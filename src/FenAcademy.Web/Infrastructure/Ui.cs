using System.Globalization;
using System.Text.Encodings.Web;
using FenAcademy.Web.Models;
using Microsoft.AspNetCore.Html;

namespace FenAcademy.Web.Infrastructure;

/// <summary>Pequeños helpers de presentación usados por las vistas (chips de estado, porcentajes).</summary>
public static class Ui
{
    public static string Num(double? v) => v is double d ? d.ToString("0.##", CultureInfo.InvariantCulture) : "—";
    public static string Pct(double v) => Num(v) + "%";
    public static string Fecha(DateTime d) => d.ToString("yyyy-MM-dd HH:mm");
    public static string Fecha(DateOnly? d) => d?.ToString("yyyy-MM-dd") ?? "Sin fecha";

    private static IHtmlContent Chip(string clase, string texto) =>
        new HtmlString($"<span class=\"estado-chip {clase}\">{HtmlEncoder.Default.Encode(texto)}</span>");

    public static IHtmlContent ChipEntrega(EstadoEntrega? e) => e switch
    {
        EstadoEntrega.Aprobado => Chip("estado-ok", "Aprobado"),
        EstadoEntrega.Revisado => Chip("estado-open", "Revisado"),
        EstadoEntrega.Rechazado => Chip("estado-bad", "Rechazado"),
        EstadoEntrega.Pendiente => Chip("estado-wait", "Por revisar"),
        _ => Chip("estado-lock", "Sin entregar"),
    };

    public static IHtmlContent ChipMatricula(EstadoMatricula e) => e switch
    {
        EstadoMatricula.Aprobado => Chip("estado-ok", "Aprobado"),
        EstadoMatricula.Reprobado => Chip("estado-bad", "Reprobado"),
        _ => Chip("estado-open", "Cursando"),
    };

    public static IHtmlContent ChipTipo(TipoActividad t) =>
        t == TipoActividad.Examen ? Chip("estado-exam", "Examen") : Chip("estado-lock", "Entrega");

    public static string NombreRol(Rol r) => r switch
    {
        Rol.Admin => "Administrador",
        Rol.Profesor => "Profesor",
        _ => "Estudiante",
    };
}
