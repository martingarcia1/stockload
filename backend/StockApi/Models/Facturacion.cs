using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StockApi.Models
{
    /// <summary>Cliente guardado para facturar (negocios, clientes frecuentes).</summary>
    [Table("Clientes")]
    public class Cliente
    {
        [Key]
        public int Id { get; set; }

        [Required, MaxLength(150)]
        public string Nombre { get; set; } = string.Empty;

        /// <summary>Código ARCA del documento: 80 CUIT, 86 CUIL, 96 DNI.</summary>
        public int DocTipo { get; set; }

        [Required, MaxLength(11)]
        public string DocNro { get; set; } = string.Empty;

        /// <summary>Condición frente al IVA (código ARCA, ej. 5 Consumidor Final, 6 Monotributo).</summary>
        public int CondicionIvaId { get; set; } = CondicionesIvaArca.ConsumidorFinal;

        [MaxLength(250)]
        public string? Domicilio { get; set; }

        [MaxLength(30)]
        public string? Telefono { get; set; }

        public DateTime Creado { get; set; }
    }

    /// <summary>
    /// Comprobante autorizado por ARCA (Factura C o Nota de crédito C).
    /// Guarda una copia de los datos del receptor tal como se informaron, para que la
    /// factura no cambie si después se edita el cliente.
    /// </summary>
    [Table("Facturas")]
    public class Factura
    {
        [Key]
        public int Id { get; set; }

        /// <summary>homologacion | produccion</summary>
        [Required, MaxLength(20)]
        public string Entorno { get; set; } = EntornosArca.Homologacion;

        /// <summary>11 Factura C, 13 Nota de crédito C.</summary>
        public int Tipo { get; set; }

        public int PuntoVenta { get; set; }
        public long Numero { get; set; }

        /// <summary>Fecha del comprobante (día, hora argentina).</summary>
        public DateTime Fecha { get; set; }

        public DateTime Creada { get; set; }

        [MaxLength(100)]
        public string Usuario { get; set; } = string.Empty;

        public int VentaId { get; set; }

        [System.Text.Json.Serialization.JsonIgnore]
        [ForeignKey(nameof(VentaId))]
        public Venta? Venta { get; set; }

        public int? ClienteId { get; set; }

        // ---------- Receptor (copia) ----------
        [MaxLength(150)]
        public string? ReceptorNombre { get; set; }

        public int ReceptorDocTipo { get; set; } = TiposDocumento.SinIdentificar;

        public long ReceptorDocNro { get; set; }

        public int ReceptorCondicionIvaId { get; set; } = CondicionesIvaArca.ConsumidorFinal;

        [MaxLength(80)]
        public string? ReceptorCondicionIva { get; set; }

        [MaxLength(250)]
        public string? ReceptorDomicilio { get; set; }

        [MaxLength(30)]
        public string? ReceptorTelefono { get; set; }

        // ---------- Importes y autorización ----------
        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        [Required, MaxLength(20)]
        public string Cae { get; set; } = string.Empty;

        public DateTime CaeVencimiento { get; set; }

        /// <summary>En una nota de crédito: la factura que anula.</summary>
        public int? AsociadaId { get; set; }

        /// <summary>Emitida | Anulada (una factura anulada tiene su nota de crédito).</summary>
        [Required, MaxLength(20)]
        public string Estado { get; set; } = EstadosComprobante.Emitida;

        [MaxLength(500)]
        public string? Observaciones { get; set; }
    }

    /// <summary>
    /// Permiso de acceso de ARCA (WSAA). Dura 12 horas y ARCA no entrega otro mientras
    /// siga vigente, por eso se guarda en la base y no en memoria.
    /// </summary>
    [Table("ArcaTickets")]
    public class ArcaTicket
    {
        /// <summary>"&lt;entorno&gt;_&lt;servicio&gt;", ej. homologacion_wsfe.</summary>
        [Key, MaxLength(60)]
        public string Clave { get; set; } = string.Empty;

        [Required]
        public string Token { get; set; } = string.Empty;

        [Required]
        public string Sign { get; set; } = string.Empty;

        public DateTime Expira { get; set; }
    }

    public static class EntornosArca
    {
        public const string Homologacion = "homologacion";
        public const string Produccion = "produccion";
    }

    public static class TiposComprobante
    {
        public const int FacturaC = 11;
        public const int NotaCreditoC = 13;

        public static string Nombre(int tipo) => tipo switch
        {
            FacturaC => "Factura C",
            NotaCreditoC => "Nota de crédito C",
            _ => $"Comprobante {tipo}"
        };
    }

    public static class EstadosComprobante
    {
        public const string Emitida = "Emitida";
        public const string Anulada = "Anulada";
    }

    public static class TiposDocumento
    {
        public const int Cuit = 80;
        public const int Cuil = 86;
        public const int Dni = 96;
        public const int SinIdentificar = 99;

        public static string Nombre(int tipo) => tipo switch
        {
            Cuit => "CUIT",
            Cuil => "CUIL",
            Dni => "DNI",
            _ => ""
        };

        public static bool EsValido(int tipo) => tipo is Cuit or Cuil or Dni;
    }

    public static class CondicionesIvaArca
    {
        public const int ConsumidorFinal = 5;

        /// <summary>
        /// Lista de respaldo de condiciones frente al IVA aceptadas en comprobantes clase C
        /// (FEParamGetCondicionIvaReceptor). Se usa si ARCA no está disponible.
        /// </summary>
        public static readonly IReadOnlyList<(int Id, string Nombre)> ClaseC = new[]
        {
            (1, "IVA Responsable Inscripto"),
            (6, "Responsable Monotributo"),
            (13, "Monotributista Social"),
            (16, "Monotributo Trabajador Independiente Promovido"),
            (4, "IVA Sujeto Exento"),
            (7, "Sujeto No Categorizado"),
            (8, "Proveedor del Exterior"),
            (9, "Cliente del Exterior"),
            (10, "IVA Liberado – Ley N° 19.640"),
            (15, "IVA No Alcanzado"),
            (5, "Consumidor Final"),
        };

        public static string Nombre(int id) =>
            ClaseC.FirstOrDefault(c => c.Id == id).Nombre ?? $"Condición {id}";
    }

    /// <summary>Validaciones de documentos argentinos.</summary>
    public static class Documentos
    {
        public static string SoloDigitos(string? s) => new((s ?? "").Where(char.IsDigit).ToArray());

        /// <summary>CUIT/CUIL: 11 dígitos con dígito verificador (pesos 5,4,3,2,7,6,5,4,3,2).</summary>
        public static bool CuitValido(string? cuit)
        {
            var d = SoloDigitos(cuit);
            if (d.Length != 11) return false;
            int[] pesos = { 5, 4, 3, 2, 7, 6, 5, 4, 3, 2 };
            var suma = 0;
            for (var i = 0; i < 10; i++) suma += (d[i] - '0') * pesos[i];
            var resto = 11 - suma % 11;
            var verificador = resto == 11 ? 0 : resto == 10 ? 9 : resto;
            return verificador == d[10] - '0';
        }

        public static bool DniValido(string? dni)
        {
            var d = SoloDigitos(dni);
            return d.Length is 7 or 8;
        }

        /// <summary>Devuelve un mensaje de error o null si el documento es válido para el tipo.</summary>
        public static string? Validar(int docTipo, string? nro)
        {
            if (!TiposDocumento.EsValido(docTipo)) return "Tipo de documento inválido.";
            if (docTipo == TiposDocumento.Dni)
                return DniValido(nro) ? null : "El DNI debe tener 7 u 8 dígitos.";
            return CuitValido(nro) ? null : $"El {TiposDocumento.Nombre(docTipo)} no es válido (revise los 11 dígitos).";
        }

        public static string FormatearCuit(string? cuit)
        {
            var d = SoloDigitos(cuit);
            return d.Length == 11 ? $"{d[..2]}-{d[2..10]}-{d[10]}" : d;
        }
    }
}
