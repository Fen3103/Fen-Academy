-- =============================================================================
--  Catálogo de cursos para impartir, por lenguaje y de principiante a avanzado.
--  Los cursos se crean vacíos (sin clases) y sin profesor: el profesor elige
--  cuáles da desde "Cursos para impartir". Si un código ya existe, no se toca.
-- =============================================================================

insert into public.cursos (codigo, nombre, lenguaje, nivel, descripcion) values
    ('PY-1',   'Python desde cero',             'Python',         1, 'Principiante: primeros pasos, variables, condicionales y bucles.'),
    ('PY-2',   'Python intermedio',             'Python',         2, 'Intermedio: funciones, colecciones, archivos y errores.'),
    ('PY-3',   'Python avanzado',               'Python',         3, 'Avanzado: programación orientada a objetos, módulos y pruebas.'),
    ('CS-1',   'C# desde cero',                 'C#',             1, 'Principiante: sintaxis, tipos, condicionales y bucles.'),
    ('CS-2',   'C# intermedio',                 'C#',             2, 'Intermedio: clases, colecciones, LINQ y manejo de errores.'),
    ('CS-3',   'C# avanzado',                   'C#',             3, 'Avanzado: async/await, interfaces, genéricos y ASP.NET.'),
    ('HTML-1', 'HTML y CSS desde cero',         'HTML y CSS',     1, 'Principiante: estructura de una página, etiquetas y estilos básicos.'),
    ('HTML-2', 'Diseño web con CSS',            'HTML y CSS',     2, 'Intermedio: Flexbox, Grid y diseño adaptable a celulares.'),
    ('HTML-3', 'HTML y CSS avanzado',           'HTML y CSS',     3, 'Avanzado: accesibilidad, animaciones y buenas prácticas.'),
    ('JAVA-1', 'Java desde cero',               'Java',           1, 'Principiante: sintaxis, tipos, condicionales y bucles.'),
    ('JAVA-2', 'Java intermedio',               'Java',           2, 'Intermedio: clases, herencia, colecciones y excepciones.'),
    ('JAVA-3', 'Java avanzado',                 'Java',           3, 'Avanzado: interfaces, genéricos, streams y archivos.'),
    ('GIT-1',  'Git desde cero',                'Git',            1, 'Principiante: repositorios, commits e historial.'),
    ('GIT-2',  'Git en equipo',                 'Git',            2, 'Intermedio: ramas, merge, GitHub y pull requests.'),
    ('GIT-3',  'Git avanzado',                  'Git',            3, 'Avanzado: rebase, resolución de conflictos y flujos de trabajo.'),
    ('JS-1',   'JavaScript básico',             'JavaScript',     1, 'Principiante: variables, condicionales, bucles y el DOM.'),
    ('JS-2',   'JavaScript moderno',            'JavaScript',     2, 'Intermedio: funciones flecha, arrays, objetos y JSON.'),
    ('JS-3',   'JavaScript avanzado',           'JavaScript',     3, 'Avanzado: async/await, fetch, módulos y APIs.'),
    ('DB-1',   'Bases de datos desde cero',     'Bases de datos', 1, 'Principiante: tablas, consultas SELECT y filtros.'),
    ('DB-2',   'Diseño de bases de datos',      'Bases de datos', 2, 'Intermedio: relaciones, claves, JOIN y normalización.'),
    ('DB-3',   'Bases de datos avanzado',       'Bases de datos', 3, 'Avanzado: índices, transacciones, vistas y procedimientos.')
on conflict (codigo) do nothing;
