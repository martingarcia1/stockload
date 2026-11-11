using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using StockApi.Data;
using StockApi.Models;

namespace StockApi.Services
{
    public record CotizacionInfo(
        decimal Valor,
        decimal? Compra,
        string Tipo,
        string Fuente,          // "automatica" | "manual" | "respaldo"
        DateTime? Actualizada);

    /// <summary>
    /// Obtiene la cotización del dólar desde https://dolarapi.com (API pública, sin clave).
    /// Se cachea 10 minutos y se guarda la última obtenida en la configuración como respaldo
    /// por si la API no responde. El valor usado para convertir es el de "venta".
    /// </summary>
    public class CotizacionService
    {
        public static readonly string[] TiposValidos = { "oficial", "blue", "bolsa", "contadoconliqui", "tarjeta", "mayorista" };

        private readonly AppDbContext _context;
        private readonly IHttpClientFactory _httpFactory;
        private readonly IMemoryCache _cache;
        private readonly ILogger<CotizacionService> _logger;

        public CotizacionService(AppDbContext context, IHttpClientFactory httpFactory, IMemoryCache cache, ILogger<CotizacionService> logger)
        {
            _context = context;
            _httpFactory = httpFactory;
            _cache = cache;
            _logger = logger;
        }

        public async Task<CotizacionInfo> ObtenerAsync()
        {
            var config = await ConfiguracionService.ObtenerAsync(_context);

            if (config.UsarCotizacionManual && config.CotizacionManual is > 0)
            {
                return new CotizacionInfo(config.CotizacionManual.Value, null, config.TipoDolar, "manual", null);
            }

            var cacheKey = $"cotizacion:{config.TipoDolar}";
            if (_cache.TryGetValue(cacheKey, out CotizacionInfo? cacheada) && cacheada != null)
            {
                return cacheada;
            }

            try
            {
                var http = _httpFactory.CreateClient("dolarapi");
                using var resp = await http.GetAsync($"v1/dolares/{config.TipoDolar}");
                resp.EnsureSuccessStatusCode();
                using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
                var root = doc.RootElement;
                var venta = root.GetProperty("venta").GetDecimal();
                decimal? compra = root.TryGetProperty("compra", out var c) && c.ValueKind == JsonValueKind.Number ? c.GetDecimal() : null;
                DateTime? fecha = root.TryGetProperty("fechaActualizacion", out var f) && f.TryGetDateTime(out var fd) ? fd : null;

                if (venta <= 0) throw new InvalidOperationException("Cotización inválida recibida");

                var info = new CotizacionInfo(venta, compra, config.TipoDolar, "automatica", fecha);
                _cache.Set(cacheKey, info, TimeSpan.FromMinutes(10));

                config.UltimaCotizacion = venta;
                config.UltimaCotizacionFecha = Hora.Ahora();
                await _context.SaveChangesAsync();

                return info;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo obtener la cotización del dólar ({Tipo})", config.TipoDolar);

                if (config.UltimaCotizacion is > 0)
                {
                    return new CotizacionInfo(config.UltimaCotizacion.Value, null, config.TipoDolar, "respaldo", config.UltimaCotizacionFecha);
                }
                if (config.CotizacionManual is > 0)
                {
                    return new CotizacionInfo(config.CotizacionManual.Value, null, config.TipoDolar, "manual", null);
                }
                throw new InvalidOperationException(
                    "No hay cotización del dólar disponible. Cargue una cotización manual en Configuración.");
            }
        }

        public void LimpiarCache(string tipo) => _cache.Remove($"cotizacion:{tipo}");

        /// <summary>Convierte un importe entre ARS y USD usando la cotización dada (pesos por dólar).</summary>
        public static decimal Convertir(decimal monto, string desde, string hacia, decimal cotizacion)
        {
            if (desde == hacia) return monto;
            if (desde == Monedas.USD && hacia == Monedas.ARS) return Math.Round(monto * cotizacion, 2);
            if (desde == Monedas.ARS && hacia == Monedas.USD) return Math.Round(monto / cotizacion, 2);
            throw new ArgumentException($"Conversión no soportada: {desde} -> {hacia}");
        }
    }

    public static class ConfiguracionService
    {
        public static async Task<Configuracion> ObtenerAsync(AppDbContext context)
        {
            var config = await context.Configuraciones.FirstOrDefaultAsync(c => c.Id == 1);
            if (config == null)
            {
                config = new Configuracion { Id = 1 };
                context.Configuraciones.Add(config);
                await context.SaveChangesAsync();
            }
            return config;
        }
    }
}
