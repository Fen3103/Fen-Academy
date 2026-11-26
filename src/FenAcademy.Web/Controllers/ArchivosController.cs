using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Models;
using FenAcademy.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Controllers;

/// <summary>Descargas con control de permisos (los archivos no son públicos).</summary>
[Authorize]
public class ArchivosController(AppDbContext db, AcademicoService academico, ArchivoService archivos) : FenController
{
    private static readonly FileExtensionContentTypeProvider Tipos = new();

    public async Task<IActionResult> Recurso(int id)
    {
        var r = await db.Recursos.FindAsync(id);
        if (r?.Archivo is null || !await academico.PuedeVerCursoAsync(User, r.CursoId)) return NotFound();
        return Enviar(r.Archivo, r.NombreOriginal!);
    }

    /// <summary>El estudiante descarga la suya; el profesor del curso (o el admin), cualquiera.</summary>
    public async Task<IActionResult> Entrega(int id)
    {
        var e = await db.Entregas.Include(x => x.Actividad).ThenInclude(a => a.Curso).FirstOrDefaultAsync(x => x.Id == id);
        if (e?.Archivo is null) return NotFound();

        var permitido = User.Rol() switch
        {
            Rol.Admin => true,
            Rol.Profesor => e.Actividad.Curso.ProfesorId == UsuarioId,
            _ => e.UsuarioId == UsuarioId,
        };
        return permitido ? Enviar(e.Archivo, e.NombreOriginal!) : NotFound();
    }

    private IActionResult Enviar(string guardado, string original)
    {
        var ruta = archivos.Ruta(guardado);
        if (!System.IO.File.Exists(ruta)) return NotFound();
        if (!Tipos.TryGetContentType(original, out var tipo)) tipo = "application/octet-stream";
        return PhysicalFile(ruta, tipo, original);
    }
}
