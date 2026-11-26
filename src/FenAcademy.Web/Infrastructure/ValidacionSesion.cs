using System.Security.Claims;
using FenAcademy.Web.Data;
using FenAcademy.Web.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace FenAcademy.Web.Infrastructure;

public static class ValidacionSesion
{
    public static ClaimsPrincipal CrearPrincipal(Usuario u) => new(new ClaimsIdentity(
    [
        new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()),
        new Claim(ClaimTypes.Name, u.Nombre),
        new Claim(ClaimTypes.Role, u.Rol.ToString()),
    ], CookieAuthenticationDefaults.AuthenticationScheme));

    /// <summary>
    /// En cada petición comprueba que el usuario siga existiendo y refresca nombre y rol desde la base.
    /// Así, si el admin convierte a alguien en profesor (o lo elimina), el cambio aplica sin volver a iniciar sesión.
    /// </summary>
    public static async Task ValidarAsync(CookieValidatePrincipalContext ctx)
    {
        var id = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var usuario = int.TryParse(id, out var uid) ? await db.Usuarios.FindAsync(uid) : null;

        if (usuario is null)
        {
            ctx.RejectPrincipal();
            await ctx.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        var actual = ctx.Principal!;
        if (actual.FindFirstValue(ClaimTypes.Role) != usuario.Rol.ToString() ||
            actual.FindFirstValue(ClaimTypes.Name) != usuario.Nombre)
        {
            ctx.ReplacePrincipal(CrearPrincipal(usuario));
            ctx.ShouldRenew = true;
        }
    }
}
