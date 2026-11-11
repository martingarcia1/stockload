using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockApi.Models
{
    /// <summary>
    /// Turno de caja: desde la apertura (con fondo inicial) hasta el cierre (con arqueo final).
    /// Se maneja el efectivo en pesos y en dólares por separado.
    /// </summary>
    [Table("CajaSesiones")]
    public class CajaSesion
    {
        [Key]
        public int Id { get; set; }

        public DateTime FechaApertura { get; set; }

        [MaxLength(100)]
        public string UsuarioApertura { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal FondoInicialArs { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal FondoInicialUsd { get; set; }

        public bool Abierta { get; set; } = true;

        public DateTime? FechaCierre { get; set; }

        [MaxLength(100)]
        public string? UsuarioCierre { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? EsperadoArs { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? EsperadoUsd { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ContadoArs { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ContadoUsd { get; set; }

        [MaxLength(500)]
        public string? ObservacionesCierre { get; set; }

        public List<MovimientoCaja> Movimientos { get; set; } = new();
        public List<Arqueo> Arqueos { get; set; } = new();
    }

    public static class TiposMovimiento
    {
        /// <summary>Entrada de efectivo que no es venta (ej. cambio que trae el dueño).</summary>
        public const string Ingreso = "Ingreso";
        /// <summary>Salida de efectivo por gastos (ej. limpieza, delivery).</summary>
        public const string Gasto = "Gasto";
        /// <summary>Entrega de efectivo al propietario/administradora (rendición de caja).</summary>
        public const string Rendicion = "Rendicion";

        public static readonly string[] Todos = { Ingreso, Gasto, Rendicion };
        public static bool EsSalida(string tipo) => tipo == Gasto || tipo == Rendicion;
    }

    [Table("MovimientosCaja")]
    public class MovimientoCaja
    {
        [Key]
        public int Id { get; set; }

        public int CajaSesionId { get; set; }

        [System.Text.Json.Serialization.JsonIgnore]
        [ForeignKey(nameof(CajaSesionId))]
        public CajaSesion? CajaSesion { get; set; }

        public DateTime Fecha { get; set; }

        [MaxLength(20)]
        public string Tipo { get; set; } = TiposMovimiento.Ingreso;

        [MaxLength(3)]
        public string Moneda { get; set; } = Monedas.ARS;

        /// <summary>Siempre positivo; el signo lo determina el Tipo.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal Monto { get; set; }

        [MaxLength(250)]
        public string Concepto { get; set; } = string.Empty;

        /// <summary>Para rendiciones: quién recibió el dinero.</summary>
        [MaxLength(100)]
        public string? RecibidoPor { get; set; }

        [MaxLength(100)]
        public string Usuario { get; set; } = string.Empty;
    }

    /// <summary>
    /// Conteo físico del efectivo comparado con lo que el sistema espera.
    /// Puede hacerse en cualquier momento (parcial) y siempre se hace uno al cerrar la caja.
    /// </summary>
    [Table("Arqueos")]
    public class Arqueo
    {
        [Key]
        public int Id { get; set; }

        public int CajaSesionId { get; set; }

        [System.Text.Json.Serialization.JsonIgnore]
        [ForeignKey(nameof(CajaSesionId))]
        public CajaSesion? CajaSesion { get; set; }

        public DateTime Fecha { get; set; }

        public bool EsCierre { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal EsperadoArs { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal EsperadoUsd { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ContadoArs { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ContadoUsd { get; set; }

        [NotMapped]
        public decimal DiferenciaArs => ContadoArs - EsperadoArs;

        [NotMapped]
        public decimal DiferenciaUsd => ContadoUsd - EsperadoUsd;

        [MaxLength(500)]
        public string? Observaciones { get; set; }

        [MaxLength(100)]
        public string Usuario { get; set; } = string.Empty;
    }
}
