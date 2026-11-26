using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using FenAcademy.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Areas.Estudiante.Controllers;

[Area("Estudiante")]
[Authorize(Roles = Roles.Estudiante)]
public class CursosController(AppDbContext db, AcademicoService academico) : FenController
{
    public async Task<IActionResult> Ver(int id)
    {
        var matricula = await db.Matriculas.Include(m => m.Curso).ThenInclude(c => c.Profesor)
            .FirstOrDefaultAsync(m => m.CursoId == id && m.UsuarioId == UsuarioId);
        if (matricula is null) return NotFound();

        var clases = await db.Clases.Where(c => c.CursoId == id).OrderBy(c => c.Orden).ThenBy(c => c.Id).ToListAsync();
        var notas = await academico.NotasAsync(id, UsuarioId);
        var recursos = await db.Recursos.Include(r => r.Usuario).Where(r => r.CursoId == id)
            .OrderByDescending(r => r.FechaSubida).ToListAsync();

        return View(new CursoEstudianteVM(matricula.Curso, matricula, clases, notas, AcademicoService.Resumen(notas), recursos));
    }
}
