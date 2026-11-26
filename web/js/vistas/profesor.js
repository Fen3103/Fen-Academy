// Pantallas del PROFESOR (y del admin en el "panel docente").
// La base solo deja ver y modificar los cursos asignados al profesor.
import { sb, q, rpc, ErrorFen, subirArchivo, descargar, borrarArchivos, EXT_RECURSOS, EXT_ENTREGAS, ultimaPorActividad, resumen } from "../api.js";
import { html, raw, num, pct, fecha, fechaHora, chipEntrega, chipTipo, tabs, panelTab, enlaceExterno, exito, hoy, claseLenguaje, icono, iconoTipo, celdaFecha, etiquetasActividad, compararLenguajes, fechaDMA } from "../ui.js";
import { listaRecursos, preguntaCorregida } from "./estudiante.js";
const EXT_ENTREGAS_TXT = EXT_ENTREGAS.join(", ") + " · máx. 16 MB";

const ESTADOS_ENTREGA = ["Pendiente", "Revisado", "Aprobado", "Rechazado"];
const ESTADOS_MATRICULA = ["Cursando", "Aprobado", "Reprobado"];
const opciones = (lista, actual) => lista.map(v => html`<option value="${v}" ${raw(v === actual ? "selected" : "")}>${v}</option>`);
const nulo = v => (v === undefined || String(v).trim() === "" ? null : String(v).trim());

// ------------------------------------------------------------------ inicio ---

export async function inicio({ perfil }) {
    const esAdmin = perfil.rol === "admin";
    const todos = await q(sb.from("cursos").select("*, profesor:perfiles(nombre), matriculas(count), actividades(id)")
        .order("lenguaje").order("nivel").order("codigo"));
    // El admin ve todo; el profesor solo los cursos que eligió dar.
    const cursos = (esAdmin ? todos : todos.filter(c => c.profesor_id === perfil.id))
        .sort((a, b) => compararLenguajes(a.lenguaje, b.lenguaje) || a.nivel - b.nivel);
    const ids = cursos.map(c => c.id);
    const pendientes = ids.length ? await q(sb.from("entregas").select("id, actividad:actividades!inner(curso_id)")
        .eq("estado", "Pendiente").in("actividad.curso_id", ids)) : [];
    const porRevisar = id => pendientes.filter(p => p.actividad.curso_id === id).length;
    const estudiantes = cursos.reduce((s, c) => s + (c.matriculas[0]?.count ?? 0), 0);

    const tarjeta = c => html`
        <a href="#/docente/curso/${c.id}" class="course-link-card">
            <div class="course-item con-imagen">
                <div class="course-thumb ${claseLenguaje(c.lenguaje)}"></div>
                <div>
                <h3>${c.codigo} · ${c.nombre}</h3>
                <p>${c.lenguaje} · Nivel ${c.nivel}${esAdmin ? " · Profesor: " + (c.profesor?.nombre ?? "sin asignar") : ""}</p>
                <p>${c.descripcion}</p>
                <div class="meta-row">
                    <span>${c.matriculas[0]?.count ?? 0} estudiantes</span>
                    <span>${c.actividades.length} actividades</span>
                    ${porRevisar(c.id) ? html`<span class="meta-alerta">${porRevisar(c.id)} por revisar</span>` : ""}
                </div>
                </div>
            </div>
        </a>`;

    return {
        titulo: "Panel docente",
        html: html`
<div class="hero-dashboard-card hero-docente"><div class="hero-dashboard-text">
    <h1>Hola, ${perfil.nombre}</h1>
    <p>${esAdmin ? "Prepará clases, publicá exámenes y revisá entregas en cualquier curso."
        : "Elegí qué cursos vas a dar, prepará tus clases, publicá exámenes y revisá las entregas de tus estudiantes."}</p>
</div></div>
<section class="stats-grid stats-grid-3">
    <div class="stat-card"><span>${esAdmin ? "Cursos (todos)" : "Cursos que doy"}</span><strong>${cursos.length}</strong></div>
    <div class="stat-card"><span>Estudiantes</span><strong>${estudiantes}</strong></div>
    <div class="stat-card ${pendientes.length ? "stat-alerta" : ""}"><span>Entregas por revisar</span><strong>${pendientes.length}</strong></div>
</section>
<section class="course-panel">
    <div class="panel-title">${esAdmin ? "Todos los cursos" : "Cursos que doy"}</div>
    <div class="course-list">
        ${cursos.map(tarjeta)}
        ${cursos.length ? "" : html`<div class="course-item"><h3>Todavía no elegiste cursos</h3>
            <p>Entrá a <a href="#/catalogo">Cursos para impartir</a> y tocá <strong>Voy a dar este curso</strong> en los que quieras enseñar.</p></div>`}
    </div>
</section>
`,
    };
}

// ---------------------------------------------------------------- catálogo ---

const NIVELES = { 1: "Principiante", 2: "Intermedio", 3: "Avanzado" };
let filtroCatalogo = "todos";   // se conserva al tomar o dejar un curso

