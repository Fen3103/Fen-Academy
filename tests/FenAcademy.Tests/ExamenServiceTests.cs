using FenAcademy.Web.Models;
using FenAcademy.Web.Services;

namespace FenAcademy.Tests;

public class ExamenServiceTests
{
    private static Pregunta Corta(string aceptadas) => new() { Tipo = TipoPregunta.RespuestaCorta, RespuestasAceptadas = aceptadas };

    [Theory]
    [InlineData("elif", "ELIF", true)]
    [InlineData("elif", "  elif. ", true)]
    [InlineData("función", "funcion", true)]
    [InlineData("3", "3.0", true)]
    [InlineData("0.5", "0,5", true)]
    [InlineData("print|imprimir", "Imprimir", true)]
    [InlineData("hola mundo", "hola    mundo", true)]
    [InlineData("3", "4", false)]
    [InlineData("elif", "", false)]
    [InlineData("for", "forr", false)]
    public void Respuesta_corta(string aceptadas, string respuesta, bool esperado) =>
        Assert.Equal(esperado, ExamenService.RespuestaCortaCorrecta(Corta(aceptadas), respuesta));

    [Fact]
    public void Nota_ponderada_por_puntos()
    {
        var preguntas = new List<Pregunta> { new() { Id = 1, Puntos = 1 }, new() { Id = 2, Puntos = 3 } };
        var respuestas = new List<Respuesta> { new() { PreguntaId = 1, Correcta = false }, new() { PreguntaId = 2, Correcta = true } };
        Assert.Equal(75, ExamenService.CalcularNota(preguntas, respuestas));
    }

    [Fact]
    public void Opciones_requieren_una_sola_correcta()
    {
        Assert.NotNull(ExamenService.ParsearOpciones("*a\nb").opciones);
        Assert.NotNull(ExamenService.ParsearOpciones("a\nb").error);
        Assert.NotNull(ExamenService.ParsearOpciones("*a\n*b").error);
        Assert.NotNull(ExamenService.ParsearOpciones("*a").error);
    }

    [Fact]
    public void Mezcla_determinista()
    {
        var a = ExamenService.Mezclar(Enumerable.Range(1, 10), 42);
        var b = ExamenService.Mezclar(Enumerable.Range(1, 10), 42);
        Assert.Equal(a, b);
        Assert.Equal(Enumerable.Range(1, 10), a.Order());
    }
}
