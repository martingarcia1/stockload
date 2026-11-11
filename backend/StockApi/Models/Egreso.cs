using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockApi.Models
{
    [Table("Egresos")]
    public class Egreso
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [Column("itemId")]
        public int ItemId { get; set; }

        [Required]
        [Column("cantidad")]
        public int Cantidad { get; set; }

        [Column("fechaEgreso")]
        public DateTime FechaEgreso { get; set; } = DateTime.Now;

        /// <summary>
        /// Salida de stock SIN cobro: Devolución, Garantía, Merma, Regalo, Ajuste, Otro.
        /// "Venta" sólo existe en registros anteriores al módulo de Ventas.
        /// </summary>
        [Column("motivo")]
        public string? Motivo { get; set; }

        [MaxLength(500)]
        public string? Observaciones { get; set; }

        /// <summary>Email del usuario que registró el egreso (null en registros anteriores).</summary>
        [MaxLength(100)]
        public string? Usuario { get; set; }

        // Relación de navegación
        [ForeignKey("ItemId")]
        public virtual Item? Item { get; set; }
    }
}