export async function catalogo({ perfil }) {
    const todos = await q(sb.from("cursos").select("*, profesor:perfiles(nombre)").order("nivel").order("codigo"));
    const grupos = new Map();
    for (const c of todos) {
        const k = c.lenguaje.toLowerCase();
        if (!grupos.has(k)) grupos.set(k, { nombre: c.lenguaje, cursos: [] });
        grupos.get(k).cursos.push(c);
    }
    const lista = [...grupos.entries()].sort(([a], [b]) => compararLenguajes(a, b));
    if (!lista.some(([k]) => k === filtroCatalogo)) filtroCatalogo = "todos";
    const doy = todos.filter(c => c.profesor_id === perfil.id).length;

    const fila = c => {
        const mio = c.profesor_id === perfil.id;
        return html`
        <div class="nivel-fila ${mio ? "es-mio" : ""}">
            <span class="nivel-badge nivel-${Math.min(c.nivel, 3)}">${NIVELES[c.nivel] || "Nivel " + c.nivel}</span>
            <div class="nivel-info">
                <h3>${c.codigo} · ${c.nombre}</h3>
                ${c.descripcion ? html`<p>${c.descripcion}</p>` : ""}
            </div>
            <div class="nivel-accion">
                ${mio ? html`<span class="chip-estado mio">${icono("ok")} Lo das vos</span>
                        <a class="admin-btn secundario" href="#/docente/curso/${c.id}">Abrir</a>`
                : c.profesor_id ? html`<span class="chip-estado ocupado">Lo da ${c.profesor?.nombre ?? "otro profesor"}</span>`
                : html`<button type="button" class="admin-btn" data-accion="tomar" data-id="${c.id}">Voy a dar este curso</button>`}
            </div>
        </div>`;
    };

    return {
        titulo: "Cursos para impartir",
        html: html`
<div class="hero-dashboard-card hero-docente"><div class="hero-dashboard-text">
    <h1>Cursos para impartir</h1>
    <p>Elegí los cursos que vas a dar, de principiante a avanzado. Tus estudiantes solo ven en la matrícula los cursos que tienen profesor.</p>
</div></div>
<section class="course-panel">
    <div class="panel-title panel-title-acciones">
        <span>Catálogo · das ${doy} de ${todos.length}</span>
        <button type="button" class="admin-btn" data-toggle="crear-curso">+ Crear curso</button>
    </div>
    <div id="crear-curso" class="resource-form-panel"><div class="admin-course-form">
        <h3>Crear curso</h3>
        <form data-accion="crearCurso">
            <input type="text" name="codigo" placeholder="Código (ej: PY-4, CS-1)" required maxlength="20">
            <input type="text" name="nombre" placeholder="Nombre del curso" required>
            <input type="text" name="lenguaje" placeholder="Lenguaje (ej: Python)" required list="lenguajes">
            <datalist id="lenguajes">${lista.map(([, g]) => html`<option value="${g.nombre}"></option>`)}</datalist>
            <input type="number" name="nivel" placeholder="Nivel (1 principiante, 2 intermedio, 3 avanzado)" min="1" required>
            <textarea name="descripcion" placeholder="Descripción"></textarea>
            <button class="admin-btn" type="submit">Crear y dar este curso</button>
        </form>
    </div></div>
    <div class="filtros-lenguaje" role="toolbar" aria-label="Filtrar por lenguaje">
        <button type="button" data-filtro="todos" class="${filtroCatalogo === "todos" ? "activo" : ""}">Todos</button>
        ${lista.map(([k, g]) => html`<button type="button" data-filtro="${k}" class="${filtroCatalogo === k ? "activo" : ""}">${g.nombre}</button>`)}
    </div>
    <div class="catalogo-grupos">
        ${lista.map(([k, g]) => html`
        <div class="lenguaje-grupo" data-lenguaje="${k}" ${filtroCatalogo !== "todos" && filtroCatalogo !== k ? raw("hidden") : ""}>
            <div class="lenguaje-cabecera">
                <div class="lenguaje-thumb ${claseLenguaje(g.nombre)}"></div>
                <div>
                    <h2>${g.nombre}</h2>
                    <p>${g.cursos.length} ${g.cursos.length === 1 ? "nivel" : "niveles"} · das ${g.cursos.filter(c => c.profesor_id === perfil.id).length}</p>
                </div>
            </div>
            <div class="niveles">${g.cursos.map(fila)}</div>
        </div>`)}
        ${lista.length ? "" : html`<div class="course-item"><h3>Todavía no hay cursos</h3><p>Creá el primero con <strong>+ Crear curso</strong>.</p></div>`}
    </div>
</section>`,
        alMontar(raiz) {
            raiz.querySelectorAll("[data-filtro]").forEach(b => b.addEventListener("click", () => {
                filtroCatalogo = b.dataset.filtro;
                raiz.querySelectorAll("[data-filtro]").forEach(x => x.classList.toggle("activo", x === b));
                raiz.querySelectorAll(".lenguaje-grupo").forEach(g =>
                    g.hidden = filtroCatalogo !== "todos" && g.dataset.lenguaje !== filtroCatalogo);
            }));
        },
        acciones: {
            async tomar(d) { exito(await rpc("tomar_curso", { p_curso: Number(d.id) })); },
            async crearCurso(d) {
                const nivel = Number(d.nivel);
                if (!Number.isInteger(nivel) || nivel < 1) throw new ErrorFen("El nivel debe ser un número entero desde 1.");
                await q(sb.from("cursos").insert({ codigo: d.codigo.trim(), nombre: d.nombre.trim(), lenguaje: d.lenguaje.trim(), nivel,
                    descripcion: nulo(d.descripcion), profesor_id: perfil.id }));
                exito("Curso creado. Ya aparece en tus cursos y en la matrícula de los estudiantes.");
            },
        },
    };
}

// ------------------------------------------------------------------- curso ---

