using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockApi.Models
{
    [Table("Producto")]
    public class Item
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("codigoBarra")]
        public string? Sku { get; set; }

        [Column("marca")]
        public string? Marca { get; set; }

        [Column("descripcion")]
        public string? Nombre { get; set; }

        [Column("idCategoria")]
        public int? IdCategoria { get; set; }

        // Nueva columna para soportar categorías tipo string del frontend.
        [Column("categoria_nueva")]
        public string? Categoria { get; set; } = "General";

        [Column("stock")]
        public int? Stock { get; set; }

        [Column("minStock")]
        public int? MinStock { get; set; } = 0;

        [Column("precio", TypeName = "decimal(18,2)")]
        public decimal Precio { get; set; }

        [Column("esActivo")]
        public bool? EsActivo { get; set; } = true;

        [Column("fechaRegistro")]
        public DateTime? FechaRegistro { get; set; } = DateTime.Now;

        [Column("nombreImagen")]
        public string? NombreImagen { get; set; }

        [Column("urlImagen")]
        public string? UrlImagen { get; set; }

        [Column("manejaPeso")]
        public bool? ManejaPeso { get; set; }
    }
}
