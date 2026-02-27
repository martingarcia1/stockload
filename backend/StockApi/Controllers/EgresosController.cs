using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockApi.Data;
using StockApi.Models;

namespace StockApi.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class EgresosController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EgresosController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Egresos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Egreso>>> GetEgresos()
        {
            // Includes the parent Item to show its name/sku easily on the frontend
            return await _context.Egresos
                .Include(e => e.Item)
                .OrderByDescending(e => e.FechaEgreso)
                .ToListAsync();
        }

        // POST: api/Egresos
        [HttpPost]
        public async Task<ActionResult<Egreso>> PostEgreso([FromBody] Egreso egreso)
        {
            if (egreso.Cantidad <= 0)
            {
                return BadRequest("La cantidad debe ser mayor a cero.");
            }

            var item = await _context.Items.FindAsync(egreso.ItemId);
            if (item == null)
            {
                return NotFound($"No se encontró el artículo con ID {egreso.ItemId}.");
            }

            // Validar que hay stock suficiente
            if (item.Stock < egreso.Cantidad)
            {
                return BadRequest($"Stock insuficiente falló. Stock actual: {item.Stock}, Intentando egresar: {egreso.Cantidad}");
            }

            // Iniciar transacción explícita
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Restar stock
                item.Stock -= egreso.Cantidad;
                _context.Entry(item).State = EntityState.Modified;

                // 2. Registrar egreso
                egreso.FechaEgreso = DateTime.Now;
                _context.Egresos.Add(egreso);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction(nameof(GetEgresos), new { id = egreso.Id }, egreso);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Error interno al registrar el egreso: {ex.Message}");
            }
        }
    }
}
