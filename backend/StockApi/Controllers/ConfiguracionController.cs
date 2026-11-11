using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StockApi.Data;
using StockApi.Models;
using StockApi.Services;

namespace StockApi.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ConfiguracionController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CotizacionService _cotizacion;

        public ConfiguracionController(AppDbContext context, CotizacionService cotizacion)
        {
            _context = context;
            _cotizacion = cotizacion;
        }

        // GET: api/Configuracion/cotizacion  -> disponible para todos (se muestra en el encabezado y en ventas)
        [HttpGet("cotizacion")]
        public async Task<ActionResult<CotizacionInfo>> GetCotizacion()
        {
            try { return await _cotizacion.ObtenerAsync(); }
            catch (InvalidOperationException ex) { return StatusCode(503, new { message = ex.Message }); }
        }

        // GET: api/Configuracion/publica -> lo mínimo que necesita el punto de venta
        [HttpGet("publica")]
        public async Task<ActionResult<object>> GetPublica()
        {
            var c = await ConfiguracionService.ObtenerAsync(_context);
            return Ok(new { c.CondicionFiscal, c.FacturarPorDefecto, c.ArcaHabilitado, c.RazonSocial });
        }

        // GET: api/Configuracion
        [HttpGet]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<Configuracion>> Get() => await ConfiguracionService.ObtenerAsync(_context);

        // PUT: api/Configuracion
        [HttpPut]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<Configuracion>> Put([FromBody] Configuracion req)
        {
            var validas = new[] { CondicionesIva.ResponsableInscripto, CondicionesIva.Monotributo, CondicionesIva.Exento };
            if (!validas.Contains(req.CondicionFiscal))
                return BadRequest(new { message = "Condición fiscal inválida." });
            if (!CotizacionService.TiposValidos.Contains(req.TipoDolar))
                return BadRequest(new { message = "Tipo de dólar inválido." });
            if (req.ArcaAmbiente != "Homologacion" && req.ArcaAmbiente != "Produccion")
                return BadRequest(new { message = "Ambiente ARCA inválido." });

            var cuit = new string((req.Cuit ?? "").Where(char.IsDigit).ToArray());
            if (cuit.Length > 0 && cuit.Length != 11)
                return BadRequest(new { message = "El CUIT debe tener 11 dígitos." });
            if (req.PuntoVenta < 1 || req.PuntoVenta > 99999)
                return BadRequest(new { message = "Punto de venta inválido." });
            if (req.UsarCotizacionManual && !(req.CotizacionManual > 0))
                return BadRequest(new { message = "Ingrese una cotización manual mayor a cero." });

            var c = await ConfiguracionService.ObtenerAsync(_context);
            var tipoAnterior = c.TipoDolar;

            c.RazonSocial = req.RazonSocial?.Trim();
            c.Cuit = cuit.Length > 0 ? cuit : null;
            c.DomicilioComercial = req.DomicilioComercial?.Trim();
            c.CondicionFiscal = req.CondicionFiscal;
            c.InicioActividades = req.InicioActividades;
            c.IngresosBrutos = req.IngresosBrutos?.Trim();
            c.PuntoVenta = req.PuntoVenta;
            c.ArcaAmbiente = req.ArcaAmbiente;
            c.ArcaHabilitado = req.ArcaHabilitado;
            c.AlicuotaIva = req.AlicuotaIva;
            c.FacturarPorDefecto = req.FacturarPorDefecto;
            c.TipoDolar = req.TipoDolar;
            c.UsarCotizacionManual = req.UsarCotizacionManual;
            c.CotizacionManual = req.CotizacionManual;
            if (tipoAnterior != c.TipoDolar)
            {
                // La última cotización guardada era de otro tipo de dólar: no sirve como respaldo
                c.UltimaCotizacion = null;
                c.UltimaCotizacionFecha = null;
            }

            await _context.SaveChangesAsync();
            _cotizacion.LimpiarCache(tipoAnterior);
            _cotizacion.LimpiarCache(c.TipoDolar);
            return c;
        }
    }
}
