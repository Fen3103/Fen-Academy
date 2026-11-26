import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const db = new PGlite();
// Prueba la migración en un Postgres en memoria (PGlite) con imitaciones de Supabase (auth, storage).
// Uso: npm test   (desde supabase/pruebas)
const dir = new URL('../migrations/', import.meta.url);
const schema = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.includes('quitar_contenido_ejemplo') && !f.includes('catalogo_por_lenguaje')).sort()
  .map(f => fs.readFileSync(new URL(f, dir), 'utf8')).join(';\n').replace(/create extension[^;]*;/, '');
await db.exec(fs.readFileSync(new URL('./stubs.sql', import.meta.url), 'utf8'));
await db.exec(schema);

let ok = 0, fail = 0;
const check = (cond, msg) => { if (cond) ok++; else { fail++; console.log('FALLA:', msg); } };
async function as(uid, sql, params = []) {
  return db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    await tx.exec('set local role authenticated');
    return (await tx.query(sql, params)).rows;
  });
}
async function err(uid, sql, params = []) {
  try { await as(uid, sql, params); return null; } catch (e) { return e.message; }
}
async function nuevo(email, usuario, nombre) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, { usuario, nombre }]);
  return r.rows[0].id;
}
const admin = await nuevo('a@x.com', 'admin', 'Admin');
const profe = await nuevo('p@x.com', 'profe', 'Profe');
const ana = await nuevo('ana@x.com', 'ana', 'Ana');
const luis = await nuevo('luis@x.com', 'luis', 'Luis');
const dup = await nuevo('ana2@x.com', 'ana', 'Otra Ana');
await db.query(`update perfiles set rol='admin' where id=$1`, [admin]);
check((await db.query(`select usuario from perfiles where id=$1`, [dup])).rows[0].usuario.startsWith('ana-'), 'usuario duplicado con sufijo');
check((await db.query(`select rol from perfiles where id=$1`, [ana])).rows[0].rol === 'estudiante', 'rol por defecto');

// Roles y perfiles
check((await err(ana, `update perfiles set rol='admin' where id=auth.uid()`))?.includes('permission'), 'estudiante no cambia su rol');
await as(ana, `update perfiles set nombre='Ana B' where id=auth.uid()`);
await as(ana, `update perfiles set nombre='hack' where id=$1`, [luis]);
check((await db.query(`select nombre from perfiles where id=$1`, [luis])).rows[0].nombre === 'Luis', 'no edita perfil ajeno');
check(await err(ana, `select admin_cambiar_rol($1,'profesor')`, [luis]), 'estudiante no usa admin_cambiar_rol');
await as(admin, `select admin_cambiar_rol($1,'profesor')`, [profe]);
check(await err(admin, `select admin_cambiar_rol($1,'estudiante')`, [admin]), 'admin no cambia su propio rol');

// Cursos
check(await err(profe, `insert into cursos (codigo,nombre,lenguaje,nivel) values ('X','x','x',1)`), 'profe no crea cursos');
await as(admin, `insert into cursos (codigo,nombre,lenguaje,nivel) values ('java 1','Java','java',1)`);
await as(admin, `insert into cursos (codigo,nombre,lenguaje,nivel) values ('JAVA-3','Java 3','JAVA',3)`);
const cj = (await db.query(`select codigo, lenguaje from cursos where nombre='Java 3'`)).rows[0];
check(cj.lenguaje === 'java', 'lenguaje normalizado a la escritura existente: ' + cj.lenguaje);
check((await db.query(`select codigo from cursos where nombre='Java'`)).rows[0].codigo === 'JAVA-1', 'código normalizado');
check(await err(admin, `insert into cursos (codigo,nombre,lenguaje,nivel) values ('java-1','dup','Java',1)`), 'código único');
check(await err(admin, `update cursos set profesor_id=$1 where codigo='PY-1'`, [ana]), 'solo profesores asignables');
await as(admin, `update cursos set profesor_id=$1 where codigo in ('PY-1','PY-2','JS-1','JAVA-1','JAVA-3')`, [profe]);
const id = async c => (await db.query(`select id from cursos where codigo=$1`, [c])).rows[0].id;
const py1 = await id('PY-1'), py2 = await id('PY-2'), py3 = await id('PY-3'), java3 = await id('JAVA-3');

