using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockApi.Models
{
    /// <summary>
    /// Configuración general del negocio (fila única, Id = 1).
    /// Contiene los datos fiscales para ARCA y la configuración de cotización del dólar.
    /// </summary>
    [Table("Configuracion")]
    public class Configuracion
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public int Id { get; set; } = 1;

        // ---------- Datos fiscales / ARCA ----------
        [MaxLength(150)]
        public string? RazonSocial { get; set; }

        [MaxLength(11)]
        public string? Cuit { get; set; }

        [MaxLength(250)]
        public string? DomicilioComercial { get; set; }

        /// <summary>ResponsableInscripto | Monotributo | Exento</summary>
        [MaxLength(30)]
        public string CondicionFiscal { get; set; } = CondicionesIva.ResponsableInscripto;

        public DateTime? InicioActividades { get; set; }

        [MaxLength(30)]
        public string? IngresosBrutos { get; set; }

        /// <summary>Punto de venta habilitado en ARCA como "Web Service".</summary>
        public int PuntoVenta { get; set; } = 1;

        /// <summary>Homologacion | Produccion</summary>
        [MaxLength(20)]
        public string ArcaAmbiente { get; set; } = "Homologacion";

        /// <summary>Si es false, las ventas a facturar quedan en estado Pendiente.</summary>
        public bool ArcaHabilitado { get; set; } = false;

        [Column(TypeName = "decimal(5,2)")]
        public decimal AlicuotaIva { get; set; } = 21m;

        /// <summary>Si es true, toda venta nueva se marca para facturar por defecto.</summary>
        public bool FacturarPorDefecto { get; set; } = true;

        /// <summary>Texto al pie del ticket de la factura (ej. "¡Gracias por su compra!").</summary>
        [MaxLength(250)]
        public string? MensajePie { get; set; }

        // ---------- Cotización del dólar ----------
        /// <summary>oficial | blue | bolsa | contadoconliqui | tarjeta | mayorista (endpoints de dolarapi.com)</summary>
        [MaxLength(30)]
        public string TipoDolar { get; set; } = "blue";

        /// <summary>Si es true, se usa CotizacionManual en lugar de la automática.</summary>
        public bool UsarCotizacionManual { get; set; } = false;

        [Column(TypeName = "decimal(18,2)")]
        public decimal? CotizacionManual { get; set; }

        /// <summary>Última cotización automática obtenida (respaldo si la API externa no responde).</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? UltimaCotizacion { get; set; }

        public DateTime? UltimaCotizacionFecha { get; set; }
    }
}