export async function curso({ perfil, params, query }) {
    const id = Number(params.id);
    const [c] = await q(sb.from("cursos").select("*").eq("id", id));
    if (!c) throw new ErrorFen("El curso no existe.");
    const [clases, actividades, matriculas, recursos] = await Promise.all([
        q(sb.from("clases").select("*").eq("curso_id", id).order("orden").order("id")),
        q(sb.from("actividades").select("*, clase:clases(orden, titulo)").eq("curso_id", id).order("fecha_limite", { nullsFirst: false }).order("id")),
        q(sb.from("matriculas").select("*, alumno:perfiles(id, nombre, usuario)").eq("curso_id", id).order("fecha")),
        q(sb.from("recursos").select("*, autor:perfiles(nombre)").eq("curso_id", id).order("fecha_subida", { ascending: false })),
    ]);
    // Si las ve un admin u otro docente no asignado, RLS devuelve listas vacías: avisamos.
    const actIds = actividades.map(a => a.id);
    const entregas = actIds.length ? await q(sb.from("entregas").select("*, alumno:perfiles(nombre)").in("actividad_id", actIds)
        .order("fecha_entrega", { ascending: false })) : [];
    const actPorId = new Map(actividades.map(a => [a.id, a]));
    const totalValor = actividades.reduce((s, a) => s + Number(a.valor), 0);
    const disponible = Math.round((100 - totalValor) * 100) / 100;
    const porRevisar = entregas.filter(e => e.estado === "Pendiente").length;
    const siguiente = clases.length ? Math.max(...clases.map(x => x.orden)) + 1 : 1;
    const tab = query.get("tab") || "clases";

    const filaEstudiante = m => {
        const r = resumen(actividades.filter(a => a.publicada), ultimaPorActividad(entregas.filter(e => e.user_id === m.user_id)));
        return html`<tr>
            <td><strong>${m.alumno.nombre}</strong><p>@${m.alumno.usuario}</p></td>
            <td>${r.entregadas} / ${r.cantidad}</td>
            <td>${pct(r.evaluado)} de ${pct(r.total)}</td>
            <td><span class="grade-chip">${num(r.nota)}/100</span></td>
            <td><form data-accion="estadoMatricula" data-id="${m.id}" class="inline-admin-form">
                <select name="estado">${opciones(ESTADOS_MATRICULA, m.estado)}</select>
                <button class="admin-btn" type="submit">Guardar</button></form></td></tr>`;
    };

    const filaEntrega = en => {
        const a = actPorId.get(en.actividad_id);
        const examen = a.tipo === "examen";
        return html`<tr>
            <td>${en.alumno?.nombre}</td>
            <td><strong>${a.titulo}</strong> ${chipTipo(a.tipo)}
                <p>${fechaHora(en.fecha_entrega)} ${en.fuera_de_tiempo ? html`<span class="texto-alerta">(fuera de tiempo)</span>` : ""}</p>
                ${en.comentario ? html`<p>💬 ${en.comentario}</p>` : ""}</td>
            <td>${examen ? html`<a class="activity-link" href="#/docente/revisar/${en.id}">Ver respuestas</a>` : ""}
                ${en.archivo_path ? html`<button type="button" class="activity-link" data-accion="descargar" data-ruta="${en.archivo_path}" data-nombre="${en.nombre_original}">${en.nombre_original}</button>` : ""}
                ${en.enlace ? html`<p>${enlaceExterno(en.enlace)}</p>` : ""}</td>
            <td>${chipEntrega(en.estado)} ${en.nota != null ? html`<br><span class="grade-chip">${num(en.nota)}/100</span>` : ""}</td>
            <td><form data-accion="calificar" data-id="${en.id}" data-examen="${examen ? "1" : ""}" class="grade-form">
                <div class="grade-form-row">
                    ${examen ? "" : html`<input type="number" name="nota" min="0" max="100" step="0.01" placeholder="Nota 0-100" value="${en.nota ?? ""}">`}
                    <select name="estado">${opciones(ESTADOS_ENTREGA, en.estado)}</select>
                </div>
                <textarea name="retroalimentacion" placeholder="Retroalimentación para el estudiante">${en.retroalimentacion}</textarea>
                <button class="admin-btn" type="submit">Guardar</button></form></td></tr>`;
    };

    return {
        titulo: c.nombre + " (docente)", seccion: c.nombre, volver: ["docente", "Mis cursos"],
        html: html`
<section class="course-banner ${claseLenguaje(c.lenguaje)}"><div class="course-banner-overlay">
    <h1>${c.nombre}</h1>
    <p>${c.codigo} · ${c.lenguaje} · Nivel ${c.nivel} · ${matriculas.length} estudiantes · Vista docente</p>
</div></section>
${tabs([{ id: "clases", texto: "Clases", icono: "class" }, { id: "evaluacion", texto: "Evaluación", icono: "eval" },
        { id: "entregas", texto: "Entregas", icono: "inbox", contador: porRevisar },
        { id: "estudiantes", texto: "Estudiantes", icono: "users" }, { id: "recursos", texto: "Recursos", icono: "folder" },
        { id: "datos", texto: "Datos del curso", icono: "settings" }], tab)}

<div ${raw(panelTab("clases", tab))}>
    <section class="teacher-grid">
        <div class="course-panel">
            <div class="panel-title">Crear clase</div>
            <form data-accion="crearClase" class="teacher-form">
                <label>Título</label><input type="text" name="titulo" required>
                <label>Número de clase</label><input type="number" name="orden" min="1" value="${siguiente}">
                <label>Descripción / contenido</label><textarea name="descripcion"></textarea>
                <button type="submit">Guardar clase</button>
            </form>
        </div>
        <div class="course-panel">
            <div class="panel-title">Clases publicadas</div>
            <div class="course-list">
                ${clases.map(cl => html`
                <div class="course-item item-con-acciones">
                    <div><h3>Clase ${cl.orden}: ${cl.titulo}</h3><p>${cl.descripcion}</p></div>
                    <button type="button" class="admin-btn danger" data-accion="eliminarClase" data-id="${cl.id}"
                        data-confirm="¿Eliminar la clase «${cl.titulo}»? Sus actividades quedarán como generales.">Eliminar</button>
                </div>`)}
                ${clases.length ? "" : html`<div class="course-item"><h3>Sin clases</h3><p>Creá la primera clase para este curso.</p></div>`}
            </div>
        </div>
    </section>
</div>

<div ${raw(panelTab("evaluacion", tab))}>
    <section class="teacher-grid">
        <div class="course-panel">
            <div class="panel-title">Crear actividad</div>
            <form data-accion="crearActividad" class="teacher-form form-limpio">
                <label>Tipo</label>
                <select name="tipo">
                    <option value="entrega">Entrega de trabajo (archivo o repositorio)</option>
                    <option value="examen">Examen (opción única / respuesta corta)</option>
                </select>
                <label>Título</label><input type="text" name="titulo" required>
                <label>Clase</label>
                <select name="clase_id"><option value="">Actividad general</option>
                    ${clases.map(cl => html`<option value="${cl.id}">Clase ${cl.orden}: ${cl.titulo}</option>`)}</select>
                <label>Fecha límite</label><input type="date" name="fecha_limite" min="${hoy()}">
                <label>Valor % (disponible: ${pct(disponible)})</label>
                <input type="number" name="valor" min="0" max="${disponible}" step="0.01" value="0">
                <label>Consigna</label><textarea name="descripcion"></textarea>
                <small>Los exámenes se crean como borrador: agregá las preguntas y después publicalos.</small>
                <button type="submit">Guardar actividad</button>
            </form>
        </div>
        <div class="course-panel">
            <div class="panel-title">Desglose de evaluación</div>
            <div class="act-tabla-wrap"><table class="act-tabla">
                <thead><tr><th class="col-tipo">Tipo</th><th>Actividad</th><th class="centro">Fecha límite</th><th class="centro">Valor</th><th class="centro">Entregas</th><th></th></tr></thead>
                <tbody>
                    ${actividades.map(a => {
                        const cant = entregas.filter(e => e.actividad_id === a.id).length;
                        return html`<tr>
                            <td class="col-tipo">${iconoTipo(a.tipo)}</td>
                            <td><a class="act-titulo act-enlace" href="#/docente/actividad/${a.id}">${a.titulo}</a>
                                ${!a.publicada ? html`<span class="estado-chip estado-wait"><i class="punto"></i>Borrador</span>` : ""}
                                ${etiquetasActividad(a)}</td>
                            <td class="centro">${celdaFecha(a.fecha_limite)}</td>
                            <td class="centro"><span class="valor-pill">${pct(a.valor)}</span></td>
                            <td class="centro"><span class="contador-pill">${cant}</span></td>
                            <td><div class="acciones-fila">
                                <a class="admin-btn secundario" href="#/docente/actividad/${a.id}">${icono("settings")} Editar</a>
                                <a class="admin-btn secundario" href="#/docente/actividad/${a.id}?tab=previa" title="Vista previa">${icono("user")}</a>
                                <button type="button" class="admin-btn danger" data-accion="eliminarActividad" data-id="${a.id}"
                                    data-confirm="¿Eliminar «${a.titulo}» y sus ${cant} entregas? No se puede deshacer.">Eliminar</button>
                            </div></td></tr>`;
                    })}
                    ${actividades.length ? "" : html`<tr><td colspan="6" class="vacio-celda">${icono("eval")}<br>Todavía no hay actividades. Creá la primera con el formulario.</td></tr>`}
                </tbody>
                <tfoot><tr><td colspan="3">Total del desglose</td>
                    <td class="centro"><span class="valor-pill">${num(totalValor)}/100%</span></td>
                    <td colspan="2" class="centro">${totalValor >= 100 ? html`<span class="estado-chip estado-ok"><i class="punto"></i>Completo</span>`
                        : html`<span class="estado-chip estado-wait"><i class="punto"></i>Faltan ${pct(disponible)}</span>`}</td></tr></tfoot>
            </table></div>
        </div>
    </section>
</div>

<div ${raw(panelTab("entregas", tab))}>
    <section class="course-panel">
        <div class="panel-title">Entregas de estudiantes</div>
        <div class="evaluation-wrapper"><table class="evaluation-table">
            <thead><tr><th>Estudiante</th><th>Actividad</th><th>Trabajo</th><th>Estado</th><th>Calificar</th></tr></thead>
            <tbody>${entregas.map(filaEntrega)}
                ${entregas.length ? "" : html`<tr><td colspan="5">Todavía no hay entregas.</td></tr>`}</tbody>
        </table></div>
    </section>
</div>

<div ${raw(panelTab("estudiantes", tab))}>
    <section class="course-panel">
        <div class="panel-title">Estudiantes matriculados</div>
        <p class="muted panel-help">Marcar a un estudiante como <strong>Aprobado</strong> le permite matricular el siguiente nivel de ${c.lenguaje}.
            Aprobado o Reprobado cierra sus entregas y exámenes en este curso.</p>
        <div class="evaluation-wrapper"><table class="evaluation-table">
            <thead><tr><th>Estudiante</th><th>Realizadas</th><th>Evaluado</th><th>Nota acumulada</th><th>Estado del curso</th></tr></thead>
            <tbody>${matriculas.map(filaEstudiante)}
                ${matriculas.length ? "" : html`<tr><td colspan="5">Todavía no hay estudiantes matriculados.</td></tr>`}</tbody>
        </table></div>
    </section>
</div>

<div ${raw(panelTab("recursos", tab))}>
    <section class="resource-hero"><div class="resource-hero-icon">↓</div>
        <div><h1>Recursos</h1><p>Material de apoyo: archivos, repositorios de ejemplo, videos o documentación.</p></div></section>
    <div class="resource-actions"><button type="button" class="resource-add-btn" data-toggle="resource-form-panel">+ Agregar un recurso</button></div>
    <div id="resource-form-panel" class="resource-form-panel"><div class="resource-form-card">
        <form data-accion="subirRecurso" class="resource-upload">
            <h3>Publicar recurso</h3>
            <label>Título</label><input name="titulo" type="text" placeholder="Ej: Guía de práctica" required>
            <label>Archivo (máx. 16 MB)</label><input name="archivo" type="file" accept="${EXT_RECURSOS.map(x => "." + x).join(",")}">
            <label>o enlace</label><input name="enlace" type="url" placeholder="https://github.com/... o https://youtube.com/...">
            <button type="submit">Publicar recurso</button>
        </form>
    </div></div>
    <div class="resource-list resource-list-full">${listaRecursos(recursos, true)}</div>
</div>

<div ${raw(panelTab("datos", tab))}>
    <section class="teacher-grid">
        <div class="course-panel">
            <div class="panel-title">Datos del curso</div>
            <form data-accion="editarCurso" class="form-fen">
                <label>Código (único)</label><input type="text" name="codigo" value="${c.codigo}" required maxlength="20">
                <label>Nombre</label><input type="text" name="nombre" value="${c.nombre}" required>
                <label>Lenguaje</label><input type="text" name="lenguaje" value="${c.lenguaje}" required>
                <label>Nivel</label><input type="number" name="nivel" value="${c.nivel}" min="1" required>
                <small>Cambiar el nivel o el lenguaje cambia los requisitos de matrícula de esa ruta.</small>
                <label>Descripción</label><textarea name="descripcion">${c.descripcion}</textarea>
                <button class="admin-btn" type="submit">Guardar cambios</button>
            </form>
        </div>
        ${c.profesor_id === perfil.id ? html`
        <div class="course-panel">
            <div class="panel-title">Dejar de dar este curso</div>
            <p class="muted panel-help">El curso vuelve al catálogo y los estudiantes ya no pueden matricularse.
                Las clases, actividades, entregas y notas se conservan si lo volvés a tomar.</p>
            <div class="panel-help">
                <button type="button" class="admin-btn danger" data-accion="dejar" data-boton="Dejar curso"
                    data-confirm="¿Dejar de dar ${c.codigo} · ${c.nombre}? Podés volver a tomarlo desde el catálogo.">Dejar este curso</button>
            </div>
        </div>` : ""}
    </section>
</div>`,
        acciones: {
            async editarCurso(d) {
                const nivel = Number(d.nivel);
                if (!Number.isInteger(nivel) || nivel < 1) throw new ErrorFen("El nivel debe ser un número entero desde 1.");
                await q(sb.from("cursos").update({ codigo: d.codigo.trim(), nombre: d.nombre.trim(), lenguaje: d.lenguaje.trim(),
                    nivel, descripcion: nulo(d.descripcion) }).eq("id", id));
                exito("Datos del curso guardados.");
            },
            async dejar() {
                exito(await rpc("dejar_curso", { p_curso: id }));
                location.hash = "#/docente";
                return false;
            },
            async crearClase(d) {
                await q(sb.from("clases").insert({ curso_id: id, titulo: d.titulo.trim(), orden: Number(d.orden) || siguiente, descripcion: nulo(d.descripcion) }));
                exito("Clase creada.");
            },
            async eliminarClase(d) { await q(sb.from("clases").delete().eq("id", d.id)); exito("Clase eliminada."); },
            async crearActividad(d) {
                const examen = d.tipo === "examen";
                const [nueva] = await q(sb.from("actividades").insert({
                    curso_id: id, tipo: d.tipo, titulo: d.titulo.trim(), descripcion: nulo(d.descripcion),
                    clase_id: nulo(d.clase_id), fecha_limite: nulo(d.fecha_limite), valor: Number(d.valor) || 0,
                    publicada: !examen,
                }).select("id"));
                if (examen) { exito("Examen creado como borrador. Agregá las preguntas y publicalo."); location.hash = `#/docente/actividad/${nueva.id}?tab=preguntas`; return false; }
                exito("Actividad creada.");
            },
            async eliminarActividad(d) {
                const archivos = entregas.filter(e => e.actividad_id === Number(d.id)).map(e => e.archivo_path);
                await borrarArchivos(archivos);   // antes de borrar la fila: el permiso se calcula con la actividad
                await q(sb.from("actividades").delete().eq("id", d.id));
                exito("Actividad eliminada.");
            },
            async calificar(d) {
                const cambios = { estado: d.estado, retroalimentacion: nulo(d.retroalimentacion) };
                if (!d.examen) {
                    const nota = nulo(d.nota);
                    if (nota !== null && (isNaN(nota) || nota < 0 || nota > 100)) throw new ErrorFen("La nota debe estar entre 0 y 100.");
                    cambios.nota = nota === null ? null : Number(nota);
                }
                await q(sb.from("entregas").update(cambios).eq("id", d.id));
                exito("Calificación guardada.");
            },
            async estadoMatricula(d) { await q(sb.from("matriculas").update({ estado: d.estado }).eq("id", d.id)); exito("Estado actualizado."); },
            async subirRecurso(d) {
                const enlace = nulo(d.enlace);
                if (!d.archivo && !enlace) throw new ErrorFen("Subí un archivo o escribí un enlace.");
                if (enlace && !/^https?:\/\/\S+$/i.test(enlace)) throw new ErrorFen("El enlace debe empezar con https://");
                const ruta = d.archivo ? await subirArchivo(`recursos/${id}`, d.archivo, EXT_RECURSOS) : null;
                const { data: { user } } = await sb.auth.getUser();
                await q(sb.from("recursos").insert({ curso_id: id, user_id: user.id, titulo: d.titulo.trim(), archivo_path: ruta,
                    nombre_original: d.archivo?.name ?? null, enlace }));
                exito("Recurso publicado.");
            },
            async eliminarRecurso(d) {
                await q(sb.from("recursos").delete().eq("id", d.id));
                await borrarArchivos([d.ruta]);
                exito("Recurso eliminado.");
            },
            descargar: d => descargar(d.ruta, d.nombre).then(() => false),
        },
    };
}

