namespace StockApi.Models
{
    /// <summary>
    /// Roles del sistema. "Admin" se conserva sólo por compatibilidad con tokens/usuarios previos
    /// (la migración AddVentasCajaFacturacion convierte los usuarios "Admin" en "Propietario").
    /// </summary>
    public static class Roles
    {
        public const string Propietario = "Propietario";
        public const string Administradora = "Administradora";
        public const string Vendedor = "Vendedor";
        public const string AdminLegacy = "Admin";

        /// <summary>Roles con acceso a caja (arqueo, rendición, cierre), reportes y configuración.</summary>
        public const string Gestion = Propietario + "," + Administradora + "," + AdminLegacy;

        public static readonly string[] Todos = { Propietario, Administradora, Vendedor };

        public static bool EsGestion(string? rol) =>
            rol == Propietario || rol == Administradora || rol == AdminLegacy;
    }

    public static class Monedas
    {
        public const string ARS = "ARS";
        public const string USD = "USD";

        public static bool EsValida(string? moneda) => moneda == ARS || moneda == USD;
    }

    public static class MediosPago
    {
        public const string Efectivo = "Efectivo";
        public const string Debito = "Debito";
        public const string Credito = "Credito";
        public const string Transferencia = "Transferencia";
        public const string MercadoPago = "MercadoPago";

        public static readonly string[] Todos = { Efectivo, Debito, Credito, Transferencia, MercadoPago };
    }

    public static class CondicionesIva
    {
        public const string ResponsableInscripto = "ResponsableInscripto";
        public const string Monotributo = "Monotributo";
        public const string Exento = "Exento";
        public const string ConsumidorFinal = "ConsumidorFinal";
    }

    public static class EstadosFactura
    {
        /// <summary>La venta no requiere comprobante fiscal (ej. venta interna).</summary>
        public const string NoSolicitada = "NoSolicitada";
        /// <summary>Se debe facturar pero ARCA no está configurado o no se envió aún.</summary>
        public const string Pendiente = "Pendiente";
        public const string Emitida = "Emitida";
        public const string Error = "Error";
    }

    /// <summary>Hora local de Argentina, independiente de la zona horaria del servidor/contenedor.</summary>
    public static class Hora
    {
        private static readonly TimeZoneInfo Zona = ObtenerZona();

        private static TimeZoneInfo ObtenerZona()
        {
            foreach (var id in new[] { "America/Argentina/Buenos_Aires", "Argentina Standard Time" })
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(id); } catch { }
            }
            return TimeZoneInfo.CreateCustomTimeZone("ART", TimeSpan.FromHours(-3), "ART", "ART");
        }

        public static DateTime Ahora() => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zona);
        public static DateTime Hoy() => Ahora().Date;
    }
}
