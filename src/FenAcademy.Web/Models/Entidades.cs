namespace FenAcademy.Web.Models;

// ---------------------------------------------------------------- enums ---

public enum Rol { Estudiante, Profesor, Admin }

public enum EstadoMatricula { Cursando, Aprobado, Reprobado }

public enum EstadoEntrega { Pendiente, Revisado, Aprobado, Rechazado }

/// <summary>Una actividad es una entrega de trabajo (archivo o enlace) o un examen en línea.</summary>
public enum TipoActividad { Entrega, Examen }

public enum TipoPregunta { OpcionUnica, RespuestaCorta }

// ------------------------------------------------------------- entidades ---

public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string NombreUsuario { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public Rol Rol { get; set; } = Rol.Estudiante;
    public string? Email { get; set; }
    public DateOnly? FechaNacimiento { get; set; }
    public DateTime FechaRegistro { get; set; } = DateTime.Now;

    public List<Matricula> Matriculas { get; set; } = [];
}

/// <summary>Una materia. Los cursos de un mismo lenguaje forman una ruta por niveles (1, 2, 3...).</summary>
public class Curso
{
    public int Id { get; set; }
    /// <summary>Código único visible, ej. PY-1. Evita confusiones entre lenguajes parecidos (Java / JavaScript).</summary>
    public string Codigo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public string Lenguaje { get; set; } = "";
    public int Nivel { get; set; } = 1;
    public string? Descripcion { get; set; }

    public int? ProfesorId { get; set; }
    public Usuario? Profesor { get; set; }

    public List<Matricula> Matriculas { get; set; } = [];
    public List<Clase> Clases { get; set; } = [];
    public List<Actividad> Actividades { get; set; } = [];
    public List<Recurso> Recursos { get; set; } = [];
}

public class Matricula
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;
    public EstadoMatricula Estado { get; set; } = EstadoMatricula.Cursando;
    public DateTime Fecha { get; set; } = DateTime.Now;
}

public class Clase
{
    public int Id { get; set; }
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;
    public string Titulo { get; set; } = "";
    public string? Descripcion { get; set; }
    public int Orden { get; set; } = 1;
}

public class Actividad
{
    public int Id { get; set; }
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;
    public int? ClaseId { get; set; }
    public Clase? Clase { get; set; }

    public TipoActividad Tipo { get; set; } = TipoActividad.Entrega;
    public string Titulo { get; set; } = "";
    public string? Descripcion { get; set; }
    public DateOnly? FechaLimite { get; set; }
    /// <summary>Porcentaje que aporta a la nota final del curso (0-100).</summary>
    public double Valor { get; set; }

    /// <summary>Los exámenes se crean ocultos y el profesor los publica cuando terminó de cargar preguntas.</summary>
    public bool Publicada { get; set; } = true;
    public int? DuracionMinutos { get; set; }
    public bool MostrarSolucion { get; set; }

    public List<Pregunta> Preguntas { get; set; } = [];
    public List<Entrega> Entregas { get; set; } = [];

    public bool EsExamen => Tipo == TipoActividad.Examen;
}

/// <summary>Trabajo del estudiante. En un examen, la entrega es el intento enviado (sin archivo).</summary>
public class Entrega
{
    public int Id { get; set; }
    public int ActividadId { get; set; }
    public Actividad Actividad { get; set; } = null!;
    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;

    public string? Archivo { get; set; }          // nombre guardado en disco
    public string? NombreOriginal { get; set; }   // nombre con el que se subió
    public string? Enlace { get; set; }           // ej. repositorio en GitHub
    public string? Comentario { get; set; }

    public EstadoEntrega Estado { get; set; } = EstadoEntrega.Pendiente;
    public double? Nota { get; set; }             // 0-100
    public string? Retroalimentacion { get; set; }
    public DateTime FechaEntrega { get; set; } = DateTime.Now;
    public bool FueraDeTiempo { get; set; }

    public List<Respuesta> Respuestas { get; set; } = [];
}

public class Pregunta
{
    public int Id { get; set; }
    public int ActividadId { get; set; }
    public Actividad Actividad { get; set; } = null!;
    public int Orden { get; set; }
    public string Enunciado { get; set; } = "";
    public TipoPregunta Tipo { get; set; }
    public double Puntos { get; set; } = 1;
    /// <summary>Solo respuesta corta: respuestas válidas separadas por "|". Ej: "15|quince".</summary>
    public string? RespuestasAceptadas { get; set; }

    public List<Opcion> Opciones { get; set; } = [];
}

public class Opcion
{
    public int Id { get; set; }
    public int PreguntaId { get; set; }
    public Pregunta Pregunta { get; set; } = null!;
    public string Texto { get; set; } = "";
    public bool EsCorrecta { get; set; }
}

/// <summary>Marca cuándo empezó un estudiante su examen (un solo intento por examen).</summary>
public class IntentoExamen
{
    public int Id { get; set; }
    public int ActividadId { get; set; }
    public Actividad Actividad { get; set; } = null!;
    public int UsuarioId { get; set; }
    public DateTime Inicio { get; set; } = DateTime.Now;
    public int? EntregaId { get; set; }
    public Entrega? Entrega { get; set; }
}

public class Respuesta
{
    public int Id { get; set; }
    public int EntregaId { get; set; }
    public Entrega Entrega { get; set; } = null!;
    public int PreguntaId { get; set; }
    public Pregunta Pregunta { get; set; } = null!;
    public int? OpcionId { get; set; }
    public Opcion? Opcion { get; set; }
    public string? Texto { get; set; }
    public bool Correcta { get; set; }
    /// <summary>true si el profesor cambió la corrección automática.</summary>
    public bool CorregidaManual { get; set; }
}

public class Recurso
{
    public int Id { get; set; }
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;
    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public string Titulo { get; set; } = "";
    public string? Archivo { get; set; }
    public string? NombreOriginal { get; set; }
    public string? Enlace { get; set; }           // video, repositorio, documentación...
    public DateTime FechaSubida { get; set; } = DateTime.Now;
}