// ---------------------------------------------------- editor de actividad ---
// Sirve para entregas y exámenes: configuración, preguntas (examen), vista previa y resultados.

export async function actividad({ params, query }) {
    const id = Number(params.id);
    const [ac] = await q(sb.from("actividades").select("*, curso:cursos(codigo, nombre, lenguaje), clase:clases(orden, titulo)").eq("id", id));
    if (!ac) throw new ErrorFen("La actividad no existe o no es de tus cursos.");
    const esExamen = ac.tipo === "examen";
    const [clases, otras, preguntas, intentos, resultados] = await Promise.all([
        q(sb.from("clases").select("id, orden, titulo").eq("curso_id", ac.curso_id).order("orden")),
        q(sb.from("actividades").select("id, valor").eq("curso_id", ac.curso_id)).then(l => l.filter(x => x.id !== id)),
        esExamen ? rpc("solucion_examen", { p_actividad: id }) : [],
        esExamen ? q(sb.from("intentos").select("id").eq("actividad_id", id)) : [],
        q(sb.from("entregas").select("*, alumno:perfiles(nombre)").eq("actividad_id", id).order("fecha_entrega", { ascending: false })),
    ]);
    const lista = preguntas || [];
    const bloqueado = intentos.length > 0;
    const puntos = lista.reduce((s, x) => s + Number(x.puntos), 0);
    const maxValor = Math.round((100 - otras.reduce((s, x) => s + Number(x.valor), 0)) * 100) / 100;
    const tab = query.get("tab") || (esExamen && !lista.length ? "preguntas" : "configuracion");
    const pendientes = resultados.filter(r => r.estado === "Pendiente").length;

    const pestañas = [
        { id: "configuracion", texto: "Configuración", icono: "settings" },
        ...(esExamen ? [{ id: "preguntas", texto: "Preguntas", icono: "eval", contador: lista.length || null }] : []),
        { id: "previa", texto: "Vista previa", icono: "user" },
        { id: "resultados", texto: esExamen ? "Resultados" : "Entregas", icono: "inbox", contador: (esExamen ? resultados.length : pendientes) || null },
    ];

    // --- Vista previa: lo mismo que ve el estudiante, sin poder enviar.
    const campo = (ic, etiqueta, valor) => html`<div class="det-campo"><span class="det-etiqueta">${icono(ic)} ${etiqueta}</span><div>${valor}</div></div>`;
    const previa = html`
    <div class="aviso-previa">${icono("info")} Así lo ven tus estudiantes. ${ac.publicada ? "" : html`<strong>Todavía está oculta: no la ven hasta que la publiques.</strong>`}</div>
    <div class="act-encabezado">${iconoTipo(ac.tipo)}<div><h1>${ac.titulo}</h1><p>${ac.curso.codigo} · ${ac.curso.nombre}</p></div></div>
    <div class="act-detalle">
        <aside class="tarjeta det-panel">
            <div class="tarjeta-cabecera">
                <span class="tarjeta-icono">${icono("info")}</span><div><h2>Detalles</h2></div>
                <span class="contador-pill ${esExamen ? "amarillo" : "azul"}">${esExamen ? "Examen" : "Entrega de archivo"}</span>
            </div>
            ${campo("calendar", "Fecha límite", html`<strong>${ac.fecha_limite ? fechaDMA(ac.fecha_limite) + " 23:59" : "Sin fecha límite"}</strong>`)}
            ${campo("folder", "Clase", html`<span class="etq etq-clase">${ac.clase?.titulo ?? "Actividad general"}</span>`)}
            ${campo("chart", "Valor en la nota final", html`<span class="valor-pill">${pct(ac.valor)}</span>`)}
            ${esExamen ? html`${campo("eval", "Preguntas", `${lista.length} preguntas · ${num(puntos)} puntos`)}
                ${campo("clock", "Duración", ac.duracion_minutos ? ac.duracion_minutos + " minutos" : "Sin límite de tiempo")}` : ""}
            ${campo("file", "Instrucciones", html`<div class="det-consigna">${ac.descripcion || "Sin instrucciones."}</div>`)}
        </aside>
        <section class="act-principal">
            ${esExamen ? html`
            <div class="tarjeta">
                <div class="tarjeta-cabecera"><span class="tarjeta-icono amarillo">${icono("star")}</span>
                    <div><h2>Examen</h2><p>Un solo intento${ac.duracion_minutos ? ` · ${ac.duracion_minutos} minutos` : ""}</p></div></div>
                <div class="previa-preguntas">
                    ${lista.map((x, i) => html`
                    <div class="pregunta">
                        <h3>${i + 1}. ${x.enunciado} <span class="puntos">(${num(x.puntos)} ${Number(x.puntos) === 1 ? "punto" : "puntos"})</span></h3>
                        ${x.tipo === "opcion_unica"
                            ? x.opciones.map(o => html`<label class="opcion"><input type="radio" disabled name="p${x.id}"><span>${o.texto}</span></label>`)
                            : html`<input type="text" disabled placeholder="Respuesta del estudiante">`}
                    </div>`)}
                    ${lista.length ? html`<p class="muted previa-nota">Al estudiante las preguntas y las opciones le aparecen en orden aleatorio.</p>`
                        : html`<div class="vacio chico">${icono("eval")}<p>Todavía no hay preguntas.</p></div>`}
                </div>
            </div>` : html`
            <div class="tarjeta">
                <div class="tarjeta-cabecera"><span class="tarjeta-icono naranja">${icono("upload")}</span>
                    <div><h2>Entregar</h2><p>Archivo (${EXT_ENTREGAS_TXT}) y/o enlace a GitHub</p></div></div>
                <div class="form-limpio previa-deshabilitada">
                    <div class="zona-archivo">${icono("upload")}<span><strong>Elegí un archivo</strong> para subir</span><small class="zona-nombre">Vista previa: no se puede subir</small></div>
                    <label>Enlace al repositorio (opcional)</label><input type="url" disabled placeholder="https://github.com/tu-usuario/tu-proyecto">
                    <label>Comentario para el profesor</label><textarea disabled placeholder="Opcional"></textarea>
                    <button type="button" class="admin-btn" disabled>${icono("upload")} Entregar actividad</button>
                </div>
            </div>`}
        </section>
    </div>`;

    return {
        titulo: (esExamen ? "Examen: " : "Actividad: ") + ac.titulo, seccion: esExamen ? "Editar examen" : "Editar actividad",
        volver: [`docente/curso/${ac.curso_id}?tab=evaluacion`, "Volver al curso"],
        html: html`
<section class="course-banner ${claseLenguaje(ac.curso.lenguaje)}"><div class="course-banner-overlay">
    <h1>${ac.titulo}</h1>
    <p>${ac.curso.codigo} · ${ac.curso.nombre} · ${esExamen ? "Examen" : "Entrega"} · ${pct(ac.valor)} de la nota
       ${esExamen ? ` · ${lista.length} preguntas · ${num(puntos)} puntos` : ""}</p>
</div></section>

<div class="editor-barra">
    <span class="estado-chip ${ac.publicada ? "estado-ok" : "estado-wait"}"><i class="punto"></i>${ac.publicada ? "Publicada: la ven tus estudiantes" : "Oculta (borrador)"}</span>
    ${bloqueado ? html`<span class="estado-chip estado-lock"><i class="punto"></i>${intentos.length} ya empezaron: preguntas bloqueadas</span>` : ""}
    <span class="editor-barra-espacio"></span>
    <button type="button" class="admin-btn ${ac.publicada ? "secundario" : ""}" data-accion="publicar" data-valor="${ac.publicada ? "" : "1"}"
        ${raw(!ac.publicada && esExamen && !lista.length ? 'disabled title="Agregá al menos una pregunta"' : "")}>
        ${ac.publicada ? "Ocultar a estudiantes" : esExamen ? "Publicar examen" : "Publicar actividad"}</button>
</div>

${tabs(pestañas, tab)}

<div ${raw(panelTab("configuracion", tab))}>
    <div class="course-panel editor-config">
        <div class="panel-title">Configuración</div>
        <form data-accion="configurar" class="teacher-form form-limpio">
            <label>Título</label><input type="text" name="titulo" value="${ac.titulo}" required>
            <label>Clase</label>
            <select name="clase_id"><option value="">Actividad general</option>
                ${clases.map(cl => html`<option value="${cl.id}" ${raw(cl.id === ac.clase_id ? "selected" : "")}>Clase ${cl.orden}: ${cl.titulo}</option>`)}</select>
            <div class="form-fila">
                <div><label>${esExamen ? "Fecha límite para comenzar" : "Fecha límite"}</label><input type="date" name="fecha_limite" value="${ac.fecha_limite ?? ""}"></div>
                <div><label>Valor % (máximo ${pct(maxValor)})</label><input type="number" name="valor" min="0" max="${maxValor}" step="0.01" value="${ac.valor}"></div>
            </div>
            ${esExamen ? html`
            <label>Duración en minutos (vacío = sin límite)</label><input type="number" name="duracion_minutos" min="1" value="${ac.duracion_minutos ?? ""}">
            <label class="check"><input type="checkbox" name="mostrar_solucion" value="1" ${raw(ac.mostrar_solucion ? "checked" : "")}>
                Mostrar la corrección al estudiante después de enviar</label>` : ""}
            <label>${esExamen ? "Instrucciones" : "Consigna"}</label><textarea name="descripcion" rows="6">${ac.descripcion}</textarea>
            <button class="admin-btn" type="submit">${icono("ok")} Guardar cambios</button>
        </form>
    </div>
</div>

${esExamen ? html`
<div ${raw(panelTab("preguntas", tab))}>
    <section class="teacher-grid">
        <div class="course-panel">
            <div class="panel-title">Agregar pregunta</div>
            ${bloqueado ? html`<p class="muted panel-help">No se pueden agregar ni quitar preguntas porque ya hay intentos.
                Si necesitás corregir algo, ajustá la corrección de cada respuesta desde Resultados.</p>` : html`
            <form data-accion="agregarPregunta" class="teacher-form form-limpio" id="form-pregunta">
                <label>Tipo</label>
                <select name="tipo" id="tipo-pregunta">
                    <option value="opcion_unica">Opción única (una correcta)</option>
                    <option value="respuesta_corta">Respuesta corta</option>
                </select>
                <label>Enunciado</label><textarea name="enunciado" required placeholder="¿Qué imprime print(2 ** 3)?"></textarea>
                <label>Puntos</label><input type="number" name="puntos" min="0.5" step="0.5" value="1">
                <div data-tipo="opcion_unica" class="form-grupo">
                    <label>Opciones (una por línea; la correcta empieza con *)</label>
                    <textarea name="opciones" rows="5" placeholder="*8&#10;6&#10;9&#10;23"></textarea>
                    <small>Al estudiante se le muestran en orden aleatorio.</small>
                </div>
                <div data-tipo="respuesta_corta" class="form-grupo" hidden>
                    <label>Respuestas aceptadas (separadas por |)</label>
                    <input type="text" name="aceptadas" placeholder="8|ocho">
                    <small>No distingue mayúsculas, tildes ni espacios extra. Los números se comparan por valor (8 = 8.0).</small>
                </div>
                <button class="admin-btn" type="submit">Agregar pregunta</button>
            </form>`}
        </div>
        <div class="course-panel">
            <div class="panel-title">Preguntas · ${num(puntos)} puntos</div>
            <div class="preguntas-lista">
            ${lista.map(x => html`
            <div class="pregunta">
                <h3>${x.orden}. ${x.enunciado} <span class="puntos">(${num(x.puntos)} pts · ${x.tipo === "opcion_unica" ? "opción única" : "respuesta corta"})</span></h3>
                ${x.tipo === "opcion_unica"
                    ? x.opciones.map(o => html`<div class="opcion ${o.id === x.opcion_correcta_id ? "correcta" : ""}">${o.id === x.opcion_correcta_id ? "✓ " : ""}${o.texto}</div>`)
                    : html`<p>Respuestas aceptadas: <strong>${(x.respuestas_aceptadas || "").split("|").filter(Boolean).join(" / ")}</strong></p>`}
                ${bloqueado ? "" : html`<div class="respuesta-acciones"><button type="button" class="admin-btn danger" data-accion="eliminarPregunta"
                    data-id="${x.id}" data-confirm="¿Eliminar esta pregunta?">Eliminar</button></div>`}
            </div>`)}
            ${lista.length ? "" : html`<div class="vacio chico">${icono("eval")}<p>Todavía no hay preguntas. Agregá al menos una para poder publicar.</p></div>`}
            </div>
        </div>
    </section>
</div>` : ""}

<div ${raw(panelTab("previa", tab))}>${previa}</div>

<div ${raw(panelTab("resultados", tab))}>
    <section class="course-panel">
        <div class="panel-title">${esExamen ? "Resultados" : "Entregas"}</div>
        <div class="act-tabla-wrap"><table class="act-tabla">
            <thead><tr><th>Estudiante</th><th class="centro">Enviado</th><th class="centro">Estado</th><th class="centro">Nota</th><th></th></tr></thead>
            <tbody>
                ${resultados.map(r => html`<tr>
                    <td><strong>${r.alumno?.nombre}</strong>${r.nombre_original ? html`<div class="muted">${r.nombre_original}</div>` : ""}</td>
                    <td class="centro">${fechaHora(r.fecha_entrega)} ${r.fuera_de_tiempo ? html`<span class="texto-rojo">· tardía</span>` : ""}</td>
                    <td class="centro">${chipEntrega(r.estado)}</td>
                    <td class="centro">${r.nota == null ? html`<span class="muted">—</span>` : html`<span class="calif-ok">${num(r.nota)}/100</span>`}</td>
                    <td><div class="acciones-fila">${esExamen
                        ? html`<a class="admin-btn secundario" href="#/docente/revisar/${r.id}">Ver respuestas</a>`
                        : html`<a class="admin-btn secundario" href="#/docente/curso/${ac.curso_id}?tab=entregas">Calificar</a>`}</div></td></tr>`)}
                ${resultados.length ? "" : html`<tr><td colspan="5" class="vacio-celda">Nadie ${esExamen ? "envió este examen" : "entregó esta actividad"} todavía.</td></tr>`}
            </tbody>
        </table></div>
    </section>
</div>`,
        alMontar(raiz) {
            const tipo = raiz.querySelector("#tipo-pregunta");
            if (!tipo) return;
            const actualizar = () => raiz.querySelectorAll("#form-pregunta [data-tipo]").forEach(d => (d.hidden = d.dataset.tipo !== tipo.value));
            tipo.addEventListener("change", actualizar);
            actualizar();
        },
        acciones: {
            async publicar(d) {
                await q(sb.from("actividades").update({ publicada: !!d.valor }).eq("id", id));
                exito(d.valor ? "Publicada: ya la ven tus estudiantes." : "Oculta: tus estudiantes ya no la ven.");
            },
            async configurar(d) {
                const valor = Number(d.valor) || 0;
                if (valor < 0 || valor > maxValor) throw new ErrorFen(`El valor debe estar entre 0 y ${pct(maxValor)} (el total del curso no puede pasar de 100%).`);
                const cambios = {
                    titulo: d.titulo.trim(), descripcion: nulo(d.descripcion), fecha_limite: nulo(d.fecha_limite),
                    clase_id: nulo(d.clase_id) === null ? null : Number(d.clase_id), valor,
                };
                if (esExamen) {
                    const dur = nulo(d.duracion_minutos);
                    cambios.duracion_minutos = dur === null ? null : Number(dur);
                    cambios.mostrar_solucion = !!d.mostrar_solucion;
                }
                await q(sb.from("actividades").update(cambios).eq("id", id));
                exito("Cambios guardados.");
            },
            async agregarPregunta(d) {
                let opciones = null, correcta = null;
                if (d.tipo === "opcion_unica") {
                    const lineas = (d.opciones || "").split("\n").map(l => l.trim()).filter(Boolean);
                    const marcadas = lineas.filter(l => l.startsWith("*"));
                    if (lineas.length < 2) throw new ErrorFen("Escribí al menos 2 opciones, una por línea.");
                    if (marcadas.length !== 1) throw new ErrorFen("Marcá exactamente UNA opción correcta con * al inicio.");
                    correcta = lineas.findIndex(l => l.startsWith("*"));
                    opciones = lineas.map(l => l.replace(/^\*\s*/, ""));
                }
                await rpc("guardar_pregunta", { p_actividad: id, p_enunciado: d.enunciado, p_tipo: d.tipo, p_puntos: Number(d.puntos) || 1,
                    p_opciones: opciones, p_correcta: correcta, p_aceptadas: d.tipo === "respuesta_corta" ? d.aceptadas : null });
                exito("Pregunta agregada.");
            },
            async eliminarPregunta(d) { await q(sb.from("preguntas").delete().eq("id", d.id)); exito("Pregunta eliminada."); },
        },
    };
}

