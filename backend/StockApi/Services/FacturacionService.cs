using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StockApi.Data;
using StockApi.Models;

namespace StockApi.Services
{
    /// <summary>A quién se le factura. DocTipo 99 + DocNro 0 = consumidor final sin identificar.</summary>
    public record Receptor(
        int? ClienteId,
        string? Nombre,
        int DocTipo,
        long DocNro,
        int CondicionIvaId,
        string? Domicilio,
        string? Telefono)
    {
        public static Receptor ConsumidorFinal() =>
            new(null, null, TiposDocumento.SinIdentificar, 0, CondicionesIvaArca.ConsumidorFinal, null, null);
    }

    /// <summary>
    /// Emisión de Factura C (monotributo) y Nota de crédito C contra ARCA, y armado del
    /// comprobante para imprimir (ticket 80 mm / PDF).
    /// </summary>
    public class FacturacionService
    {
        /// <summary>Desde este importe hay que identificar al consumidor final (RG 5700/2025).</summary>
        public const decimal TopeConsumidorFinalSinIdentificar = 10_000_000m;

        // Un comprobante a la vez: el número se calcula como "último autorizado + 1"
        private static readonly SemaphoreSlim LockEmision = new(1, 1);

        private readonly AppDbContext _db;
        private readonly ArcaService _arca;
        private readonly ILogger<FacturacionService> _log;

        public FacturacionService(AppDbContext db, ArcaService arca, ILogger<FacturacionService> log)
        {
            _db = db;
            _arca = arca;
            _log = log;
        }

        public string Entorno => _arca.Entorno;

        /// <summary>CUIT con el que se factura (o error si no hay certificado).</summary>
        private string CuitEmisor() =>
            _arca.CuitEmisor ?? throw new ArcaException(_arca.Certificado.Error ?? "No se pudo determinar el CUIT del emisor.");

        // =====================================================================
        // Factura C
        // =====================================================================

        public async Task<Factura> FacturarVentaAsync(Venta venta, Receptor receptor, string usuario, CancellationToken ct = default)
        {
            if (venta.Anulada) throw new ArcaException("La venta está anulada.");

            var yaFacturada = await _db.Facturas.AnyAsync(f => f.VentaId == venta.Id && f.Entorno == Entorno
                && f.Tipo == TiposComprobante.FacturaC && f.Estado == EstadosComprobante.Emitida, ct);
            if (yaFacturada) throw new ArcaException("La venta ya tiene una factura emitida.");

            var total = Math.Round(venta.TotalArs, 2);
            if (total <= 0) throw new ArcaException("El total de la venta debe ser mayor a cero.");

            if (receptor.DocTipo == TiposDocumento.SinIdentificar && total >= TopeConsumidorFinalSinIdentificar)
                throw new ArcaException(
                    $"Desde $ {TopeConsumidorFinalSinIdentificar:N0} hay que identificar al cliente (DNI o CUIT).");

            var config = await ConfiguracionService.ObtenerAsync(_db);
            var cuit = CuitEmisor();
            var hoy = Hora.Hoy();

            var (numero, cae) = await PedirCaeAsync(cuit, n => new SolicitudCae(
                TiposComprobante.FacturaC, config.PuntoVenta, n, hoy,
                receptor.DocTipo, receptor.DocNro, receptor.CondicionIvaId, total), ct);

            var factura = new Factura
            {
                Entorno = Entorno,
                Tipo = TiposComprobante.FacturaC,
                PuntoVenta = config.PuntoVenta,
                Numero = numero,
                Fecha = hoy,
                Creada = Hora.Ahora(),
                Usuario = usuario,
                VentaId = venta.Id,
                Total = total,
                Cae = cae.Cae!,
                CaeVencimiento = cae.Vence ?? hoy.AddDays(10),
                Observaciones = cae.Mensaje,
            };
            CopiarReceptor(factura, receptor);
            _db.Facturas.Add(factura);

            // La venta conserva un resumen de su factura (se muestra en el listado de ventas)
            venta.FacturaEstado = EstadosFactura.Emitida;
            venta.TipoComprobante = factura.Tipo;
            venta.PuntoVenta = factura.PuntoVenta;
            venta.NumeroComprobante = factura.Numero;
            venta.Cae = factura.Cae;
            venta.CaeVencimiento = factura.CaeVencimiento;
            venta.NetoGravado = total;
            venta.ImporteIva = 0;
            venta.FacturaError = null;
            if (receptor.DocTipo != TiposDocumento.SinIdentificar)
            {
                venta.ClienteNombre = receptor.Nombre;
                venta.ClienteDocTipo = receptor.DocTipo == TiposDocumento.Dni ? "DNI" : "CUIT";
                venta.ClienteDocNro = receptor.DocNro.ToString();
            }

            await GuardarAutorizadoAsync(factura, ct);
            return factura;
        }

