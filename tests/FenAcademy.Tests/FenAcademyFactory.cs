using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FenAcademy.Tests;

/// <summary>Levanta la app real con una base SQLite y carpeta de archivos temporales (una por prueba).</summary>
public class FenAcademyFactory : WebApplicationFactory<Program>
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "fenacademy-tests-" + Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(_dir);
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={Path.Combine(_dir, "test.db")};Pooling=False");
        builder.UseSetting("Almacenamiento:Uploads", Path.Combine(_dir, "uploads"));
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { Directory.Delete(_dir, true); } catch (IOException) { }
    }

    public Navegador Navegador() => new(CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }));

    /// <summary>Un navegador nuevo con la sesión de ese usuario ya iniciada.</summary>
    public async Task<Navegador> ComoAsync(string usuario, string password)
    {
        var nav = Navegador();
        var r = await nav.LoginAsync(usuario, password);
        if (r.StatusCode != HttpStatusCode.Redirect) throw new InvalidOperationException("No se pudo iniciar sesión como " + usuario);
        return nav;
    }
}

/// <summary>Cliente HTTP con cookies que sabe iniciar sesión y enviar formularios con token antifalsificación.</summary>
public partial class Navegador(HttpClient http)
{
    public HttpClient Http { get; } = http;

    [GeneratedRegex("name=\"__RequestVerificationToken\" type=\"hidden\" value=\"([^\"]+)\"")]
    private static partial Regex TokenRegex();

    public async Task<string> TokenAsync(string url)
    {
        var html = await Http.GetStringAsync(url);
        return TokenRegex().Match(html).Groups[1].Value;
    }

    public async Task<HttpResponseMessage> LoginAsync(string usuario, string password)
    {
        var token = await TokenAsync("/Cuenta/Login");
        return await Http.PostAsync("/Cuenta/Login", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["usuario"] = usuario, ["password"] = password, ["__RequestVerificationToken"] = token,
        }));
    }

    public async Task<HttpResponseMessage> PostAsync(string url, Dictionary<string, string>? datos = null)
    {
        var token = await TokenAsync("/Cuenta/Perfil");
        var form = new Dictionary<string, string>(datos ?? []) { ["__RequestVerificationToken"] = token };
        return await Http.PostAsync(url, new FormUrlEncodedContent(form));
    }

    public async Task<HttpResponseMessage> PostArchivoAsync(string url, string nombreArchivo, byte[] contenido, Dictionary<string, string>? datos = null)
    {
        var token = await TokenAsync("/Cuenta/Perfil");
        var form = new MultipartFormDataContent { { new StringContent(token), "__RequestVerificationToken" } };
        foreach (var (k, v) in datos ?? []) form.Add(new StringContent(v), k);
        form.Add(new ByteArrayContent(contenido), "archivo", nombreArchivo);
        return await Http.PostAsync(url, form);
    }

    /// <summary>GET siguiendo redirecciones; devuelve el HTML final.</summary>
    public async Task<string> HtmlAsync(string url)
    {
        for (var i = 0; i < 5; i++)
        {
            var r = await Http.GetAsync(url);
            if (r.StatusCode is HttpStatusCode.Redirect or HttpStatusCode.Found)
            {
                url = r.Headers.Location!.ToString();
                continue;
            }
            return await r.Content.ReadAsStringAsync();
        }
        throw new InvalidOperationException("Demasiadas redirecciones");
    }
}
