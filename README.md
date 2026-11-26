# Fen Academy

Aula virtual para enseñar programación, hecha con **C# · ASP.NET Core MVC (.NET 10) · Entity Framework Core · SQLite**.

Tres roles bien separados, cada uno en su propia [Área](https://learn.microsoft.com/aspnet/core/mvc/controllers/areas) de MVC:

| Rol | Qué puede hacer | URL |
|---|---|---|
| **Estudiante** | Matricularse en cursos, ver clases, **entregar trabajos** (archivo y/o enlace a su repositorio de GitHub), **rendir exámenes**, ver notas y retroalimentación, descargar recursos | `/Estudiante` |
| **Profesor** | Solo en sus cursos asignados: clases, actividades y exámenes (el desglose no puede pasar de 100%), calificar entregas, revisar exámenes, aprobar o reprobar estudiantes, publicar recursos | `/Profesor` |
| **Admin** | Usuarios y roles, materias (crear, editar, eliminar, asignar profesor). Puede entrar a cualquier curso como docente | `/Admin` |

Las cuentas nuevas se registran como **estudiante**; el admin las convierte en profesor.

## Exámenes

- Dos tipos de pregunta: **opción única** (una correcta) y **respuesta corta**.
- Corrección automática. La respuesta corta no distingue mayúsculas, tildes ni espacios extra, admite varias respuestas válidas (`8|ocho`) y compara números por valor (`3` = `3.0`).
- Un solo intento por estudiante; duración opcional con reloj (se envía solo al llegar a 0).
- Preguntas y opciones en orden distinto para cada estudiante.
- El examen se crea como borrador y se publica cuando está listo. Cuando alguien ya empezó, las preguntas se bloquean.
- El profesor puede marcar a mano una respuesta como correcta o incorrecta, y la nota se recalcula.
- Opcional: mostrar la corrección al estudiante después de enviar.

## Materias y niveles

- Cada curso tiene un **código único** (`PY-1`, `JS-1`, `JAVA-1`…). Así Java y JavaScript no se confunden.
- Los cursos de un mismo lenguaje forman una ruta: para matricular el nivel N hay que **aprobar** el nivel anterior que exista (si no hay nivel 4, el 5 pide el 3).
- "python" y "Python" cuentan como el mismo lenguaje.
- Nota del curso = Σ (nota de la actividad × su valor %), usando la última entrega de cada actividad.

## Cómo ejecutarlo

Necesitás el [SDK de .NET 10](https://dotnet.microsoft.com/download).

```powershell
git clone <url-de-este-repositorio>
cd FenAcademy
dotnet run --project src/FenAcademy.Web
```

La primera vez se crea sola la base `src/FenAcademy.Web/App_Data/fenacademy.db` con cursos de ejemplo (Python 1-3 y JavaScript 1-2, con sus clases), dos entregas y un examen en PY-1.

### Cuentas de ejemplo

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | admin123 | Administrador |
| profe | profe123 | Profesor (tiene todos los cursos demo) |
| ana | ana123 | Estudiante (matriculada en PY-1) |
| luis | luis123 | Estudiante (sin cursos) |

**Antes de usarlo con alumnos reales**, cambiá estas contraseñas desde *Perfil*, o arrancá con la base vacía poniendo `"DatosDemo": false` en `appsettings.json` antes de la primera ejecución (después creá tu cuenta, y en la base cambiá su `Rol` a `Admin`).

Para empezar de cero: borrá la carpeta `src/FenAcademy.Web/App_Data`.

### Pruebas

```powershell
dotnet test
```

GitHub Actions corre estas pruebas en cada push (`.github/workflows/ci.yml`).

## Estructura

```
src/FenAcademy.Web/
  Program.cs                 configuración: base de datos, login por cookie, roles, antifalsificación
  Models/Entidades.cs        Usuario, Curso, Matricula, Clase, Actividad, Entrega, Pregunta, Opcion, ...
  Models/ViewModels.cs       datos que recibe cada vista
  Data/AppDbContext.cs       Entity Framework Core (tablas, índices únicos, borrados en cascada)
  Data/DatosIniciales.cs     datos de ejemplo
  Services/                  reglas de negocio: notas y requisitos, exámenes, archivos
  Infrastructure/            roles, mensajes flash, helpers de vista, validación de sesión
  Controllers/               lo compartido: Cuenta (login/registro/perfil), Archivos (descargas), Home
  Areas/Estudiante/          controladores y vistas del estudiante
  Areas/Profesor/            controladores y vistas del profesor (incluye el editor de exámenes)
  Areas/Admin/               controladores y vistas del administrador
  Views/Shared/_Layout.cshtml   el menú lateral cambia según el rol
  wwwroot/                   style.css y app.js
tests/FenAcademy.Tests/      pruebas de integración (flujos completos) y del corrector de exámenes
```

## Publicarlo en internet

GitHub guarda el código, pero **GitHub Pages no puede ejecutar esta aplicación** (solo sirve páginas estáticas, y acá hay un servidor C# con base de datos). Para que tus alumnos entren desde internet necesitás un servidor con .NET, por ejemplo Azure App Service, un VPS o una PC propia:

```powershell
dotnet publish src/FenAcademy.Web -c Release -o publicado
```

Copiá la carpeta `publicado` al servidor y ejecutá `dotnet FenAcademy.Web.dll`. La base y los archivos subidos quedan en `App_Data/`; incluila en tus respaldos.

## Seguridad incluida

- Contraseñas con hash (`PasswordHasher` de ASP.NET Core Identity).
- Token antifalsificación (CSRF) en todos los formularios.
- Los archivos subidos se guardan fuera de `wwwroot` con un nombre aleatorio. Para descargarlos se verifica el permiso: cada estudiante solo baja lo suyo, y el profesor solo lo de sus cursos.
- Máximo 16 MB por archivo, con lista de extensiones permitidas.
- Si el admin cambia el rol de alguien, el cambio aplica al instante, sin volver a iniciar sesión.