// Matrículas y requisitos
check((await as(ana, `select matricular($1) m`, [py1]))[0].m.includes('matriculaste'), 'matricula PY-1');
check((await err(ana, `select matricular($1)`, [py2]))?.includes('PY-1'), 'PY-2 exige PY-1');
check((await err(ana, `select matricular($1)`, [java3]))?.includes('JAVA-1'), 'JAVA-3 exige JAVA-1 (salto de nivel)');
check(await err(ana, `insert into matriculas (user_id,curso_id) values (auth.uid(), $1)`, [py3]), 'no se inserta matrícula directa');
check(await err(profe, `select matricular($1)`, [py1]), 'profe no se matricula');
check((await as(luis, `select * from clases where curso_id=$1`, [py1])).length === 0, 'no matriculado no ve clases');
check((await as(ana, `select * from clases where curso_id=$1`, [py1])).length === 4, 'matriculada ve clases');
await as(ana, `update matriculas set estado='Aprobado' where user_id=auth.uid()`);
check((await db.query(`select estado from matriculas where user_id=$1`, [ana])).rows[0].estado === 'Cursando', 'estudiante no se aprueba sola');

// Actividades
const acts = await as(ana, `select id, tipo, titulo, publicada from actividades where curso_id=$1 order by id`, [py1]);
check(acts.length === 3, 'ana ve 3 actividades publicadas: ' + acts.length);
const entrega1 = acts[0].id, examen = acts[2].id;
check((await err(profe, `insert into actividades (curso_id,titulo,valor) values ($1,'x',10)`, [py1]))?.includes('100'), 'desglose > 100');
check(await err(profe, `insert into actividades (curso_id,titulo,valor) values ($1,'x',0)`, [py3]), 'profe no crea en curso ajeno');
await as(profe, `insert into actividades (curso_id,titulo,valor,tipo,publicada) values ($1,'Borrador',0,'examen',false)`, [py1]);
check((await as(ana, `select * from actividades where titulo='Borrador'`)).length === 0, 'borrador oculto al estudiante');
check((await err(profe, `update actividades set publicada=true where titulo='Borrador'`))?.includes('pregunta'), 'no publicar examen vacío');
const borr = (await db.query(`select id from actividades where titulo='Borrador'`)).rows[0].id;
check(await err(profe, `select guardar_pregunta($1,'¿?','opcion_unica',1,array['a','b'],2,null)`, [borr]), 'correcta fuera de rango');
check(await err(profe, `select guardar_pregunta($1,'¿2+2?','opcion_unica',1,array['3','4'],1,null)`, [borr]) === null, 'guardar_pregunta ok');
check(await err(ana, `select guardar_pregunta($1,'x','respuesta_corta',1,null,null,'x')`, [borr]), 'estudiante no crea preguntas');
check(await err(profe, `update actividades set publicada=true where id=$1`, [borr]) === null, 'publica examen con preguntas');

// Claves y preguntas ocultas
check((await as(ana, `select * from preguntas`)).length === 0, 'estudiante no ve preguntas');
check((await as(ana, `select * from claves`)).length === 0, 'estudiante no ve claves');
check((await as(profe, `select * from claves`)).length === 5, 'profe ve claves');
check(await err(ana, `select preguntas_examen($1)`, [examen]), 'preguntas_examen requiere intento');
check((await as(ana, `select solucion_examen($1) s`, [examen]))[0].s === null, 'sin solución antes de rendir');

