// Título simbólico (sin validez oficial) por terminar el plan de estudio completo.
// Se imprime o guarda como PDF.
import { sb, q } from "../api.js";
import { html, raw, icono, ISOTIPO, compararLenguajes } from "../ui.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** El título del plan completo con su avance. */
export function tituloDe(cursos, estadoDe) {
    const todos = [...cursos].sort((a, b) => compararLenguajes(a.lenguaje.toLowerCase(), b.lenguaje.toLowerCase()) || a.nivel - b.nivel);
    const aprobados = todos.filter(c => estadoDe.get(c.id) === "Aprobado").length;
    return { clave: "plan", area: "Plan de estudio completo", nombre: "Desarrollador de Software", cursos: todos,
        aprobados, completo: todos.length > 0 && aprobados === todos.length };
}

/** Tarjeta para Progreso: el título y cuánto falta. */
export function tarjetaTitulos(cursos, estadoDe) {
    const t = tituloDe(cursos, estadoDe);
    const pct = t.cursos.length ? Math.round(t.aprobados / t.cursos.length * 100) : 0;
    return html`
<section class="tarjeta camino-tarjeta">
    <div class="tarjeta-cabecera">
        <span class="tarjeta-icono amarillo">${icono("star")}</span>
        <div><h2>Título</h2><p>Se otorga al terminar todo el plan de estudio</p></div>
    </div>
    <div class="titulos-grid">
        <a class="titulo-card mayor ${t.completo ? "ganado" : ""}" href="#/titulo">
            <span class="titulo-medalla">${icono(t.completo ? "award" : "star")}</span>
            <div><strong>${t.nombre}</strong>
                <small>${t.completo ? "¡Título obtenido! Ver e imprimir" : `${t.aprobados} de ${t.cursos.length} cursos aprobados · te faltan ${t.cursos.length - t.aprobados}`}</small>
                ${t.completo ? "" : html`<span class="titulo-barra"><span style="width:${pct}%"></span></span>`}</div>
            ${icono("flecha")}
        </a>
    </div>
</section>`;
}

