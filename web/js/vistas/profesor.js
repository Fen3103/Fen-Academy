// Pantallas del PROFESOR (y del admin en el "panel docente").
// La base solo deja ver y modificar los cursos asignados al profesor.
import { sb, q, rpc, ErrorFen, subirArchivo, descargar, borrarArchivos, EXT_RECURSOS, ultimaPorActividad, resumen } from "../api.js";
import { html, raw, num, pct, fecha, fechaHora, chipEntrega, chipTipo, tabs, panelTab, enlaceExterno, exito, hoy, claseLenguaje } from "../ui.js";
import { listaRecursos, preguntaCorregida } from "./estudiante.js";

const ESTADOS_ENTREGA = ["Pendiente", "Revisado", "Aprobado", "Rechazado"];
const ESTADOS_MATRICULA = ["Cursando", "Aprobado", "Reprobado"];
const opciones = (lista, actual) => lista.map(v => html`<option value="${v}" ${raw(v === actual ? "selected" : "")}>${v}</option>`);
const nulo = v => (v === undefined || String(v).trim() === "" ? null : String(v).trim());

// ------------------------------------------------------------------ inicio ---

export async function inicio({ perfil }) {
    const esAdmin = perfil.rol === "admin";
    let consulta = sb.from("cursos").select("*, profesor:perfiles(nombre), matriculas(count), actividades(id)").order("lenguaje").order("nivel");
    if (!esAdmin) consulta = consulta.eq("profesor_id", perfil.id);
    const cursos = await q(consulta);
    const ids = cursos.map(c => c.id);
    const pendientes = ids.length ? await q(sb.from("entregas").select("id, actividad:actividades!inner(curso_id)")
        .eq("estado", "Pendiente").in("actividad.curso_id", ids)) : [];
    const porRevisar = id => pendientes.filter(p => p.actividad.curso_id === id).length;
    const estudiantes = cursos.reduce((s, c) => s + (c.matriculas[0]?.count ?? 0), 0);

    return {
        titulo: "Panel docente",
        html: html`
<div class="hero-dashboard-card hero-docente"><div class="hero-dashboard-text">
    <h1>Hola, ${perfil.nombre}</h1>
    <p>Prepará tus clases, publicá exámenes y revisá las entregas de tus estudiantes.</p>
</div></div>
<section class="stats-grid stats-grid-3">
    <div class="stat-card"><span>${esAdmin ? "Cursos (todos)" : "Mis cursos"}</span><strong>${cursos.length}</strong></div>
    <div class="stat-card"><span>Estudiantes</span><strong>${estudiantes}</strong></div>
    <div class="stat-card ${pendientes.length ? "stat-alerta" : ""}"><span>Entregas por revisar</span><strong>${pendientes.length}</strong></div>
</section>
<section class="course-panel">
    <div class="panel-title">${esAdmin ? "Todos los cursos" : "Mis cursos"}</div>
    <div class="course-list">
        ${cursos.map(c => html`
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
        </a>`)}
        ${cursos.length ? "" : html`<div class="course-item"><h3>Sin cursos asignados</h3>
            <p>Cuando un administrador te asigne cursos, aparecerán en este panel.</p></div>`}
    </div>
</section>`,
    };
}

// ------------------------------------------------------------------- curso ---

export async function curso({ params, query }) {
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
        { id: "entregas", texto: porRevisar ? `Entregas (${porRevisar})` : "Entregas", icono: "list" },
        { id: "estudiantes", texto: "Estudiantes", icono: "list" }, { id: "recursos", texto: "Recursos", icono: "folder" }], tab)}

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
            <form data-accion="crearActividad" class="teacher-form">
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
            <div class="evaluation-wrapper"><table class="evaluation-table">
                <thead><tr><th>Actividad</th><th>Fecha</th><th>Valor</th><th>Entregas</th><th></th></tr></thead>
                <tbody>
                    ${actividades.map(a => {
                        const cant = entregas.filter(e => e.actividad_id === a.id).length;
                        return html`<tr>
                            <td><strong>${a.titulo}</strong> ${chipTipo(a.tipo)}
                                ${!a.publicada ? html`<span class="estado-chip estado-wait">Borrador</span>` : ""}
                                <p>${a.clase ? `Clase ${a.clase.orden}: ${a.clase.titulo}` : "General"}</p></td>
                            <td>${fecha(a.fecha_limite)}</td><td>${pct(a.valor)}</td><td>${cant}</td>
                            <td><div class="resource-card-actions">
                                ${a.tipo === "examen" ? html`<a class="admin-btn" href="#/docente/examen/${a.id}">Preguntas</a>` : ""}
                                <button type="button" class="admin-btn danger" data-accion="eliminarActividad" data-id="${a.id}"
                                    data-confirm="¿Eliminar «${a.titulo}» y sus ${cant} entregas? No se puede deshacer.">Eliminar</button>
                            </div></td></tr>`;
                    })}
                    ${actividades.length ? "" : html`<tr><td colspan="5">No hay actividades registradas.</td></tr>`}
                    <tr class="evaluation-total-row"><td colspan="2">Total del desglose</td><td>${num(totalValor)}/100%</td>
                        <td colspan="2">${totalValor >= 100 ? html`<span class="estado-chip estado-ok">Completo</span>`
                            : html`<span class="estado-chip estado-lock">Faltan ${pct(disponible)}</span>`}</td></tr>
                </tbody>
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
</div>`,
        acciones: {
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
                if (examen) { exito("Examen creado como borrador. Agregá las preguntas y publicalo."); location.hash = `#/docente/examen/${nueva.id}`; return false; }
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

