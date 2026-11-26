using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using FenAcademy.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Areas.Profesor.Controllers;

/// <summary>Armar un examen (preguntas de opción única o respuesta corta), publicarlo y revisar los intentos.</summary>
[Area("Profesor")]
[Authorize(Roles = Roles.Docentes)]
public class ExamenesController(AppDbContext db, AcademicoService academico) : FenController
{
    private async Task<Actividad?> ExamenDocenteAsync(int id)
    {
        var examen = await db.Actividades.Include(a => a.Curso).FirstOrDefaultAsync(a => a.Id == id && a.Tipo == TipoActividad.Examen);
        return examen is not null && await academico.CursoDocenteAsync(User, examen.CursoId) is not null ? examen : null;
    }

    private Task<int> IntentosAsync(int id) => db.IntentosExamen.CountAsync(i => i.ActividadId == id);

    public async Task<IActionResult> Editar(int id)
    {
        var examen = await ExamenDocenteAsync(id);
        if (examen is null) return NotFound();

        var preguntas = await db.Preguntas.Include(p => p.Opciones).Where(p => p.ActividadId == id).OrderBy(p => p.Orden).ToListAsync();
        var resultados = await db.Entregas.Include(e => e.Usuario).Where(e => e.ActividadId == id)
            .OrderBy(e => e.Usuario.Nombre).ToListAsync();
        return View(new ExamenEditarVM(examen, preguntas, await IntentosAsync(id), resultados));
    }

    [HttpPost]
    public async Task<IActionResult> Configurar(int id, string titulo, string? descripcion, DateOnly? fechaLimite,
                                                int? duracionMinutos, bool mostrarSolucion)
    {
        var examen = await ExamenDocenteAsync(id);
        if (examen is null) return NotFound();
        if (string.IsNullOrWhiteSpace(titulo)) { Error("El título es obligatorio."); return RedirectToAction(nameof(Editar), new { id }); }

        examen.Titulo = titulo.Trim();
        examen.Descripcion = descripcion?.Trim();
        examen.FechaLimite = fechaLimite;
        examen.DuracionMinutos = duracionMinutos is > 0 ? duracionMinutos : null;
        examen.MostrarSolucion = mostrarSolucion;
        await db.SaveChangesAsync();
        Exito("Configuración guardada.");
        return RedirectToAction(nameof(Editar), new { id });
    }

    [HttpPost]
    public async Task<IActionResult> AgregarPregunta(int id, string enunciado, TipoPregunta tipo, double puntos,
                                                     string? opciones, string? respuestasAceptadas)
    {
        var examen = await ExamenDocenteAsync(id);
        if (examen is null) return NotFound();

        if (await IntentosAsync(id) > 0)
            Error("Ya hay estudiantes que empezaron el examen: no se pueden cambiar las preguntas.");
        else if (string.IsNullOrWhiteSpace(enunciado))
            Error("Escribí el enunciado de la pregunta.");
        else if (puntos <= 0 || double.IsNaN(puntos))
            Error("Los puntos deben ser mayores que 0.");
        else
        {
            var orden = (await db.Preguntas.Where(p => p.ActividadId == id).MaxAsync(p => (int?)p.Orden) ?? 0) + 1;
            var pregunta = new Pregunta { ActividadId = id, Orden = orden, Enunciado = enunciado.Trim(), Tipo = tipo, Puntos = puntos };

            string? error = null;
            if (tipo == TipoPregunta.OpcionUnica)
            {
                (var lista, error) = ExamenService.ParsearOpciones(opciones);
                if (lista is not null) pregunta.Opciones = lista;
            }
            else
            {
                pregunta.RespuestasAceptadas = string.Join("|", (respuestasAceptadas ?? "").Split('|')
                    .Select(r => r.Trim()).Where(r => r.Length > 0));
                if (pregunta.RespuestasAceptadas.Length == 0) error = "Escribí al menos una respuesta aceptada.";
            }

            if (error is not null) Error(error);
            else
            {
                db.Preguntas.Add(pregunta);
                await db.SaveChangesAsync();
                Exito("Pregunta agregada.");
            }
        }
        return RedirectToAction(nameof(Editar), new { id });
    }

