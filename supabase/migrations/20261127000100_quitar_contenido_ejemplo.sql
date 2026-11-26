-- =============================================================================
--  Quita el contenido de ejemplo de las materias (clases, entregas y examen),
--  para que el profesor arme su propio plan de estudio.
--  Las materias (PY-1, PY-2, PY-3, JS-1, JS-2) se mantienen.
--  Solo borra lo que cargó la migración inicial, comparando título exacto:
--  lo que haya creado el profesor no se toca.
-- =============================================================================

delete from public.actividades a
using public.cursos c
where a.curso_id = c.id and c.codigo = 'PY-1'
  and a.titulo in ('Calculadora de edad', '¿Par o impar?', 'Examen parcial: fundamentos');

delete from public.clases cl
using public.cursos c
where cl.curso_id = c.id and (c.codigo, cl.titulo) in (
    ('PY-1', '¿Qué es programar?'), ('PY-1', 'Variables y tipos'), ('PY-1', 'Condicionales'), ('PY-1', 'Bucles'),
    ('PY-2', 'Funciones'), ('PY-2', 'Listas y tuplas'), ('PY-2', 'Diccionarios y conjuntos'), ('PY-2', 'Archivos y errores'),
    ('PY-3', 'Clases y objetos'), ('PY-3', 'Herencia y polimorfismo'), ('PY-3', 'Módulos y paquetes'), ('PY-3', 'Pruebas'),
    ('JS-1', 'JavaScript en el navegador'), ('JS-1', 'Variables y tipos'), ('JS-1', 'Condicionales y bucles'), ('JS-1', 'El DOM'),
    ('JS-2', 'Funciones flecha'), ('JS-2', 'Arrays'), ('JS-2', 'Objetos y JSON'), ('JS-2', 'fetch y async/await'));
