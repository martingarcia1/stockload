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
    public class StockController : ControllerBase
    {
        private readonly AppDbContext _context;

        public StockController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Stock
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Item>>> GetStock()
        {
            return await _context.Items.OrderByDescending(i => i.Id).ToListAsync();
        }

        // GET: api/Stock/stats
        [HttpGet("stats")]
        public async Task<ActionResult<object>> GetStockStats()
        {
            var totalItems = await _context.Items.CountAsync();
            var totalWatches = await _context.Items.CountAsync(i => i.Categoria == "Relojes");
            var totalJewelry = await _context.Items.CountAsync(i => i.Categoria == "Joyas");
            var lowStockItems = await _context.Items.Where(i => i.Stock <= i.MinStock).ToListAsync();
            var recentItems = await _context.Items.OrderByDescending(i => i.Id).Take(5).ToListAsync();

            return new
            {
                TotalItems = totalItems,
                TotalWatches = totalWatches,
                TotalJewelry = totalJewelry,
                LowStockCount = lowStockItems.Count,
                LowStockItems = lowStockItems.Take(5),
                RecentItems = recentItems
            };
        }

        [HttpGet("debug-seed")]
        public IActionResult DebugSeed()
        {
            try
            {
                var sqlFilePath = @"D:\app carga de stock\database\Productos_Insert_Export.sql";
                if (System.IO.File.Exists(sqlFilePath))
                {
                    var sql = System.IO.File.ReadAllText(sqlFilePath);
                    _context.Database.ExecuteSqlRaw(sql);
                    return Ok("Inyectado con éxito.");
                }
                return NotFound("Archivo no encontrado.");
            }
            catch (Exception ex)
            {
                return BadRequest(new { Error = ex.Message, Inner = ex.InnerException?.Message });
            }
        }

        // GET: api/Stock/paginated
        [HttpGet("paginated")]
        public async Task<ActionResult<PaginatedResponse<Item>>> GetStockPaginated(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? category = "Todas",
            [FromQuery] string? stockStatus = "Todos")
        {
            var query = _context.Items.AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(i => 
                    (i.Nombre != null && i.Nombre.ToLower().Contains(searchLower)) ||
                    (i.Sku != null && i.Sku.ToLower().Contains(searchLower)) ||
                    (i.Marca != null && i.Marca.ToLower().Contains(searchLower))
                );
            }

            if (!string.IsNullOrEmpty(category) && category != "Todas")
            {
                query = query.Where(i => i.Categoria == category);
            }

            if (!string.IsNullOrEmpty(stockStatus))
            {
                if (stockStatus == "Bajo")
                {
                    query = query.Where(i => i.Stock <= i.MinStock);
                }
                else if (stockStatus == "Óptimo")
                {
                    query = query.Where(i => i.Stock > i.MinStock);
                }
            }

            var totalItems = await query.CountAsync();

            var items = await query
                .OrderByDescending(i => i.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var response = new PaginatedResponse<Item>(items, totalItems, page, pageSize);

            return Ok(response);
        }

        // GET: api/Stock/export
        [HttpGet("export")]
        public async Task<ActionResult<IEnumerable<Item>>> GetStockForExport(
             [FromQuery] string? search = null,
             [FromQuery] string? category = "Todas",
             [FromQuery] string? stockStatus = "Todos")
        {
            var query = _context.Items.AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(i =>
                    (i.Nombre != null && i.Nombre.ToLower().Contains(searchLower)) ||
                    (i.Sku != null && i.Sku.ToLower().Contains(searchLower)) ||
                    (i.Marca != null && i.Marca.ToLower().Contains(searchLower))
                );
            }

            if (!string.IsNullOrEmpty(category) && category != "Todas")
            {
                query = query.Where(i => i.Categoria == category);
            }

            if (!string.IsNullOrEmpty(stockStatus))
            {
                if (stockStatus == "Bajo")
                {
                    query = query.Where(i => i.Stock <= i.MinStock);
                }
                else if (stockStatus == "Óptimo")
                {
                    query = query.Where(i => i.Stock > i.MinStock);
                }
            }

            var items = await query.OrderByDescending(i => i.Id).ToListAsync();

            return Ok(items);
        }

        // GET: api/Stock/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Item>> GetItem(int id)
        {
            var item = await _context.Items.FindAsync(id);

            if (item == null)
            {
                return NotFound();
            }

            return item;
        }

        // POST: api/Stock
        [HttpPost]
        public async Task<ActionResult<Item>> PostItem(Item item)
        {
            // Set default date
            item.FechaRegistro = DateTime.Now;

            _context.Items.Add(item);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetItem), new { id = item.Id }, item);
        }

        // PUT: api/Stock/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutItem(int id, Item item)
        {
            if (id != item.Id)
            {
                return BadRequest("El ID del ítem no coincide con el ID de la URL.");
            }

            _context.Entry(item).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ItemExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // DELETE: api/Stock/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteItem(int id)
        {
            var item = await _context.Items.FindAsync(id);
            if (item == null)
            {
                return NotFound();
            }

            _context.Items.Remove(item);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ItemExists(int id)
        {
            return _context.Items.Any(e => e.Id == id);
        }
    }
}
