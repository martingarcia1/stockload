using Microsoft.EntityFrameworkCore;
using StockApi.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Configure Entity Framework Core with SQL Server
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();

// Add CORS to allow the React Frontend to communicate with the API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

var app = builder.Build();

// Seed Database from SQL script if empty
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        // Revisar si hay registros, sino cargar el SQL
        if (!context.Items.Any())
        {
            var sqlFilePath = @"D:\app carga de stock\database\Productos_Insert_Export.sql";
            if (System.IO.File.Exists(sqlFilePath))
            {
                var sql = System.IO.File.ReadAllText(sqlFilePath);
                context.Database.ExecuteSqlRaw(sql);
                Console.WriteLine("Datos semilla inyectados con éxito desde el archivo SQL original.");
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error insertando datos semilla: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("AllowReactApp");
app.UseAuthorization();
app.MapControllers();
app.Run();