        // =====================================================================
        // Nota de crédito C (anulación)
        // =====================================================================

        public async Task<Factura> AnularAsync(Factura factura, string usuario, CancellationToken ct = default)
        {
            if (factura.Tipo != TiposComprobante.FacturaC) throw new ArcaException("Sólo se pueden anular facturas.");
            if (factura.Estado == EstadosComprobante.Anulada) throw new ArcaException("La factura ya está anulada.");
            if (factura.Entorno != Entorno)
                throw new ArcaException("La factura es de otro entorno de ARCA (pruebas / producción).");

            var cuit = CuitEmisor();
            var hoy = Hora.Hoy();
            var asociado = new ComprobanteAsociado(factura.Tipo, factura.PuntoVenta, factura.Numero, cuit, factura.Fecha);

            var (numero, cae) = await PedirCaeAsync(cuit, n => new SolicitudCae(
                TiposComprobante.NotaCreditoC, factura.PuntoVenta, n, hoy,
                factura.ReceptorDocTipo, factura.ReceptorDocNro, factura.ReceptorCondicionIvaId,
                factura.Total, asociado), ct);

            var nota = new Factura
            {
                Entorno = Entorno,
                Tipo = TiposComprobante.NotaCreditoC,
                PuntoVenta = factura.PuntoVenta,
                Numero = numero,
                Fecha = hoy,
                Creada = Hora.Ahora(),
                Usuario = usuario,
                VentaId = factura.VentaId,
                ClienteId = factura.ClienteId,
                ReceptorNombre = factura.ReceptorNombre,
                ReceptorDocTipo = factura.ReceptorDocTipo,
                ReceptorDocNro = factura.ReceptorDocNro,
                ReceptorCondicionIvaId = factura.ReceptorCondicionIvaId,
                ReceptorCondicionIva = factura.ReceptorCondicionIva,
                ReceptorDomicilio = factura.ReceptorDomicilio,
                ReceptorTelefono = factura.ReceptorTelefono,
                Total = factura.Total,
                Cae = cae.Cae!,
                CaeVencimiento = cae.Vence ?? hoy.AddDays(10),
                AsociadaId = factura.Id,
                Observaciones = cae.Mensaje,
            };
            _db.Facturas.Add(nota);
            factura.Estado = EstadosComprobante.Anulada;

            // La venta queda sin factura: se puede volver a facturar o anular
            var venta = await _db.Ventas.FirstOrDefaultAsync(v => v.Id == factura.VentaId, ct);
            if (venta != null)
            {
                venta.FacturaEstado = EstadosFactura.NoSolicitada;
                venta.TipoComprobante = null;
                venta.PuntoVenta = null;
                venta.NumeroComprobante = null;
                venta.Cae = null;
                venta.CaeVencimiento = null;
                venta.NetoGravado = null;
                venta.ImporteIva = null;
                venta.FacturaError = null;
            }

            await GuardarAutorizadoAsync(nota, ct);
            return nota;
        }

