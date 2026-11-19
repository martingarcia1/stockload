using System.Globalization;
using System.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using StockApi.Data;
using StockApi.Models;

namespace StockApi.Services
{
    /// <summary>Error de ARCA con un mensaje entendible para mostrar en pantalla.</summary>
    public class ArcaException : Exception
    {
        public IReadOnlyList<int> Codigos { get; }

        public ArcaException(string mensaje, IReadOnlyList<int>? codigos = null, Exception? inner = null)
            : base(mensaje, inner)
        {
            Codigos = codigos ?? Array.Empty<int>();
        }
    }

    public record CertificadoInfo(bool Cargado, string? Cuit, DateTime? Vence, string? Emisor, string? Error);

    public record ComprobanteAsociado(int Tipo, int PuntoVenta, long Numero, string Cuit, DateTime Fecha);

    public record SolicitudCae(
        int Tipo,
        int PuntoVenta,
        long Numero,
        DateTime Fecha,
        int DocTipo,
        long DocNro,
        int CondicionIvaId,
        decimal Total,
        ComprobanteAsociado? Asociado = null);

    public record ResultadoCae(
        bool Aprobado,
        string? Cae,
        DateTime? Vence,
        string? Mensaje,
        IReadOnlyList<int> CodigosError);

    /// <summary>
    /// Conexión con los web services de ARCA:
    ///  - WSAA (LoginCms): pedido de acceso firmado con el certificado → token + sign por 12 horas.
    ///  - WSFEv1: último número autorizado, pedido de CAE, condiciones frente al IVA.
    ///
    /// Configuración (appsettings.Local.json o variables de entorno):
    ///   Arca:Entorno  homologacion | produccion  (por defecto homologacion)
    ///   Arca:Cert / Arca:Key  texto PEM completo (en Docker). Si están vacíos se leen los
    ///   archivos *.crt y *.key de la carpeta arca/&lt;entorno&gt;/ del backend.
    ///   Arca:Cuit     opcional: si no se indica, se toma del certificado.
    /// </summary>
    public class ArcaService
    {
        public const int CodigoNumeroNoCorrelativo = 10016;

        private const string NsWsfe = "http://ar.gov.afip.dif.FEV1/";
        private static readonly SemaphoreSlim LockAcceso = new(1, 1);

        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _http;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<ArcaService> _log;
        private readonly object _lockCert = new();
        private (X509Certificate2? cert, CertificadoInfo info)? _cert;

        public ArcaService(IConfiguration config, IHttpClientFactory http, IWebHostEnvironment env, ILogger<ArcaService> log)
        {
            _config = config;
            _http = http;
            _env = env;
            _log = log;
            var entorno = (config["Arca:Entorno"] ?? EntornosArca.Homologacion).Trim().ToLowerInvariant();
            Entorno = entorno.StartsWith("prod") ? EntornosArca.Produccion : EntornosArca.Homologacion;
        }

        public string Entorno { get; }
        public bool EsProduccion => Entorno == EntornosArca.Produccion;

        private string UrlWsaa => EsProduccion
            ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
            : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

        private string UrlWsfe => EsProduccion
            ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
            : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";

        // =====================================================================
        // Certificado
        // =====================================================================

        public CertificadoInfo Certificado => CargarCertificado().info;

        /// <summary>CUIT del emisor: el de la configuración del servidor o el del certificado.</summary>
        public string? CuitEmisor
        {
            get
            {
                var cfg = Documentos.SoloDigitos(_config["Arca:Cuit"]);
                return cfg.Length == 11 ? cfg : Certificado.Cuit;
            }
        }

        private (X509Certificate2? cert, CertificadoInfo info) CargarCertificado()
        {
            lock (_lockCert)
            {
                if (_cert.HasValue) return _cert.Value;
                _cert = LeerCertificado();
                return _cert.Value;
            }
        }

