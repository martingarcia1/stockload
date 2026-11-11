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
    public class UsuariosController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsuariosController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Usuarios
        [HttpGet]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<IEnumerable<object>>> Get()
        {
            return await _context.Usuarios
                .OrderBy(u => u.Email)
                .Select(u => new { u.Id, u.Email, u.Nombre, u.Rol, u.Activo })
                .ToListAsync();
        }

        // POST: api/Usuarios
        [HttpPost]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> Post([FromBody] UsuarioRequest req)
        {
            var error = ValidarRol(req.Rol);
            if (error != null) return error;
            if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
                return BadRequest(new { message = "La contraseña debe tener al menos 6 caracteres." });

            var email = req.Email.Trim().ToLower();
            if (await _context.Usuarios.AnyAsync(u => u.Email.ToLower() == email))
                return BadRequest(new { message = "Ya existe un usuario con ese email." });

            var usuario = new Usuario
            {
                Email = email,
                Nombre = req.Nombre?.Trim(),
                Rol = req.Rol,
                Activo = req.Activo,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
            };
            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();

            return Ok(new { usuario.Id, usuario.Email, usuario.Nombre, usuario.Rol, usuario.Activo });
        }

        // PUT: api/Usuarios/5
        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Gestion)]
        public async Task<ActionResult<object>> Put(int id, [FromBody] UsuarioRequest req)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();

            // Sólo el propietario puede modificar a otro propietario
            if (usuario.Rol == Roles.Propietario && User.Rol() != Roles.Propietario && User.Rol() != Roles.AdminLegacy)
                return Forbid();

            var error = ValidarRol(req.Rol);
            if (error != null) return error;

            bool esUnoMismo = usuario.Email == User.Email();
            if (esUnoMismo && (!req.Activo || req.Rol != usuario.Rol))
                return BadRequest(new { message = "No puede desactivarse ni cambiarse el rol a sí mismo." });

            var email = req.Email.Trim().ToLower();
            if (email != usuario.Email.ToLower() && await _context.Usuarios.AnyAsync(u => u.Email.ToLower() == email))
                return BadRequest(new { message = "Ya existe un usuario con ese email." });

            usuario.Email = email;
            usuario.Nombre = req.Nombre?.Trim();
            usuario.Rol = req.Rol;
            usuario.Activo = req.Activo;
            if (!string.IsNullOrWhiteSpace(req.Password))
            {
                if (req.Password.Length < 6)
                    return BadRequest(new { message = "La contraseña debe tener al menos 6 caracteres." });
                usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
            }

            await _context.SaveChangesAsync();
            return Ok(new { usuario.Id, usuario.Email, usuario.Nombre, usuario.Rol, usuario.Activo });
        }

        // POST: api/Usuarios/cambiar-password  -> cada usuario cambia su propia contraseña
        [HttpPost("cambiar-password")]
        public async Task<IActionResult> CambiarPassword([FromBody] CambiarPasswordRequest req)
        {
            var email = User.Email();
            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == email);
            if (usuario == null) return NotFound();
            if (!BCrypt.Net.BCrypt.Verify(req.PasswordActual, usuario.PasswordHash))
                return BadRequest(new { message = "La contraseña actual es incorrecta." });

            usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.PasswordNueva);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private ActionResult? ValidarRol(string rol)
        {
            if (!Roles.Todos.Contains(rol))
                return BadRequest(new { message = "Rol inválido." });
            // Sólo un propietario puede crear/asignar el rol Propietario
            if (rol == Roles.Propietario && User.Rol() != Roles.Propietario && User.Rol() != Roles.AdminLegacy)
                return BadRequest(new { message = "Sólo el propietario puede asignar el rol Propietario." });
            return null;
        }
    }
}
