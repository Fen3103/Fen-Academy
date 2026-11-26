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
public class InicioController(AppDbContext db, AcademicoService academico) : FenController
{
    private static readonly Noticia[] Noticias =
    [
        new("Dato de programación", "Python sigue siendo clave para aprender lógica",
            "Su sintaxis simple ayuda a concentrarse en resolver problemas antes de pelearse con detalles del lenguaje."),
        new("Tecnología", "La inteligencia artificial ya es parte del flujo de desarrollo",
            "Hoy muchos equipos usan asistentes para revisar código, generar pruebas y explorar soluciones más rápido."),
        new("Consejo tech", "Leer errores es una habilidad de programador",
            "Un buen primer paso al depurar es mirar el mensaje exacto, la línea y repetir el caso mínimo que falla."),
        new("Dato web", "HTML, CSS y JavaScript trabajan en capas",
            "HTML estructura, CSS presenta y JavaScript agrega comportamiento. Separarlos hace el proyecto más fácil de mantener."),
        new("Git", "Hacé commits pequeños y con buenos mensajes",
            "Un historial claro te permite volver atrás, entender qué cambió y mostrar tu progreso en GitHub."),
    ];

    public async Task<IActionResult> Index()
    {
        var matriculas = await db.Matriculas.Include(m => m.Curso)
            .Where(m => m.UsuarioId == UsuarioId)
            .OrderBy(m => m.Curso.Lenguaje).ThenBy(m => m.Curso.Nivel).ToListAsync();

        var cursando = matriculas.Where(m => m.Estado == EstadoMatricula.Cursando).Select(m => m.CursoId).ToList();
        var pendientes = await db.Actividades.Include(a => a.Curso)
            .Where(a => cursando.Contains(a.CursoId) && a.Publicada &&
                        !a.Entregas.Any(e => e.UsuarioId == UsuarioId))
            .ToListAsync();
        pendientes = pendientes.OrderBy(a => a.FechaLimite is null).ThenBy(a => a.FechaLimite).ToList();

        var noticia = Noticias[DateTime.Today.DayOfYear % Noticias.Length];
        return View(new EstudianteInicioVM(matriculas, pendientes, noticia));
    }

    public async Task<IActionResult> Matricula()
    {
        var cursos = await db.Cursos.Include(c => c.Profesor)
            .OrderBy(c => c.Lenguaje).ThenBy(c => c.Nivel).ThenBy(c => c.Codigo).ToListAsync();
        var mias = await db.Matriculas.Where(m => m.UsuarioId == UsuarioId).ToDictionaryAsync(m => m.CursoId, m => m.Estado);

        var filas = new List<FilaMatriculaVM>();
        foreach (var c in cursos)
        {
            var (cumplido, requisito) = await academico.RequisitoAsync(c, UsuarioId);
            filas.Add(new FilaMatriculaVM(c, mias.TryGetValue(c.Id, out var e) ? e : null, !cumplido, requisito));
        }
        return View(filas.GroupBy(f => f.Curso.Lenguaje).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Matricular(int id)
    {
        var curso = await db.Cursos.FindAsync(id);
        if (curso is null) return NotFound();

        if (await db.Matriculas.AnyAsync(m => m.UsuarioId == UsuarioId && m.CursoId == id))
        {
            Info("Ya estás matriculado en ese curso.");
        }
        else
        {
            var (cumplido, requisito) = await academico.RequisitoAsync(curso, UsuarioId);
            if (!cumplido)
            {
                Error($"No podés matricular {curso.Nombre}. Requisito: aprobar {requisito}.");
            }
            else
            {
                db.Matriculas.Add(new Matricula { UsuarioId = UsuarioId, CursoId = id });
                await db.SaveChangesAsync();
                Exito($"Te matriculaste en {curso.Nombre}.");
            }
        }
        return RedirectToAction(nameof(Matricula));
    }

    public async Task<IActionResult> Progreso()
    {
        var matriculas = await db.Matriculas.Include(m => m.Curso)
            .Where(m => m.UsuarioId == UsuarioId)
            .OrderBy(m => m.Curso.Lenguaje).ThenBy(m => m.Curso.Nivel).ToListAsync();

        var lista = new List<ProgresoVM>();
        foreach (var m in matriculas)
            lista.Add(new ProgresoVM(m, AcademicoService.Resumen(await academico.NotasAsync(m.CursoId, UsuarioId))));
        return View(lista);
    }
}