        private (X509Certificate2? cert, CertificadoInfo info) LeerCertificado()
        {
            string? certPem = Pem(_config["Arca:Cert"]);
            string? keyPem = Pem(_config["Arca:Key"]);

            if (certPem == null || keyPem == null)
            {
                var carpeta = Path.Combine(_env.ContentRootPath, _config["Arca:Carpeta"] ?? "arca", Entorno);
                if (!Directory.Exists(carpeta))
                    return (null, new CertificadoInfo(false, null, null, null,
                        $"No hay certificado de ARCA. Copie el .crt y el .key en la carpeta arca/{Entorno}/ del backend."));

                certPem ??= Directory.GetFiles(carpeta, "*.crt").Concat(Directory.GetFiles(carpeta, "*.pem"))
                    .Select(File.ReadAllText).FirstOrDefault(t => t.Contains("BEGIN CERTIFICATE"));
                keyPem ??= Directory.GetFiles(carpeta, "*.key").Concat(Directory.GetFiles(carpeta, "*.pem"))
                    .Select(File.ReadAllText).FirstOrDefault(t => t.Contains("PRIVATE KEY"));

                if (certPem == null || keyPem == null)
                    return (null, new CertificadoInfo(false, null, null, null,
                        $"Falta el {(certPem == null ? "certificado (.crt)" : "archivo de la clave (.key)")} en arca/{Entorno}/."));
            }

            try
            {
                using var temporal = X509Certificate2.CreateFromPem(certPem, keyPem);
                // En Windows la clave importada desde PEM es efímera y no sirve para firmar CMS:
                // se re-importa como PKCS#12 (funciona igual en Linux).
                var cert = X509CertificateLoader.LoadPkcs12(temporal.Export(X509ContentType.Pkcs12), null);

                var cuit = Regex.Match(cert.Subject, @"CUIT\s*(\d{11})").Groups[1].Value;
                var esDePrueba = cert.Issuer.Contains("Computadores Test", StringComparison.OrdinalIgnoreCase);
                var vence = cert.NotAfter;

                string? error = null;
                if (esDePrueba && EsProduccion)
                    error = "El certificado es de pruebas (homologación) pero el entorno es producción.";
                else if (!esDePrueba && !EsProduccion)
                    error = "El certificado es de producción pero el entorno es homologación (pruebas). ARCA responderá \"Certificado no emitido por AC de confianza\".";
                else if (vence < DateTime.Now)
                    error = $"El certificado venció el {vence:dd/MM/yyyy}.";

                return (error == null ? cert : null,
                    new CertificadoInfo(error == null, string.IsNullOrEmpty(cuit) ? null : cuit, vence, cert.Issuer, error));
            }
            catch (Exception ex) when (ex is CryptographicException or ArgumentException)
            {
                _log.LogWarning(ex, "No se pudo leer el certificado de ARCA");
                return (null, new CertificadoInfo(false, null, null, null,
                    "No se pudo leer el certificado o la clave (¿la clave corresponde al certificado?). " + ex.Message));
            }
        }

        /// <summary>En variables de entorno el PEM suele venir en una línea con "\n" escritos.</summary>
        private static string? Pem(string? valor) =>
            string.IsNullOrWhiteSpace(valor) ? null : valor.Replace("\\n", "\n").Trim();

        private X509Certificate2 CertificadoObligatorio()
        {
            var (cert, info) = CargarCertificado();
            return cert ?? throw new ArcaException(info.Error ?? "Certificado de ARCA no disponible.");
        }

        // =====================================================================
        // WSAA: permiso de acceso
        // =====================================================================

        /// <summary>Token y sign vigentes para wsfe. Se reutilizan hasta 10 minutos antes de vencer.</summary>
        public async Task<(string token, string sign)> AccesoAsync(AppDbContext db, CancellationToken ct = default)
        {
            var clave = $"{Entorno}_wsfe";
            await LockAcceso.WaitAsync(ct);
            try
            {
                var ticket = await db.ArcaTickets.FirstOrDefaultAsync(t => t.Clave == clave, ct);
                if (ticket != null && ticket.Expira > DateTime.UtcNow.AddMinutes(10))
                    return (ticket.Token, ticket.Sign);

                var (token, sign, expira) = await PedirAccesoAsync(ct);
                if (ticket == null)
                {
                    ticket = new ArcaTicket { Clave = clave };
                    db.ArcaTickets.Add(ticket);
                }
                ticket.Token = token;
                ticket.Sign = sign;
                ticket.Expira = expira;
                await db.SaveChangesAsync(ct);
                return (token, sign);
            }
            finally
            {
                LockAcceso.Release();
            }
        }

