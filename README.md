# Fen Academy

Aula virtual para enseñar programación. Es **solo una página** (HTML + CSS + JavaScript, sin servidor propio) publicada en **GitHub Pages**, con **[Supabase](https://supabase.com)** (plan gratis) para las cuentas, la base de datos y los archivos subidos.

Tres roles bien separados:

| Rol | Qué puede hacer |
|---|---|
| **Estudiante** | Matricularse en cursos, ver clases, **entregar trabajos** (archivo y/o enlace a su repositorio de GitHub), **rendir exámenes**, ver notas y retroalimentación, descargar recursos |
| **Profesor** | Solo en sus cursos asignados: clases, actividades y exámenes (el desglose no puede pasar de 100 %), calificar entregas, revisar exámenes, aprobar o reprobar estudiantes, publicar recursos |
| **Admin** | Usuarios y roles, materias (crear, editar, eliminar, asignar profesor). Puede entrar a cualquier curso como docente |

Las cuentas nuevas se registran siempre como **estudiante**; el admin las convierte en profesor.

## Exámenes

- Dos tipos de pregunta: **opción única** (una correcta) y **respuesta corta**.
- **Se corrigen en la base, no en la página**: el estudiante nunca recibe las respuestas correctas (están en una tabla que no puede leer), así que no se pueden ver con las herramientas del navegador.
- La respuesta corta no distingue mayúsculas, tildes ni espacios extra, admite varias respuestas válidas (`8|ocho`) y compara números por valor (`3` = `3.0`).
- Un solo intento por estudiante; duración opcional con reloj (usa la hora del servidor y se envía solo al llegar a 0). Si se corta internet o se recarga la página, las respuestas escritas no se pierden.
- Preguntas y opciones en orden distinto para cada estudiante.
- El examen se crea como borrador y se publica cuando está listo. Cuando alguien ya empezó, las preguntas se bloquean.
- El profesor puede marcar a mano una respuesta como correcta o incorrecta, y la nota se recalcula.
- Opcional: mostrar la corrección al estudiante después de enviar.

## Materias y niveles

- Cada curso tiene un **código único** (`PY-1`, `JS-1`, `JAVA-1`…). Así Java y JavaScript no se confunden.
- Los cursos de un mismo lenguaje forman una ruta: para matricular el nivel N hay que **aprobar** el nivel anterior que exista (si no hay nivel 4, el 5 pide el 3).
- "python" y "Python" cuentan como el mismo lenguaje.
- Nota del curso = Σ (nota de la actividad × su valor %), usando la última entrega de cada actividad.

## Puesta en marcha (una sola vez)

### 1. Base de datos en Supabase

En tu proyecto de Supabase la estructura completa está en [`supabase/migrations/`](supabase/migrations/).

- **Si conectaste el repositorio con la integración de GitHub de Supabase** y activaste el despliegue a producción, la migración se aplica sola cuando el código llega a `main`.
- **Si no**: abrí *SQL Editor* → *New query*, pegá todo el archivo `supabase/migrations/20261126000000_fen_academy.sql` y presioná **Run**. Hacelo una sola vez, en un proyecto nuevo.

Crea las tablas, las reglas de seguridad, el bucket privado `archivos` (máx. 16 MB por archivo) y 5 materias de ejemplo (Python 1-3, JavaScript 1-2, con clases, dos entregas y un examen en PY-1).

### 2. Cuentas

En *Authentication → URL Configuration* poné como **Site URL** la dirección de tu página (ej. `https://fen3103.github.io/Fen-Academy/`), así los correos de confirmación y de "olvidé mi contraseña" vuelven a la página.

*Authentication → Sign In / Providers → Email*: con **Confirm email** activado cada estudiante tiene que confirmar su correo antes de entrar. Para una clase chica podés desactivarlo. El servicio de correo gratis de Supabase manda pocos correos por hora; para muchos alumnos configurá un SMTP propio.

### 3. Conectar la página

En *Project Settings → API* (o el botón *Connect*) copiá la **Project URL** y la **anon / publishable key** en [`web/js/config.js`](web/js/config.js).

La anon key es pública a propósito: va en la página y la seguridad la ponen las reglas de la base. **Nunca** pongas la `service_role` / secret key.

### 4. Publicar en GitHub Pages

En GitHub: *Settings → Pages → Source:* **GitHub Actions**. Cada push a `main` que cambie `web/` publica la página (`.github/workflows/pages.yml`).

### 5. Hacerte administrador

Registrate en la página y después, en el *SQL Editor* de Supabase:

```sql
update public.perfiles set rol = 'admin' where email = 'tu-correo@ejemplo.com';
```

Desde ahí, todo se maneja en la página: convertí a tus profesores (o a vos mismo en otra cuenta) en **Profesor** y asignales las materias.

## Estructura

```
web/                         la página que se publica
  index.html
  css/style.css              el diseño (tema oscuro con naranja)
  js/config.js               URL y anon key de tu proyecto de Supabase
  js/api.js                  conexión a Supabase, archivos, cálculo de notas y requisitos
  js/ui.js                   escapado de HTML, chips de estado, fechas, mensajes
  js/main.js                 sesión, menú según el rol y navegación (#/ruta)
  js/vistas/                 pantallas: auth, estudiante, profesor, admin, cuenta
supabase/migrations/         tablas, reglas de seguridad (RLS), funciones y datos de ejemplo
supabase/pruebas/            73 pruebas de la base en un Postgres en memoria
.github/workflows/           pruebas (ci.yml) y publicación en Pages (pages.yml)
```

Para ver la página en tu PC: `python -m http.server 5180 --directory web` y abrí http://localhost:5180 (usa tu proyecto de Supabase real).

## Pruebas

```powershell
cd supabase/pruebas
npm install
npm test
```

Comprueban, entre otras cosas, que un estudiante no puede cambiarse el rol, ponerse nota, aprobarse, ver respuestas correctas, ver entregas ajenas ni subir archivos a carpetas de otros. GitHub Actions las corre en cada push.

## Seguridad

- Cada tabla tiene **Row Level Security**: aunque alguien modifique el JavaScript, la base rechaza lo que su rol no puede hacer.
- Matricularse, entregar, rendir, corregir y cambiar roles pasan por funciones de la base que validan todo (requisitos, fechas, curso cerrado, un solo intento).
- Los archivos están en un bucket **privado**; se descargan con enlaces temporales de 60 segundos y solo si te corresponde (el estudiante lo suyo, el profesor lo de sus cursos).
- El correo y la fecha de nacimiento de cada usuario solo los ven él mismo y el admin.
- Los textos que escriben los usuarios se escapan antes de mostrarse (no se puede inyectar HTML).

## Versión anterior

La versión en C# · ASP.NET Core MVC (con servidor propio) quedó en el historial de git, en el commit `2adf9d0`.
