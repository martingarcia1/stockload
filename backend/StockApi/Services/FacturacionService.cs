using StockApi.Models;

namespace StockApi.Services
{
    /// <summary>Datos calculados del comprobante antes de enviarlo a ARCA.</summary>
    public record DatosComprobante(
        int TipoComprobante,     // 1 = A, 6 = B, 11 = C
        string Letra,
        int PuntoVenta,
        int DocTipo,             // 80 = CUIT, 96 = DNI, 99 = Consumidor Final sin identificar
        long DocNro,
        decimal ImporteTotal,    // En pesos
        decimal NetoGravado,
        decimal ImporteIva,
        decimal AlicuotaIva);

    public record ResultadoFacturacion(
        bool Exito,
        string Estado,           // EstadosFactura.*
        long? Numero = null,
        string? Cae = null,
        DateTime? CaeVencimiento = null,
        string? Error = null);

    /// <summary>
    /// Punto de integración con ARCA (ex AFIP). La implementación real debe:
    ///   1. Autenticarse en WSAA con el certificado + clave privada del CUIT (ticket de acceso, dura 12 h).
    ///   2. Consultar FECompUltimoAutorizado para obtener el próximo número.
    ///   3. Llamar FECAESolicitar (WSFEv1) con los datos de <see cref="DatosComprobante"/>.
    /// </summary>
    public interface IFacturacionService
    {
        Task<ResultadoFacturacion> EmitirAsync(DatosComprobante datos, Configuracion config);
    }

    /// <summary>
    /// Implementación provisoria: la conexión con ARCA todavía no está configurada,
    /// por lo que las facturas quedan en estado "Pendiente" para emitirse cuando se habilite.
    /// Reemplazar por la implementación WSAA/WSFEv1 en Program.cs cuando se tenga el certificado.
    /// </summary>
    public class FacturacionNoConfiguradaService : IFacturacionService
    {
        public Task<ResultadoFacturacion> EmitirAsync(DatosComprobante datos, Configuracion config)
        {
            return Task.FromResult(new ResultadoFacturacion(
                false,
                EstadosFactura.Pendiente,
                Error: "La conexión con ARCA aún no está configurada. El comprobante quedó pendiente de emisión."));
        }
    }

    /// <summary>Reglas fiscales para armar el comprobante según la condición del emisor y del cliente.</summary>
    public static class ReglasFiscales
    {
        public const int FacturaA = 1;
        public const int FacturaB = 6;
        public const int FacturaC = 11;

        public static string Letra(int? tipo) => tipo switch
        {
            FacturaA => "A",
            FacturaB => "B",
            FacturaC => "C",
            _ => "-"
        };

        /// <summary>
        /// Arma el comprobante y valida los datos. Devuelve un mensaje de error si la venta no puede facturarse así.
        /// - Emisor Monotributo / Exento: siempre Factura C, sin discriminar IVA.
        /// - Emisor Responsable Inscripto: Factura A si el cliente es RI (o Monotributo, que también recibe A),
        ///   Factura B para consumidor final y exentos. El IVA se calcula "hacia adentro" del precio final.
        /// </summary>
        public static (DatosComprobante? datos, string? error) ArmarComprobante(Venta venta, Configuracion config)
        {
            var total = Math.Round(venta.TotalArs, 2);

            long docNro = 0;
            int docTipo = 99;
            var docLimpio = new string((venta.ClienteDocNro ?? "").Where(char.IsDigit).ToArray());
            if (!string.IsNullOrEmpty(docLimpio))
            {
                docTipo = venta.ClienteDocTipo == "CUIT" ? 80 : 96;
                long.TryParse(docLimpio, out docNro);
            }

            bool emisorRI = config.CondicionFiscal == CondicionesIva.ResponsableInscripto;

            if (!emisorRI)
            {
                return (new DatosComprobante(FacturaC, "C", config.PuntoVenta, docTipo, docNro, total, total, 0, 0), null);
            }

            bool clienteRecibeA = venta.ClienteCondicionIva == CondicionesIva.ResponsableInscripto
                               || venta.ClienteCondicionIva == CondicionesIva.Monotributo;

            if (clienteRecibeA)
            {
                if (docTipo != 80 || docLimpio.Length != 11)
                {
                    return (null, "Para emitir Factura A se requiere el CUIT del cliente (11 dígitos).");
                }
            }

            var alicuota = config.AlicuotaIva;
            var neto = Math.Round(total / (1 + alicuota / 100m), 2);
            var iva = total - neto;

            var tipo = clienteRecibeA ? FacturaA : FacturaB;
            return (new DatosComprobante(tipo, Letra(tipo), config.PuntoVenta, docTipo, docNro, total, neto, iva, alicuota), null);
        }

        /// <summary>Aplica el comprobante calculado y el resultado de ARCA a la venta.</summary>
        public static void Aplicar(Venta venta, DatosComprobante datos, ResultadoFacturacion resultado)
        {
            venta.TipoComprobante = datos.TipoComprobante;
            venta.PuntoVenta = datos.PuntoVenta;
            venta.NetoGravado = datos.NetoGravado;
            venta.ImporteIva = datos.ImporteIva;
            venta.FacturaEstado = resultado.Estado;
            venta.FacturaError = resultado.Error;
            if (resultado.Exito)
            {
                venta.NumeroComprobante = resultado.Numero;
                venta.Cae = resultado.Cae;
                venta.CaeVencimiento = resultado.CaeVencimiento;
            }
        }
    }
}