// Código corto y estable para "verificar" el título (decorativo).
function codigo(uid, clave) {
    let h = 2166136261;
    for (const ch of `${uid}|${clave}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const s = (h >>> 0).toString(36).toUpperCase().padStart(7, "0");
    return `FEN-${clave.slice(0, 4).toUpperCase().replace(/-/g, "")}-${s.slice(0, 4)}-${s.slice(4)}`;
}

// Sello dorado con texto en círculo.
function sello(texto) {
    const puntas = 36, rExt = 58, rInt = 52;
    const pts = [];
    for (let i = 0; i < puntas * 2; i++) {
        const r = i % 2 ? rInt : rExt, a = Math.PI * i / puntas;
        pts.push(`${(60 + r * Math.sin(a)).toFixed(2)},${(60 - r * Math.cos(a)).toFixed(2)}`);
    }
    return raw(`<svg class="dip-sello" viewBox="0 0 120 150" aria-hidden="true">
        <defs>
            <radialGradient id="oro" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#e2b13c"/><stop offset="1" stop-color="#9a6b12"/></radialGradient>
            <linearGradient id="cinta" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--acento-osc)"/><stop offset="1" stop-color="var(--acento-2)"/></linearGradient>
            <path id="circulo-texto" d="M60,60 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"/>
        </defs>
        <path d="M38 95 L28 146 L42 136 L50 148 L58 100 Z" fill="url(#cinta)"/>
        <path d="M82 95 L92 146 L78 136 L70 148 L62 100 Z" fill="url(#cinta)"/>
        <polygon points="${pts.join(" ")}" fill="url(#oro)" stroke="#8a5d0c" stroke-width=".6"/>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#8a5d0c" stroke-width="1"/>
        <circle cx="60" cy="60" r="29" fill="none" stroke="#8a5d0c" stroke-width=".8"/>
        <text font-size="7.4" font-weight="700" letter-spacing="1.6" fill="#5c3d06" font-family="Cormorant Garamond, Georgia, serif">
            <textPath href="#circulo-texto" startOffset="0">${texto}</textPath></text>
        <text x="60" y="70" text-anchor="middle" font-size="30" font-weight="700" fill="#5c3d06" font-family="Cormorant Garamond, Georgia, serif">F</text>
    </svg>`);
}

// Adorno de esquina (se rota con CSS).
const ESQUINA = raw(`<svg class="dip-esquina" viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4">
    <path d="M4 76 V20 Q4 4 20 4 H76"/><path d="M12 76 V26 Q12 12 26 12 H76" opacity=".6"/>
    <path d="M20 20 q10 2 14 12 q-10 -2 -14 -12z" fill="currentColor" opacity=".55"/>
    <circle cx="20" cy="20" r="3.2" fill="currentColor"/>
    <path d="M30 4 q4 8 0 16 M4 30 q8 4 16 0" opacity=".7"/></g></svg>`);

export async function titulo({ perfil }) {
    const demo = perfil.rol !== "estudiante";
    const cursos = await q(sb.from("cursos").select("id, codigo, nombre, lenguaje, nivel, profesor:perfiles!cursos_profesor_id_fkey(nombre)"));
    const estadoDe = new Map();
    if (!demo) {
        const mats = await q(sb.from("matriculas").select("curso_id, estado").eq("user_id", perfil.id));
        for (const m of mats) estadoDe.set(m.curso_id, m.estado);
    }
    const t = { ...tituloDe(cursos, estadoDe), mayor: true };
    const d = new Date();
    // Profesor/admin: el título lo firma quien lo emite.
    const profesores = demo ? [perfil.nombre] : [...new Set(t.cursos.map(c => c.profesor?.nombre).filter(Boolean))];
    const volver = demo ? null : ["progreso", "Volver a Progreso"];

    // Profesor/admin: lista de sus estudiantes con cuántos cursos aprobaron, para emitir el título a mano.
    let alumnos = [];
    if (demo) {
        const mats = await q(sb.from("matriculas").select("user_id, estado, curso:cursos(profesor_id), alumno:perfiles(id, nombre)")).catch(() => []);
        const porId = new Map();
        for (const m of mats) {
            if (!m.alumno || (perfil.rol !== "admin" && m.curso?.profesor_id !== perfil.id)) continue;
            const a = porId.get(m.user_id) ?? { id: m.user_id, nombre: m.alumno.nombre, aprobados: 0, cursos: 0 };
            a.cursos++; if (m.estado === "Aprobado") a.aprobados++;
            porId.set(m.user_id, a);
        }
        alumnos = [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }

    if (!demo && !t.completo) {
        const faltan = t.cursos.filter(c => estadoDe.get(c.id) !== "Aprobado");
        return {
            titulo: t.nombre, seccion: "Títulos", volver,
            html: html`
<section class="tarjeta titulo-bloqueado">
    <div class="vacio">
        <span class="titulo-medalla grande">${icono("star")}</span>
        <h3>${t.nombre}</h3>
        <p>Te faltan ${faltan.length} ${faltan.length === 1 ? "curso" : "cursos"} para recibir este título:</p>
        <div class="titulo-faltan">${faltan.map(c => html`<span class="etq">${c.codigo} · ${c.nombre}</span>`)}</div>
        <a class="admin-btn" href="#/plan">Ver mi plan de estudio</a>
    </div>
</section>`,
        };
    }

    const nombre = demo ? "Nombre del Estudiante" : perfil.nombre;
    const hoyISO = d.toISOString().slice(0, 10);
    return {
        titulo: t.nombre, seccion: "Título", volver,
        html: html`
${demo ? html`
<section class="course-panel titulo-generador no-imprimir">
    <div class="panel-title">${icono("award")} Crear título</div>
    <div class="titulo-generador-campos">
        <div class="form-grupo"><label for="tg-alumno">Estudiante</label>
            <select id="tg-alumno">
                <option value="">— Escribir un nombre a mano —</option>
                ${alumnos.map(a => html`<option value="${a.id}" data-nombre="${a.nombre}">${a.nombre} · aprobó ${a.aprobados} de ${t.cursos.length}</option>`)}
            </select></div>
        <div class="form-grupo"><label for="tg-nombre">Nombre en el título</label>
            <input id="tg-nombre" type="text" placeholder="Nombre completo del estudiante" maxlength="60"></div>
        <div class="form-grupo"><label for="tg-fecha">Fecha</label>
            <input id="tg-fecha" type="date" value="${hoyISO}"></div>
    </div>
    <p class="muted panel-help">Elegí un estudiante o escribí el nombre, revisá la vista previa y tocá <strong>Imprimir o guardar como PDF</strong>.
        Es un título simbólico: no queda guardado en el sistema.</p>
</section>` : ""}
<div class="cert-acciones">
    <button type="button" class="admin-btn" data-imprimir>${icono("download")} Imprimir o guardar como PDF</button>
</div>
<div class="diploma-escena">
<article class="diploma ${t.mayor ? "diploma-mayor" : ""}">
    <div class="dip-marco">
        <span class="dip-esq e1">${ESQUINA}</span><span class="dip-esq e2">${ESQUINA}</span>
        <span class="dip-esq e3">${ESQUINA}</span><span class="dip-esq e4">${ESQUINA}</span>
        <div class="dip-marca-agua">${ISOTIPO}</div>

        <header class="dip-cabecera">
            <div class="dip-logo">${ISOTIPO}</div>
            <div><p class="dip-academia">Fen Academy</p><p class="dip-escuela">Escuela de Programación</p></div>
        </header>

        <p class="dip-por">Por cuanto</p>
        <h2 class="dip-nombre" id="dip-nombre">${nombre}</h2>
        <p class="dip-texto">ha cumplido con todos los requisitos del programa de <strong>${t.area}</strong>,
            aprobando ${t.cursos.length === 1 ? "el curso" : `los ${t.cursos.length} cursos`} que lo componen, por lo que se le otorga el título de</p>
        <h1 class="dip-titulo">${t.nombre}</h1>
        <div class="dip-cursos">${t.cursos.slice(0, 24).map(c => html`<span>${c.codigo}</span>`)}${t.cursos.length > 24 ? html`<span>+${t.cursos.length - 24}</span>` : ""}</div>
        <p class="dip-fecha" id="dip-fecha">Dado en Fen Academy, a los ${d.getDate()} días del mes de ${MESES[d.getMonth()]} de ${d.getFullYear()}.</p>

        <footer class="dip-firmas">
            <div class="dip-firma"><span class="dip-rubrica">${profesores[0] ?? "Equipo docente"}</span><span class="dip-linea"></span>
                <small>${profesores.length > 1 ? "Equipo docente" : "Profesor"}</small></div>
            ${sello(`FEN ACADEMY · ${t.mayor ? "EXCELENCIA" : "TÍTULO"} · ${d.getFullYear()} · `)}
            <div class="dip-firma"><span class="dip-rubrica">Fen Academy</span><span class="dip-linea"></span><small>Dirección académica</small></div>
        </footer>

        <p class="dip-pie">Código <span id="dip-codigo">${codigo(demo ? "demo" : perfil.id, t.clave)}</span> · Título simbólico emitido por Fen Academy, sin validez oficial.</p>
    </div>
</article>
</div>`,
        alMontar: demo ? () => {
            const sel = document.getElementById("tg-alumno"), inp = document.getElementById("tg-nombre"), fec = document.getElementById("tg-fecha");
            const actualizar = () => {
                const nom = inp.value.trim() || "Nombre del Estudiante";
                document.getElementById("dip-nombre").textContent = nom;
                document.getElementById("dip-codigo").textContent = codigo(sel.value || `manual|${nom.toLowerCase()}`, t.clave);
                const [y, m, dd] = (fec.value || hoyISO).split("-").map(Number);
                document.getElementById("dip-fecha").textContent = `Dado en Fen Academy, a los ${dd} días del mes de ${MESES[m - 1]} de ${y}.`;
                document.title = `Título · ${nom}`;
            };
            sel.addEventListener("change", () => { inp.value = sel.selectedOptions[0]?.dataset.nombre ?? ""; actualizar(); });
            inp.addEventListener("input", actualizar);
            fec.addEventListener("input", actualizar);
        } : undefined,
    };
}