// ------------------------------------------------------- editor de examen ---

export async function examen({ params }) {
    const id = Number(params.id);
    const [ex] = await q(sb.from("actividades").select("*, curso:cursos(codigo, nombre)").eq("id", id).eq("tipo", "examen"));
    if (!ex) throw new ErrorFen("El examen no existe o no es de tus cursos.");
    const [preguntas, intentos, resultados] = await Promise.all([
        rpc("solucion_examen", { p_actividad: id }),
        q(sb.from("intentos").select("id", { count: "exact", head: false }).eq("actividad_id", id)),
        q(sb.from("entregas").select("*, alumno:perfiles(nombre)").eq("actividad_id", id).order("fecha_entrega")),
    ]);
    const bloqueado = intentos.length > 0;
    const puntos = (preguntas || []).reduce((s, p) => s + Number(p.puntos), 0);

    return {
        titulo: "Examen: " + ex.titulo, seccion: "Editor de examen", volver: [`docente/curso/${ex.curso_id}?tab=evaluacion`, "Volver al curso"],
        html: html`
<section class="course-banner"><div class="course-banner-overlay">
    <h1>${ex.titulo}</h1>
    <p>${ex.curso.codigo} · ${ex.curso.nombre} · ${pct(ex.valor)} de la nota · ${preguntas.length} preguntas · ${num(puntos)} puntos ·
       ${ex.publicada ? "Publicado" : "Borrador (oculto)"}</p>
</div></section>

<div class="exam-toolbar" style="padding-top:18px">
    <button type="button" class="admin-btn ${ex.publicada ? "danger" : ""}" data-accion="publicar" data-valor="${ex.publicada ? "" : "1"}">
        ${ex.publicada ? "Ocultar a estudiantes" : "Publicar examen"}</button>
    ${bloqueado ? html`<span class="estado-chip estado-wait">${intentos.length} estudiante(s) ya empezaron: las preguntas quedan bloqueadas</span>` : ""}
</div>

<section class="teacher-grid">
    <div class="course-panel">
        <div class="panel-title">Agregar pregunta</div>
        ${bloqueado ? html`<p class="muted panel-help">No se pueden agregar ni quitar preguntas porque ya hay intentos.
            Si necesitás corregir algo, podés ajustar la corrección de cada respuesta desde los resultados.</p>` : html`
        <form data-accion="agregarPregunta" class="form-fen" id="form-pregunta">
            <label>Tipo</label>
            <select name="tipo" id="tipo-pregunta">
                <option value="opcion_unica">Opción única (una correcta)</option>
                <option value="respuesta_corta">Respuesta corta</option>
            </select>
            <label>Enunciado</label><textarea name="enunciado" required placeholder="¿Qué imprime print(2 ** 3)?"></textarea>
            <label>Puntos</label><input type="number" name="puntos" min="0.5" step="0.5" value="1">
            <div data-tipo="opcion_unica">
                <label>Opciones (una por línea; la correcta empieza con *)</label>
                <textarea name="opciones" rows="5" placeholder="*8&#10;6&#10;9&#10;23"></textarea>
                <small>Al estudiante se le muestran en orden aleatorio.</small>
            </div>
            <div data-tipo="respuesta_corta" hidden>
                <label>Respuestas aceptadas (separadas por |)</label>
                <input type="text" name="aceptadas" placeholder="8|ocho">
                <small>No distingue mayúsculas, tildes ni espacios extra. Los números se comparan por valor (8 = 8.0).</small>
            </div>
            <button class="admin-btn" type="submit">Agregar pregunta</button>
        </form>`}
    </div>
    <div class="course-panel">
        <div class="panel-title">Configuración</div>
        <form data-accion="configurar" class="form-fen">
            <label>Título</label><input type="text" name="titulo" value="${ex.titulo}" required>
            <label>Instrucciones</label><textarea name="descripcion">${ex.descripcion}</textarea>
            <label>Fecha límite para comenzar</label><input type="date" name="fecha_limite" value="${ex.fecha_limite ?? ""}">
            <label>Valor % en la nota final</label><input type="number" name="valor" min="0" max="100" step="0.01" value="${ex.valor}">
            <label>Duración en minutos (vacío = sin límite)</label><input type="number" name="duracion_minutos" min="1" value="${ex.duracion_minutos ?? ""}">
            <label class="check"><input type="checkbox" name="mostrar_solucion" value="1" ${raw(ex.mostrar_solucion ? "checked" : "")}>
                Mostrar la corrección al estudiante después de enviar</label>
            <button class="admin-btn" type="submit">Guardar configuración</button>
        </form>
    </div>
</section>

<section class="course-panel" style="margin-top:20px">
    <div class="panel-title">Preguntas</div>
    ${preguntas.map(p => html`
    <div class="pregunta">
        <h3>${p.orden}. ${p.enunciado} <span class="puntos">(${num(p.puntos)} pts · ${p.tipo === "opcion_unica" ? "opción única" : "respuesta corta"})</span></h3>
        ${p.tipo === "opcion_unica"
            ? p.opciones.map(o => html`<div class="opcion ${o.id === p.opcion_correcta_id ? "correcta" : ""}">${o.id === p.opcion_correcta_id ? "✓ " : ""}${o.texto}</div>`)
            : html`<p>Respuestas aceptadas: <strong>${(p.respuestas_aceptadas || "").split("|").filter(Boolean).join(" / ")}</strong></p>`}
        ${bloqueado ? "" : html`<div class="respuesta-acciones"><button type="button" class="admin-btn danger" data-accion="eliminarPregunta"
            data-id="${p.id}" data-confirm="¿Eliminar esta pregunta?">Eliminar</button></div>`}
    </div>`)}
    ${preguntas.length ? "" : html`<p class="muted panel-help">Todavía no hay preguntas. Agregá al menos una para poder publicar.</p>`}
</section>

<section class="course-panel" style="margin-top:20px">
    <div class="panel-title">Resultados</div>
    <div class="evaluation-wrapper"><table class="evaluation-table">
        <thead><tr><th>Estudiante</th><th>Enviado</th><th>Nota</th><th></th></tr></thead>
        <tbody>
            ${resultados.map(r => html`<tr><td>${r.alumno?.nombre}</td>
                <td>${fechaHora(r.fecha_entrega)} ${r.fuera_de_tiempo ? html`<span class="texto-alerta">(fuera de tiempo)</span>` : ""}</td>
                <td><span class="grade-chip">${num(r.nota)}/100</span></td>
                <td><a class="activity-link" href="#/docente/revisar/${r.id}">Ver respuestas</a></td></tr>`)}
            ${resultados.length ? "" : html`<tr><td colspan="4">Nadie envió este examen todavía.</td></tr>`}
        </tbody>
    </table></div>
</section>`,
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
                exito(d.valor ? "Examen publicado: ya lo ven tus estudiantes." : "Examen oculto.");
            },
            async configurar(d) {
                const dur = nulo(d.duracion_minutos);
                await q(sb.from("actividades").update({
                    titulo: d.titulo.trim(), descripcion: nulo(d.descripcion), fecha_limite: nulo(d.fecha_limite),
                    valor: Number(d.valor) || 0, duracion_minutos: dur === null ? null : Number(dur), mostrar_solucion: !!d.mostrar_solucion,
                }).eq("id", id));
                exito("Configuración guardada.");
            },
            async agregarPregunta(d) {
                let lista = null, correcta = null;
                if (d.tipo === "opcion_unica") {
                    const lineas = (d.opciones || "").split("\n").map(l => l.trim()).filter(Boolean);
                    const marcadas = lineas.filter(l => l.startsWith("*"));
                    if (lineas.length < 2) throw new ErrorFen("Escribí al menos 2 opciones, una por línea.");
                    if (marcadas.length !== 1) throw new ErrorFen("Marcá exactamente UNA opción correcta con * al inicio.");
                    correcta = lineas.findIndex(l => l.startsWith("*"));
                    lista = lineas.map(l => l.replace(/^\*\s*/, ""));
                }
                await rpc("guardar_pregunta", { p_actividad: id, p_enunciado: d.enunciado, p_tipo: d.tipo, p_puntos: Number(d.puntos) || 1,
                    p_opciones: lista, p_correcta: correcta, p_aceptadas: d.tipo === "respuesta_corta" ? d.aceptadas : null });
                exito("Pregunta agregada.");
            },
            async eliminarPregunta(d) { await q(sb.from("preguntas").delete().eq("id", d.id)); exito("Pregunta eliminada."); },
        },
    };
}

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
        titulo: "Respuestas de " + en.alumno?.nombre, seccion: "Revisión de examen", volver: [`docente/examen/${en.actividad_id}`, "Volver al examen"],
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