/** Compatibilidad con los enlaces viejos #/docente/examen/:id */
export const examen = ctx => actividad({ ...ctx, query: ctx.query ?? new URLSearchParams() });

// --------------------------------------------------------- revisar intento ---

export async function revisar({ params }) {
    const id = Number(params.id);
    const [en] = await q(sb.from("entregas").select("*, alumno:perfiles(nombre), actividad:actividades(id, titulo)").eq("id", id));
    if (!en) throw new ErrorFen("La entrega no existe o no es de tus cursos.");
    const [preguntas, respuestas] = await Promise.all([
        rpc("solucion_examen", { p_actividad: en.actividad_id }),
        q(sb.from("respuestas").select("*").eq("entrega_id", id)),
    ]);
    const porPregunta = new Map(respuestas.map(r => [r.pregunta_id, r]));
    const boton = r => r ? html`<div class="respuesta-acciones"><button type="button" class="admin-btn ${r.correcta ? "danger" : ""}"
        data-accion="corregir" data-id="${r.id}" data-valor="${r.correcta ? "" : "1"}">${r.correcta ? "Marcar como incorrecta" : "Marcar como correcta"}</button></div>` : "";

    return {
        titulo: "Respuestas de " + en.alumno?.nombre, seccion: "Revisión de examen", volver: [`docente/actividad/${en.actividad_id}?tab=resultados`, "Volver al examen"],
        html: html`
<section class="course-panel">
    <div class="panel-title">${en.actividad.titulo} · ${en.alumno?.nombre}</div>
    <div class="exam-toolbar">
        <span class="nota-grande">${num(en.nota)}/100</span>
        <span>Enviado ${fechaHora(en.fecha_entrega)}</span>
        ${en.fuera_de_tiempo ? html`<span class="estado-chip estado-bad">Fuera de tiempo</span>` : ""}
        ${en.comentario ? html`<span class="muted">${en.comentario}</span>` : ""}
    </div>
    <p class="muted panel-help">La corrección es automática. Si una respuesta corta está bien pero escrita de otra forma, marcala como correcta: la nota se recalcula.</p>
    ${(preguntas || []).map(p => preguntaCorregida(p, porPregunta.get(p.id), boton(porPregunta.get(p.id))))}
    <form data-accion="comentar" class="form-fen">
        <label>Comentario para el estudiante</label>
        <textarea name="retroalimentacion">${en.retroalimentacion}</textarea>
        <button class="admin-btn" type="submit">Guardar comentario</button>
    </form>
</section>`,
        acciones: {
            async corregir(d) {
                const nota = await rpc("cambiar_correccion", { p_respuesta: Number(d.id), p_correcta: !!d.valor });
                exito(`Corrección actualizada. Nueva nota: ${num(nota)}/100.`);
            },
            async comentar(d) {
                await q(sb.from("entregas").update({ retroalimentacion: nulo(d.retroalimentacion) }).eq("id", id));
                exito("Comentario guardado.");
            },
        },
    };
}
