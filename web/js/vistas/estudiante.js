// Pantallas del ESTUDIANTE: inicio, matrícula, progreso, curso, actividad y examen.
import { sb, q, rpc, ErrorFen, subirArchivo, descargar, EXT_ENTREGAS, ultimaPorActividad, resumen, aporte, requisito, mezclar } from "../api.js";
import { html, raw, num, pct, fecha, fechaHora, vencida, chipEntrega, chipMatricula, chipTipo, tabs, panelTab,
         enlaceExterno, exito, NOTICIAS, claseLenguaje } from "../ui.js";

const CURSO_COLS = "id, codigo, nombre, lenguaje, nivel, descripcion, profesor:perfiles!cursos_profesor_id_fkey(nombre)";

async function misMatriculas(uid) {
    return q(sb.from("matriculas").select(`id, curso_id, estado, curso:cursos(${CURSO_COLS})`).eq("user_id", uid).order("fecha"));
}

// ------------------------------------------------------------------ inicio ---

export async function inicio({ perfil }) {
    const matriculas = await misMatriculas(perfil.id);
    const cursando = matriculas.filter(m => m.estado === "Cursando").map(m => m.curso_id);
    const [actividades, entregas] = await Promise.all([
        cursando.length ? q(sb.from("actividades").select("id, titulo, tipo, fecha_limite, curso:cursos(nombre)").in("curso_id", cursando)) : [],
        q(sb.from("entregas").select("actividad_id").eq("user_id", perfil.id)),
    ]);
    const hechas = new Set(entregas.map(x => x.actividad_id));
    const pendientes = actividades.filter(a => !hechas.has(a.id))
        .sort((a, b) => (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999"));
    const [cat, tit, txt] = NOTICIAS[Math.floor(Date.now() / 864e5) % NOTICIAS.length];

    return {
        titulo: "Inicio",
        html: html`
<section class="welcome-banner">
    <div class="warning-icon">!</div>
    <p>Hola <strong>${perfil.nombre}</strong>. Bienvenido a Fen Academy. Aquí verás tus cursos y tus actividades pendientes.</p>
</section>
<section class="main-panels">
    <div class="student-panel">
        <div class="panel-title">Panel del estudiante</div>
        <div class="hero-dashboard-card">
            <div class="hero-dashboard-text">
                <h1>Tu aula virtual está lista</h1>
                <p>Revisá clases, entregá tus trabajos (archivo o repositorio de GitHub), rendí exámenes y seguí tus notas.</p>
                <a href="#/matricula" class="hero-dashboard-badge">Ver matrícula</a>
            </div>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><span>Cursos</span><strong>${matriculas.length}</strong></div>
            <div class="stat-card"><span>Actividades pendientes</span><strong>${pendientes.length}</strong></div>
        </div>
        <div class="quick-grid">
            ${matriculas.map(m => html`
            <a href="#/curso/${m.curso_id}" class="course-link-card">
                <div class="quick-card course-card">
                    <div class="course-thumb ${claseLenguaje(m.curso.lenguaje)}"></div>
                    <h3>${m.curso.codigo} · ${m.curso.nombre}</h3>
                    <p><strong>Lenguaje:</strong> ${m.curso.lenguaje} · <strong>Nivel:</strong> ${m.curso.nivel}</p>
                    <p>${m.curso.descripcion}</p>
                    ${chipMatricula(m.estado)}
                </div>
            </a>`)}
            ${matriculas.length ? "" : html`<div class="quick-card"><h3>Sin cursos todavía</h3>
                <p>Entrá a <a class="activity-link" href="#/matricula">Matrícula</a> y elegí tu primer curso.</p></div>`}
        </div>
    </div>
    <aside class="bulletin-panel">
        <div class="panel-title">Por entregar</div>
        <div class="pending-list">
            ${pendientes.slice(0, 6).map(a => html`
            <a class="pending-item" href="#/actividad/${a.id}">
                <strong>${a.titulo} ${chipTipo(a.tipo)}</strong>
                <span>${a.curso.nombre}</span>
                <small class="${vencida(a.fecha_limite) ? "texto-alerta" : ""}">${a.fecha_limite ? "Vence " + fecha(a.fecha_limite) : "Sin fecha límite"}</small>
            </a>`)}
            ${pendientes.length ? "" : html`<p class="muted">¡Estás al día! No tenés actividades pendientes.</p>`}
        </div>
        <div class="panel-title">Noticias tech</div>
        <div class="tech-news-card"><span>${cat}</span><h3>${tit}</h3><p>${txt}</p></div>
    </aside>
</section>`,
    };
}

// --------------------------------------------------------------- matrícula ---

export async function matricula({ perfil }) {
    const [cursos, mias] = await Promise.all([
        q(sb.from("cursos").select(CURSO_COLS).order("lenguaje").order("nivel").order("codigo")),
        q(sb.from("matriculas").select("curso_id, estado, curso:cursos(lenguaje, nivel)").eq("user_id", perfil.id)),
    ]);
    const estado = new Map(mias.map(m => [m.curso_id, m.estado]));
    // Solo se ofrecen los cursos que alguien está dando (y los que ya cursaste).
    const activos = cursos.filter(c => c.profesor);
    const visibles = cursos.filter(c => c.profesor || estado.has(c.id));
    const grupos = new Map();
    for (const c of visibles) {
        const clave = c.lenguaje;
        if (!grupos.has(clave)) grupos.set(clave, []);
        const req = estado.has(c.id) ? null : requisito(c, activos);
        const aprobado = req && req.some(r => estado.get(r.id) === "Aprobado");
        grupos.get(clave).push({ c, estado: estado.get(c.id), bloqueado: !!req && !aprobado,
            req: req ? req.map(r => `${r.codigo} ${r.nombre}`).join(" o ") : null });
    }

    const fila = f => {
        const clase = f.estado ? "fila-matriculada" : f.bloqueado ? "fila-bloqueada" : "fila-disponible";
        const chip = f.estado ? chipMatricula(f.estado)
            : f.bloqueado ? html`<span class="estado-chip estado-lock">Bloqueado</span>` : html`<span class="estado-chip estado-open">Disponible</span>`;
        const accion = f.estado ? html`<a class="accion-icon accion-check" href="#/curso/${f.c.id}" title="Entrar al curso">→</a>`
            : f.bloqueado ? html`<span class="accion-icon accion-lock" title="Requiere aprobar ${f.req}">🔒</span>`
            : html`<button type="button" class="accion-btn" title="Matricularme" data-accion="matricular" data-id="${f.c.id}"
                     data-confirm="¿Matricularte en ${f.c.nombre}?" data-boton="Matricularme">+</button>`;
        return html`<tr class="${clase}"><td>${f.c.codigo}</td><td>${f.c.nombre}</td><td>${f.c.nivel}</td>
            <td>${f.c.profesor?.nombre ?? "Por asignar"}</td><td>${f.req ?? "--"}</td><td>${chip}</td><td>${accion}</td></tr>`;
    };

    return {
        titulo: "Matrícula",
        html: html`
<section class="student-panel">
    <div class="panel-title">Matrícula de cursos</div>
    <p class="muted panel-help">El primer nivel de cada lenguaje está abierto. Para el siguiente nivel tu profesor debe marcarte como <strong>Aprobado</strong> en el anterior.</p>
    <div class="matricula-wrapper">
        <table class="matricula-table">
            <thead><tr><th>Código</th><th>Nombre</th><th>Nivel</th><th>Profesor</th><th>Requisito</th><th>Estado</th><th>✔</th></tr></thead>
            <tbody>
                ${[...grupos].map(([leng, filas]) => html`<tr class="grupo-lenguaje"><td colspan="7">${leng}</td></tr>${filas.map(fila)}`)}
                ${visibles.length ? "" : html`<tr><td colspan="7">Todavía no hay cursos abiertos. Tu profesor los habilita cuando empieza a darlos.</td></tr>`}
            </tbody>
        </table>
    </div>
</section>`,
        acciones: {
            async matricular(d) { exito(await rpc("matricular", { p_curso: Number(d.id) })); },
        },
    };
}

// ---------------------------------------------------------------- progreso ---

async function notasDe(uid, cursoIds) {
    if (!cursoIds.length) return { actividades: [], ultimas: new Map() };
    const [actividades, entregas] = await Promise.all([
        q(sb.from("actividades").select("id, curso_id, clase_id, tipo, titulo, fecha_limite, valor, clase:clases(orden, titulo)")
            .in("curso_id", cursoIds).order("fecha_limite", { nullsFirst: false }).order("id")),
        q(sb.from("entregas").select("id, actividad_id, estado, nota, fecha_entrega").eq("user_id", uid)),
    ]);
    return { actividades, ultimas: ultimaPorActividad(entregas) };
}

export async function progreso({ perfil }) {
    const matriculas = await misMatriculas(perfil.id);
    const { actividades, ultimas } = await notasDe(perfil.id, matriculas.map(m => m.curso_id));
    return {
        titulo: "Progreso",
        html: html`
<section class="course-panel">
    <div class="panel-title">Avance por curso</div>
    <div class="course-list">
        ${matriculas.map(m => {
            const r = resumen(actividades.filter(a => a.curso_id === m.curso_id), ultimas);
            return html`
            <a class="course-link-card" href="#/curso/${m.curso_id}">
                <div class="course-item">
                    <div class="progress-head">
                        <div>
                            <h3>${m.curso.codigo} · ${m.curso.nombre}</h3>
                            <p>${m.curso.lenguaje} · Nivel ${m.curso.nivel} · ${chipMatricula(m.estado)}</p>
                        </div>
                        <div class="nota-box"><strong>${num(r.nota)}</strong><small>nota acumulada / 100</small></div>
                    </div>
                    <div class="progress-bar"><span style="width: ${r.porcentaje}%"></span></div>
                    <p>${r.entregadas} de ${r.cantidad} actividades realizadas (${r.porcentaje}%) · evaluado ${pct(r.evaluado)} de ${pct(r.total)}</p>
                </div>
            </a>`;
        })}
        ${matriculas.length ? "" : html`<div class="course-item"><h3>Sin progreso todavía</h3>
            <p>Matriculate en un curso para empezar a ver tu avance.</p></div>`}
    </div>
</section>`,
    };
}

// ------------------------------------------------------------------- curso ---

export async function curso({ perfil, params, query }) {
    const id = Number(params.id);
    const [mat] = await q(sb.from("matriculas").select(`estado, curso:cursos(${CURSO_COLS})`).eq("user_id", perfil.id).eq("curso_id", id));
    if (!mat) throw new ErrorFen("No estás matriculado en este curso.");
    const [clases, recursos, { actividades, ultimas }] = await Promise.all([
        q(sb.from("clases").select("*").eq("curso_id", id).order("orden").order("id")),
        q(sb.from("recursos").select("*, autor:perfiles(nombre)").eq("curso_id", id).order("fecha_subida", { ascending: false })),
        notasDe(perfil.id, [id]),
    ]);
    const c = mat.curso;
    const r = resumen(actividades, ultimas);
    const tab = query.get("tab") || "clases";

    return {
        titulo: c.nombre,
        html: html`
<section class="course-banner ${claseLenguaje(c.lenguaje)}"><div class="course-banner-overlay">
    <h1>${c.nombre}</h1>
    <p>${c.codigo} · ${c.lenguaje} · Nivel ${c.nivel} · Profesor: ${c.profesor?.nombre ?? "por asignar"} · ${chipMatricula(mat.estado)}</p>
</div></section>
${tabs([{ id: "clases", texto: "Clases", icono: "class" }, { id: "evaluacion", texto: "Evaluación", icono: "eval" },
        { id: "recursos", texto: "Recursos", icono: "folder" }], tab)}

<div ${raw(panelTab("clases", tab))}>
    <div class="course-panel">
        <div class="panel-title">Clases</div>
        <div class="course-list">
            ${clases.map(cl => html`
            <div class="course-item">
                <h3>Clase ${cl.orden}: ${cl.titulo}</h3>
                <p>${cl.descripcion}</p>
                ${actividades.filter(a => a.clase_id === cl.id).map(a => html`
                <a class="clase-tarea" href="#/actividad/${a.id}">${a.tipo === "examen" ? "🧪" : "📝"} ${a.titulo} · ${pct(a.valor)} ${chipEntrega(ultimas.get(a.id)?.estado)}</a>`)}
            </div>`)}
            ${clases.length ? "" : html`<div class="course-item"><h3>Sin clases</h3><p>Tu profesor todavía no publicó clases.</p></div>`}
        </div>
    </div>
</div>

<div ${raw(panelTab("evaluacion", tab))}>
    <div class="course-panel">
        <div class="panel-title">Evaluación</div>
        <div class="evaluation-wrapper compact-evaluation-wrapper">
            <table class="evaluation-table compact-evaluation-table">
                <thead><tr><th>Actividad</th><th>Tipo</th><th>Fecha límite</th><th>Estado</th><th>Valor</th><th>Nota</th><th>Aporte</th></tr></thead>
                <tbody>
                    ${actividades.map(a => {
                        const en = ultimas.get(a.id);
                        return html`<tr class="click-row" data-href="#/actividad/${a.id}">
                            <td><strong>${a.titulo}</strong><p>${a.clase ? `Clase ${a.clase.orden}: ${a.clase.titulo}` : "Actividad general"}</p></td>
                            <td>${chipTipo(a.tipo)}</td><td>${fecha(a.fecha_limite)}</td><td>${chipEntrega(en?.estado)}</td>
                            <td>${pct(a.valor)}</td>
                            <td><span class="grade-chip">${en?.nota == null ? "—" : num(en.nota) + "/100"}</span></td>
                            <td>${num(aporte(a, en))}</td></tr>`;
                    })}
                    ${actividades.length ? "" : html`<tr><td colspan="7">No hay actividades registradas.</td></tr>`}
                    <tr class="evaluation-total-row">
                        <td colspan="4">Nota acumulada (evaluado ${pct(r.evaluado)} de ${pct(r.total)})</td>
                        <td>${pct(r.total)}</td><td colspan="2"><strong>${num(r.nota)}/100</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<div ${raw(panelTab("recursos", tab))}>
    <section class="resource-hero"><div class="resource-hero-icon">↓</div>
        <div><h1>Recursos</h1><p>Material de apoyo compartido por tu profesor.</p></div></section>
    <div class="resource-list resource-list-full">${listaRecursos(recursos, false)}</div>
</div>`,
        acciones: { descargar: d => descargar(d.ruta, d.nombre).then(() => false) },
    };
}

/** Lista de recursos (la usa también el profesor, con botón Eliminar). */
export function listaRecursos(recursos, docente) {
    if (!recursos.length) return html`<div class="course-item"><h3>${docente ? "Sin recursos" : "Sin recursos aún"}</h3>
        <p>${docente ? "Publicá material de apoyo para esta materia." : "Aquí aparecerá el material que comparta tu profesor."}</p></div>`;
    return html`${recursos.map(r => html`
    <div class="resource-card">
        <div>
            <h3>${r.titulo}</h3>
            <p>Subido por ${r.autor?.nombre ?? "—"} · ${fechaHora(r.fecha_subida)}</p>
            ${r.nombre_original ? html`<span>${r.nombre_original}</span>` : ""}
            ${r.enlace ? html`<p>${enlaceExterno(r.enlace)}</p>` : ""}
        </div>
        <div class="resource-card-actions">
            ${r.archivo_path ? html`<button type="button" class="admin-btn" data-accion="descargar" data-ruta="${r.archivo_path}" data-nombre="${r.nombre_original}">Descargar</button>` : ""}
            ${docente ? html`<button type="button" class="admin-btn danger" data-accion="eliminarRecurso" data-id="${r.id}" data-ruta="${r.archivo_path ?? ""}"
                data-confirm="¿Eliminar el recurso «${r.titulo}»?">Eliminar</button>` : ""}
        </div>
    </div>`)}`;
}

// --------------------------------------------------------------- actividad ---

export async function actividad({ perfil, params }) {
    const id = Number(params.id);
    const [a] = await q(sb.from("actividades").select("*, curso:cursos(id, codigo, nombre), clase:clases(titulo)").eq("id", id));
    if (!a) throw new ErrorFen("La actividad no existe o todavía no está publicada.");
    const [mat] = await q(sb.from("matriculas").select("estado").eq("user_id", perfil.id).eq("curso_id", a.curso_id));
    const entregas = await q(sb.from("entregas").select("*").eq("actividad_id", id).eq("user_id", perfil.id)
        .order("fecha_entrega", { ascending: false }).order("id", { ascending: false }));
    const esExamen = a.tipo === "examen";
    const vence = vencida(a.fecha_limite);

    let estadoEx = null, solucion = null, respuestas = [];
    if (esExamen) {
        estadoEx = await rpc("estado_examen", { p_actividad: id });
        if (estadoEx.entrega_id) {
            // El examen pudo cerrarse recién por tiempo agotado: volvemos a leer la entrega.
            if (!entregas.length) entregas.push(...await q(sb.from("entregas").select("*").eq("id", estadoEx.entrega_id)));
            [solucion, respuestas] = await Promise.all([
                rpc("solucion_examen", { p_actividad: id }),
                q(sb.from("respuestas").select("*").eq("entrega_id", estadoEx.entrega_id)),
            ]);
        }
    }

    const info = html`
    <section class="activity-info">
        <h1>Datos generales</h1>
        <label>${esExamen ? "Examen" : "Actividad"}</label><input value="${a.titulo}" readonly>
        <label>Curso</label><input value="${a.curso.codigo} · ${a.curso.nombre}" readonly>
        <label>Clase</label><input value="${a.clase?.titulo ?? "Actividad general"}" readonly>
        <label>Fecha límite</label><input value="${fecha(a.fecha_limite)}${vence ? " (vencida)" : ""}" readonly>
        <label>Valor en la nota final</label><input value="${pct(a.valor)}" readonly>
        ${esExamen ? html`
        <label>Preguntas</label><input value="${estadoEx.preguntas} preguntas · ${num(estadoEx.puntos)} puntos" readonly>
        <label>Duración</label><input value="${a.duracion_minutos ? a.duracion_minutos + " minutos" : "Sin límite de tiempo"}" readonly>` : ""}
        <label>Consigna</label><textarea readonly>${a.descripcion}</textarea>
    </section>`;

    return {
        titulo: a.titulo, seccion: esExamen ? "Examen" : "Actividad",
        volver: [`curso/${a.curso_id}?tab=evaluacion`, "Volver al curso"],
        html: html`<div class="activity-layout">${info}
            <section class="activity-submit">${esExamen ? panelExamen(a, estadoEx, entregas[0], solucion, respuestas)
                : panelEntrega(a, mat, entregas, vence)}</section></div>`,
        acciones: {
            async comenzar() {
                await rpc("comenzar_examen", { p_actividad: id });
                location.hash = `#/examen/${id}`;
                return false;
            },
            async entregar(d) {
                const enlace = (d.enlace || "").trim();
                if (!d.archivo && !enlace) throw new ErrorFen("Subí un archivo o pegá el enlace de tu repositorio.");
                let ruta = null;
                if (d.archivo) ruta = await subirArchivo(`entregas/${id}/${perfil.id}`, d.archivo, EXT_ENTREGAS);
                await rpc("entregar_trabajo", { p_actividad: id, p_archivo_path: ruta, p_nombre_original: d.archivo?.name ?? null,
                    p_enlace: enlace || null, p_comentario: d.comentario || null });
                exito("¡Entrega enviada! Tu profesor la va a revisar.");
            },
            descargar: d => descargar(d.ruta, d.nombre).then(() => false),
        },
    };
}

function panelExamen(a, est, resultado, solucion, respuestas) {
    if (resultado) {
        const porPregunta = new Map(respuestas.map(r => [r.pregunta_id, r]));
        return html`
        <h1>Tu examen</h1>
        <div class="review-box">
            <h3>Resultado</h3>
            <p class="nota-grande">${num(resultado.nota)}/100</p>
            <p>Enviado: ${fechaHora(resultado.fecha_entrega)} ${resultado.fuera_de_tiempo ? "(fuera de tiempo)" : ""}</p>
            ${resultado.comentario ? html`<p>${resultado.comentario}</p>` : ""}
            ${resultado.retroalimentacion ? html`<div class="feedback-box"><strong>Comentario del profesor:</strong> ${resultado.retroalimentacion}</div>` : ""}
        </div>
        ${solucion?.length ? html`<h2>Corrección</h2>${solucion.map(p => preguntaCorregida(p, porPregunta.get(p.id)))}`
            : a.mostrar_solucion ? "" : html`<p class="muted">Tu profesor no habilitó la vista de la corrección para este examen.</p>`}`;
    }
    if (est.puede_rendir) {
        return html`
        <h1>Tu examen</h1>
        <div class="review-box">
            <h3>${est.iniciado ? "Examen en curso" : "Listo para empezar"}</h3>
            <p>Tenés <strong>un solo intento</strong>.
               ${a.duracion_minutos ? html`Al comenzar corre un reloj de <strong>${a.duracion_minutos} minutos</strong>; si se acaba, el examen se envía solo.` : ""}</p>
        </div>
        ${est.iniciado
            ? html`<div class="upload-box"><a class="admin-btn" href="#/examen/${a.id}">Continuar examen</a></div>`
            : html`<div class="upload-box"><button type="button" data-accion="comenzar" data-confirm="¿Comenzar el examen ahora? Solo tenés un intento." data-boton="Comenzar">Comenzar examen</button></div>`}`;
    }
    return html`<h1>Tu examen</h1><div class="review-box"><h3>Examen no disponible</h3><p>${est.motivo}</p></div>`;
}

/** Pregunta con la corrección (la usa también el profesor). */
export function preguntaCorregida(p, r, extra = "") {
    const ok = r?.correcta;
    const opciones = p.tipo === "opcion_unica"
        ? p.opciones.map(o => {
            const clase = o.id === p.opcion_correcta_id ? "correcta" : r?.opcion_id === o.id ? "elegida-mal" : "";
            return html`<div class="opcion ${clase}">${r?.opcion_id === o.id ? "● " : "○ "}${o.texto}</div>`;
        })
        : html`<p>Respuesta: <strong>${r?.texto ? r.texto : "(vacía)"}</strong></p>
               <p class="muted">Respuesta esperada: ${(p.respuestas_aceptadas || "").split("|").filter(Boolean).join(" / ")}</p>`;
    return html`<div class="pregunta" style="margin:0 0 12px">
        <h3>${p.orden}. ${p.enunciado} <span class="puntos">(${num(p.puntos)} pts)</span>
            ${ok ? html`<span class="marca-ok">✓</span>` : html`<span class="marca-mal">✗</span>`}
            ${r?.corregida_manual ? html`<span class="estado-chip estado-wait">corregida a mano</span>` : ""}</h3>
        ${opciones}${extra}</div>`;
}

function panelEntrega(a, mat, entregas, vence) {
    const ultima = entregas[0];
    const puede = mat?.estado === "Cursando" && ultima?.estado !== "Aprobado";
    return html`
    <h1>Tu entrega</h1>
    ${puede ? html`
    <div class="review-box">
        <h3>${entregas.length ? "Volver a entregar" : "Entregar"}</h3>
        <p>Subí un archivo (${EXT_ENTREGAS.join(", ")} · máx. 16 MB) y/o pegá el enlace a tu repositorio de GitHub.
           ${vence ? html`<br><strong class="texto-alerta">La fecha límite ya pasó: tu entrega quedará marcada como tardía.</strong>` : ""}
           ${entregas.length ? html`<br>Tu profesor calificará la última entrega.` : ""}</p>
    </div>
    <form data-accion="entregar" class="upload-box">
        <label>Archivo</label>
        <input type="file" name="archivo" accept="${EXT_ENTREGAS.map(x => "." + x).join(",")}">
        <label>Enlace al repositorio (opcional)</label>
        <input type="url" name="enlace" placeholder="https://github.com/tu-usuario/tu-proyecto">
        <label>Comentario para el profesor</label>
        <textarea name="comentario" placeholder="Opcional"></textarea>
        <button type="submit">Entregar actividad</button>
    </form>` : html`
    <div class="review-box"><h3>Entrega cerrada</h3>
        <p>${ultima?.estado === "Aprobado" ? "Tu entrega fue aprobada." : "El curso ya fue cerrado por tu profesor."}</p></div>`}

    <h2>Entregas realizadas</h2>
    ${entregas.map(en => html`
    <div class="delivery-card">
        <div>
            ${en.nombre_original ? html`<strong>${en.nombre_original}</strong>` : ""}
            ${en.enlace ? html`<p>${enlaceExterno(en.enlace)}</p>` : ""}
            <p>Entregado: ${fechaHora(en.fecha_entrega)} ${en.fuera_de_tiempo ? html`<span class="texto-alerta">(tardía)</span>` : ""}</p>
            ${en.comentario ? html`<p>Tu comentario: ${en.comentario}</p>` : ""}
            <p>${chipEntrega(en.estado)} ${en.nota != null ? html`<span class="grade-chip">Nota: ${num(en.nota)}/100</span>` : ""}</p>
            ${en.retroalimentacion ? html`<div class="feedback-box"><strong>Retroalimentación:</strong> ${en.retroalimentacion}</div>` : ""}
        </div>
        ${en.archivo_path ? html`<button type="button" class="activity-link" data-accion="descargar" data-ruta="${en.archivo_path}" data-nombre="${en.nombre_original}">Descargar</button>` : ""}
    </div>`)}
    ${entregas.length ? "" : html`<div class="empty-delivery">Todavía no entregaste esta actividad.</div>`}`;
}

// ----------------------------------------------------------- rendir examen ---

export async function rendir({ perfil, params, alSalir }) {
    const id = Number(params.id);
    const [a] = await q(sb.from("actividades").select("id, titulo, curso_id").eq("id", id));
    if (!a) throw new ErrorFen("El examen no existe.");
    const est = await rpc("estado_examen", { p_actividad: id });
    if (!est.iniciado || est.entrega_id) { location.hash = `#/actividad/${id}`; return { titulo: a.titulo, html: html`` }; }
    const preguntas = await rpc("preguntas_examen", { p_actividad: id });
    // Segundos restantes según el reloj del servidor (no el de la PC del estudiante).
    const restante = est.vence ? Math.max(0, Math.floor((new Date(est.vence) - new Date(est.ahora)) / 1000)) : null;
    const clave = `fen-examen-${id}-${perfil.id}`;
    let guardado = {};
    try { guardado = JSON.parse(localStorage.getItem(clave) || "{}"); } catch { /* sin borrador */ }

    const enviar = async datos => {
        const respuestas = {};
        for (const p of preguntas) respuestas[p.id] = datos[`p${p.id}`] ?? "";
        const nota = await rpc("enviar_examen", { p_actividad: id, p_respuestas: respuestas });
        try { localStorage.removeItem(clave); } catch { /* nada */ }
        exito(`Examen enviado. Tu nota: ${num(nota)}/100.`);
        location.hash = `#/actividad/${id}`;
        return false;
    };

    return {
        titulo: a.titulo, seccion: "Examen en curso",
        html: html`
<section class="course-panel">
    <div class="panel-title">${a.titulo}</div>
    <p class="muted panel-help">Respondé todas las preguntas y presioná <strong>Enviar examen</strong>. Solo tenés un intento.
        Las respuestas cortas no distinguen mayúsculas ni tildes.</p>
    ${restante !== null ? html`<div class="exam-timer" id="reloj">⏱ --:--</div>` : ""}
    <form data-accion="enviar" id="form-examen" data-confirm="¿Enviar el examen? No vas a poder cambiar tus respuestas." data-boton="Enviar examen">
        ${mezclar(preguntas, perfil.id + ":" + id).map((p, i) => html`
        <div class="pregunta">
            <h3>${i + 1}. ${p.enunciado} <span class="puntos">(${num(p.puntos)} ${Number(p.puntos) === 1 ? "punto" : "puntos"})</span></h3>
            ${p.tipo === "opcion_unica"
                ? mezclar(p.opciones, perfil.id + ":" + p.id).map(o => html`
                    <label class="opcion"><input type="radio" name="p${p.id}" value="${o.id}" ${raw(guardado[`p${p.id}`] === String(o.id) ? "checked" : "")}>
                    <span>${o.texto}</span></label>`)
                : html`<input type="text" name="p${p.id}" maxlength="500" autocomplete="off" placeholder="Tu respuesta" value="${guardado[`p${p.id}`] ?? ""}">`}
        </div>`)}
        <div class="exam-toolbar"><button type="submit" class="admin-btn">Enviar examen</button></div>
    </form>
</section>`,
        acciones: { enviar },
        alMontar(raiz) {
            const form = raiz.querySelector("#form-examen");
            // Borrador local: si se corta internet o se recarga la página, las respuestas no se pierden.
            form.addEventListener("input", () => {
                try { localStorage.setItem(clave, JSON.stringify(Object.fromEntries(new FormData(form)))); } catch { /* sin espacio */ }
            });
            const reloj = raiz.querySelector("#reloj");
            if (!reloj) return;
            let quedan = restante;
            const fin = Date.now() + quedan * 1000;
            const pintar = () => {
                const m = Math.floor(quedan / 60), s = quedan % 60;
                reloj.textContent = `⏱ Tiempo restante: ${m}:${String(s).padStart(2, "0")}`;
                reloj.classList.toggle("urgente", quedan <= 60);
            };
            pintar();
            const timer = setInterval(async () => {
                quedan = Math.max(0, Math.round((fin - Date.now()) / 1000));
                if (quedan > 0) return pintar();
                clearInterval(timer);
                reloj.textContent = "⏱ Tiempo agotado: enviando…";
                form.querySelectorAll("button").forEach(b => (b.disabled = true));
                try { await enviar(Object.fromEntries(new FormData(form))); }
                catch (err) { reloj.textContent = "⏱ " + (err.message || "No se pudo enviar"); }
            }, 1000);
            alSalir(() => clearInterval(timer));
        },
    };
}
