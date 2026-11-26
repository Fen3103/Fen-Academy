using FenAcademy.Web.Models;
using Microsoft.AspNetCore.Identity;

namespace FenAcademy.Web.Data;

/// <summary>Crea la base (si no existe) y la llena con usuarios, cursos, clases y un examen de ejemplo.</summary>
public static class DatosIniciales
{
    public static void Inicializar(AppDbContext db, bool conDemo = true)
    {
        db.Database.EnsureCreated();
        if (!conDemo || db.Usuarios.Any()) return;

        var hasher = new PasswordHasher<Usuario>();
        Usuario Nuevo(string nombre, string usuario, string password, Rol rol)
        {
            var u = new Usuario { Nombre = nombre, NombreUsuario = usuario, Rol = rol };
            u.PasswordHash = hasher.HashPassword(u, password);
            return u;
        }

        var admin = Nuevo("Administrador", "admin", "admin123", Rol.Admin);
        var profe = Nuevo("Profe Fen", "profe", "profe123", Rol.Profesor);
        var ana = Nuevo("Ana Estudiante", "ana", "ana123", Rol.Estudiante);
        var luis = Nuevo("Luis Estudiante", "luis", "luis123", Rol.Estudiante);
        db.Usuarios.AddRange(admin, profe, ana, luis);

        Curso NuevoCurso(string codigo, string nombre, string lenguaje, int nivel, string descripcion, params (string titulo, string desc)[] clases)
        {
            var c = new Curso { Codigo = codigo, Nombre = nombre, Lenguaje = lenguaje, Nivel = nivel, Descripcion = descripcion, Profesor = profe };
            for (var i = 0; i < clases.Length; i++)
                c.Clases.Add(new Clase { Orden = i + 1, Titulo = clases[i].titulo, Descripcion = clases[i].desc });
            return c;
        }

        var py1 = NuevoCurso("PY-1", "Python desde cero", "Python", 1, "Primeros pasos: variables, tipos de datos, condicionales y bucles.",
            ("¿Qué es programar?", "Algoritmos, instalación de Python, el intérprete y el primer print()."),
            ("Variables y tipos", "int, float, str y bool. Leer datos con input() y convertir con int() / float()."),
            ("Condicionales", "if, elif, else. Operadores de comparación y lógicos (and, or, not)."),
            ("Bucles", "while y for con range(). Contadores, acumuladores y break."));
        var py2 = NuevoCurso("PY-2", "Python intermedio", "Python", 2, "Funciones, colecciones y archivos.",
            ("Funciones", "def, parámetros, return y alcance de variables."),
            ("Listas y tuplas", "Índices, slicing, métodos de lista y recorridos."),
            ("Diccionarios y conjuntos", "Clave-valor, .get(), .items() y operaciones de conjuntos."),
            ("Archivos y errores", "open(), with, lectura/escritura y try / except."));
        var py3 = NuevoCurso("PY-3", "Python avanzado", "Python", 3, "Programación orientada a objetos, módulos y pruebas.",
            ("Clases y objetos", "class, __init__, atributos y métodos."),
            ("Herencia y polimorfismo", "Subclases, super() y sobrescritura de métodos."),
            ("Módulos y paquetes", "import, entornos virtuales y pip."),
            ("Pruebas", "assert y pytest para comprobar que el código funciona."));
        var js1 = NuevoCurso("JS-1", "JavaScript básico", "JavaScript", 1, "Sintaxis del lenguaje y primeros pasos en el navegador.",
            ("JavaScript en el navegador", "La consola, <script> y console.log()."),
            ("Variables y tipos", "let, const, number, string, boolean y conversiones."),
            ("Condicionales y bucles", "if/else, for, while y operadores."),
            ("El DOM", "querySelector, textContent y eventos con addEventListener."));
        var js2 = NuevoCurso("JS-2", "JavaScript intermedio", "JavaScript", 2, "Funciones modernas, arrays y peticiones a APIs.",
            ("Funciones flecha", "Sintaxis =>, parámetros por defecto y callbacks."),
            ("Arrays", "map, filter, reduce y find."),
            ("Objetos y JSON", "Desestructuración, spread y JSON.parse / stringify."),
            ("fetch y async/await", "Pedir datos a una API y mostrarlos en la página."));
        db.Cursos.AddRange(py1, py2, py3, js1, js2);
        db.SaveChanges();

        // Actividades de ejemplo en Python 1
        db.Actividades.AddRange(
            new Actividad
            {
                Curso = py1, Clase = py1.Clases[1], Tipo = TipoActividad.Entrega, Valor = 30,
                Titulo = "Calculadora de edad", FechaLimite = DateOnly.FromDateTime(DateTime.Today.AddDays(14)),
                Descripcion = "Pedí el año de nacimiento y mostrá la edad. Subí el archivo .py o el enlace a tu repositorio de GitHub.",
            },
            new Actividad
            {
                Curso = py1, Clase = py1.Clases[2], Tipo = TipoActividad.Entrega, Valor = 30,
                Titulo = "¿Par o impar?", FechaLimite = DateOnly.FromDateTime(DateTime.Today.AddDays(21)),
                Descripcion = "Leé un número entero e indicá si es par o impar usando el operador %.",
            });

        var examen = new Actividad
        {
            Curso = py1, Tipo = TipoActividad.Examen, Valor = 40, Publicada = true, DuracionMinutos = 20, MostrarSolucion = true,
            Titulo = "Examen parcial: fundamentos", FechaLimite = DateOnly.FromDateTime(DateTime.Today.AddDays(28)),
            Descripcion = "Preguntas de opción única y de respuesta corta. Tenés un solo intento.",
        };
        examen.Preguntas.Add(OpcionUnica(1, "¿Qué función muestra texto en pantalla en Python?", "print()", "input()", "echo()", "show()"));
        examen.Preguntas.Add(OpcionUnica(2, "¿Qué tipo de dato es 3.14?", "float", "int", "str", "bool"));
        examen.Preguntas.Add(new Pregunta { Orden = 3, Tipo = TipoPregunta.RespuestaCorta, Puntos = 1,
            Enunciado = "¿Qué imprime print(7 // 2)?", RespuestasAceptadas = "3" });
        examen.Preguntas.Add(new Pregunta { Orden = 4, Tipo = TipoPregunta.RespuestaCorta, Puntos = 1,
            Enunciado = "¿Qué palabra clave se usa para definir una condición alternativa después de if (antes de else)?", RespuestasAceptadas = "elif" });
        db.Actividades.Add(examen);

        db.Matriculas.Add(new Matricula { Usuario = ana, Curso = py1 });
        db.SaveChanges();
    }

    /// <summary>La primera opción es la correcta (al estudiante se le muestran mezcladas).</summary>
    private static Pregunta OpcionUnica(int orden, string enunciado, string correcta, params string[] incorrectas)
    {
        var p = new Pregunta { Orden = orden, Tipo = TipoPregunta.OpcionUnica, Puntos = 1, Enunciado = enunciado };
        p.Opciones.Add(new Opcion { Texto = correcta, EsCorrecta = true });
        foreach (var o in incorrectas) p.Opciones.Add(new Opcion { Texto = o });
        return p;
    }
}
