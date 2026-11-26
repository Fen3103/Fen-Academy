// Calendario de fechas de entrega (estudiante: sus cursos; profesor: los que da).
import { sb, q } from "../api.js";
import { html, hoy, icono, iconoTipo, fechaDMA } from "../ui.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const dos = n => String(n).padStart(2, "0");

export async function calendario({ perfil, query }) {
    const esEstudiante = perfil.rol === "estudiante";
    const mes = /^\d{4}-\d{2}$/.test(query.get("mes") || "") ? query.get("mes") : hoy().slice(0, 7);
    const [anio, m] = mes.split("-").map(Number);

    // Cursos que importan según el rol.
    let cursoIds;
    if (esEstudiante) {
        const mats = await q(sb.from("matriculas").select("curso_id, estado").eq("user_id", perfil.id));
        cursoIds = mats.filter(x => x.estado === "Cursando").map(x => x.curso_id);
    } else {
        const cursos = await q(sb.from("cursos").select("id, profesor_id"));
        cursoIds = cursos.filter(c => perfil.rol === "admin" || c.profesor_id === perfil.id).map(c => c.id);
    }
    const actividades = cursoIds.length
        ? await q(sb.from("actividades").select("id, titulo, tipo, fecha_limite, publicada, curso:cursos(codigo, nombre)").in("curso_id", cursoIds))
        : [];
    const hechas = esEstudiante
        ? new Set((await q(sb.from("entregas").select("actividad_id").eq("user_id", perfil.id))).map(e => e.actividad_id))
        : new Set();
    const conFecha = actividades.filter(a => a.fecha_limite);
    const porDia = new Map();
    for (const a of conFecha) {
        const d = String(a.fecha_limite).slice(0, 10);
        if (!porDia.has(d)) porDia.set(d, []);
        porDia.get(d).push(a);
    }

    const hoyStr = hoy();
    const estado = a => esEstudiante
        ? (hechas.has(a.id) ? "hecha" : a.fecha_limite < hoyStr ? "vencida" : "pendiente")
        : (a.publicada ? "pendiente" : "borrador");
    const enlace = a => esEstudiante ? `#/actividad/${a.id}` : `#/docente/actividad/${a.id}`;

    // Cuadrícula: semanas de lunes a domingo.
    const primero = new Date(anio, m - 1, 1);
    const inicio = new Date(primero);
    inicio.setDate(1 - ((primero.getDay() + 6) % 7));
    const celdas = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(inicio); d.setDate(inicio.getDate() + i);
        const clave = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
        celdas.push({ clave, dia: d.getDate(), fuera: d.getMonth() !== m - 1, eventos: porDia.get(clave) || [] });
        if (i >= 34 && d.getMonth() !== m - 1 && i % 7 === 6) break;
    }
    const antes = m === 1 ? `${anio - 1}-12` : `${anio}-${dos(m - 1)}`;
    const despues = m === 12 ? `${anio + 1}-01` : `${anio}-${dos(m + 1)}`;
    const proximas = conFecha.filter(a => a.fecha_limite >= hoyStr && estado(a) !== "hecha")
        .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite)).slice(0, 8);

    return {
        titulo: "Calendario",
        html: html`
<section class="main-panels calendario-layout">
    <div class="tarjeta">
        <div class="tarjeta-cabecera">
            <span class="tarjeta-icono">${icono("calendar")}</span>
            <div><h2>${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} ${anio}</h2><p>Fechas límite de ${esEstudiante ? "tus cursos" : "los cursos que das"}</p></div>
            <div class="cal-nav">
                <a class="admin-btn secundario icono-solo" href="#/calendario?mes=${antes}" aria-label="Mes anterior">‹</a>
                <a class="admin-btn secundario" href="#/calendario">Hoy</a>
                <a class="admin-btn secundario icono-solo" href="#/calendario?mes=${despues}" aria-label="Mes siguiente">›</a>
            </div>
        </div>
        <div class="cal-grid">
            ${DIAS.map(d => html`<div class="cal-dia-nombre">${d}</div>`)}
            ${celdas.map(c => html`
            <div class="cal-celda ${c.fuera ? "fuera" : ""} ${c.clave === hoyStr ? "hoy" : ""}">
                <span class="cal-num">${c.dia}</span>
                ${c.eventos.map(a => html`<a class="cal-evento ${estado(a)}" href="${enlace(a)}" title="${a.curso.codigo} · ${a.titulo}">${a.curso.codigo} · ${a.titulo}</a>`)}
            </div>`)}
        </div>
        <div class="cal-leyenda">
            ${esEstudiante ? html`<span><i class="pendiente"></i>Por entregar</span><span><i class="hecha"></i>Entregada</span><span><i class="vencida"></i>Vencida</span>`
                : html`<span><i class="pendiente"></i>Publicada</span><span><i class="borrador"></i>Borrador</span>`}
        </div>
    </div>
    <aside class="columna-lateral">
        <div class="tarjeta">
            <div class="tarjeta-cabecera"><span class="tarjeta-icono naranja">${icono("clock")}</span><div><h2>Próximas fechas</h2><p>${esEstudiante ? "Lo que todavía no entregaste" : "Próximos cierres"}</p></div></div>
            <div class="pendientes-lista">
                ${proximas.map(a => html`
                <a class="pendiente-fila" href="${enlace(a)}">${iconoTipo(a.tipo)}
                    <div><strong>${a.titulo}</strong><small>${a.curso.codigo} · ${a.curso.nombre}</small></div>
                    <span class="pendiente-fecha">${fechaDMA(a.fecha_limite)}</span></a>`)}
                ${proximas.length ? "" : html`<div class="vacio chico">${icono("ok")}<p>No hay fechas próximas.</p></div>`}
            </div>
        </div>
    </aside>
</section>`,
    };
}