        private async Task<(string token, string sign, DateTime expiraUtc)> PedirAccesoAsync(CancellationToken ct)
        {
            var cert = CertificadoObligatorio();
            var ahora = DateTimeOffset.UtcNow;
            string Iso(DateTimeOffset d) => d.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);

            var tra = $"""
                <?xml version="1.0" encoding="UTF-8"?>
                <loginTicketRequest version="1.0">
                  <header>
                    <uniqueId>{ahora.ToUnixTimeSeconds()}</uniqueId>
                    <generationTime>{Iso(ahora.AddMinutes(-10))}</generationTime>
                    <expirationTime>{Iso(ahora.AddMinutes(10))}</expirationTime>
                  </header>
                  <service>wsfe</service>
                </loginTicketRequest>
                """;

            var cms = new SignedCms(new ContentInfo(Encoding.UTF8.GetBytes(tra)));
            var firmante = new CmsSigner(SubjectIdentifierType.IssuerAndSerialNumber, cert)
            {
                IncludeOption = X509IncludeOption.EndCertOnly,
                DigestAlgorithm = new Oid("2.16.840.1.101.3.4.2.1"), // SHA-256
            };
            firmante.SignedAttributes.Add(new Pkcs9SigningTime(DateTime.Now));
            cms.ComputeSignature(firmante);
            var firmado = Convert.ToBase64String(cms.Encode());

            var sobre = $"""
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
                  <soapenv:Header/>
                  <soapenv:Body><wsaa:loginCms><wsaa:in0>{firmado}</wsaa:in0></wsaa:loginCms></soapenv:Body>
                </soapenv:Envelope>
                """;

            var respuesta = await EnviarAsync(UrlWsaa, "", sobre, ct);
            var falla = Buscar(respuesta, "faultstring")?.Value;
            if (falla != null)
            {
                if (falla.Contains("TA valido", StringComparison.OrdinalIgnoreCase))
                    throw new ArcaException(
                        "ARCA ya entregó un permiso de acceso que todavía está vigente y no quedó guardado en esta base " +
                        "(¿se probó desde otra computadora con otra base?). Vuelva a intentar cuando venza (hasta 12 horas).");
                throw new ArcaException($"ARCA rechazó el acceso: {falla}");
            }

            var ticketXml = Buscar(respuesta, "loginCmsReturn")?.Value
                ?? throw new ArcaException("Respuesta inesperada del servicio de acceso de ARCA.");
            var ticket = XDocument.Parse(ticketXml);
            var token = Buscar(ticket, "token")?.Value;
            var sign = Buscar(ticket, "sign")?.Value;
            var expira = Buscar(ticket, "expirationTime")?.Value;
            if (token == null || sign == null || expira == null)
                throw new ArcaException("El permiso de acceso de ARCA vino incompleto.");

            return (token, sign, DateTimeOffset.Parse(expira, CultureInfo.InvariantCulture).UtcDateTime);
        }

        // =====================================================================
        // WSFEv1
        // =====================================================================

        /// <summary>Estado de los servidores de ARCA (no necesita permiso).</summary>
        public async Task<(bool ok, string detalle)> DummyAsync(CancellationToken ct = default)
        {
            var r = await LlamarWsfeAsync("FEDummy", "", ct);
            string V(string n) => Buscar(r, n)?.Value ?? "?";
            var (app, db, auth) = (V("AppServer"), V("DbServer"), V("AuthServer"));
            return (app == "OK" && db == "OK" && auth == "OK", $"app {app} · base {db} · acceso {auth}");
        }

