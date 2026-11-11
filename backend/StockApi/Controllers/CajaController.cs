using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockApi.Data;
using StockApi.Models;
using StockApi.Services;

namespace StockApi.Controllers
{
    /// <summary>
    /// Apertura, movimientos, rendición, arqueo y cierre de caja.
    /// Cualquier usuario puede abrir la caja y consultar si está abierta (para poder vender);
    /// el resto de las operaciones es sólo para Propietario y Administradora.
    /// </summary>
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class CajaController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CajaController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Caja/actual  -> estado de la caja abierta (o null)
        [HttpGet("actual")]
        public async Task<ActionResult<object?>> GetActual()
        {
            var sesion = await CajaService.ObtenerAbiertaAsync(_context);
            if (sesion == null) return Ok(new { abierta = false });

            if (!Roles.EsGestion(User.Rol()))
            {
                // El vendedor sólo necesita saber que la caja está abierta
                return Ok(new { abierta = true, sesion = new { sesion.Id, sesion.FechaApertura, sesion.UsuarioApertura } });
            }

            return Ok(await ArmarDetalle(sesion));
        }

        // GET: api/Caja/5
        [HttpGet("{id:int}")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> GetSesion(int id)
        {
            var sesion = await _context.CajaSesiones.FindAsync(id);
            if (sesion == null) return NotFound();
            return Ok(await ArmarDetalle(sesion));
        }

        // GET: api/Caja/historial?desde=&hasta=
        [HttpGet("historial")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<IEnumerable<CajaSesion>>> GetHistorial([FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            var query = _context.CajaSesiones.AsQueryable();
            if (desde.HasValue) query = query.Where(c => c.FechaApertura >= desde.Value.Date);
            if (hasta.HasValue) query = query.Where(c => c.FechaApertura < hasta.Value.Date.AddDays(1));
            return await query.OrderByDescending(c => c.FechaApertura).Take(200).ToListAsync();
        }

        // POST: api/Caja/abrir
        [HttpPost("abrir")]
        public async Task<ActionResult<object>> Abrir([FromBody] AbrirCajaRequest req)
        {
            if (await CajaService.ObtenerAbiertaAsync(_context) != null)
                return BadRequest(new { message = "Ya hay una caja abierta. Ciérrela antes de abrir otra." });

            var sesion = new CajaSesion
            {
                FechaApertura = Hora.Ahora(),
                UsuarioApertura = User.Email(),
                FondoInicialArs = req.FondoInicialArs,
                FondoInicialUsd = req.FondoInicialUsd,
                Abierta = true
            };
            _context.CajaSesiones.Add(sesion);
            await _context.SaveChangesAsync();

            return Ok(await ArmarDetalle(sesion));
        }

        // POST: api/Caja/movimientos  -> ingreso, gasto o rendición
        [HttpPost("movimientos")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> RegistrarMovimiento([FromBody] MovimientoRequest req)
        {
            var sesion = await CajaService.ObtenerAbiertaAsync(_context);
            if (sesion == null) return BadRequest(new { message = "No hay una caja abierta." });
            if (!TiposMovimiento.Todos.Contains(req.Tipo)) return BadRequest(new { message = "Tipo de movimiento inválido." });
            if (!Monedas.EsValida(req.Moneda)) return BadRequest(new { message = "Moneda inválida." });
            if (req.Tipo == TiposMovimiento.Rendicion && string.IsNullOrWhiteSpace(req.RecibidoPor))
                return BadRequest(new { message = "Indique quién recibe el dinero de la rendición." });

            if (TiposMovimiento.EsSalida(req.Tipo))
            {
                var resumen = await CajaService.CalcularAsync(_context, sesion);
                var disponible = req.Moneda == Monedas.ARS ? resumen.EsperadoArs : resumen.EsperadoUsd;
                if (req.Monto > disponible)
                    return BadRequest(new { message = $"El monto supera el efectivo disponible en caja ({req.Moneda} {disponible:N2})." });
            }

            _context.MovimientosCaja.Add(new MovimientoCaja
            {
                CajaSesionId = sesion.Id,
                Fecha = Hora.Ahora(),
                Tipo = req.Tipo,
                Moneda = req.Moneda,
                Monto = Math.Round(req.Monto, 2),
                Concepto = req.Concepto.Trim(),
                RecibidoPor = req.RecibidoPor?.Trim(),
                Usuario = User.Email()
            });
            await _context.SaveChangesAsync();

            return Ok(await ArmarDetalle(sesion));
        }

        // POST: api/Caja/arqueo  -> conteo parcial sin cerrar la caja
        [HttpPost("arqueo")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> RegistrarArqueo([FromBody] ArqueoRequest req)
        {
            var sesion = await CajaService.ObtenerAbiertaAsync(_context);
            if (sesion == null) return BadRequest(new { message = "No hay una caja abierta." });

            await GuardarArqueo(sesion, req, esCierre: false);
            return Ok(await ArmarDetalle(sesion));
        }

        // POST: api/Caja/cerrar  -> arqueo final y cierre
        [HttpPost("cerrar")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> Cerrar([FromBody] ArqueoRequest req)
        {
            var sesion = await CajaService.ObtenerAbiertaAsync(_context);
            if (sesion == null) return BadRequest(new { message = "No hay una caja abierta." });

            var arqueo = await GuardarArqueo(sesion, req, esCierre: true);

            sesion.Abierta = false;
            sesion.FechaCierre = arqueo.Fecha;
            sesion.UsuarioCierre = arqueo.Usuario;
            sesion.EsperadoArs = arqueo.EsperadoArs;
            sesion.EsperadoUsd = arqueo.EsperadoUsd;
            sesion.ContadoArs = arqueo.ContadoArs;
            sesion.ContadoUsd = arqueo.ContadoUsd;
            sesion.ObservacionesCierre = req.Observaciones;
            await _context.SaveChangesAsync();

            return Ok(await ArmarDetalle(sesion));
        }

        private async Task<Arqueo> GuardarArqueo(CajaSesion sesion, ArqueoRequest req, bool esCierre)
        {
            var resumen = await CajaService.CalcularAsync(_context, sesion);
            var arqueo = new Arqueo
            {
                CajaSesionId = sesion.Id,
                Fecha = Hora.Ahora(),
                EsCierre = esCierre,
                EsperadoArs = resumen.EsperadoArs,
                EsperadoUsd = resumen.EsperadoUsd,
                ContadoArs = Math.Round(req.ContadoArs, 2),
                ContadoUsd = Math.Round(req.ContadoUsd, 2),
                Observaciones = req.Observaciones,
                Usuario = User.Email()
            };
            _context.Arqueos.Add(arqueo);
            await _context.SaveChangesAsync();
            return arqueo;
        }

        private async Task<object> ArmarDetalle(CajaSesion sesion)
        {
            var resumen = await CajaService.CalcularAsync(_context, sesion);
            var movimientos = await _context.MovimientosCaja
                .Where(m => m.CajaSesionId == sesion.Id).OrderByDescending(m => m.Fecha).ToListAsync();
            var arqueos = await _context.Arqueos
                .Where(a => a.CajaSesionId == sesion.Id).OrderByDescending(a => a.Fecha).ToListAsync();

            return new { abierta = sesion.Abierta, sesion, resumen, movimientos, arqueos };
        }
    }
}
