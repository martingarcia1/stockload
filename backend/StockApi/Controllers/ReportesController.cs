using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockApi.Data;
using StockApi.Models;
using StockApi.Services;

namespace StockApi.Controllers
{
    [Authorize(Roles = Roles.Gestion)]
    [Route("api/[controller]")]
    [ApiController]
    public class ReportesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReportesController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Arqueo diario: resumen completo de un día (ventas por medio de pago y moneda,
        /// descuentos otorgados, movimientos de caja, arqueos y cierres, estado de facturación).
        /// GET: api/Reportes/diario?fecha=2026-11-04
        /// </summary>
        [HttpGet("diario")]
        public async Task<ActionResult<object>> GetDiario([FromQuery] DateTime? fecha)
        {
            var dia = (fecha ?? Hora.Hoy()).Date;
            var sig = dia.AddDays(1);

            var ventas = await _context.Ventas
                .Include(v => v.Items)
                .Where(v => v.Fecha >= dia && v.Fecha < sig)
                .OrderBy(v => v.Fecha)
                .AsSplitQuery()
                .ToListAsync();

            var validas = ventas.Where(v => !v.Anulada).ToList();

            var porMedio = validas
                .GroupBy(v => new { v.MedioPago, v.Moneda })
                .Select(g => new { medioPago = g.Key.MedioPago, moneda = g.Key.Moneda, cantidad = g.Count(), total = g.Sum(v => v.Total) })
                .OrderBy(x => x.medioPago).ThenBy(x => x.moneda)
                .ToList();

            var porVendedor = validas
                .GroupBy(v => v.Usuario)
                .Select(g => new
                {
                    usuario = g.Key,
                    cantidad = g.Count(),
                    totalArs = g.Sum(v => v.TotalArs),
                    descuentoArs = g.Sum(v => CotizacionService.Convertir(v.Descuento, v.Moneda, Monedas.ARS, v.Cotizacion))
                })
                .OrderByDescending(x => x.totalArs)
                .ToList();

            var descuentos = validas
                .Where(v => v.Descuento > 0)
                .Select(v => new
                {
                    ventaId = v.Id,
                    v.Fecha,
                    v.Usuario,
                    v.Moneda,
                    v.MedioPago,
                    subtotal = v.Subtotal,
                    descuento = v.Descuento,
                    total = v.Total,
                    porcentaje = v.Subtotal > 0 ? Math.Round(v.Descuento / v.Subtotal * 100, 1) : 0,
                    motivos = v.Items.Where(i => i.Descuento > 0 && !string.IsNullOrEmpty(i.DescuentoMotivo))
                        .Select(i => $"{i.Descripcion}: {i.DescuentoMotivo}")
                        .Concat(string.IsNullOrEmpty(v.DescuentoMotivo) ? Array.Empty<string>() : new[] { v.DescuentoMotivo! })
                        .ToList()
                })
                .ToList();

            var facturacion = validas
                .GroupBy(v => v.FacturaEstado)
                .ToDictionary(g => g.Key, g => g.Count());

            // Mercadería que salió sin cobrarse (devoluciones, garantías, mermas, regalos...)
            var egresos = await _context.Egresos
                .Include(e => e.Item)
                .Where(e => e.FechaEgreso >= dia && e.FechaEgreso < sig)
                .OrderBy(e => e.FechaEgreso)
                .Select(e => new
                {
                    e.Id,
                    fecha = e.FechaEgreso,
                    e.Cantidad,
                    e.Motivo,
                    e.Observaciones,
                    e.Usuario,
                    producto = e.Item != null ? e.Item.Nombre : null,
                    sku = e.Item != null ? e.Item.Sku : null,
                    precio = e.Item != null ? e.Item.Precio : 0,
                    moneda = e.Item != null ? e.Item.Moneda : Monedas.ARS
                })
                .ToListAsync();

            // Cajas abiertas ese día (o que seguían abiertas)
            var sesiones = await _context.CajaSesiones
                .Where(c => (c.FechaApertura >= dia && c.FechaApertura < sig)
                         || (c.FechaCierre >= dia && c.FechaCierre < sig))
                .OrderBy(c => c.FechaApertura)
                .ToListAsync();

            var cajas = new List<object>();
            foreach (var s in sesiones)
            {
                var resumen = await CajaService.CalcularAsync(_context, s);
                var movimientos = await _context.MovimientosCaja.Where(m => m.CajaSesionId == s.Id).OrderBy(m => m.Fecha).ToListAsync();
                var arqueos = await _context.Arqueos.Where(a => a.CajaSesionId == s.Id).OrderBy(a => a.Fecha).ToListAsync();
                cajas.Add(new { sesion = s, resumen, movimientos, arqueos });
            }

            return Ok(new
            {
                fecha = dia,
                totales = new
                {
                    cantidadVentas = validas.Count,
                    ventasAnuladas = ventas.Count(v => v.Anulada),
                    totalArs = validas.Where(v => v.Moneda == Monedas.ARS).Sum(v => v.Total),
                    totalUsd = validas.Where(v => v.Moneda == Monedas.USD).Sum(v => v.Total),
                    totalEquivalenteArs = validas.Sum(v => v.TotalArs),
                    descuentosArs = validas.Where(v => v.Moneda == Monedas.ARS).Sum(v => v.Descuento),
                    descuentosUsd = validas.Where(v => v.Moneda == Monedas.USD).Sum(v => v.Descuento),
                    unidadesVendidas = validas.Sum(v => v.Items.Sum(i => i.Cantidad))
                },
                porMedio,
                porVendedor,
                descuentos,
                facturacion,
                cajas,
                egresos,
                anuladas = ventas.Where(v => v.Anulada)
                    .Select(v => new { v.Id, v.Fecha, v.Usuario, v.Total, v.Moneda, v.UsuarioAnulacion, v.MotivoAnulacion })
            });
        }
    }
}
