using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using FenAcademy.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Areas.Admin.Controllers;

/// <summary>Usuarios, roles y materias (cursos).</summary>
[Area("Admin")]
[Authorize(Roles = Roles.Admin)]
public class InicioController(AppDbContext db, AcademicoService academico, ArchivoService archivos) : FenController
{
    private IActionResult Volver(string ancla = "") => Redirect(Url.Action(nameof(Index))! + ancla);

    public async Task<IActionResult> Index()
    {
        var usuarios = await db.Usuarios.OrderBy(u => u.Rol).ThenBy(u => u.Nombre).ToListAsync();
        var cursos = await db.Cursos.Include(c => c.Profesor).OrderBy(c => c.Lenguaje).ThenBy(c => c.Nivel).ThenBy(c => c.Codigo).ToListAsync();
        var estudiantes = await db.Matriculas.GroupBy(m => m.CursoId).Select(g => new { g.Key, N = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.N);
        return View(new AdminVM(usuarios, cursos, estudiantes, usuarios.Where(u => u.Rol == Rol.Profesor).ToList(), UsuarioId));
    }

    // ------------------------------------------------------------ usuarios ---

    [HttpPost]
    public async Task<IActionResult> CambiarRol(int id, Rol rol)
    {
        var u = await db.Usuarios.FindAsync(id);
        if (u is null) return NotFound();
        if (id == UsuarioId) { Error("No podés cambiar tu propio rol."); return Volver(); }

        u.Rol = rol;
        if (rol != Rol.Profesor)
            await db.Cursos.Where(c => c.ProfesorId == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.ProfesorId, (int?)null));
        await db.SaveChangesAsync();
        Exito($"{u.Nombre} ahora es {rol.ToString().ToLower()}.");
        return Volver();
    }

    [HttpPost]
    public async Task<IActionResult> EliminarUsuario(int id)
    {
        if (id == UsuarioId) { Error("No podés eliminar tu propia cuenta."); return Volver(); }
        var u = await db.Usuarios.FindAsync(id);
        if (u is null) return NotFound();

        foreach (var a in await db.Entregas.Where(e => e.UsuarioId == id).Select(e => e.Archivo).ToListAsync()) archivos.Borrar(a);
        foreach (var a in await db.Recursos.Where(r => r.UsuarioId == id).Select(r => r.Archivo).ToListAsync()) archivos.Borrar(a);
        db.Usuarios.Remove(u);
        await db.SaveChangesAsync();
        Exito("Usuario eliminado.");
        return Volver();
    }

    // -------------------------------------------------------------- cursos ---

    private async Task<string?> ValidarCursoAsync(string codigo, string nombre, string lenguaje, int nivel, int? profesorId, int? excluirId)
    {
        if (codigo == "" || nombre == "" || lenguaje == "") return "Completá código, nombre y lenguaje.";
        if (nivel < 1) return "El nivel debe ser 1 o mayor.";
        if (await db.Cursos.AnyAsync(c => c.Codigo == codigo && c.Id != excluirId)) return $"Ya existe un curso con el código {codigo}.";
        if (profesorId is not null && !await db.Usuarios.AnyAsync(u => u.Id == profesorId && u.Rol == Rol.Profesor))
            return "Seleccioná un profesor válido.";
        return null;
    }

    [HttpPost]
    public async Task<IActionResult> CrearCurso(string codigo, string nombre, string lenguaje, int nivel, string? descripcion, int? profesorId)
    {
        codigo = AcademicoService.NormalizarCodigo(codigo ?? "");
        nombre = (nombre ?? "").Trim();
        lenguaje = await academico.NormalizarLenguajeAsync(lenguaje ?? "");

        if (await ValidarCursoAsync(codigo, nombre, lenguaje, nivel, profesorId, null) is string error) Error(error);
        else
        {
            db.Cursos.Add(new Curso { Codigo = codigo, Nombre = nombre, Lenguaje = lenguaje, Nivel = nivel,
                                      Descripcion = descripcion?.Trim(), ProfesorId = profesorId });
            await db.SaveChangesAsync();
            Exito($"Curso {codigo} creado.");
        }
        return Volver("#cursos");
    }

    [HttpGet]
    public async Task<IActionResult> EditarCurso(int id)
    {
        var curso = await db.Cursos.FindAsync(id);
        if (curso is null) return NotFound();
        ViewBag.Profesores = await db.Usuarios.Where(u => u.Rol == Rol.Profesor).OrderBy(u => u.Nombre).ToListAsync();
        ViewBag.Lenguajes = await db.Cursos.Select(c => c.Lenguaje).Distinct().ToListAsync();
        return View(curso);
    }

    [HttpPost]
    public async Task<IActionResult> EditarCurso(int id, string codigo, string nombre, string lenguaje, int nivel, string? descripcion, int? profesorId)
    {
        var curso = await db.Cursos.FindAsync(id);
        if (curso is null) return NotFound();
        codigo = AcademicoService.NormalizarCodigo(codigo ?? "");
        nombre = (nombre ?? "").Trim();
        lenguaje = await academico.NormalizarLenguajeAsync(lenguaje ?? "");

        if (await ValidarCursoAsync(codigo, nombre, lenguaje, nivel, profesorId, id) is string error)
        {
            Error(error);
            return RedirectToAction(nameof(EditarCurso), new { id });
        }
        (curso.Codigo, curso.Nombre, curso.Lenguaje, curso.Nivel, curso.Descripcion, curso.ProfesorId) =
            (codigo, nombre, lenguaje, nivel, descripcion?.Trim(), profesorId);
        await db.SaveChangesAsync();
        Exito($"Curso {codigo} actualizado.");
        return Volver("#cursos");
    }

    [HttpPost]
    public async Task<IActionResult> AsignarProfesor(int id, int? profesorId)
    {
        var curso = await db.Cursos.FindAsync(id);
        if (curso is null) return NotFound();
        if (profesorId is not null && !await db.Usuarios.AnyAsync(u => u.Id == profesorId && u.Rol == Rol.Profesor))
            Error("Seleccioná un profesor válido.");
        else
        {
            curso.ProfesorId = profesorId;
            await db.SaveChangesAsync();
            Exito("Profesor asignado.");
        }
        return Volver("#cursos");
    }

    [HttpPost]
    public async Task<IActionResult> EliminarCurso(int id)
    {
        var curso = await db.Cursos.FindAsync(id);
        if (curso is null) return NotFound();
        foreach (var a in await db.Entregas.Where(e => e.Actividad.CursoId == id).Select(e => e.Archivo).ToListAsync()) archivos.Borrar(a);
        foreach (var a in await db.Recursos.Where(r => r.CursoId == id).Select(r => r.Archivo).ToListAsync()) archivos.Borrar(a);
        db.Cursos.Remove(curso);
        await db.SaveChangesAsync();
        Exito("Curso eliminado.");
        return Volver("#cursos");
    }
}
