using System.Net;
using System.Text;

namespace FenAcademy.Tests;

// Datos de ejemplo (DatosIniciales): usuarios admin=1, profe=2, ana=3, luis=4.
// Cursos PY-1=1, PY-2=2, PY-3=3, JS-1=4, JS-2=5. En PY-1: actividades 1 y 2 (entregas) y 3 (examen).
// Examen 3: pregunta 1 (opción correcta id 1), pregunta 2 (opción correcta id 5), 3 corta "3", 4 corta "elif".
public class FlujosTests : IDisposable
{
    private readonly FenAcademyFactory _app = new();
    public void Dispose() => _app.Dispose();

    private static string Destino(HttpResponseMessage r) => r.Headers.Location?.ToString() ?? "";

    [Fact]
    public async Task Login_redirige_segun_rol()
    {
        Assert.StartsWith("/Estudiante", Destino(await _app.Navegador().LoginAsync("ana", "ana123")));
        Assert.StartsWith("/Profesor", Destino(await _app.Navegador().LoginAsync("profe", "profe123")));
        Assert.StartsWith("/Admin", Destino(await _app.Navegador().LoginAsync("admin", "admin123")));

        var mal = await _app.Navegador().LoginAsync("ana", "incorrecta");
        Assert.Contains("incorrectos", await mal.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Post_sin_token_es_rechazado()
    {
        var r = await _app.Navegador().Http.PostAsync("/Cuenta/Login",
            new FormUrlEncodedContent(new Dictionary<string, string> { ["usuario"] = "ana", ["password"] = "ana123" }));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task Roles_separados()
    {
        var ana = await _app.ComoAsync("ana", "ana123");
        Assert.Contains("AccesoDenegado", Destino(await ana.Http.GetAsync("/Profesor/Inicio")));
        Assert.Contains("AccesoDenegado", Destino(await ana.Http.GetAsync("/Admin/Inicio")));
        // Un estudiante no puede usar acciones de profesor aunque arme el POST a mano.
        Assert.Contains("AccesoDenegado", Destino(await ana.PostAsync("/Profesor/Cursos/CambiarEstado/1",
            new() { ["usuarioId"] = "3", ["estado"] = "Aprobado" })));

        var profe = await _app.ComoAsync("profe", "profe123");
        Assert.Contains("AccesoDenegado", Destino(await profe.Http.GetAsync("/Estudiante/Inicio")));
        Assert.Contains("AccesoDenegado", Destino(await profe.Http.GetAsync("/Admin/Inicio")));

        var admin = await _app.ComoAsync("admin", "admin123");
        Assert.Equal(HttpStatusCode.OK, (await admin.Http.GetAsync("/Profesor/Inicio")).StatusCode);
    }

    [Fact]
    public async Task Todas_las_paginas_cargan()
    {
        var ana = await _app.ComoAsync("ana", "ana123");
        foreach (var url in new[] { "/Estudiante/Inicio", "/Estudiante/Inicio/Matricula", "/Estudiante/Inicio/Progreso",
                                    "/Estudiante/Cursos/Ver/1", "/Estudiante/Actividades/Ver/1", "/Estudiante/Actividades/Ver/3",
                                    "/Cuenta/Perfil", "/Cuenta/Ajustes" })
            Assert.True((await ana.Http.GetAsync(url)).StatusCode == HttpStatusCode.OK, url);

        var profe = await _app.ComoAsync("profe", "profe123");
        foreach (var url in new[] { "/Profesor/Inicio", "/Profesor/Cursos/Ver/1", "/Profesor/Examenes/Editar/3", "/Cuenta/Perfil" })
            Assert.True((await profe.Http.GetAsync(url)).StatusCode == HttpStatusCode.OK, url);

        var admin = await _app.ComoAsync("admin", "admin123");
        foreach (var url in new[] { "/Admin/Inicio", "/Admin/Inicio/EditarCurso/1", "/Profesor/Cursos/Ver/1" })
            Assert.True((await admin.Http.GetAsync(url)).StatusCode == HttpStatusCode.OK, url);
    }

    [Fact]
    public async Task Estudiante_no_ve_cursos_ajenos_y_profesor_solo_los_suyos()
    {
        var luis = await _app.ComoAsync("luis", "luis123");
        Assert.Equal(HttpStatusCode.NotFound, (await luis.Http.GetAsync("/Estudiante/Cursos/Ver/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await luis.Http.GetAsync("/Estudiante/Actividades/Ver/1")).StatusCode);

        var admin = await _app.ComoAsync("admin", "admin123");
        await admin.PostAsync("/Admin/Inicio/CambiarRol/4", new() { ["rol"] = "Profesor" });
        // Luis ahora es profesor (el cambio aplica sin volver a iniciar sesión) pero no tiene cursos asignados.
        Assert.Equal(HttpStatusCode.OK, (await luis.Http.GetAsync("/Profesor/Inicio")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await luis.Http.GetAsync("/Profesor/Cursos/Ver/1")).StatusCode);
    }

    [Fact]
    public async Task Flujo_entrega_calificacion_y_aprobacion()
    {
        var ana = await _app.ComoAsync("ana", "ana123");

        // Nivel 2 bloqueado al inicio
        await ana.PostAsync("/Estudiante/Inicio/Matricular/2");
        Assert.Contains("No podés matricular", await ana.HtmlAsync("/Estudiante/Inicio/Matricula"));

        // Entrega con enlace de GitHub, sin archivo
        await ana.PostAsync("/Estudiante/Actividades/Entregar/1", new() { ["enlace"] = "https://github.com/ana/edad", ["comentario"] = "listo" });
        Assert.Contains("https://github.com/ana/edad", await ana.HtmlAsync("/Estudiante/Actividades/Ver/1"));

        // Enlace inválido y archivo no permitido
        await ana.PostAsync("/Estudiante/Actividades/Entregar/2", new() { ["enlace"] = "javascript:alert(1)" });
        Assert.Contains("https://", await ana.HtmlAsync("/Estudiante/Actividades/Ver/2"));
        await ana.PostArchivoAsync("/Estudiante/Actividades/Entregar/2", "virus.exe", [1, 2, 3]);
        Assert.Contains("no permitido", await ana.HtmlAsync("/Estudiante/Actividades/Ver/2"));

        // Entrega con archivo .py
        await ana.PostArchivoAsync("/Estudiante/Actividades/Entregar/2", "par.py", Encoding.UTF8.GetBytes("print('par')"));
        Assert.Contains("par.py", await ana.HtmlAsync("/Estudiante/Actividades/Ver/2"));

        // El profesor ve ambas, califica la primera y aprueba el curso
        var profe = await _app.ComoAsync("profe", "profe123");
        var html = await profe.HtmlAsync("/Profesor/Cursos/Ver/1");
        Assert.Contains("https://github.com/ana/edad", html);
        Assert.Contains("par.py", html);
        await profe.PostAsync("/Profesor/Cursos/Calificar/1", new() { ["nota"] = "90", ["estado"] = "Aprobado", ["retroalimentacion"] = "Muy bien" });
        Assert.Equal(HttpStatusCode.OK, (await profe.Http.GetAsync("/Archivos/Entrega/2")).StatusCode);
        await profe.PostAsync("/Profesor/Cursos/CambiarEstado/1", new() { ["usuarioId"] = "3", ["estado"] = "Aprobado" });

        // Ana ve nota 90 (aporte 90 × 30% = 27) y ya puede matricular PY-2
        html = await ana.HtmlAsync("/Estudiante/Cursos/Ver/1");
        Assert.Contains("90/100", html);
        Assert.Contains("27/100", html);
        Assert.Contains("Muy bien", await ana.HtmlAsync("/Estudiante/Actividades/Ver/1"));
        await ana.PostAsync("/Estudiante/Inicio/Matricular/2");
        Assert.Equal(HttpStatusCode.OK, (await ana.Http.GetAsync("/Estudiante/Cursos/Ver/2")).StatusCode);

        // Otro estudiante no puede descargar el archivo de Ana
        var luis = await _app.ComoAsync("luis", "luis123");
        Assert.Equal(HttpStatusCode.NotFound, (await luis.Http.GetAsync("/Archivos/Entrega/2")).StatusCode);
    }

    [Fact]
    public async Task Examen_se_corrige_solo_y_tiene_un_intento()
    {
        var ana = await _app.ComoAsync("ana", "ana123");
        await ana.PostAsync("/Estudiante/Actividades/Comenzar/3");
        var examen = await ana.HtmlAsync("/Estudiante/Actividades/Rendir/3");
        Assert.Contains("id=\"reloj\"", examen); // el examen demo dura 20 minutos
        Assert.Contains("name=\"p3\"", examen);

        // Pregunta 2 mal (opción 6), la 4 bien aunque esté escrita "  Elif. "
        await ana.PostAsync("/Estudiante/Actividades/Enviar/3",
            new() { ["p1"] = "1", ["p2"] = "6", ["p3"] = "3.0", ["p4"] = "  Elif. " });
        var resultado = await ana.HtmlAsync("/Estudiante/Actividades/Ver/3");
        Assert.Contains("75/100", resultado);
        Assert.Contains("Corrección", resultado);            // el demo permite ver la corrección
        Assert.DoesNotContain("Comenzar examen", resultado);

        // No se puede volver a enviar
        await ana.PostAsync("/Estudiante/Actividades/Enviar/3", new() { ["p1"] = "1", ["p2"] = "5", ["p3"] = "3", ["p4"] = "elif" });
        Assert.Contains("75/100", await ana.HtmlAsync("/Estudiante/Actividades/Ver/3"));

        // El profesor no puede cambiar preguntas con intentos, pero sí la corrección
        var profe = await _app.ComoAsync("profe", "profe123");
        await profe.PostAsync("/Profesor/Examenes/EliminarPregunta/1");
        Assert.Contains("no se pueden cambiar las preguntas", await profe.HtmlAsync("/Profesor/Examenes/Editar/3"));

        var revisar = await profe.HtmlAsync("/Profesor/Examenes/Revisar/1");
        Assert.Contains("incorrecta", revisar);
        await profe.PostAsync("/Profesor/Examenes/CambiarCorreccion/2", new() { ["correcta"] = "true" }); // respuesta a pregunta 2
        Assert.Contains("100/100", await ana.HtmlAsync("/Estudiante/Actividades/Ver/3"));
    }

    [Fact]
    public async Task Profesor_crea_examen_borrador_y_lo_publica()
    {
        var profe = await _app.ComoAsync("profe", "profe123");
        var r = await profe.PostAsync("/Profesor/Cursos/CrearActividad/4",
            new() { ["titulo"] = "Quiz DOM", ["tipo"] = "Examen", ["valor"] = "20" });
        var editar = Destino(r);
        Assert.Contains("/Profesor/Examenes/Editar/", editar);
        var id = editar.Split('/').Last();

        // Validaciones de opciones
        await profe.PostAsync($"/Profesor/Examenes/AgregarPregunta/{id}",
            new() { ["enunciado"] = "¿?", ["tipo"] = "OpcionUnica", ["puntos"] = "1", ["opciones"] = "a\nb" });
        Assert.Contains("exactamente UNA", await profe.HtmlAsync(editar));

        await profe.PostAsync($"/Profesor/Examenes/AgregarPregunta/{id}",
            new() { ["enunciado"] = "¿Qué método selecciona un elemento?", ["tipo"] = "OpcionUnica", ["puntos"] = "2",
                    ["opciones"] = "*querySelector\ngetAll\nselect" });
        await profe.PostAsync($"/Profesor/Examenes/AgregarPregunta/{id}",
            new() { ["enunciado"] = "¿Qué palabra declara una constante?", ["tipo"] = "RespuestaCorta", ["puntos"] = "1",
                    ["respuestasAceptadas"] = "const" });
        await profe.PostAsync($"/Profesor/Examenes/Publicar/{id}", new() { ["publicar"] = "true" });
        Assert.Contains("Publicado", await profe.HtmlAsync(editar));

        // Un estudiante de JS-1 lo ve
        var luis = await _app.ComoAsync("luis", "luis123");
        await luis.PostAsync("/Estudiante/Inicio/Matricular/4");
        Assert.Contains("Quiz DOM", await luis.HtmlAsync("/Estudiante/Cursos/Ver/4"));
    }

    [Fact]
    public async Task Desglose_no_supera_100()
    {
        var profe = await _app.ComoAsync("profe", "profe123");
        await profe.PostAsync("/Profesor/Cursos/CrearActividad/1", new() { ["titulo"] = "Extra", ["tipo"] = "Entrega", ["valor"] = "10" });
        Assert.Contains("superaría el 100%", await profe.HtmlAsync("/Profesor/Cursos/Ver/1"));
    }

    [Fact]
    public async Task Materias_codigo_unico_lenguaje_normalizado_y_requisitos_con_huecos()
    {
        var admin = await _app.ComoAsync("admin", "admin123");

        await admin.PostAsync("/Admin/Inicio/CrearCurso", new() { ["codigo"] = "py-1", ["nombre"] = "Repetido", ["lenguaje"] = "Python", ["nivel"] = "1" });
        Assert.Contains("Ya existe un curso con el código PY-1", await admin.HtmlAsync("/Admin/Inicio"));

        // "  python " se guarda como "Python" (misma ruta), y el nivel 5 pide el 3 porque no existe el 4
        await admin.PostAsync("/Admin/Inicio/CrearCurso", new() { ["codigo"] = "PY-5", ["nombre"] = "Python experto", ["lenguaje"] = "  python ", ["nivel"] = "5" });
        var ana = await _app.ComoAsync("ana", "ana123");
        var matricula = await ana.HtmlAsync("/Estudiante/Inicio/Matricula");
        Assert.DoesNotContain(">python<", matricula);
        Assert.Contains("PY-3 Python avanzado", matricula);

        // Java y JavaScript conviven con códigos distintos
        await admin.PostAsync("/Admin/Inicio/CrearCurso", new() { ["codigo"] = "JAVA-1", ["nombre"] = "Java básico", ["lenguaje"] = "Java", ["nivel"] = "1" });
        matricula = await ana.HtmlAsync("/Estudiante/Inicio/Matricula");
        Assert.Contains("JAVA-1", matricula);
        Assert.Contains("JS-1", matricula);
    }

    [Fact]
    public async Task Registro_crea_estudiante()
    {
        var nav = _app.Navegador();
        var token = await nav.TokenAsync("/Cuenta/Registro");
        await nav.Http.PostAsync("/Cuenta/Registro", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["nombre"] = "Nuevo", ["usuario"] = "nuevo", ["password"] = "secreto1", ["confirmar"] = "secreto1",
            ["__RequestVerificationToken"] = token,
        }));
        Assert.StartsWith("/Estudiante", Destino(await _app.Navegador().LoginAsync("nuevo", "secreto1")));
    }

    [Fact]
    public async Task Admin_no_puede_quitarse_su_rol()
    {
        var admin = await _app.ComoAsync("admin", "admin123");
        await admin.PostAsync("/Admin/Inicio/CambiarRol/1", new() { ["rol"] = "Estudiante" });
        Assert.Equal(HttpStatusCode.OK, (await admin.Http.GetAsync("/Admin/Inicio")).StatusCode);
    }
}
