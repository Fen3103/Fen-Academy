using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using FenAcademy.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Areas.Estudiante.Controllers;

/// <summary>Ver una actividad, entregar trabajos (archivo y/o enlace) y rendir exámenes.</summary>
[Area("Estudiante")]
[Authorize(Roles = Roles.Estudiante)]
public class ActividadesController(AppDbContext db, ArchivoService archivos) : FenController
{
    /// <summary>La actividad (publicada) de un curso donde el estudiante está matriculado.</summary>
    private async Task<(Actividad? actividad, Matricula? matricula)> CargarAsync(int id)
    {
        var actividad = await db.Actividades.Include(a => a.Curso).Include(a => a.Clase)
            .FirstOrDefaultAsync(a => a.Id == id && a.Publicada);
        if (actividad is null) return (null, null);
        var matricula = await db.Matriculas.FirstOrDefaultAsync(m => m.CursoId == actividad.CursoId && m.UsuarioId == UsuarioId);
        return matricula is null ? (null, null) : (actividad, matricula);
    }

    private static bool Vencida(Actividad a) => a.FechaLimite is DateOnly f && f < DateOnly.FromDateTime(DateTime.Today);

    // ------------------------------------------------------------------ ver ---

    public async Task<IActionResult> Ver(int id)
    {
        var (actividad, matricula) = await CargarAsync(id);
        if (actividad is null) return NotFound();

        var entregas = await db.Entregas.Where(e => e.ActividadId == id && e.UsuarioId == UsuarioId)
            .OrderByDescending(e => e.FechaEntrega).ThenByDescending(e => e.Id).ToListAsync();

        if (!actividad.EsExamen)
        {
            var ultima = entregas.FirstOrDefault();
            return View(new ActividadEstudianteVM
            {
                Actividad = actividad, Matricula = matricula!, Entregas = entregas, Vencida = Vencida(actividad),
                // Se puede (re)entregar mientras el curso siga abierto y la última entrega no esté aprobada.
                PuedeEntregar = matricula!.Estado == EstadoMatricula.Cursando && ultima?.Estado != EstadoEntrega.Aprobado,
            });
        }

        var intento = await FinalizarSiVencioAsync(id);
        var preguntas = await db.Preguntas.Include(p => p.Opciones).Where(p => p.ActividadId == id).OrderBy(p => p.Orden).ToListAsync();
        if (intento?.EntregaId is not null)
            entregas = await db.Entregas.Include(e => e.Respuestas).Where(e => e.Id == intento.EntregaId).ToListAsync();

        string? motivo = null;
        if (intento?.EntregaId is not null) motivo = "Ya rendiste este examen.";
        else if (matricula!.Estado != EstadoMatricula.Cursando) motivo = "El curso ya fue cerrado por tu profesor.";
        else if (Vencida(actividad) && intento is null) motivo = "La fecha límite del examen ya pasó.";
        else if (preguntas.Count == 0) motivo = "El examen todavía no tiene preguntas.";

        return View(new ActividadEstudianteVM
        {
            Actividad = actividad, Matricula = matricula!, Entregas = entregas, Vencida = Vencida(actividad),
            CantidadPreguntas = preguntas.Count, PuntosTotales = preguntas.Sum(p => p.Puntos),
            Intento = intento, PuedeRendir = motivo is null, MotivoNoRendir = motivo,
            Solucion = intento?.EntregaId is not null && actividad.MostrarSolucion ? preguntas : [],
        });
    }

    // ---------------------------------------------------- entrega de trabajo ---

    [HttpPost]
    public async Task<IActionResult> Entregar(int id, IFormFile? archivo, string? enlace, string? comentario)
    {
        var (actividad, matricula) = await CargarAsync(id);
        if (actividad is null || actividad.EsExamen) return NotFound();

        var ultima = await db.Entregas.Where(e => e.ActividadId == id && e.UsuarioId == UsuarioId)
            .OrderByDescending(e => e.FechaEntrega).ThenByDescending(e => e.Id).FirstOrDefaultAsync();
        enlace = string.IsNullOrWhiteSpace(enlace) ? null : enlace.Trim();

        if (matricula!.Estado != EstadoMatricula.Cursando || ultima?.Estado == EstadoEntrega.Aprobado)
            Error("Esta actividad ya no admite entregas.");
        else if (archivo is null && enlace is null)
            Error("Subí un archivo o pegá el enlace de tu repositorio (o las dos cosas).");
        else if (enlace is not null && !ArchivoService.EnlaceValido(enlace))
            Error("El enlace debe empezar con https:// (por ejemplo https://github.com/tu-usuario/tu-proyecto).");
        else
        {
            string? guardado = null, original = null, error = null;
            if (archivo is not null)
                (guardado, original, error) = await archivos.GuardarAsync(archivo, ArchivoService.ExtEntregas, $"entrega_a{id}_u{UsuarioId}");

            if (error is not null) Error(error);
            else
            {
                db.Entregas.Add(new Entrega
                {
                    ActividadId = id, UsuarioId = UsuarioId, Archivo = guardado, NombreOriginal = original, Enlace = enlace,
                    Comentario = string.IsNullOrWhiteSpace(comentario) ? null : comentario.Trim(),
                    FueraDeTiempo = Vencida(actividad),
                });
                await db.SaveChangesAsync();
                Exito("Actividad entregada correctamente.");
            }
        }
        return RedirectToAction(nameof(Ver), new { id });
    }