    [HttpPost]
    public async Task<IActionResult> EliminarPregunta(int id)
    {
        var pregunta = await db.Preguntas.FindAsync(id);
        if (pregunta is null || await ExamenDocenteAsync(pregunta.ActividadId) is null) return NotFound();

        if (await IntentosAsync(pregunta.ActividadId) > 0)
            Error("Ya hay estudiantes que empezaron el examen: no se pueden cambiar las preguntas.");
        else
        {
            db.Preguntas.Remove(pregunta);
            await db.SaveChangesAsync();
            Exito("Pregunta eliminada.");
        }
        return RedirectToAction(nameof(Editar), new { id = pregunta.ActividadId });
    }

    [HttpPost]
    public async Task<IActionResult> Publicar(int id, bool publicar)
    {
        var examen = await ExamenDocenteAsync(id);
        if (examen is null) return NotFound();

        if (publicar && !await db.Preguntas.AnyAsync(p => p.ActividadId == id))
            Error("Agregá al menos una pregunta antes de publicar.");
        else
        {
            examen.Publicada = publicar;
            await db.SaveChangesAsync();
            Exito(publicar ? "Examen publicado: los estudiantes ya pueden rendirlo." : "Examen oculto para los estudiantes.");
        }
        return RedirectToAction(nameof(Editar), new { id });
    }

    // ------------------------------------------------------------ revisión ---

    public async Task<IActionResult> Revisar(int id)
    {
        var entrega = await db.Entregas.Include(e => e.Usuario).Include(e => e.Actividad).ThenInclude(a => a.Curso)
            .Include(e => e.Respuestas).ThenInclude(r => r.Opcion)
            .FirstOrDefaultAsync(e => e.Id == id && e.Actividad.Tipo == TipoActividad.Examen);
        if (entrega is null || await academico.CursoDocenteAsync(User, entrega.Actividad.CursoId) is null) return NotFound();

        var preguntas = await db.Preguntas.Include(p => p.Opciones).Where(p => p.ActividadId == entrega.ActividadId)
            .OrderBy(p => p.Orden).ToListAsync();
        return View(new RevisarIntentoVM(entrega, preguntas, entrega.Respuestas.ToDictionary(r => r.PreguntaId)));
    }

    /// <summary>El profesor puede aceptar una respuesta corta escrita de otra forma (o anular una). Recalcula la nota.</summary>
    [HttpPost]
    public async Task<IActionResult> CambiarCorreccion(int id, bool correcta)
    {
        var respuesta = await db.Respuestas.Include(r => r.Entrega).ThenInclude(e => e.Actividad)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (respuesta is null || await academico.CursoDocenteAsync(User, respuesta.Entrega.Actividad.CursoId) is null) return NotFound();

        respuesta.Correcta = correcta;
        respuesta.CorregidaManual = true;
        await RecalcularAsync(respuesta.Entrega);
        Exito($"Corrección actualizada. Nueva nota: {respuesta.Entrega.Nota:0.##}/100.");
        return RedirectToAction(nameof(Revisar), new { id = respuesta.EntregaId });
    }

    [HttpPost]
    public async Task<IActionResult> Comentar(int id, string? retroalimentacion)
    {
        var entrega = await db.Entregas.Include(e => e.Actividad).FirstOrDefaultAsync(e => e.Id == id);
        if (entrega is null || await academico.CursoDocenteAsync(User, entrega.Actividad.CursoId) is null) return NotFound();
        entrega.Retroalimentacion = string.IsNullOrWhiteSpace(retroalimentacion) ? null : retroalimentacion.Trim();
        await db.SaveChangesAsync();
        Exito("Comentario guardado.");
        return RedirectToAction(nameof(Revisar), new { id });
    }

    private async Task RecalcularAsync(Entrega entrega)
    {
        var preguntas = await db.Preguntas.Where(p => p.ActividadId == entrega.ActividadId).ToListAsync();
        var respuestas = await db.Respuestas.Where(r => r.EntregaId == entrega.Id).ToListAsync();
        entrega.Nota = ExamenService.CalcularNota(preguntas, respuestas);
        await db.SaveChangesAsync();
    }
}
