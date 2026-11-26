using System.Globalization;
using System.Text;
using FenAcademy.Web.Models;

namespace FenAcademy.Web.Services;

/// <summary>Corrección automática de exámenes de opción única y respuesta corta.</summary>
public static class ExamenService
{
    /// <summary>Margen para enviar después de que el reloj llegó a cero (latencia, auto-envío).</summary>
    public static readonly TimeSpan Tolerancia = TimeSpan.FromMinutes(1);

    /// <summary>"  Élif. " → "elif": minúsculas, sin tildes, sin espacios repetidos ni punto final.</summary>
    public static string Normalizar(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return "";
        var sinTildes = new StringBuilder();
        foreach (var c in texto.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sinTildes.Append(c);
        var limpio = string.Join(' ', sinTildes.ToString().Normalize(NormalizationForm.FormC)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return limpio.TrimEnd('.', ';', '!');
    }

    public static IEnumerable<string> Aceptadas(Pregunta p) =>
        (p.RespuestasAceptadas ?? "").Split('|').Select(r => r.Trim()).Where(r => r.Length > 0);

    /// <summary>Compara normalizando texto. Si ambas son números, compara su valor (3 == 3.0, 0,5 == 0.5).</summary>
    public static bool RespuestaCortaCorrecta(Pregunta p, string? respuesta)
    {
        var r = Normalizar(respuesta);
        if (r.Length == 0) return false;
        foreach (var aceptada in Aceptadas(p).Select(Normalizar))
        {
            if (r == aceptada) return true;
            if (ANumero(r) is double a && ANumero(aceptada) is double b && Math.Abs(a - b) < 1e-9) return true;
        }
        return false;
    }

    private static double? ANumero(string s) =>
        double.TryParse(s.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var n) ? n : null;

    /// <summary>Nota 0-100 a partir de las respuestas marcadas como correctas.</summary>
    public static double CalcularNota(IEnumerable<Pregunta> preguntas, IEnumerable<Respuesta> respuestas)
    {
        var total = preguntas.Sum(p => p.Puntos);
        if (total <= 0) return 0;
        var correctas = respuestas.Where(r => r.Correcta).Select(r => r.PreguntaId).ToHashSet();
        var obtenidos = preguntas.Where(p => correctas.Contains(p.Id)).Sum(p => p.Puntos);
        return Math.Round(obtenidos * 100 / total, 2);
    }

    public static DateTime? Vence(IntentoExamen intento, Actividad examen) =>
        examen.DuracionMinutos is int min ? intento.Inicio.AddMinutes(min) : null;

    /// <summary>Mezcla determinista: el mismo estudiante ve siempre el mismo orden (y distinto al de sus compañeros).</summary>
    public static List<T> Mezclar<T>(IEnumerable<T> items, int semilla)
    {
        var lista = items.ToList();
        var rnd = new Random(semilla);
        for (var i = lista.Count - 1; i > 0; i--)
        {
            var j = rnd.Next(i + 1);
            (lista[i], lista[j]) = (lista[j], lista[i]);
        }
        return lista;
    }

    /// <summary>
    /// Lee las opciones del profesor: una por línea, la correcta empieza con "*".
    /// Devuelve null y un error si el formato no es válido.
    /// </summary>
    public static (List<Opcion>? opciones, string? error) ParsearOpciones(string? texto)
    {
        var lineas = (texto ?? "").Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0).ToList();
        var opciones = lineas.Select(l => l.StartsWith('*')
            ? new Opcion { Texto = l[1..].Trim(), EsCorrecta = true }
            : new Opcion { Texto = l }).Where(o => o.Texto.Length > 0).ToList();

        if (opciones.Count < 2) return (null, "Escribí al menos 2 opciones, una por línea.");
        if (opciones.Count(o => o.EsCorrecta) != 1) return (null, "Marcá exactamente UNA opción correcta empezando la línea con *.");
        return (opciones, null);
    }
}
