using System.ComponentModel.DataAnnotations;

namespace StockApi.Models
{
    // ---------- Ventas ----------
    public class VentaItemRequest
    {
        public int ItemId { get; set; }
        public int Cantidad { get; set; } = 1;
        /// <summary>Descuento total de la línea en la moneda de cobro.</summary>
        public decimal Descuento { get; set; }
        public string? DescuentoMotivo { get; set; }
    }

    public class VentaRequest
    {
        [Required]
        public List<VentaItemRequest> Items { get; set; } = new();

        public string Moneda { get; set; } = Monedas.ARS;
        public string MedioPago { get; set; } = MediosPago.Efectivo;

        public decimal DescuentoGeneral { get; set; }
        public string? DescuentoMotivo { get; set; }

        public bool Facturar { get; set; } = true;

        public string? ClienteNombre { get; set; }
        public string? ClienteDocTipo { get; set; }
        public string? ClienteDocNro { get; set; }
        public string ClienteCondicionIva { get; set; } = CondicionesIva.ConsumidorFinal;

        public string? Observaciones { get; set; }
    }

    public class AnularVentaRequest
    {
        [Required, MaxLength(250)]
        public string Motivo { get; set; } = string.Empty;
    }

    // ---------- Caja ----------
    public class AbrirCajaRequest
    {
        [Range(0, double.MaxValue)]
        public decimal FondoInicialArs { get; set; }
        [Range(0, double.MaxValue)]
        public decimal FondoInicialUsd { get; set; }
    }

    public class MovimientoRequest
    {
        [Required]
        public string Tipo { get; set; } = TiposMovimiento.Gasto;
        public string Moneda { get; set; } = Monedas.ARS;
        [Range(0.01, double.MaxValue, ErrorMessage = "El monto debe ser mayor a cero")]
        public decimal Monto { get; set; }
        [Required, MaxLength(250)]
        public string Concepto { get; set; } = string.Empty;
        public string? RecibidoPor { get; set; }
    }

    public class ArqueoRequest
    {
        [Range(0, double.MaxValue)]
        public decimal ContadoArs { get; set; }
        [Range(0, double.MaxValue)]
        public decimal ContadoUsd { get; set; }
        [MaxLength(500)]
        public string? Observaciones { get; set; }
    }

    // ---------- Usuarios ----------
    public class UsuarioRequest
    {
        [Required, EmailAddress, MaxLength(100)]
        public string Email { get; set; } = string.Empty;
        [MaxLength(100)]
        public string? Nombre { get; set; }
        [Required]
        public string Rol { get; set; } = Roles.Vendedor;
        /// <summary>Obligatoria al crear; opcional al editar (si viene, se cambia).</summary>
        public string? Password { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class CambiarPasswordRequest
    {
        [Required]
        public string PasswordActual { get; set; } = string.Empty;
        [Required, MinLength(6)]
        public string PasswordNueva { get; set; } = string.Empty;
    }
}