// Entregas
check((await err(ana, `select entregar_trabajo($1,null,null,null,null)`, [entrega1]))?.includes('archivo'), 'entrega vacía');
check((await err(ana, `select entregar_trabajo($1,null,null,'javascript:alert(1)',null)`, [entrega1]))?.includes('https'), 'enlace inválido');
check(await err(ana, `select entregar_trabajo($1,'entregas/1/otro/x.py','x.py',null,null)`, [entrega1]), 'ruta de archivo ajena');
check(await err(luis, `select entregar_trabajo($1,null,null,'https://github.com/a/b',null)`, [entrega1]), 'no matriculado no entrega');
const eid = (await as(ana, `select entregar_trabajo($1,$2,'tarea.py','https://github.com/ana/t','hola') id`,
  [entrega1, `entregas/${entrega1}/${ana}/tarea.py`]))[0].id;
check(eid > 0, 'entrega creada');
await as(ana, `update entregas set nota=100 where id=$1`, [eid]).catch(() => {});
check((await db.query(`select nota from entregas where id=$1`, [eid])).rows[0].nota === null, 'estudiante no se pone nota');
check(await err(ana, `insert into entregas (actividad_id,user_id) values ($1,auth.uid())`, [entrega1]), 'insert directo de entrega bloqueado');
await as(profe, `update entregas set nota=90, estado='Aprobado', retroalimentacion='Bien' where id=$1`, [eid]);
check((await db.query(`select nota from entregas where id=$1`, [eid])).rows[0].nota == 90, 'profe califica');
check((await err(ana, `select entregar_trabajo($1,null,null,'https://github.com/a/b',null)`, [entrega1]))?.includes('aprobada'), 'no reentrega aprobada');
check((await as(luis, `select * from entregas`)).length === 0, 'luis no ve entregas ajenas');

// Storage
check(await err(ana, `insert into storage.objects (bucket_id,name) values ('archivos',$1)`, [`entregas/${entrega1}/${ana}/a.py`]) === null, 'ana sube a su carpeta');
check(await err(ana, `insert into storage.objects (bucket_id,name) values ('archivos',$1)`, [`entregas/${entrega1}/${luis}/a.py`]), 'ana no sube a carpeta ajena');
check(await err(luis, `insert into storage.objects (bucket_id,name) values ('archivos',$1)`, [`entregas/${entrega1}/${luis}/a.py`]), 'luis no matriculado no sube');
check(await err(ana, `insert into storage.objects (bucket_id,name) values ('archivos',$1)`, [`recursos/${py1}/r.pdf`]), 'estudiante no sube recursos');
check(await err(profe, `insert into storage.objects (bucket_id,name) values ('archivos',$1)`, [`recursos/${py1}/r.pdf`]) === null, 'profe sube recursos');
check((await as(ana, `select * from storage.objects`)).length === 2, 'ana ve su entrega y el recurso del curso');
check((await as(luis, `select * from storage.objects`)).length === 0, 'luis no ve archivos');
check((await as(profe, `select * from storage.objects`)).length === 2, 'profe ve archivos de su curso');

// Examen
const est = (await as(ana, `select estado_examen($1) e`, [examen]))[0].e;
check(est.puede_rendir && est.preguntas === 4, 'estado inicial examen');
await as(ana, `select comenzar_examen($1)`, [examen]);
check((await err(profe, `delete from preguntas where actividad_id=$1`, [examen]))?.includes('empezaron'), 'preguntas bloqueadas con intentos');
const preg = (await as(ana, `select preguntas_examen($1) p`, [examen]))[0].p;
check(preg.length === 4 && !JSON.stringify(preg).includes('correcta'), 'preguntas sin clave');
const resp = {};
for (const p of preg) {
  if (p.tipo === 'opcion_unica') resp[p.id] = String(p.opciones.find(o => ['print()', 'int'].includes(o.texto)).id);
  else resp[p.id] = p.enunciado.includes('7 //') ? ' 3.0 ' : 'ELÍF.';
}
const nota = (await as(ana, `select enviar_examen($1,$2) n`, [examen, resp]))[0].n;
check(Number(nota) === 75, 'nota examen 75 (print ok, int mal, 3.0 ok, ELÍF ok): ' + nota);
check((await err(ana, `select enviar_examen($1,$2)`, [examen, resp]))?.includes('Ya'), 'un solo envío');
check((await as(ana, `select estado_examen($1) e`, [examen]))[0].e.puede_rendir === false, 'ya rindió');
const sol = (await as(ana, `select solucion_examen($1) s`, [examen]))[0].s;
check(sol && sol.length === 4 && sol[0].opcion_correcta_id, 'solución visible tras enviar');
check((await as(ana, `select * from respuestas`)).length === 4, 'ana ve sus respuestas');
const mal = (await as(profe, `select r.id from respuestas r where not r.correcta`))[0].id;
check(await err(ana, `select cambiar_correccion($1,true)`, [mal]), 'estudiante no corrige');
check(Number((await as(profe, `select cambiar_correccion($1,true) n`, [mal]))[0].n) === 100, 'corrección manual a 100');

