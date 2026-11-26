using System.Security.Claims;
using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Services;

public record ActividadNota(Actividad Actividad, Entrega? Entrega)
{
    public double? Aporte => Entrega?.Nota is double n ? Math.Round(n * Actividad.Valor / 100, 2) : null;
}

public record ResumenNotas(double NotaAcumulada, double PorcentajeEvaluado, double TotalValor, int Entregadas, int Total)
{
    public int PorcentajeEntregado => Total == 0 ? 0 : (int)Math.Round(Entregadas * 100.0 / Total);
}

/// <summary>Reglas académicas: permisos sobre cursos, requisitos entre niveles y cálculo de notas.</summary>
public class AcademicoService(AppDbContext db)
{
    // ------------------------------------------------------------ permisos ---

    /// <summary>El curso si el usuario es su profesor (o admin); si no, null.</summary>
    public Task<Curso?> CursoDocenteAsync(ClaimsPrincipal user, int cursoId)
    {
        var query = db.Cursos.Include(c => c.Profesor).Where(c => c.Id == cursoId);
        if (user.Rol() != Rol.Admin)
        {
            var uid = user.UsuarioId();
            query = query.Where(c => c.ProfesorId == uid);
        }
        return query.FirstOrDefaultAsync();
    }

    public async Task<bool> PuedeVerCursoAsync(ClaimsPrincipal user, int cursoId)
    {
        var uid = user.UsuarioId();
        return user.Rol() switch
        {
            Rol.Admin => true,
            Rol.Profesor => await db.Cursos.AnyAsync(c => c.Id == cursoId && c.ProfesorId == uid),
            _ => await db.Matriculas.AnyAsync(m => m.CursoId == cursoId && m.UsuarioId == uid),
        };
    }

    // ----------------------------------------------------------- materias ---

    /// <summary>
    /// Nivel 1 (o el nivel más bajo del lenguaje) es libre. Para los demás hay que haber aprobado
    /// algún curso del nivel anterior que exista en ese lenguaje (si falta el nivel 2, el 3 pide el 1).
    /// </summary>
    public async Task<(bool cumplido, string? requisito)> RequisitoAsync(Curso curso, int usuarioId)
    {
        var lenguaje = curso.Lenguaje.ToLower();
        var nivelAnterior = await db.Cursos
            .Where(c => c.Lenguaje.ToLower() == lenguaje && c.Nivel < curso.Nivel)
            .MaxAsync(c => (int?)c.Nivel);
        if (nivelAnterior is null) return (true, null);

        var anteriores = await db.Cursos
            .Where(c => c.Lenguaje.ToLower() == lenguaje && c.Nivel == nivelAnterior)
            .Select(c => c.Codigo + " " + c.Nombre).ToListAsync();

        var aprobado = await db.Matriculas.AnyAsync(m =>
            m.UsuarioId == usuarioId && m.Estado == EstadoMatricula.Aprobado &&
            m.Curso.Lenguaje.ToLower() == lenguaje && m.Curso.Nivel == nivelAnterior);

        return (aprobado, string.Join(" o ", anteriores));
    }

    /// <summary>Si ya existe "Python", no permite crear "python" o " PYTHON " como otra ruta distinta.</summary>
    public async Task<string> NormalizarLenguajeAsync(string lenguaje)
    {
        lenguaje = string.Join(' ', lenguaje.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        var bajo = lenguaje.ToLower();
        var existente = await db.Cursos.Where(c => c.Lenguaje.ToLower() == bajo).Select(c => c.Lenguaje).FirstOrDefaultAsync();
        return existente ?? lenguaje;
    }

    public static string NormalizarCodigo(string codigo) => codigo.Trim().ToUpperInvariant().Replace(' ', '-');

    // -------------------------------------------------------------- notas ---

    /// <summary>Cada actividad publicada del curso con la última entrega del estudiante.</summary>
    public async Task<List<ActividadNota>> NotasAsync(int cursoId, int usuarioId)
    {
        var actividades = await db.Actividades.Include(a => a.Clase)
            .Where(a => a.CursoId == cursoId && a.Publicada)
            .ToListAsync();
        var entregas = await db.Entregas
            .Where(e => e.UsuarioId == usuarioId && e.Actividad.CursoId == cursoId)
            .ToListAsync();

        return actividades
            .OrderBy(a => a.FechaLimite is null).ThenBy(a => a.FechaLimite).ThenBy(a => a.Id)
            .Select(a => new ActividadNota(a, entregas
                .Where(e => e.ActividadId == a.Id)
                .OrderByDescending(e => e.FechaEntrega).ThenByDescending(e => e.Id)
                .FirstOrDefault()))
            .ToList();
    }

    /// <summary>Nota acumulada = Σ(nota × valor%) de las actividades ya calificadas.</summary>
    public static ResumenNotas Resumen(IReadOnlyCollection<ActividadNota> notas)
    {
        var calificadas = notas.Where(n => n.Entrega?.Nota is not null).ToList();
        return new ResumenNotas(
            NotaAcumulada: Math.Round(calificadas.Sum(n => n.Entrega!.Nota!.Value * n.Actividad.Valor / 100), 2),
            PorcentajeEvaluado: Math.Round(calificadas.Sum(n => n.Actividad.Valor), 2),
            TotalValor: Math.Round(notas.Sum(n => n.Actividad.Valor), 2),
            Entregadas: notas.Count(n => n.Entrega is not null),
            Total: notas.Count);
    }

    /// <summary>Porcentaje ya asignado en el curso (entregas + exámenes). No puede pasar de 100.</summary>
    public async Task<double> ValorAsignadoAsync(int cursoId) =>
        Math.Round((await db.Actividades.Where(a => a.CursoId == cursoId).Select(a => a.Valor).ToListAsync()).Sum(), 2);
}