        public async Task<long> UltimoAutorizadoAsync(AppDbContext db, string cuit, int puntoVenta, int tipo, CancellationToken ct = default)
        {
            var auth = await AuthXmlAsync(db, cuit, ct);
            var r = await LlamarWsfeAsync("FECompUltimoAutorizado",
                $"{auth}<PtoVta>{puntoVenta}</PtoVta><CbteTipo>{tipo}</CbteTipo>", ct);
            LanzarSiHayErrores(r, "No se pudo consultar el último comprobante");
            return long.TryParse(Buscar(r, "CbteNro")?.Value, out var n) ? n : 0;
        }

        public async Task<List<(int Id, string Nombre)>> CondicionesIvaAsync(AppDbContext db, string cuit, CancellationToken ct = default)
        {
            var auth = await AuthXmlAsync(db, cuit, ct);
            var r = await LlamarWsfeAsync("FEParamGetCondicionIvaReceptor", $"{auth}<ClaseCmp>C</ClaseCmp>", ct);
            LanzarSiHayErrores(r, "No se pudieron obtener las condiciones frente al IVA");
            return r.Descendants().Where(e => e.Name.LocalName == "CondicionIvaReceptor")
                .Select(e => (
                    Id: int.TryParse(Hijo(e, "Id"), out var id) ? id : 0,
                    Nombre: Hijo(e, "Desc") ?? ""))
                .Where(c => c.Id > 0)
                .ToList();
        }

        public async Task<ResultadoCae> SolicitarCaeAsync(AppDbContext db, string cuit, SolicitudCae s, CancellationToken ct = default)
        {
            var auth = await AuthXmlAsync(db, cuit, ct);
            string Importe(decimal d) => d.ToString("0.00", CultureInfo.InvariantCulture);
            var fecha = s.Fecha.ToString("yyyyMMdd", CultureInfo.InvariantCulture);

            var asociado = s.Asociado == null ? "" : $"""
                <CbtesAsoc><CbteAsoc>
                  <Tipo>{s.Asociado.Tipo}</Tipo><PtoVta>{s.Asociado.PuntoVenta}</PtoVta><Nro>{s.Asociado.Numero}</Nro>
                  <Cuit>{s.Asociado.Cuit}</Cuit><CbteFch>{s.Asociado.Fecha:yyyyMMdd}</CbteFch>
                </CbteAsoc></CbtesAsoc>
                """;

            // Factura C: el neto es el total y no se informa IVA. Concepto 1 = productos.
            var cuerpo = $"""
                {auth}
                <FeCAEReq>
                  <FeCabReq><CantReg>1</CantReg><PtoVta>{s.PuntoVenta}</PtoVta><CbteTipo>{s.Tipo}</CbteTipo></FeCabReq>
                  <FeDetReq><FECAEDetRequest>
                    <Concepto>1</Concepto>
                    <DocTipo>{s.DocTipo}</DocTipo><DocNro>{s.DocNro}</DocNro>
                    <CbteDesde>{s.Numero}</CbteDesde><CbteHasta>{s.Numero}</CbteHasta>
                    <CbteFch>{fecha}</CbteFch>
                    <ImpTotal>{Importe(s.Total)}</ImpTotal><ImpTotConc>0</ImpTotConc><ImpNeto>{Importe(s.Total)}</ImpNeto>
                    <ImpOpEx>0</ImpOpEx><ImpTrib>0</ImpTrib><ImpIVA>0</ImpIVA>
                    <MonId>PES</MonId><MonCotiz>1</MonCotiz>
                    <CondicionIVAReceptorId>{s.CondicionIvaId}</CondicionIVAReceptorId>
                    {asociado}
                  </FECAEDetRequest></FeDetReq>
                </FeCAEReq>
                """;

            var r = await LlamarWsfeAsync("FECAESolicitar", cuerpo, ct);

            var det = r.Descendants().FirstOrDefault(e => e.Name.LocalName == "FECAEDetResponse");
            var cae = det == null ? null : Hijo(det, "CAE");
            var resultado = det == null ? null : Hijo(det, "Resultado");
            var mensajes = Mensajes(r);

            if (resultado == "A" && !string.IsNullOrWhiteSpace(cae))
            {
                DateTime? vence = DateTime.TryParseExact(Hijo(det!, "CAEFchVto"), "yyyyMMdd",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var v) ? v : null;
                return new ResultadoCae(true, cae, vence, mensajes.texto, Array.Empty<int>());
            }

            return new ResultadoCae(false, null, null,
                string.IsNullOrEmpty(mensajes.texto) ? "ARCA rechazó el comprobante sin indicar el motivo." : mensajes.texto,
                mensajes.codigos);
        }