// Vencimiento
await as(dup, `select matricular($1)`, [py1]);
await as(dup, `select comenzar_examen($1)`, [examen]);
await db.query(`update intentos set inicio = now() - interval '30 minutes' where user_id=$1`, [dup]);
const venc = (await as(dup, `select estado_examen($1) e`, [examen]))[0].e;
check(venc.puede_rendir === false && venc.entrega_id, 'examen vencido se cierra');
check(Number((await db.query(`select nota from entregas where user_id=$1`, [dup])).rows[0].nota) === 0, 'vencido nota 0');

// Profesor cambiado a estudiante pierde cursos
await as(admin, `select admin_cambiar_rol($1,'estudiante')`, [profe]);
check((await db.query(`select count(*)::int n from cursos where profesor_id=$1`, [profe])).rows[0].n === 0, 'pierde cursos al dejar de ser profesor');
check((await as(profe, `select * from claves`)).length === 0, 'ex profe ya no ve claves');

// Borrar curso con intentos (cascada) y usuarios
const e1 = await err(admin, `delete from cursos where id=$1`, [py1]);
check(e1 === null, 'admin borra curso con examen rendido: ' + e1);
check(await err(admin, `select admin_eliminar_usuario($1)`, [luis]) === null, 'admin elimina usuario');
check((await db.query(`select count(*)::int n from perfiles where id=$1`, [luis])).rows[0].n === 0, 'perfil eliminado');

