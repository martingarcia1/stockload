using Microsoft.EntityFrameworkCore;
using StockApi.Data;
using StockApi.Models;

namespace StockApi.Services
{
    public record ResumenCaja(
        decimal FondoInicialArs,
        decimal FondoInicialUsd,
        decimal VentasEfectivoArs,
        decimal VentasEfectivoUsd,
        decimal IngresosArs,
        decimal IngresosUsd,
        decimal GastosArs,
        decimal GastosUsd,
        decimal RendicionesArs,
        decimal RendicionesUsd,
        decimal EsperadoArs,
        decimal EsperadoUsd,
        int CantidadVentas,
        Dictionary<string, decimal> VentasPorMedioArs,
        Dictionary<string, decimal> VentasPorMedioUsd);

    public static class CajaService
    {
        public static Task<CajaSesion?> ObtenerAbiertaAsync(AppDbContext context) =>
            context.CajaSesiones.FirstOrDefaultAsync(c => c.Abierta);

        /// <summary>
        /// Calcula cuánto efectivo debería haber en la caja: fondo inicial + ventas en efectivo
        /// + ingresos - gastos - rendiciones. Las ventas anuladas no cuentan.
        /// </summary>
        public static async Task<ResumenCaja> CalcularAsync(AppDbContext context, CajaSesion sesion)
        {
            var ventas = await context.Ventas
                .Where(v => v.CajaSesionId == sesion.Id && !v.Anulada)
                .Select(v => new { v.Moneda, v.MedioPago, v.Total })
                .ToListAsync();

            var movimientos = await context.MovimientosCaja
                .Where(m => m.CajaSesionId == sesion.Id)
                .ToListAsync();

            decimal SumVentas(string moneda) => ventas
                .Where(v => v.Moneda == moneda && v.MedioPago == MediosPago.Efectivo).Sum(v => v.Total);
            decimal SumMov(string tipo, string moneda) => movimientos
                .Where(m => m.Tipo == tipo && m.Moneda == moneda).Sum(m => m.Monto);

            var ventasArs = SumVentas(Monedas.ARS);
            var ventasUsd = SumVentas(Monedas.USD);
            var ingArs = SumMov(TiposMovimiento.Ingreso, Monedas.ARS);
            var ingUsd = SumMov(TiposMovimiento.Ingreso, Monedas.USD);
            var gasArs = SumMov(TiposMovimiento.Gasto, Monedas.ARS);
            var gasUsd = SumMov(TiposMovimiento.Gasto, Monedas.USD);
            var renArs = SumMov(TiposMovimiento.Rendicion, Monedas.ARS);
            var renUsd = SumMov(TiposMovimiento.Rendicion, Monedas.USD);

            Dictionary<string, decimal> PorMedio(string moneda) => ventas
                .Where(v => v.Moneda == moneda)
                .GroupBy(v => v.MedioPago)
                .ToDictionary(g => g.Key, g => g.Sum(v => v.Total));

            return new ResumenCaja(
                sesion.FondoInicialArs, sesion.FondoInicialUsd,
                ventasArs, ventasUsd,
                ingArs, ingUsd,
                gasArs, gasUsd,
                renArs, renUsd,
                sesion.FondoInicialArs + ventasArs + ingArs - gasArs - renArs,
                sesion.FondoInicialUsd + ventasUsd + ingUsd - gasUsd - renUsd,
                ventas.Count,
                PorMedio(Monedas.ARS),
                PorMedio(Monedas.USD));
        }
    }
}
