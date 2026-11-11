using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockApi.Migrations
{
    /// <inheritdoc />
    public partial class AddVentasCajaFacturacion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Activo",
                table: "Usuarios",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Nombre",
                table: "Usuarios",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "moneda",
                table: "Producto",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "ARS");

            migrationBuilder.CreateTable(
                name: "CajaSesiones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FechaApertura = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsuarioApertura = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FondoInicialArs = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    FondoInicialUsd = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Abierta = table.Column<bool>(type: "bit", nullable: false),
                    FechaCierre = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UsuarioCierre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    EsperadoArs = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    EsperadoUsd = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ContadoArs = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ContadoUsd = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ObservacionesCierre = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CajaSesiones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Configuracion",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    RazonSocial = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Cuit = table.Column<string>(type: "nvarchar(11)", maxLength: 11, nullable: true),
                    DomicilioComercial = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CondicionFiscal = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    InicioActividades = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IngresosBrutos = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    PuntoVenta = table.Column<int>(type: "int", nullable: false),
                    ArcaAmbiente = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ArcaHabilitado = table.Column<bool>(type: "bit", nullable: false),
                    AlicuotaIva = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    FacturarPorDefecto = table.Column<bool>(type: "bit", nullable: false),
                    TipoDolar = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    UsarCotizacionManual = table.Column<bool>(type: "bit", nullable: false),
                    CotizacionManual = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    UltimaCotizacion = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    UltimaCotizacionFecha = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Configuracion", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Arqueos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CajaSesionId = table.Column<int>(type: "int", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EsCierre = table.Column<bool>(type: "bit", nullable: false),
                    EsperadoArs = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    EsperadoUsd = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ContadoArs = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ContadoUsd = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Observaciones = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Usuario = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Arqueos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Arqueos_CajaSesiones_CajaSesionId",
                        column: x => x.CajaSesionId,
                        principalTable: "CajaSesiones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MovimientosCaja",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CajaSesionId = table.Column<int>(type: "int", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Tipo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Moneda = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Monto = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Concepto = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    RecibidoPor = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Usuario = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MovimientosCaja", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MovimientosCaja_CajaSesiones_CajaSesionId",
                        column: x => x.CajaSesionId,
                        principalTable: "CajaSesiones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Ventas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Usuario = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CajaSesionId = table.Column<int>(type: "int", nullable: true),
                    ClienteNombre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    ClienteDocTipo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ClienteDocNro = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ClienteCondicionIva = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Moneda = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Cotizacion = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MedioPago = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Subtotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Descuento = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DescuentoGeneral = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DescuentoMotivo = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Total = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalArs = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Observaciones = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Anulada = table.Column<bool>(type: "bit", nullable: false),
                    FechaAnulacion = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UsuarioAnulacion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MotivoAnulacion = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    FacturaEstado = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TipoComprobante = table.Column<int>(type: "int", nullable: true),
                    PuntoVenta = table.Column<int>(type: "int", nullable: true),
                    NumeroComprobante = table.Column<long>(type: "bigint", nullable: true),
                    Cae = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CaeVencimiento = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NetoGravado = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ImporteIva = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    FacturaError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ventas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Ventas_CajaSesiones_CajaSesionId",
                        column: x => x.CajaSesionId,
                        principalTable: "CajaSesiones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VentaItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VentaId = table.Column<int>(type: "int", nullable: false),
                    ItemId = table.Column<int>(type: "int", nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Sku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Cantidad = table.Column<int>(type: "int", nullable: false),
                    PrecioLista = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MonedaLista = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    PrecioUnitario = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Descuento = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DescuentoMotivo = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Subtotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VentaItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VentaItems_Producto_ItemId",
                        column: x => x.ItemId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VentaItems_Ventas_VentaId",
                        column: x => x.VentaId,
                        principalTable: "Ventas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Usuarios_Email",
                table: "Usuarios",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Arqueos_CajaSesionId",
                table: "Arqueos",
                column: "CajaSesionId");

            migrationBuilder.CreateIndex(
                name: "IX_CajaSesiones_Abierta",
                table: "CajaSesiones",
                column: "Abierta");

            migrationBuilder.CreateIndex(
                name: "IX_MovimientosCaja_CajaSesionId",
                table: "MovimientosCaja",
                column: "CajaSesionId");

            migrationBuilder.CreateIndex(
                name: "IX_VentaItems_ItemId",
                table: "VentaItems",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_VentaItems_VentaId",
                table: "VentaItems",
                column: "VentaId");

            migrationBuilder.CreateIndex(
                name: "IX_Ventas_CajaSesionId",
                table: "Ventas",
                column: "CajaSesionId");

            migrationBuilder.CreateIndex(
                name: "IX_Ventas_Fecha",
                table: "Ventas",
                column: "Fecha");

            // El antiguo rol único "Admin" pasa a ser "Propietario"
            migrationBuilder.Sql("UPDATE Usuarios SET Rol = 'Propietario' WHERE Rol = 'Admin'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE Usuarios SET Rol = 'Admin' WHERE Rol = 'Propietario'");

            migrationBuilder.DropTable(
                name: "Arqueos");

            migrationBuilder.DropTable(
                name: "Configuracion");

            migrationBuilder.DropTable(
                name: "MovimientosCaja");

            migrationBuilder.DropTable(
                name: "VentaItems");

            migrationBuilder.DropTable(
                name: "Ventas");

            migrationBuilder.DropTable(
                name: "CajaSesiones");

            migrationBuilder.DropIndex(
                name: "IX_Usuarios_Email",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "Activo",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "Nombre",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "moneda",
                table: "Producto");
        }
    }
}
