namespace FenAcademy.Web.Services;

/// <summary>Guarda los archivos subidos fuera de wwwroot, así solo se descargan pasando por un control de permisos.</summary>
public class ArchivoService
{
    public const long TamanoMaximo = 16 * 1024 * 1024; // 16 MB

    /// <summary>Lo que puede subir un estudiante: código y documentos.</summary>
    public static readonly string[] ExtEntregas =
        ["pdf", "zip", "txt", "md", "py", "ipynb", "js", "ts", "html", "css", "sql", "java", "c", "cpp", "cs", "json"];

    /// <summary>Lo que puede subir un profesor como material.</summary>
    public static readonly string[] ExtRecursos =
        [.. ExtEntregas, "doc", "docx", "ppt", "pptx", "xls", "xlsx", "png", "jpg", "jpeg"];

    private readonly string _carpeta;

    public ArchivoService(IConfiguration config, IWebHostEnvironment env)
    {
        _carpeta = Path.Combine(env.ContentRootPath, config["Almacenamiento:Uploads"] ?? "App_Data/uploads");
        Directory.CreateDirectory(_carpeta);
    }

    public static string Accept(IEnumerable<string> ext) => string.Join(",", ext.Select(e => "." + e));

    /// <summary>Devuelve (nombreGuardado, nombreOriginal) o un mensaje de error.</summary>
    public async Task<(string? guardado, string? original, string? error)> GuardarAsync(IFormFile? archivo, string[] permitidas, string prefijo)
    {
        if (archivo is null || archivo.Length == 0) return (null, null, "Seleccioná un archivo.");
        if (archivo.Length > TamanoMaximo) return (null, null, "El archivo supera los 16 MB.");

        var ext = Path.GetExtension(archivo.FileName).TrimStart('.').ToLowerInvariant();
        if (!permitidas.Contains(ext))
            return (null, null, "Tipo de archivo no permitido. Formatos válidos: " + string.Join(", ", permitidas));

        var original = Path.GetFileName(archivo.FileName);
        var guardado = $"{prefijo}_{Guid.NewGuid():N}.{ext}"; // nunca usamos el nombre del usuario como ruta
        await using var destino = File.Create(Path.Combine(_carpeta, guardado));
        await archivo.CopyToAsync(destino);
        return (guardado, original, null);
    }

    public string Ruta(string guardado) => Path.Combine(_carpeta, Path.GetFileName(guardado));

    public void Borrar(string? guardado)
    {
        if (string.IsNullOrEmpty(guardado)) return;
        var ruta = Ruta(guardado);
        if (File.Exists(ruta)) File.Delete(ruta);
    }

    /// <summary>Acepta solo enlaces http(s), ej. https://github.com/usuario/proyecto.</summary>
    public static bool EnlaceValido(string? enlace) =>
        Uri.TryCreate(enlace, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);
}
