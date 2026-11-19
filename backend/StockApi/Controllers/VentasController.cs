using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockApi.Data;
using StockApi.Models;
using StockApi.Services;

namespace StockApi.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class VentasController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CotizacionService _cotizacion;

        public VentasController(AppDbContext context, CotizacionService cotizacion)
        {
            _context = context;
            _cotizacion = cotizacion;
        }

        // GET: api/Ventas?desde=2026-11-01&hasta=2026-11-04&page=1&pageSize=20&usuario=&facturaEstado=
        [HttpGet]
        public async Task<ActionResult<PaginatedResponse<Venta>>> GetVentas(
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] string? facturaEstado,
            [FromQuery] bool soloConDescuento = false,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var query = _context.Ventas.Include(v => v.Items).AsQueryable();

            // Un vendedor sólo ve sus propias ventas
            if (!Roles.EsGestion(User.Rol()))
            {
                var email = User.Email();
                query = query.Where(v => v.Usuario == email);
            }

            if (desde.HasValue) query = query.Where(v => v.Fecha >= desde.Value.Date);
            if (hasta.HasValue) query = query.Where(v => v.Fecha < hasta.Value.Date.AddDays(1));
            if (!string.IsNullOrEmpty(facturaEstado)) query = query.Where(v => v.FacturaEstado == facturaEstado);
            if (soloConDescuento) query = query.Where(v => v.Descuento > 0);

            pageSize = Math.Clamp(pageSize, 1, 200);
            page = Math.Max(1, page);

            var total = await query.CountAsync();
            var data = await query
                .OrderByDescending(v => v.Fecha)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .AsSplitQuery()
                .ToListAsync();

            return Ok(new PaginatedResponse<Venta>(data, total, page, pageSize));
        }

        // GET: api/Ventas/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Venta>> GetVenta(int id)
        {
            var venta = await _context.Ventas.Include(v => v.Items).FirstOrDefaultAsync(v => v.Id == id);
            if (venta == null) return NotFound();
            if (!Roles.EsGestion(User.Rol()) && venta.Usuario != User.Email()) return Forbid();
            return venta;
        }

        // POST: api/Ventas
        [HttpPost]
        public async Task<ActionResult<Venta>> PostVenta([FromBody] VentaRequest req)
        {
            // ---------- Validaciones ----------
            if (req.Items == null || req.Items.Count == 0)
                return BadRequest(new { message = "La venta debe tener al menos un producto." });
            if (!Monedas.EsValida(req.Moneda))
                return BadRequest(new { message = "Moneda inválida. Use ARS o USD." });
            if (!MediosPago.Todos.Contains(req.MedioPago))
                return BadRequest(new { message = "Medio de pago inválido." });
            if (req.Items.Any(i => i.Cantidad <= 0))
                return BadRequest(new { message = "Las cantidades deben ser mayores a cero." });
            if (req.Items.Any(i => i.Descuento < 0) || req.DescuentoGeneral < 0)
                return BadRequest(new { message = "Los descuentos no pueden ser negativos." });

            var caja = await CajaService.ObtenerAbiertaAsync(_context);
            if (caja == null)
                return BadRequest(new { message = "No hay una caja abierta. Abra la caja antes de registrar ventas." });

            CotizacionInfo cotizacion;
            try { cotizacion = await _cotizacion.ObtenerAsync(); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }

            var ids = req.Items.Select(i => i.ItemId).Distinct().ToList();
            var productos = await _context.Items.Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id);

            var venta = new Venta
            {
                Fecha = Hora.Ahora(),
                Usuario = User.Email(),
                CajaSesionId = caja.Id,
                Moneda = req.Moneda,
                Cotizacion = cotizacion.Valor,
                MedioPago = req.MedioPago,
                ClienteNombre = req.ClienteNombre?.Trim(),
                ClienteDocTipo = string.IsNullOrWhiteSpace(req.ClienteDocNro) ? null : req.ClienteDocTipo,
                ClienteDocNro = req.ClienteDocNro?.Trim(),
                ClienteCondicionIva = req.ClienteCondicionIva,
                Observaciones = req.Observaciones,
                DescuentoGeneral = Math.Round(req.DescuentoGeneral, 2),
                DescuentoMotivo = req.DescuentoMotivo?.Trim(),
            };

            // Se agrupan cantidades por producto para validar stock correctamente
            foreach (var grupo in req.Items.GroupBy(i => i.ItemId))
            {
                if (!productos.TryGetValue(grupo.Key, out var prod))
                    return BadRequest(new { message = $"No existe el producto con ID {grupo.Key}." });
                var cant = grupo.Sum(i => i.Cantidad);
                if ((prod.Stock ?? 0) < cant)
                    return BadRequest(new { message = $"Stock insuficiente para \"{prod.Nombre}\". Disponible: {prod.Stock ?? 0}, solicitado: {cant}." });
            }

            foreach (var linea in req.Items)
            {
                var prod = productos[linea.ItemId];
                var monedaProd = Monedas.EsValida(prod.Moneda) ? prod.Moneda : Monedas.ARS;
                var unitario = CotizacionService.Convertir(prod.Precio, monedaProd, req.Moneda, cotizacion.Valor);
                var bruto = unitario * linea.Cantidad;
                var desc = Math.Round(linea.Descuento, 2);

                if (desc > bruto)
                    return BadRequest(new { message = $"El descuento de \"{prod.Nombre}\" supera su precio." });

                venta.Items.Add(new VentaItem
                {
                    ItemId = prod.Id,
                    Descripcion = prod.Nombre,
                    Sku = prod.Sku,
                    Cantidad = linea.Cantidad,
                    PrecioLista = prod.Precio,
                    MonedaLista = monedaProd,
                    PrecioUnitario = unitario,
                    Descuento = desc,
                    DescuentoMotivo = desc > 0 ? linea.DescuentoMotivo?.Trim() : null,
                    Subtotal = bruto - desc,
                });
            }

            venta.Subtotal = venta.Items.Sum(i => i.PrecioUnitario * i.Cantidad);
            var subtotalConDescLineas = venta.Items.Sum(i => i.Subtotal);
            if (venta.DescuentoGeneral > subtotalConDescLineas)
                return BadRequest(new { message = "El descuento general supera el total de la venta." });

            venta.Descuento = venta.Items.Sum(i => i.Descuento) + venta.DescuentoGeneral;
            venta.Total = venta.Subtotal - venta.Descuento;
            venta.TotalArs = CotizacionService.Convertir(venta.Total, venta.Moneda, Monedas.ARS, venta.Cotizacion);

            // Todo descuento debe quedar justificado (se registra quién y por qué)
            var sinMotivo = venta.Items.Any(i => i.Descuento > 0 && string.IsNullOrWhiteSpace(i.DescuentoMotivo))
                            && string.IsNullOrWhiteSpace(venta.DescuentoMotivo);
            if ((venta.DescuentoGeneral > 0 && string.IsNullOrWhiteSpace(venta.DescuentoMotivo)) || sinMotivo)
                return BadRequest(new { message = "Indique el motivo del descuento (ej. \"Pago contado efectivo\")." });

            // La factura (ARCA) se emite aparte, con "Facturar esta venta": api/facturacion/ventas/{id}/facturar

            // ---------- Persistencia (venta + stock en una transacción) ----------
            using var tx = await _context.Database.BeginTransactionAsync();
            foreach (var linea in venta.Items)
            {
                productos[linea.ItemId].Stock = (productos[linea.ItemId].Stock ?? 0) - linea.Cantidad;
            }
            _context.Ventas.Add(venta);
            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return CreatedAtAction(nameof(GetVenta), new { id = venta.Id }, venta);
        }

        // POST: api/Ventas/5/anular
        [HttpPost("{id}/anular")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<Venta>> Anular(int id, [FromBody] AnularVentaRequest req)
        {
            var venta = await _context.Ventas.Include(v => v.Items).Include(v => v.CajaSesion)
                .FirstOrDefaultAsync(v => v.Id == id);
            if (venta == null) return NotFound();
            if (venta.Anulada) return BadRequest(new { message = "La venta ya está anulada." });
            if (venta.FacturaEstado == EstadosFactura.Emitida)
                return BadRequest(new { message = "La venta tiene factura emitida: primero anule la factura (Facturación > Anular), que emite la nota de crédito." });
            if (venta.CajaSesion is { Abierta: false })
                return BadRequest(new { message = "La caja de esta venta ya fue cerrada. Registre la devolución como movimiento de caja." });

            using var tx = await _context.Database.BeginTransactionAsync();
            var ids = venta.Items.Select(i => i.ItemId).ToList();
            var productos = await _context.Items.Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
            foreach (var linea in venta.Items)
            {
                if (productos.TryGetValue(linea.ItemId, out var prod))
                    prod.Stock = (prod.Stock ?? 0) + linea.Cantidad;
            }

            venta.Anulada = true;
            venta.FechaAnulacion = Hora.Ahora();
            venta.UsuarioAnulacion = User.Email();
            venta.MotivoAnulacion = req.Motivo;
            if (venta.FacturaEstado != EstadosFactura.NoSolicitada)
                venta.FacturaEstado = EstadosFactura.NoSolicitada;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return venta;
        }
    }
}
