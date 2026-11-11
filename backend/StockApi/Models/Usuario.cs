using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockApi.Models
{
    [Table("Usuarios")]
    public class Usuario
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Nombre { get; set; }

        /// <summary>Propietario | Administradora | Vendedor (ver <see cref="Roles"/>).</summary>
        [MaxLength(20)]
        public string Rol { get; set; } = Roles.Vendedor;

        public bool Activo { get; set; } = true;
    }
}