        // =====================================================================
        // Utilidades SOAP
        // =====================================================================

        private async Task<string> AuthXmlAsync(AppDbContext db, string cuit, CancellationToken ct)
        {
            var (token, sign) = await AccesoAsync(db, ct);
            return $"<Auth><Token>{SecurityElement.Escape(token)}</Token><Sign>{SecurityElement.Escape(sign)}</Sign><Cuit>{cuit}</Cuit></Auth>";
        }

        private async Task<XDocument> LlamarWsfeAsync(string metodo, string cuerpo, CancellationToken ct)
        {
            var sobre = $"""
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Body><{metodo} xmlns="{NsWsfe}">{cuerpo}</{metodo}></soap:Body>
                </soap:Envelope>
                """;
            var r = await EnviarAsync(UrlWsfe, NsWsfe + metodo, sobre, ct);
            var falla = Buscar(r, "faultstring")?.Value;
            if (falla != null) throw new ArcaException($"Error del servicio de facturación de ARCA: {falla}");
            return r;
        }

        private async Task<XDocument> EnviarAsync(string url, string soapAction, string sobre, CancellationToken ct)
        {
            var cliente = _http.CreateClient("arca");
            using var pedido = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(sobre, Encoding.UTF8, "text/xml")
            };
            pedido.Headers.TryAddWithoutValidation("SOAPAction", $"\"{soapAction}\"");

            HttpResponseMessage respuesta;
            try { respuesta = await cliente.SendAsync(pedido, ct); }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                throw new ArcaException("No se pudo conectar con ARCA. Revise la conexión a internet o intente en unos minutos.", inner: ex);
            }

            var texto = await respuesta.Content.ReadAsStringAsync(ct);
            try { return XDocument.Parse(texto); }
            catch (System.Xml.XmlException)
            {
                _log.LogWarning("Respuesta no XML de ARCA ({Status}): {Texto}", (int)respuesta.StatusCode, texto.Length > 500 ? texto[..500] : texto);
                throw new ArcaException($"ARCA respondió con un error ({(int)respuesta.StatusCode}). Intente en unos minutos.");
            }
        }

        private static XElement? Buscar(XContainer doc, string nombre) =>
            doc.Descendants().FirstOrDefault(e => e.Name.LocalName == nombre);

        private static string? Hijo(XElement e, string nombre) =>
            e.Elements().FirstOrDefault(x => x.Name.LocalName == nombre)?.Value;

        /// <summary>Errors/Err y Observaciones/Obs de una respuesta de WSFEv1.</summary>
        private static (string texto, List<int> codigos) Mensajes(XDocument r)
        {
            var codigos = new List<int>();
            var textos = new List<string>();
            foreach (var e in r.Descendants().Where(e => e.Name.LocalName is "Err" or "Obs"))
            {
                var code = Hijo(e, "Code");
                var msg = Hijo(e, "Msg");
                if (e.Name.LocalName == "Err" && int.TryParse(code, out var c)) codigos.Add(c);
                textos.Add($"{(e.Name.LocalName == "Obs" ? "Obs." : "Error")} {code}: {msg}");
            }
            return (string.Join(" · ", textos), codigos);
        }

        private static void LanzarSiHayErrores(XDocument r, string contexto)
        {
            var errores = r.Descendants().Where(e => e.Name.LocalName == "Err").ToList();
            if (errores.Count == 0) return;
            var (texto, codigos) = Mensajes(r);
            throw new ArcaException($"{contexto}. {texto}", codigos);
        }
    }
}
