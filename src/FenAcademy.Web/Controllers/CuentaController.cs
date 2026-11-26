using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Controllers;

/// <summary>Login, registro, perfil y ajustes: lo que comparten los tres roles.</summary>
public class CuentaController(AppDbContext db) : FenController
{
    private static readonly PasswordHasher<Usuario> Hasher = new();
    private const int MinPassword = 6;

    [HttpGet]
    public IActionResult Login(string? returnUrl)
    {
        if (User.Identity?.IsAuthenticated == true) return RedirectToAction("Index", "Home");
        ViewData["ReturnUrl"] = returnUrl;
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Login(string usuario, string password, string? returnUrl)
    {
        ViewData["ReturnUrl"] = returnUrl;
        var u = await db.Usuarios.FirstOrDefaultAsync(x => x.NombreUsuario == (usuario ?? "").Trim());
        if (u is null || Hasher.VerifyHashedPassword(u, u.PasswordHash, password ?? "") == PasswordVerificationResult.Failed)
        {
            Error("Usuario o contraseña incorrectos.");
            return View();
        }

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, ValidacionSesion.CrearPrincipal(u));
        // Volver a la página que pidió login, solo si es de este sitio (evita redirecciones a sitios externos).
        if (Url.IsLocalUrl(returnUrl)) return LocalRedirect(returnUrl);
        return RedirectToAction("Index", "Inicio", new { area = u.Rol.ToString() });
    }

    [HttpGet]
    public IActionResult Registro() => View();

    [HttpPost]
    public async Task<IActionResult> Registro(string nombre, string usuario, string password, string confirmar)
    {
        nombre = (nombre ?? "").Trim();
        usuario = (usuario ?? "").Trim();

        if (nombre == "" || usuario == "" || string.IsNullOrEmpty(password))
            Error("Completá todos los campos.");
        else if (password.Length < MinPassword)
            Error($"La contraseña debe tener al menos {MinPassword} caracteres.");
        else if (password != confirmar)
            Error("Las contraseñas no coinciden.");
        else if (await db.Usuarios.AnyAsync(u => u.NombreUsuario == usuario))
            Error("Ese usuario ya existe.");
        else
        {
            // Toda cuenta nueva es de estudiante. Solo un admin puede volverla profesor.
            var u = new Usuario { Nombre = nombre, NombreUsuario = usuario, Rol = Rol.Estudiante };
            u.PasswordHash = Hasher.HashPassword(u, password);
            db.Usuarios.Add(u);
            await db.SaveChangesAsync();
            Exito("Cuenta creada. Ya podés iniciar sesión.");
            return RedirectToAction(nameof(Login));
        }
        ViewData["Nombre"] = nombre;
        ViewData["Usuario"] = usuario;
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction(nameof(Login));
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> Perfil() => View(await db.Usuarios.FindAsync(UsuarioId));

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Perfil(string nombre, string usuario, string? email, DateOnly? fechaNacimiento,
                                            string? password, string? confirmar)
    {
        var u = (await db.Usuarios.FindAsync(UsuarioId))!;
        nombre = (nombre ?? "").Trim();
        usuario = (usuario ?? "").Trim();

        if (nombre == "" || usuario == "")
            Error("El nombre y el usuario son obligatorios.");
        else if (await db.Usuarios.AnyAsync(x => x.NombreUsuario == usuario && x.Id != u.Id))
            Error("Ese nombre de usuario ya está en uso.");
        else if (!string.IsNullOrEmpty(password) && password.Length < MinPassword)
            Error($"La contraseña debe tener al menos {MinPassword} caracteres.");
        else if (!string.IsNullOrEmpty(password) && password != confirmar)
            Error("Las contraseñas no coinciden.");
        else
        {
            u.Nombre = nombre;
            u.NombreUsuario = usuario;
            u.Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
            u.FechaNacimiento = fechaNacimiento;
            if (!string.IsNullOrEmpty(password)) u.PasswordHash = Hasher.HashPassword(u, password);
            await db.SaveChangesAsync();
            Exito("Perfil actualizado correctamente.");
        }
        return RedirectToAction(nameof(Perfil));
    }

    [Authorize]
    public IActionResult Ajustes() => View();

    public IActionResult AccesoDenegado()
    {
        Error("Esa sección no está disponible para tu rol.");
        return RedirectToAction("Index", "Home");
    }
}
