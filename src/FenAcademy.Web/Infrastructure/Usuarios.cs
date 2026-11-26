using System.Security.Claims;
using System.Text.Json;
using FenAcademy.Web.Models;
using Microsoft.AspNetCore.Mvc;

namespace FenAcademy.Web.Infrastructure;

public static class Roles
{
    public const string Estudiante = nameof(Rol.Estudiante);
    public const string Profesor = nameof(Rol.Profesor);
    public const string Admin = nameof(Rol.Admin);
    /// <summary>El admin puede entrar al panel docente de cualquier curso.</summary>
    public const string Docentes = Profesor + "," + Admin;
}

public static class ClaimsExtensions
{
    public static int UsuarioId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static Rol Rol(this ClaimsPrincipal user) =>
        Enum.Parse<Rol>(user.FindFirstValue(ClaimTypes.Role)!);

    public static string Nombre(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Name) ?? "";
}

/// <summary>Base de todos los controladores: mensajes flash que sobreviven a un redirect.</summary>
public abstract class FenController : Controller
{
    public const string ClaveFlash = "flash";

    protected int UsuarioId => User.UsuarioId();

    protected void Exito(string mensaje) => Flash("success", mensaje);
    protected void Error(string mensaje) => Flash("error", mensaje);
    protected void Info(string mensaje) => Flash("info", mensaje);

    private void Flash(string tipo, string mensaje)
    {
        var lista = TempData.Peek(ClaveFlash) is string json
            ? JsonSerializer.Deserialize<List<string[]>>(json)!
            : [];
        lista.Add([tipo, mensaje]);
        TempData[ClaveFlash] = JsonSerializer.Serialize(lista);
    }
}