        /// <summary>
        /// Pide el CAE con el número siguiente al último autorizado. Si otro comprobante salió
        /// al mismo tiempo, ARCA rechaza por número no correlativo: se reintenta una vez.
        /// </summary>
        private async Task<(long numero, ResultadoCae cae)> PedirCaeAsync(
            string cuit, Func<long, SolicitudCae> armar, CancellationToken ct)
        {
            await LockEmision.WaitAsync(ct);
            try
            {
                for (var intento = 1; ; intento++)
                {
                    var plantilla = armar(0);
                    var numero = await _arca.UltimoAutorizadoAsync(_db, cuit, plantilla.PuntoVenta, plantilla.Tipo, ct) + 1;
                    var cae = await _arca.SolicitarCaeAsync(_db, cuit, armar(numero), ct);
                    if (cae.Aprobado) return (numero, cae);

                    if (intento == 1 && cae.CodigosError.Contains(ArcaService.CodigoNumeroNoCorrelativo)) continue;
                    throw new ArcaException($"ARCA rechazó el comprobante. {cae.Mensaje}", cae.CodigosError);
                }
            }
            finally
            {
                LockEmision.Release();
            }
        }

        /// <summary>
        /// El comprobante ya está autorizado en ARCA: si no se puede guardar, se deja el CAE en el
        /// registro del servidor para poder recuperarlo.
        /// </summary>
        private async Task GuardarAutorizadoAsync(Factura f, CancellationToken ct)
        {
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex,
                    "Comprobante AUTORIZADO en ARCA pero no guardado: tipo {Tipo} PV {Pv} N° {Numero} CAE {Cae} venta {Venta} total {Total}",
                    f.Tipo, f.PuntoVenta, f.Numero, f.Cae, f.VentaId, f.Total);
                throw new ArcaException(
                    $"ARCA autorizó el comprobante N° {f.PuntoVenta:00000}-{f.Numero:00000000} (CAE {f.Cae}) pero no se pudo guardar. " +
                    "Anote estos datos y avise al administrador.", inner: ex);
            }
        }

        private static void CopiarReceptor(Factura f, Receptor r)
        {
            f.ClienteId = r.ClienteId;
            f.ReceptorNombre = string.IsNullOrWhiteSpace(r.Nombre) ? null : r.Nombre.Trim();
            f.ReceptorDocTipo = r.DocTipo;
            f.ReceptorDocNro = r.DocTipo == TiposDocumento.SinIdentificar ? 0 : r.DocNro;
            f.ReceptorCondicionIvaId = r.CondicionIvaId;
            f.ReceptorCondicionIva = CondicionesIvaArca.Nombre(r.CondicionIvaId);
            f.ReceptorDomicilio = string.IsNullOrWhiteSpace(r.Domicilio) ? null : r.Domicilio.Trim();
            f.ReceptorTelefono = string.IsNullOrWhiteSpace(r.Telefono) ? null : r.Telefono.Trim();
        }

        // =====================================================================
        // Comprobante para imprimir
        // =====================================================================

        public static string NumeroFormateado(int puntoVenta, long numero) => $"{puntoVenta:00000}-{numero:00000000}";

        /// <summary>URL del QR obligatorio (RG 4892): https://www.afip.gob.ar/fe/qr/?p=base64(JSON).</summary>
        public static string UrlQr(Factura f, string cuitEmisor)
        {
            var datos = new Dictionary<string, object>
            {
                ["ver"] = 1,
                ["fecha"] = f.Fecha.ToString("yyyy-MM-dd"),
                ["cuit"] = long.Parse(cuitEmisor),
                ["ptoVta"] = f.PuntoVenta,
                ["tipoCmp"] = f.Tipo,
                ["nroCmp"] = f.Numero,
                ["importe"] = f.Total,
                ["moneda"] = "PES",
                ["ctz"] = 1,
                ["tipoDocRec"] = f.ReceptorDocTipo,
                ["nroDocRec"] = f.ReceptorDocNro,
                ["tipoCodAut"] = "E",
                ["codAut"] = long.Parse(f.Cae),
            };
            var json = JsonSerializer.Serialize(datos);
            return "https://www.afip.gob.ar/fe/qr/?p=" + Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
        }

        /// <summary>Todo lo que se imprime en el ticket / PDF de un comprobante.</summary>
        public async Task<object> ComprobanteAsync(Factura f, CancellationToken ct = default)
        {
            var config = await ConfiguracionService.ObtenerAsync(_db);
            var venta = await _db.Ventas.Include(v => v.Items).AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == f.VentaId, ct);
            var cuit = _arca.CuitEmisor ?? config.Cuit ?? "0";

            // Los importes de ARCA son en pesos: si la venta fue en dólares se convierten las líneas
            decimal Ars(decimal monto) => venta == null || venta.Moneda == Monedas.ARS
                ? monto
                : Math.Round(monto * venta.Cotizacion, 2);

            var items = (venta?.Items ?? new List<VentaItem>()).Select(i => new
            {
                descripcion = i.Descripcion,
                sku = i.Sku,
                cantidad = i.Cantidad,
                precioUnitario = Ars(i.PrecioUnitario),
                descuento = Ars(i.Descuento),
                subtotal = Ars(i.Subtotal),
            }).ToList();
            var descuentoGeneral = Math.Round(items.Sum(i => i.subtotal) - f.Total, 2);

            Factura? asociada = f.AsociadaId == null ? null
                : await _db.Facturas.AsNoTracking().FirstOrDefaultAsync(x => x.Id == f.AsociadaId, ct);
            Factura? notaCredito = f.Tipo != TiposComprobante.FacturaC ? null
                : await _db.Facturas.AsNoTracking().FirstOrDefaultAsync(x => x.AsociadaId == f.Id, ct);

            return new
            {
                id = f.Id,
                tipo = f.Tipo,
                tipoNombre = TiposComprobante.Nombre(f.Tipo),
                letra = "C",
                codigo = f.Tipo.ToString("000"),
                puntoVenta = f.PuntoVenta,
                numero = f.Numero,
                numeroFormateado = NumeroFormateado(f.PuntoVenta, f.Numero),
                fecha = f.Fecha,
                estado = f.Estado,
                entorno = f.Entorno,
                esPrueba = f.Entorno != EntornosArca.Produccion,
                ventaId = f.VentaId,
                medioPago = venta?.MedioPago,
                emisor = new
                {
                    razonSocial = config.RazonSocial,
                    cuit = Documentos.FormatearCuit(cuit),
                    domicilio = config.DomicilioComercial,
                    ingresosBrutos = config.IngresosBrutos,
                    inicioActividades = config.InicioActividades,
                    condicionIva = "Responsable Monotributo",
                    mensajePie = config.MensajePie,
                },
                receptor = new
                {
                    nombre = f.ReceptorNombre,
                    docTipo = f.ReceptorDocTipo,
                    docTipoNombre = TiposDocumento.Nombre(f.ReceptorDocTipo),
                    docNro = f.ReceptorDocTipo == TiposDocumento.SinIdentificar ? null
                        : f.ReceptorDocTipo == TiposDocumento.Dni ? f.ReceptorDocNro.ToString() : Documentos.FormatearCuit(f.ReceptorDocNro.ToString()),
                    condicionIva = f.ReceptorCondicionIva ?? CondicionesIvaArca.Nombre(f.ReceptorCondicionIvaId),
                    domicilio = f.ReceptorDomicilio,
                    telefono = f.ReceptorTelefono,
                },
                items,
                descuentoGeneral = descuentoGeneral >= 0.01m ? descuentoGeneral : 0,
                total = f.Total,
                cae = f.Cae,
                caeVencimiento = f.CaeVencimiento,
                qrUrl = UrlQr(f, Documentos.SoloDigitos(cuit).PadLeft(11, '0')),
                asociada = asociada == null ? null : new
                {
                    id = asociada.Id,
                    tipoNombre = TiposComprobante.Nombre(asociada.Tipo),
                    numeroFormateado = NumeroFormateado(asociada.PuntoVenta, asociada.Numero),
                    fecha = asociada.Fecha,
                },
                notaCredito = notaCredito == null ? null : new
                {
                    id = notaCredito.Id,
                    numeroFormateado = NumeroFormateado(notaCredito.PuntoVenta, notaCredito.Numero),
                },
            };
        }
    }
}
