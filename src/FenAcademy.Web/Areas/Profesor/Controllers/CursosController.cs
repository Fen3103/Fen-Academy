using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using FenAcademy.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Areas.Profesor.Controllers;

/// <summary>Gestión de un curso: clases, actividades, calificaciones, estudiantes y recursos.</summary>
[Area("Profesor")]
[Authorize(Roles = Roles.Docentes)]
public class CursosController(AppDbContext db, AcademicoService academico, ArchivoService archivos) : FenController
{
    private IActionResult IrA(int cursoId, string tab) => RedirectToAction(nameof(Ver), new { id = cursoId, tab });

    public async Task<IActionResult> Ver(int id)
    {
        var curso = await academico.CursoDocenteAsync(User, id);
        if (curso is null) return NotFound();

        var actividades = await db.Actividades.Include(a => a.Clase).Where(a => a.CursoId == id).ToListAsync();
        var entregas = await db.Entregas.Include(e => e.Actividad).Include(e => e.Usuario)
            .Where(e => e.Actividad.CursoId == id).ToListAsync();

        var estudiantes = new List<EstudianteCursoVM>();
        foreach (var m in await db.Matriculas.Include(m => m.Usuario).Where(m => m.CursoId == id).OrderBy(m => m.Usuario.Nombre).ToListAsync())
            estudiantes.Add(new EstudianteCursoVM(m.Usuario, m, AcademicoService.Resumen(await academico.NotasAsync(id, m.UsuarioId))));

        return View(new CursoProfesorVM
        {
            Curso = curso,
            Clases = await db.Clases.Where(c => c.CursoId == id).OrderBy(c => c.Orden).ThenBy(c => c.Id).ToListAsync(),
            Actividades = actividades.OrderBy(a => a.FechaLimite is null).ThenBy(a => a.FechaLimite).ThenBy(a => a.Id).ToList(),
            EntregasPorActividad = entregas.GroupBy(e => e.ActividadId).ToDictionary(g => g.Key, g => g.Count()),
            TotalValor = Math.Round(actividades.Sum(a => a.Valor), 2),
            Entregas = entregas.OrderByDescending(e => e.Estado == EstadoEntrega.Pendiente)
                               .ThenByDescending(e => e.FechaEntrega).ToList(),
            Estudiantes = estudiantes,
            Recursos = await db.Recursos.Include(r => r.Usuario).Where(r => r.CursoId == id)
                               .OrderByDescending(r => r.FechaSubida).ToListAsync(),
        });
    }

    // -------------------------------------------------------------- clases ---

    [HttpPost]
    public async Task<IActionResult> CrearClase(int id, string titulo, string? descripcion, int orden = 1)
    {
        if (await academico.CursoDocenteAsync(User, id) is null) return NotFound();
        if (string.IsNullOrWhiteSpace(titulo)) Error("Escribí un título para la clase.");
        else
        {
            db.Clases.Add(new Clase { CursoId = id, Titulo = titulo.Trim(), Descripcion = descripcion?.Trim(), Orden = Math.Max(orden, 1) });
            await db.SaveChangesAsync();
            Exito("Clase creada correctamente.");
        }
        return IrA(id, "clases");
    }

    [HttpPost]
    public async Task<IActionResult> EliminarClase(int id)
    {
        var clase = await db.Clases.FindAsync(id);
        if (clase is null || await academico.CursoDocenteAsync(User, clase.CursoId) is null) return NotFound();
        db.Clases.Remove(clase); // sus actividades quedan como "generales"
        await db.SaveChangesAsync();
        Exito("Clase eliminada.");
        return IrA(clase.CursoId, "clases");
    }

    // --------------------------------------------------------- actividades ---

    [HttpPost]
    public async Task<IActionResult> CrearActividad(int id, string titulo, TipoActividad tipo, int? claseId,
                                                    DateOnly? fechaLimite, double valor, string? descripcion)
    {
        if (await academico.CursoDocenteAsync(User, id) is null) return NotFound();
        var usado = await academico.ValorAsignadoAsync(id);
        if (claseId is not null && !await db.Clases.AnyAsync(c => c.Id == claseId && c.CursoId == id)) claseId = null;

        if (string.IsNullOrWhiteSpace(titulo)) Error("Escribí un título para la actividad.");
        else if (valor is < 0 or > 100 || double.IsNaN(valor)) Error("El valor debe estar entre 0 y 100.");
        else if (usado + valor > 100.0001) Error($"El desglose superaría el 100%. Ya hay {usado:0.##}% asignado; te quedan {100 - usado:0.##}%.");
        else
        {
            var actividad = new Actividad
            {
                CursoId = id, ClaseId = claseId, Tipo = tipo, Titulo = titulo.Trim(), Descripcion = descripcion?.Trim(),
                FechaLimite = fechaLimite, Valor = Math.Round(valor, 2),
                Publicada = tipo != TipoActividad.Examen, // el examen se publica cuando tenga preguntas
            };
            db.Actividades.Add(actividad);
            await db.SaveChangesAsync();

            if (tipo == TipoActividad.Examen)
            {
                Exito("Examen creado. Agregá las preguntas y publicalo cuando esté listo.");
                return RedirectToAction("Editar", "Examenes", new { id = actividad.Id });
            }
            Exito("Actividad creada correctamente.");
        }
        return IrA(id, "evaluacion");
    }