    // -------------------------------------------------------------- examen ---

    [HttpPost]
    public async Task<IActionResult> Comenzar(int id)
    {
        var (actividad, matricula) = await CargarAsync(id);
        if (actividad is null || !actividad.EsExamen) return NotFound();

        var intento = await db.IntentosExamen.FirstOrDefaultAsync(i => i.ActividadId == id && i.UsuarioId == UsuarioId);
        if (intento is null)
        {
            var hayPreguntas = await db.Preguntas.AnyAsync(p => p.ActividadId == id);
            if (matricula!.Estado != EstadoMatricula.Cursando || Vencida(actividad) || !hayPreguntas)
            {
                Error("Este examen no está disponible.");
                return RedirectToAction(nameof(Ver), new { id });
            }
            db.IntentosExamen.Add(new IntentoExamen { ActividadId = id, UsuarioId = UsuarioId, Inicio = DateTime.Now });
            await db.SaveChangesAsync();
        }
        return RedirectToAction(nameof(Rendir), new { id });
    }

    public async Task<IActionResult> Rendir(int id)
    {
        var (actividad, _) = await CargarAsync(id);
        if (actividad is null || !actividad.EsExamen) return NotFound();

        var intento = await FinalizarSiVencioAsync(id);
        if (intento is null || intento.EntregaId is not null) return RedirectToAction(nameof(Ver), new { id });

        var preguntas = await db.Preguntas.Include(p => p.Opciones).Where(p => p.ActividadId == id).ToListAsync();
        // Orden mezclado por estudiante: dificulta copiarse entre compañeros.
        var semilla = UsuarioId * 7919 + id; // determinista (HashCode.Combine cambia en cada ejecución)
        var vm = ExamenService.Mezclar(preguntas.OrderBy(p => p.Orden), semilla)
            .Select(p => new PreguntaRendirVM(p, ExamenService.Mezclar(p.Opciones.OrderBy(o => o.Id), semilla + p.Id)))
            .ToList();

        return View(new RendirVM(actividad, intento, vm, ExamenService.Vence(intento, actividad)));
    }

    [HttpPost]
    public async Task<IActionResult> Enviar(int id, IFormCollection form)
    {
        var (actividad, _) = await CargarAsync(id);
        if (actividad is null || !actividad.EsExamen) return NotFound();

        var intento = await db.IntentosExamen.FirstOrDefaultAsync(i => i.ActividadId == id && i.UsuarioId == UsuarioId);
        if (intento is null || intento.EntregaId is not null) return RedirectToAction(nameof(Ver), new { id });

        var preguntas = await db.Preguntas.Include(p => p.Opciones).Where(p => p.ActividadId == id).ToListAsync();
        var respuestas = new List<Respuesta>();
        foreach (var p in preguntas)
        {
            var valor = form[$"p{p.Id}"].ToString();
            var r = new Respuesta { PreguntaId = p.Id };
            if (p.Tipo == TipoPregunta.OpcionUnica)
            {
                var opcion = int.TryParse(valor, out var oid) ? p.Opciones.FirstOrDefault(o => o.Id == oid) : null;
                r.OpcionId = opcion?.Id;
                r.Correcta = opcion?.EsCorrecta == true;
            }
            else
            {
                r.Texto = valor.Length > 500 ? valor[..500] : valor;
                r.Correcta = ExamenService.RespuestaCortaCorrecta(p, valor);
            }
            respuestas.Add(r);
        }

        var vence = ExamenService.Vence(intento, actividad);
        var entrega = new Entrega
        {
            ActividadId = id, UsuarioId = UsuarioId, Respuestas = respuestas,
            Estado = EstadoEntrega.Revisado, Nota = ExamenService.CalcularNota(preguntas, respuestas),
            FueraDeTiempo = vence is not null && DateTime.Now > vence.Value + ExamenService.Tolerancia,
        };
        db.Entregas.Add(entrega);
        await db.SaveChangesAsync();
        intento.EntregaId = entrega.Id;
        await db.SaveChangesAsync();

        Exito($"Examen enviado. Tu nota: {entrega.Nota:0.##}/100.");
        return RedirectToAction(nameof(Ver), new { id });
    }

    /// <summary>Si el tiempo se agotó y el estudiante nunca envió (cerró la pestaña), se cierra con nota 0.</summary>
    private async Task<IntentoExamen?> FinalizarSiVencioAsync(int actividadId)
    {
        var intento = await db.IntentosExamen.Include(i => i.Actividad)
            .FirstOrDefaultAsync(i => i.ActividadId == actividadId && i.UsuarioId == UsuarioId);
        if (intento is null || intento.EntregaId is not null) return intento;

        var vence = ExamenService.Vence(intento, intento.Actividad);
        if (vence is null || DateTime.Now <= vence.Value + ExamenService.Tolerancia) return intento;

        var entrega = new Entrega
        {
            ActividadId = actividadId, UsuarioId = UsuarioId, Estado = EstadoEntrega.Revisado, Nota = 0,
            FueraDeTiempo = true, Comentario = "Tiempo agotado sin enviar respuestas.",
        };
        db.Entregas.Add(entrega);
        await db.SaveChangesAsync();
        intento.EntregaId = entrega.Id;
        await db.SaveChangesAsync();
        return intento;
    }
}
