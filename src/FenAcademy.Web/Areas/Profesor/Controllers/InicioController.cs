using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Areas.Profesor.Controllers;

[Area("Profesor")]
[Authorize(Roles = Roles.Docentes)]
public class InicioController(AppDbContext db) : FenController
{
    /// <summary>El profesor ve sus cursos asignados; el admin ve todos.</summary>
    public async Task<IActionResult> Index()
    {
        var query = db.Cursos.Include(c => c.Profesor).AsQueryable();
        if (User.Rol() != Rol.Admin) query = query.Where(c => c.ProfesorId == UsuarioId);

        var cursos = await query.OrderBy(c => c.Lenguaje).ThenBy(c => c.Nivel)
            .Select(c => new CursoResumenVM(
                c,
                c.Matriculas.Count,
                c.Actividades.Count,
                db.Entregas.Count(e => e.Actividad.CursoId == c.Id && e.Estado == EstadoEntrega.Pendiente)))
            .ToListAsync();
        return View(cursos);
    }
}
