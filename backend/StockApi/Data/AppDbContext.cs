using Microsoft.EntityFrameworkCore;
using StockApi.Models;

namespace StockApi.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Item> Items { get; set; }
        public DbSet<Egreso> Egresos { get; set; }
        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Configuracion> Configuraciones { get; set; }
        public DbSet<Venta> Ventas { get; set; }
        public DbSet<VentaItem> VentaItems { get; set; }
        public DbSet<CajaSesion> CajaSesiones { get; set; }
        public DbSet<MovimientoCaja> MovimientosCaja { get; set; }
        public DbSet<Arqueo> Arqueos { get; set; }
        public DbSet<Cliente> Clientes { get; set; }
        public DbSet<Factura> Facturas { get; set; }
        public DbSet<ArcaTicket> ArcaTickets { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Aseguramos el mapeo de la entidad Item a la tabla Producto
            modelBuilder.Entity<Item>().ToTable("Producto");
            modelBuilder.Entity<Item>().Property(i => i.Moneda).HasDefaultValue(Monedas.ARS);

            modelBuilder.Entity<Usuario>().HasIndex(u => u.Email).IsUnique();
            modelBuilder.Entity<Usuario>().Property(u => u.Activo).HasDefaultValue(true);

            modelBuilder.Entity<Venta>().HasIndex(v => v.Fecha);
            modelBuilder.Entity<Venta>()
                .HasMany(v => v.Items)
                .WithOne(i => i.Venta)
                .HasForeignKey(i => i.VentaId)
                .OnDelete(DeleteBehavior.Cascade);

            // No borrar productos que ya tienen ventas registradas
            modelBuilder.Entity<VentaItem>()
                .HasOne(i => i.Item)
                .WithMany()
                .HasForeignKey(i => i.ItemId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Venta>()
                .HasOne(v => v.CajaSesion)
                .WithMany()
                .HasForeignKey(v => v.CajaSesionId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CajaSesion>().HasIndex(c => c.Abierta);

            // ---------- Facturación ARCA ----------
            modelBuilder.Entity<Cliente>().HasIndex(c => new { c.DocTipo, c.DocNro }).IsUnique();

            // El número es único por entorno + tipo + punto de venta (pruebas y producción no se mezclan)
            modelBuilder.Entity<Factura>()
                .HasIndex(f => new { f.Entorno, f.Tipo, f.PuntoVenta, f.Numero }).IsUnique();
            modelBuilder.Entity<Factura>().HasIndex(f => f.Fecha);
            modelBuilder.Entity<Factura>().HasIndex(f => f.VentaId);
            modelBuilder.Entity<Factura>()
                .HasOne(f => f.Venta)
                .WithMany()
                .HasForeignKey(f => f.VentaId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
