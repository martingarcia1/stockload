using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StockApi.Data;
using StockApi.Models;
using System.Text;
using CloudinaryDotNet;

var builder = WebApplication.CreateBuilder(args);

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

// Config JWT 
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings.GetValue<string>("Key");

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
        // Aplicar migraciones pendientes a la base de datos automáticamente al inicio
        context.Database.Migrate();

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

        // Sembrar el usuario maestro si no hay usuarios en la DB
        if (!context.Usuarios.Any())
        {
            var adminUser = new Usuario
            {
                Email = "mestebansiufi14@gmail.com",
                // Contraseña "Admin123!" cifrada con BCrypt o simplemente como texto plano si lo hasheamos en AuthController
                // Lo más ideal es guardar el hash: usaremos BCrypt en el AuthController, 
                // pero por ahora para arrancar usaremos BCryptNet para crear el hash.
                // Como no hemos instalado BCrypt.Net-Next, usaremos una versión hasheada generada con BCrypt "Admin123!" 
                // O mejor instalo BCrypt.Net-Next más adelante, o pongo el hash quemado "$2a$11$m2vP.rS/f...":
                // Hash the password manually for now using standard approach:
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                Rol = "Admin"
            };
            context.Usuarios.Add(adminUser);
            context.SaveChanges();
            Console.WriteLine("Usuario maestro inyectado con éxito.");
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
