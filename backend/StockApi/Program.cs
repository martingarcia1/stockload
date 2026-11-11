using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StockApi.Data;
using StockApi.Models;
using System.Text;
using CloudinaryDotNet;

var builder = WebApplication.CreateBuilder(args);

// Claves locales para desarrollo (no se suben a GitHub). En Docker vienen por variables de entorno desde .env.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);
builder.Configuration.AddEnvironmentVariables();

// Add services to the container.
builder.Services.AddControllers();

// Configure Entity Framework Core with SQL Server
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Config Cloudinary
var cloudinarySettings = builder.Configuration.GetSection("CloudinarySettings");
Account cloudinaryAccount = new Account(
    cloudinarySettings["CloudName"],
    cloudinarySettings["ApiKey"],
    cloudinarySettings["ApiSecret"]);
Cloudinary cloudinary = new Cloudinary(cloudinaryAccount);
builder.Services.AddSingleton(cloudinary);

// Cotización del dólar (dolarapi.com) y facturación
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient("dolarapi", c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Cotizacion:BaseUrl"] ?? "https://dolarapi.com/");
    c.Timeout = TimeSpan.FromSeconds(8);
});
builder.Services.AddScoped<StockApi.Services.CotizacionService>();
// TODO ARCA: reemplazar por la implementación WSAA + WSFEv1 cuando se tenga el certificado digital.
builder.Services.AddScoped<StockApi.Services.IFacturacionService, StockApi.Services.FacturacionNoConfiguradaService>();

// Config JWT 
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings.GetValue<string>("Key");
if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Length < 32)
{
    throw new InvalidOperationException(
        "Falta JwtSettings:Key (mínimo 32 caracteres). En Docker: JWT_SECRET en .env. Con 'dotnet run': appsettings.Local.json.");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings.GetValue<string>("Issuer"),
        ValidateAudience = true,
        ValidAudience = jwtSettings.GetValue<string>("Audience"),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();

// Add CORS to allow the React Frontend to communicate with the API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173", "http://localhost:5174", "http://localhost", "https://stockload.vercel.app")
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
        // Aplicar migraciones pendientes a la base de datos automáticamente al inicio.
        // SQL Server puede tardar en levantar (sobre todo en equipos con poca RAM): se reintenta hasta ~3 minutos.
        for (int intento = 1; ; intento++)
        {
            try
            {
                context.Database.Migrate();
                break;
            }
            catch (Exception ex) when (intento < 18)
            {
                Console.WriteLine($"Base de datos no disponible (intento {intento}/18): {ex.Message}. Reintentando en 10 s...");
                Thread.Sleep(TimeSpan.FromSeconds(10));
            }
        }

        // Revisar si hay registros, sino cargar el SQL
        if (!context.Items.Any())
        {
            var sqlFilePath = "/app/database/Productos_Insert_Export.sql";
            if (System.IO.File.Exists(sqlFilePath))
            {
                var sql = System.IO.File.ReadAllText(sqlFilePath);
                var batches = System.Text.RegularExpressions.Regex.Split(sql, @"^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline | System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                
                context.Database.SetCommandTimeout(300); // 5 minutes timeout just in case
                context.Database.OpenConnection();
                try
                {
                    int count = 0;
                    foreach (var batch in batches)
                    {
                        if (!string.IsNullOrWhiteSpace(batch))
                        {
                            context.Database.ExecuteSqlRaw(batch);
                            count++;
                            if (count % 500 == 0)
                            {
                                Console.WriteLine($"Procesados {count} bloques SQL...");
                            }
                        }
                    }
                    Console.WriteLine("Datos semilla inyectados con éxito desde el archivo SQL original.");
                }
                finally
                {
                    context.Database.CloseConnection();
                }
            }
        }

        // Sembrar el usuario maestro si no hay usuarios en la DB
        // Email y contraseña vienen de la configuración (SeedAdmin__Email / SeedAdmin__Password en .env),
        // nunca escritos en el código.
        if (!context.Usuarios.Any())
        {
            var seedEmail = app.Configuration["SeedAdmin:Email"];
            var seedPassword = app.Configuration["SeedAdmin:Password"];
            if (string.IsNullOrWhiteSpace(seedEmail) || string.IsNullOrWhiteSpace(seedPassword))
            {
                Console.WriteLine("No hay usuarios y falta SeedAdmin:Email / SeedAdmin:Password en la configuración: no se creó el usuario inicial.");
            }
            else
            {
                context.Usuarios.Add(new Usuario
                {
                    Email = seedEmail.Trim().ToLower(),
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(seedPassword),
                    Rol = Roles.Propietario
                });
                context.SaveChanges();
                Console.WriteLine("Usuario maestro inyectado con éxito.");
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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
try
{
    app.Run();
}
catch (Exception ex)
{
    Console.WriteLine($"\n\n\n=== ERROR FATAL AL INICIAR SERVIDOR ===");
    Console.WriteLine($"[ERROR] {ex.Message}");
    if (ex.InnerException != null)
    {
        Console.WriteLine($"[INNER] {ex.InnerException.Message}");
    }
    Console.WriteLine($"=======================================\n\n\n");
}