    [HttpPost]
    public async Task<IActionResult> EliminarActividad(int id)
    {
        var actividad = await db.Actividades.Include(a => a.Entregas).FirstOrDefaultAsync(a => a.Id == id);
        if (actividad is null || await academico.CursoDocenteAsync(User, actividad.CursoId) is null) return NotFound();
        foreach (var e in actividad.Entregas) archivos.Borrar(e.Archivo);
        db.Actividades.Remove(actividad);
        await db.SaveChangesAsync();
        Exito("Actividad eliminada (junto con sus entregas).");
        return IrA(actividad.CursoId, "evaluacion");
    }

    // ------------------------------------------------------------ entregas ---

    [HttpPost]
    public async Task<IActionResult> Calificar(int id, EstadoEntrega estado, string? nota, string? retroalimentacion)
    {
        var entrega = await db.Entregas.Include(e => e.Actividad).FirstOrDefaultAsync(e => e.Id == id);
        if (entrega is null || await academico.CursoDocenteAsync(User, entrega.Actividad.CursoId) is null) return NotFound();

        double? valorNota = null;
        if (!string.IsNullOrWhiteSpace(nota))
        {
            if (!double.TryParse(nota.Replace(',', '.'), System.Globalization.CultureInfo.InvariantCulture, out var n) || n is < 0 or > 100)
            {
                Error("La nota debe ser un número entre 0 y 100.");
                return IrA(entrega.Actividad.CursoId, "entregas");
            }
            valorNota = Math.Round(n, 2);
        }

        // En exámenes la nota sale de las respuestas; acá solo se cambia estado y comentario.
        if (!entrega.Actividad.EsExamen) entrega.Nota = valorNota;
        entrega.Estado = entrega.Nota is not null && estado == EstadoEntrega.Pendiente ? EstadoEntrega.Revisado : estado;
        entrega.Retroalimentacion = string.IsNullOrWhiteSpace(retroalimentacion) ? null : retroalimentacion.Trim();
        await db.SaveChangesAsync();
        Exito("Entrega calificada.");
        return IrA(entrega.Actividad.CursoId, "entregas");
    }

    // --------------------------------------------------------- estudiantes ---

    [HttpPost]
    public async Task<IActionResult> CambiarEstado(int id, int usuarioId, EstadoMatricula estado)
    {
        if (await academico.CursoDocenteAsync(User, id) is null) return NotFound();
        var m = await db.Matriculas.FirstOrDefaultAsync(x => x.CursoId == id && x.UsuarioId == usuarioId);
        if (m is null) return NotFound();
        m.Estado = estado;
        await db.SaveChangesAsync();
        Exito("Estado actualizado." + (estado == EstadoMatricula.Aprobado ? " Ya puede matricular el siguiente nivel." : ""));
        return IrA(id, "estudiantes");
    }

    // ------------------------------------------------------------ recursos ---

    [HttpPost]
    public async Task<IActionResult> SubirRecurso(int id, string titulo, IFormFile? archivo, string? enlace)
    {
        if (await academico.CursoDocenteAsync(User, id) is null) return NotFound();
        enlace = string.IsNullOrWhiteSpace(enlace) ? null : enlace.Trim();

        if (string.IsNullOrWhiteSpace(titulo)) Error("Escribí un título para el recurso.");
        else if (archivo is null && enlace is null) Error("Subí un archivo o pegá un enlace.");
        else if (enlace is not null && !ArchivoService.EnlaceValido(enlace)) Error("El enlace debe empezar con https://");
        else
        {
            string? guardado = null, original = null, error = null;
            if (archivo is not null)
                (guardado, original, error) = await archivos.GuardarAsync(archivo, ArchivoService.ExtRecursos, $"recurso_c{id}");
            if (error is not null) Error(error);
            else
            {
                db.Recursos.Add(new Recurso { CursoId = id, UsuarioId = UsuarioId, Titulo = titulo.Trim(),
                                              Archivo = guardado, NombreOriginal = original, Enlace = enlace });
                await db.SaveChangesAsync();
                Exito("Recurso publicado.");
            }
        }
        return IrA(id, "recursos");
    }

    [HttpPost]
    public async Task<IActionResult> EliminarRecurso(int id)
    {
        var r = await db.Recursos.FindAsync(id);
        if (r is null || await academico.CursoDocenteAsync(User, r.CursoId) is null) return NotFound();
        archivos.Borrar(r.Archivo);
        db.Recursos.Remove(r);
        await db.SaveChangesAsync();
        Exito("Recurso eliminado.");
        return IrA(r.CursoId, "recursos");
    }
}
