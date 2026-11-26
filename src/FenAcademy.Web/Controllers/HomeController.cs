using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using Microsoft.AspNetCore.Mvc;

namespace FenAcademy.Web.Controllers;

public class HomeController : FenController
{
    /// <summary>Cada rol tiene su propia página de inicio.</summary>
    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated != true) return RedirectToAction("Login", "Cuenta");
        return RedirectToAction("Index", "Inicio", new { area = User.Rol().ToString() });
    }

    [Route("Home/Error")]
    public IActionResult Error(int? codigo)
    {
        codigo ??= 500;
        ViewData["Codigo"] = codigo;
        ViewData["Mensaje"] = codigo switch
        {
            404 => "No encontramos esa página, o no tenés acceso a ella.",
            400 => "El formulario venció o es inválido. Recargá la página e intentá de nuevo.",
            413 => "El archivo es demasiado grande (máximo 16 MB).",
            _ => "Ocurrió un error inesperado.",
        };
        Response.StatusCode = codigo.Value;
        return View();
    }
}
