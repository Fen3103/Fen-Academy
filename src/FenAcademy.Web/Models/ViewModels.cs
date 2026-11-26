using FenAcademy.Web.Services;

namespace FenAcademy.Web.Models;

// Datos que cada vista necesita. Se arman en el controlador y la vista solo los muestra.

public record Noticia(string Categoria, string Titulo, string Texto);

// ---------------------------------------------------------- estudiante ---

public record EstudianteInicioVM(List<Matricula> Matriculas, List<Actividad> Pendientes, Noticia Noticia);

public record FilaMatriculaVM(Curso Curso, EstadoMatricula? Estado, bool Bloqueado, string? Requisito);

public record ProgresoVM(Matricula Matricula, ResumenNotas Resumen);

public record CursoEstudianteVM(Curso Curso, Matricula Matricula, List<Clase> Clases,
                                List<ActividadNota> Notas, ResumenNotas Resumen, List<Recurso> Recursos);

public class ActividadEstudianteVM
{
    public required Actividad Actividad { get; init; }
    public required Matricula Matricula { get; init; }
    public List<Entrega> Entregas { get; init; } = [];
    public bool PuedeEntregar { get; init; }
    public bool Vencida { get; init; }

    // Solo exámenes
    public int CantidadPreguntas { get; init; }
    public double PuntosTotales { get; init; }
    public IntentoExamen? Intento { get; init; }
    public bool PuedeRendir { get; init; }
    public string? MotivoNoRendir { get; init; }
    public List<Pregunta> Solucion { get; init; } = []; // si el profesor permite ver la corrección
}

public record PreguntaRendirVM(Pregunta Pregunta, List<Opcion> Opciones);

public record RendirVM(Actividad Examen, IntentoExamen Intento, List<PreguntaRendirVM> Preguntas, DateTime? Vence);

// ------------------------------------------------------------ profesor ---

public record CursoResumenVM(Curso Curso, int Estudiantes, int Actividades, int PorRevisar);

public record EstudianteCursoVM(Usuario Usuario, Matricula Matricula, ResumenNotas Resumen);

public class CursoProfesorVM
{
    public required Curso Curso { get; init; }
    public List<Clase> Clases { get; init; } = [];
    public List<Actividad> Actividades { get; init; } = [];
    public Dictionary<int, int> EntregasPorActividad { get; init; } = [];
    public double TotalValor { get; init; }
    public List<Entrega> Entregas { get; init; } = [];
    public List<EstudianteCursoVM> Estudiantes { get; init; } = [];
    public List<Recurso> Recursos { get; init; } = [];
    public int PorRevisar => Entregas.Count(e => e.Estado == EstadoEntrega.Pendiente);
}

public record ExamenEditarVM(Actividad Examen, List<Pregunta> Preguntas, int Intentos, List<Entrega> Resultados);

public record RevisarIntentoVM(Entrega Entrega, List<Pregunta> Preguntas, Dictionary<int, Respuesta> Respuestas);

// --------------------------------------------------------------- admin ---

public record AdminVM(List<Usuario> Usuarios, List<Curso> Cursos, Dictionary<int, int> EstudiantesPorCurso,
                      List<Usuario> Profesores, int UsuarioActualId);
