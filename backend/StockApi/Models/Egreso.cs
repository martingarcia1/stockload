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

        [Column("motivo")]
        public string? Motivo { get; set; } // Ej. "Venta", "Devolución a proveedor", "Merma"

        // Relación de navegación
        [ForeignKey("ItemId")]
        public virtual Item? Item { get; set; }
    }
}
