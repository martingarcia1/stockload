using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace StockApi.Controllers
{
    public static class ClaimsExtensions
    {
        /// <summary>Email del usuario autenticado (claim "sub" del JWT).</summary>
        public static string Email(this ClaimsPrincipal user) =>
            user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.Identity?.Name
            ?? "desconocido";

        public static string? Rol(this ClaimsPrincipal user) =>
            user.FindFirstValue(ClaimTypes.Role) ?? user.FindFirstValue("rol");
    }
}
