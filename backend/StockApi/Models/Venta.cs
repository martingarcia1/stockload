using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockApi.Models
{
    /// <summary>
    /// Venta realizada en el local. Todos los importes (Subtotal, Descuento, Total) están expresados
    /// en la moneda de cobro (<see cref="Moneda"/>). <see cref="TotalArs"/> guarda el equivalente en pesos
    /// con la cotización del momento, que es el importe que se informa a ARCA.
    /// </summary>
    [Table("Ventas")]
    public class Venta
    {
        [Key]
        public int Id { get; set; }

        public DateTime Fecha { get; set; }

        [MaxLength(100)]
        public string Usuario { get; set; } = string.Empty;

        public int? CajaSesionId { get; set; }

        [ForeignKey(nameof(CajaSesionId))]
        public CajaSesion? CajaSesion { get; set; }

        // ---------- Cliente ----------
        [MaxLength(150)]
        public string? ClienteNombre { get; set; }

        /// <summary>CUIT | DNI | (vacío = consumidor final sin identificar)</summary>
        [MaxLength(10)]
        public string? ClienteDocTipo { get; set; }

        [MaxLength(20)]
        public string? ClienteDocNro { get; set; }

        [MaxLength(30)]
        public string ClienteCondicionIva { get; set; } = CondicionesIva.ConsumidorFinal;

        // ---------- Importes ----------
        /// <summary>Moneda en la que paga el cliente (ARS | USD).</summary>
        [MaxLength(3)]
        public string Moneda { get; set; } = Monedas.ARS;

        /// <summary>Pesos por dólar al momento de la venta.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal Cotizacion { get; set; }

        [MaxLength(30)]
        public string MedioPago { get; set; } = MediosPago.Efectivo;

        /// <summary>Suma de precios de lista (sin descuentos), en la moneda de cobro.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal Subtotal { get; set; }

        /// <summary>Suma de descuentos de las líneas + descuento general, en la moneda de cobro.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal Descuento { get; set; }

        /// <summary>Descuento aplicado sobre el total de la venta (además de los de cada línea).</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal DescuentoGeneral { get; set; }

        [MaxLength(250)]
        public string? DescuentoMotivo { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalArs { get; set; }

        [MaxLength(500)]
        public string? Observaciones { get; set; }

        // ---------- Estado ----------
        public bool Anulada { get; set; }
        public DateTime? FechaAnulacion { get; set; }

        [MaxLength(100)]
        public string? UsuarioAnulacion { get; set; }

        [MaxLength(250)]
        public string? MotivoAnulacion { get; set; }

        // ---------- Facturación ARCA ----------
        [MaxLength(20)]
        public string FacturaEstado { get; set; } = EstadosFactura.NoSolicitada;

        /// <summary>Código ARCA: 1 = Factura A, 6 = Factura B, 11 = Factura C.</summary>
        public int? TipoComprobante { get; set; }

        public int? PuntoVenta { get; set; }
        public long? NumeroComprobante { get; set; }

        [MaxLength(20)]
        public string? Cae { get; set; }

        public DateTime? CaeVencimiento { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? NetoGravado { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ImporteIva { get; set; }

        [MaxLength(1000)]
        public string? FacturaError { get; set; }

        public List<VentaItem> Items { get; set; } = new();
    }

    [Table("VentaItems")]
    public class VentaItem
    {
        [Key]
        public int Id { get; set; }

        public int VentaId { get; set; }

        [System.Text.Json.Serialization.JsonIgnore]
        [ForeignKey(nameof(VentaId))]
        public Venta? Venta { get; set; }

        public int ItemId { get; set; }

        [ForeignKey(nameof(ItemId))]
        public Item? Item { get; set; }

        [MaxLength(300)]
        public string? Descripcion { get; set; }

        [MaxLength(100)]
        public string? Sku { get; set; }

        public int Cantidad { get; set; }

        /// <summary>Precio de lista del producto en su moneda original.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal PrecioLista { get; set; }

        [MaxLength(3)]
        public string MonedaLista { get; set; } = Monedas.ARS;

        /// <summary>Precio unitario de lista convertido a la moneda de cobro.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal PrecioUnitario { get; set; }

        /// <summary>Descuento total de la línea (no unitario), en la moneda de cobro.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal Descuento { get; set; }

        [MaxLength(250)]
        public string? DescuentoMotivo { get; set; }

        /// <summary>PrecioUnitario * Cantidad - Descuento.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal Subtotal { get; set; }
    }
}
