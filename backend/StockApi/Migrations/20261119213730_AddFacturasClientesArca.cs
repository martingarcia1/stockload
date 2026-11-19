using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockApi.Migrations
{
    /// <inheritdoc />
    public partial class AddFacturasClientesArca : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MensajePie",
                table: "Configuracion",
                type: "nvarchar(250)",
                maxLength: 250,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ArcaTickets",
                columns: table => new
                {
                    Clave = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Token = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Sign = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Expira = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArcaTickets", x => x.Clave);
                });

            migrationBuilder.CreateTable(
                name: "Clientes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    DocTipo = table.Column<int>(type: "int", nullable: false),
                    DocNro = table.Column<string>(type: "nvarchar(11)", maxLength: 11, nullable: false),
                    CondicionIvaId = table.Column<int>(type: "int", nullable: false),
                    Domicilio = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Telefono = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Creado = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clientes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Facturas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Entorno = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Tipo = table.Column<int>(type: "int", nullable: false),
                    PuntoVenta = table.Column<int>(type: "int", nullable: false),
                    Numero = table.Column<long>(type: "bigint", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Creada = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Usuario = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    VentaId = table.Column<int>(type: "int", nullable: false),
                    ClienteId = table.Column<int>(type: "int", nullable: true),
                    ReceptorNombre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    ReceptorDocTipo = table.Column<int>(type: "int", nullable: false),
                    ReceptorDocNro = table.Column<long>(type: "bigint", nullable: false),
                    ReceptorCondicionIvaId = table.Column<int>(type: "int", nullable: false),
                    ReceptorCondicionIva = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    ReceptorDomicilio = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    ReceptorTelefono = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Total = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Cae = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CaeVencimiento = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AsociadaId = table.Column<int>(type: "int", nullable: true),
                    Estado = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Observaciones = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Facturas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Facturas_Ventas_VentaId",
                        column: x => x.VentaId,
                        principalTable: "Ventas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_DocTipo_DocNro",
                table: "Clientes",
                columns: new[] { "DocTipo", "DocNro" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Facturas_Entorno_Tipo_PuntoVenta_Numero",
                table: "Facturas",
                columns: new[] { "Entorno", "Tipo", "PuntoVenta", "Numero" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Facturas_Fecha",
                table: "Facturas",
                column: "Fecha");

            migrationBuilder.CreateIndex(
                name: "IX_Facturas_VentaId",
                table: "Facturas",
                column: "VentaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArcaTickets");

            migrationBuilder.DropTable(
                name: "Clientes");

            migrationBuilder.DropTable(
                name: "Facturas");

            migrationBuilder.DropColumn(
                name: "MensajePie",
                table: "Configuracion");
        }
    }
}