check((await err(ana, 'select email from perfiles'))?.includes('permission'), 'email privado');
check((await as(ana, 'select mi_perfil() p'))[0].p.email === 'ana@x.com', 'mi_perfil');
check(await err(ana, 'select * from admin_usuarios()'), 'admin_usuarios solo admin');
check((await as(admin, 'select * from admin_usuarios()')).length >= 3, 'admin lista usuarios');
check((await as(ana, 'select id, nombre, usuario, rol from perfiles')).length >= 3, 'columnas públicas visibles');
// El profesor elige sus cursos
const prof2 = await nuevo('p2@x.com', 'profe2', 'Profe Dos');
const est2 = await nuevo('e2@x.com', 'est2', 'Estudiante Dos');
const prof3 = await nuevo('p3@x.com', 'profe3', 'Profe Tres');
await db.query(`update perfiles set rol='profesor' where id = any($1)`, [[prof2, prof3]]);
await db.query(`update cursos set profesor_id=$1, descripcion='JS' where codigo='JS-1'`, [prof3]);
const libre = await id('PY-3');
check((await err(est2, `select matricular($1)`, [libre]))?.includes('profesor'), 'no se matricula en curso sin profesor');
check((await err(est2, `select tomar_curso($1)`, [libre])), 'estudiante no toma cursos');
check((await as(prof2, `select tomar_curso($1) m`, [libre]))[0].m.includes('Ahora das'), 'profesor toma curso libre');
check((await err(prof2, `select tomar_curso($1)`, [await id('JS-1')]))?.includes('otro profesor'), 'no toma curso de otro profesor');
check((await as(est2, `select matricular($1) m`, [libre]))[0].m.includes('matriculaste'), 'PY-3 activo sin niveles anteriores activos: libre');
check(await err(prof2, `update cursos set profesor_id=$1 where id=$2`, [profe, libre]), 'no pasa su curso a otro');
await as(prof2, `update cursos set descripcion='Nueva' where id=$1`, [libre]);
check((await db.query(`select descripcion from cursos where id=$1`, [libre])).rows[0].descripcion === 'Nueva', 'edita su curso');
await as(prof2, `update cursos set descripcion='hack' where codigo='JS-1'`);
check((await db.query(`select descripcion from cursos where codigo='JS-1'`)).rows[0].descripcion !== 'hack', 'no edita curso ajeno');
check(await err(prof2, `insert into cursos (codigo,nombre,lenguaje,nivel,profesor_id) values ('GO-1','Go','Go',1,$1)`, [prof2]) === null, 'profesor crea su curso');
check(await err(prof2, `insert into cursos (codigo,nombre,lenguaje,nivel,profesor_id) values ('GO-2','Go 2','Go',2,$1)`, [profe]), 'no crea cursos a nombre de otro');
check(await err(est2, `insert into cursos (codigo,nombre,lenguaje,nivel) values ('X-1','x','x',1)`), 'estudiante no crea cursos');
await as(prof2, `delete from cursos where id=$1`, [libre]);
check((await db.query(`select count(*)::int n from cursos where id=$1`, [libre])).rows[0].n === 1, 'no borra curso con estudiantes');
check((await as(prof2, `select dejar_curso($1) m`, [libre]))[0].m.includes('Dejaste'), 'profesor deja su curso');
check((await db.query(`select profesor_id from cursos where id=$1`, [libre])).rows[0].profesor_id === null, 'curso queda libre');
check(await err(prof2, `select dejar_curso($1)`, [libre]), 'no deja un curso que no da');

// Limpieza del contenido de ejemplo: borra lo sembrado y respeta lo creado por el profesor
await db.query(`insert into clases (curso_id, titulo) select id, 'Mi clase propia' from cursos where codigo='PY-2'`);
const antes = (await db.query(`select count(*)::int n from clases`)).rows[0].n;
const limpieza = fs.readdirSync(dir).find(f => f.includes('quitar_contenido_ejemplo'));
await db.exec(fs.readFileSync(new URL(limpieza, dir), 'utf8'));
const quedan = (await db.query(`select titulo from clases`)).rows.map(r => r.titulo);
check(antes > 1 && quedan.length === 1 && quedan[0] === 'Mi clase propia', 'limpieza borra solo el ejemplo: ' + quedan.join(','));
check((await db.query(`select count(*)::int n from cursos where codigo in ('PY-2','PY-3','JS-1','JS-2')`)).rows[0].n === 4, 'las materias se mantienen');

// Catálogo por lenguaje: agrega los que faltan sin tocar los existentes y se puede volver a correr
const catalogo = fs.readFileSync(new URL(fs.readdirSync(dir).find(f => f.includes('catalogo_por_lenguaje')), dir), 'utf8');
const profPy1 = (await db.query(`select profesor_id from cursos where codigo='PY-2'`)).rows[0].profesor_id;
await db.exec(catalogo);
await db.exec(catalogo);
const langs = (await db.query(`select lenguaje, count(*)::int n from cursos where codigo ~ '^(PY|CS|HTML|JAVA|GIT|JS|DB)-[123]$' group by 1 order by 1`)).rows;
check(langs.length === 7 && langs.every(r => r.n === 3), 'catálogo: 7 lenguajes x 3 niveles: ' + JSON.stringify(langs));
check((await db.query(`select profesor_id from cursos where codigo='PY-2'`)).rows[0].profesor_id === profPy1, 'catálogo no toca cursos existentes');
check((await db.query(`select count(*)::int n from cursos where codigo='CS-1' and profesor_id is null`)).rows[0].n === 1, 'cursos nuevos sin profesor');

console.log(`\n${ok} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
