using FenAcademy.Web.Data;
using FenAcademy.Web.Infrastructure;
using FenAcademy.Web.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.Features;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.WebEncoders;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------- servicios ---

// Base de datos SQLite: un archivo, sin instalar servidor. La ruta se configura en appsettings.json.
var csb = new SqliteConnectionStringBuilder(builder.Configuration.GetConnectionString("Default") ?? "Data Source=App_Data/fenacademy.db");
if (!Path.IsPathRooted(csb.DataSource))
    csb.DataSource = Path.Combine(builder.Environment.ContentRootPath, csb.DataSource);
Directory.CreateDirectory(Path.GetDirectoryName(csb.DataSource)!);
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(csb.ToString()));

builder.Services.AddScoped<AcademicoService>();
builder.Services.AddSingleton<ArchivoService>();

// Escribe "á", "ñ", "¿" tal cual en el HTML (por defecto Razor los convierte en &#xE1;).
builder.Services.Configure<WebEncoderOptions>(o => o.TextEncoderSettings = new TextEncoderSettings(UnicodeRanges.All));

// Todo POST de un formulario MVC exige el token antifalsificación (CSRF).
builder.Services.AddControllersWithViews(o => o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()));

// Login con cookie. El rol viaja como claim y [Authorize(Roles = ...)] separa las áreas.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.LoginPath = "/Cuenta/Login";
        o.AccessDeniedPath = "/Cuenta/AccesoDenegado";
        o.ExpireTimeSpan = TimeSpan.FromHours(8);
        o.SlidingExpiration = true;
        o.Events.OnValidatePrincipal = ValidacionSesion.ValidarAsync; // un cambio de rol aplica al instante
    });
builder.Services.AddAuthorization();

// Archivos de hasta 16 MB (+ margen para el resto del formulario).
const long limite = ArchivoService.TamanoMaximo + 1024 * 1024;
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = limite);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = limite);

var app = builder.Build();

// ------------------------------------------------------- base de datos inicial ---

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DatosIniciales.Inicializar(db, conDemo: app.Configuration.GetValue("DatosDemo", true));
}

// ------------------------------------------------------------------ pipeline ---

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
app.UseStatusCodePagesWithReExecute("/Home/Error", "?codigo={0}");

// Números con punto decimal (como los envía <input type="number">) y fechas yyyy-MM-dd.
app.UseRequestLocalization(o =>
{
    o.DefaultRequestCulture = new Microsoft.AspNetCore.Localization.RequestCulture(System.Globalization.CultureInfo.InvariantCulture);
    o.SupportedCultures = o.SupportedUICultures = [System.Globalization.CultureInfo.InvariantCulture];
    o.RequestCultureProviders.Clear();
});

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute("areas", "{area:exists}/{controller=Inicio}/{action=Index}/{id?}");
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");

app.Run();

/// <summary>Necesario para las pruebas de integración (WebApplicationFactory).</summary>
public partial class Program;
