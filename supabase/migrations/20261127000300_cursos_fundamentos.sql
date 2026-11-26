-- =============================================================================
--  Cursos de base y de cierre para quien empieza desde cero:
--  lógica, computación básica, cómo funciona la web, estructuras de datos
--  y proyecto integrador. Vacíos y sin profesor; si el código existe, no se toca.
--  (El orden por prioridad del catálogo lo define la página.)
-- =============================================================================

insert into public.cursos (codigo, nombre, lenguaje, nivel, descripcion) values
    ('LOG-1',  'Lógica de programación',         'Lógica de programación', 1, 'Principiante: algoritmos, pseudocódigo, diagramas de flujo, variables, condiciones y ciclos.'),
    ('LOG-2',  'Resolución de problemas',        'Lógica de programación', 2, 'Intermedio: dividir problemas en partes, funciones y ejercicios de lógica paso a paso.'),
    ('COMP-1', 'Computación básica y terminal',  'Computación básica',     1, 'Principiante: archivos y carpetas, instalar programas, VS Code y comandos de la terminal.'),
    ('WEB-1',  'Cómo funciona la web',           'Cómo funciona la web',   1, 'Servidores, navegador, HTTP, dominios, JSON y qué es una API.'),
    ('ED-1',   'Estructuras de datos',           'Estructuras de datos',   1, 'Listas, pilas, colas, diccionarios y árboles: cuándo usar cada una.'),
    ('ED-2',   'Algoritmos',                     'Estructuras de datos',   2, 'Búsqueda, ordenamiento, recursión y una noción de eficiencia.'),
    ('PROY-1', 'Proyecto integrador',            'Proyecto integrador',    1, 'Proyecto final: web + base de datos + Git, listo para el portafolio.')
on conflict (codigo) do nothing;
