using FenAcademy.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace FenAcademy.Web.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Curso> Cursos => Set<Curso>();
    public DbSet<Matricula> Matriculas => Set<Matricula>();
    public DbSet<Clase> Clases => Set<Clase>();
    public DbSet<Actividad> Actividades => Set<Actividad>();
    public DbSet<Entrega> Entregas => Set<Entrega>();
    public DbSet<Pregunta> Preguntas => Set<Pregunta>();
    public DbSet<Opcion> Opciones => Set<Opcion>();
    public DbSet<IntentoExamen> IntentosExamen => Set<IntentoExamen>();
    public DbSet<Respuesta> Respuestas => Set<Respuesta>();
    public DbSet<Recurso> Recursos => Set<Recurso>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        // Guardamos los enums como texto ("Profesor", "Aprobado"...) para que la base sea legible.
        builder.Properties<Rol>().HaveConversion<string>();
        builder.Properties<EstadoMatricula>().HaveConversion<string>();
        builder.Properties<EstadoEntrega>().HaveConversion<string>();
        builder.Properties<TipoActividad>().HaveConversion<string>();
        builder.Properties<TipoPregunta>().HaveConversion<string>();
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Usuario>().HasIndex(u => u.NombreUsuario).IsUnique();
        b.Entity<Curso>().HasIndex(c => c.Codigo).IsUnique();

        b.Entity<Curso>().HasOne(c => c.Profesor).WithMany()
            .HasForeignKey(c => c.ProfesorId).OnDelete(DeleteBehavior.SetNull);

        b.Entity<Matricula>().HasIndex(m => new { m.UsuarioId, m.CursoId }).IsUnique();

        b.Entity<Actividad>().HasOne(a => a.Clase).WithMany()
            .HasForeignKey(a => a.ClaseId).OnDelete(DeleteBehavior.SetNull);

        b.Entity<IntentoExamen>().HasIndex(i => new { i.ActividadId, i.UsuarioId }).IsUnique();
        b.Entity<IntentoExamen>().HasOne(i => i.Entrega).WithMany()
            .HasForeignKey(i => i.EntregaId).OnDelete(DeleteBehavior.SetNull);
        b.Entity<IntentoExamen>().HasOne<Usuario>().WithMany()
            .HasForeignKey(i => i.UsuarioId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<Respuesta>().HasOne(r => r.Opcion).WithMany()
            .HasForeignKey(r => r.OpcionId).OnDelete(DeleteBehavior.SetNull);
    }
}
