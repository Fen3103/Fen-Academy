// Helpers de presentación: escapar HTML, chips de estado, fechas y mensajes.

/** Escapa texto para insertarlo en HTML (evita que un estudiante inyecte código). */
export function e(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Plantilla segura: los valores se escapan salvo que vengan envueltos en raw(). */
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(s);
export function html(partes, ...valores) {
    let out = partes[0];
    valores.forEach((v, i) => {
        if (Array.isArray(v)) out += v.map(x => (x instanceof Raw ? x.s : e(x))).join("");
        else if (v instanceof Raw) out += v.s;
        else if (v === null || v === undefined || v === false) out += "";
        else out += e(v);
        out += partes[i + 1];
    });
    return raw(out);
}

export const num = v => (v === null || v === undefined || v === "" ? "—" : String(Math.round(Number(v) * 100) / 100));
export const pct = v => num(v) + "%";
export const fecha = d => (d ? String(d).slice(0, 10) : "Sin fecha");
export function fechaHora(d) {
    if (!d) return "—";
    const x = new Date(d);
    const p = n => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}`;
}
export function hoy() {
    const x = new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export const vencida = fechaLimite => !!fechaLimite && fechaLimite < hoy();

const chip = (clase, texto) => html`<span class="estado-chip ${clase}"><i class="punto"></i>${texto}</span>`;

export function chipEntrega(estado) {
    switch (estado) {
        case "Aprobado": return chip("estado-ok", "Aprobado");
        case "Revisado": return chip("estado-open", "Revisado");
        case "Rechazado": return chip("estado-bad", "Rechazado");
        case "Pendiente": return chip("estado-wait", "Por revisar");
        default: return chip("estado-lock", "Sin entregar");
    }
}
export function chipMatricula(estado) {
    if (estado === "Aprobado") return chip("estado-ok", "Aprobado");
    if (estado === "Reprobado") return chip("estado-bad", "Reprobado");
    return chip("estado-open", "Cursando");
}
export const chipTipo = t => (t === "examen" ? chip("estado-exam", "Examen") : chip("estado-lock", "Entrega"));
export const nombreRol = r => ({ admin: "Administrador", profesor: "Profesor" })[r] || "Estudiante";

// ------------------------------------------------------------ mensajes ---

let pendientes = [];
/** Mensaje que se muestra en la próxima pantalla (como el "flash" de un servidor). */
export function flash(tipo, texto) { pendientes.push([tipo, texto]); }
export const exito = t => flash("success", t);
export const error = t => flash("error", t);
export function tomarMensajes() { const m = pendientes; pendientes = []; return m; }

export function mensajesHtml(auth = false) {
    const m = tomarMensajes();
    if (!m.length) return "";
    const items = m.map(([t, txt]) => auth ? html`<div class="msg-${t}">${txt}</div>` : alerta(t, txt));
    return auth ? html`${items}` : html`<div class="alerts-box no-side-padding">${items}</div>`;
}

/** Pestañas de un curso: [{id, texto, icono, contador?}]. La activa se recuerda en la URL (?tab=). */
export function tabs(lista, activa) {
    return html`<nav class="course-menu-tabs" role="tablist">${lista.map(t => html`
        <button type="button" role="tab" class="course-menu-tab ${t.id === activa ? "active" : ""}" data-tab="${t.id}"
                aria-selected="${t.id === activa ? "true" : "false"}">
            ${icono(t.icono)}<span>${t.texto}</span>${t.contador ? html`<span class="tab-contador">${t.contador}</span>` : ""}
        </button>`)}</nav>`;
}
export const panelTab = (id, activa) => `id="${id}" class="tab-content ${id === activa ? "active-tab" : ""}"`;

export const enlaceExterno = url => html`<a class="link-repo" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;

export const NOTICIAS = [
    ["Dato de programación", "Python sigue siendo clave para aprender lógica",
        "Su sintaxis simple ayuda a concentrarse en resolver problemas antes de pelearse con detalles del lenguaje."],
    ["Tecnología", "La inteligencia artificial ya es parte del flujo de desarrollo",
        "Hoy muchos equipos usan asistentes para revisar código, generar pruebas y explorar soluciones más rápido."],
    ["Consejo tech", "Leer errores es una habilidad de programador",
        "Un buen primer paso al depurar es mirar el mensaje exacto, la línea y repetir el caso mínimo que falla."],
    ["Dato web", "HTML, CSS y JavaScript trabajan en capas",
        "HTML estructura, CSS presenta y JavaScript agrega comportamiento. Separarlos hace el proyecto más fácil de mantener."],
    ["Git", "Hacé commits pequeños y con buenos mensajes",
        "Un historial claro te permite volver atrás, entender qué cambió y mostrar tu progreso en GitHub."],
];

/** Clase CSS con la foto que corresponde al lenguaje del curso. */
export function claseLenguaje(lenguaje) {
    const l = String(lenguaje || "").toLowerCase();
    if (l.includes("lógica") || l.includes("logica")) return "lang-logica";
    if (l.includes("computación") || l.includes("computacion")) return "lang-comp";
    if (l.includes("estructuras")) return "lang-ed";
    if (l.includes("proyecto")) return "lang-proy";
    if (l.includes("python")) return "lang-python";
    if (l.includes("javascript") || l === "js" || l.includes("typescript")) return "lang-javascript";
    if (l.includes("html") || l.includes("css") || l.includes("web")) return "lang-web";
    if (l.includes("java")) return "lang-java";
    if (l.includes("c#") || l.includes("csharp") || l.includes(".net")) return "lang-csharp";
    if (l.includes("git")) return "lang-git";
    if (l.includes("sql") || l.includes("datos") || l.includes("database")) return "lang-db";
    return "lang-otro";
}

// ---------------------------------------------------------------- íconos ---
// Íconos de línea (SVG en el propio código: no dependen de otra página).
const ICONOS = {
    class: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
    eval: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    matricula: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    ok: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
    alerta: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    capas: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    upload: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    flecha: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
    megafono: '<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
};
export const icono = (nombre, clase = "icono") =>
    raw(`<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre] || ""}</svg>`);

/** Aviso con ícono y botón para cerrarlo (los de éxito se van solos). */
export const alerta = (tipo, texto) => html`<div class="alert ${tipo}" role="${tipo === "error" ? "alert" : "status"}">
    ${icono(tipo === "error" ? "alerta" : "ok")}<span>${texto}</span>
    <button type="button" class="alert-cerrar" data-cerrar-alerta aria-label="Cerrar">${icono("cerrar")}</button></div>`;

/** Orden recomendado para aprender desde cero (los demás lenguajes van al final, por nombre). */
export const ORDEN_LENGUAJES = ["lógica de programación", "computación básica", "python", "git", "html y css", "javascript",
    "cómo funciona la web", "bases de datos", "c#", "java", "estructuras de datos", "proyecto integrador"];
export const posLenguaje = l => (ORDEN_LENGUAJES.indexOf(String(l).toLowerCase()) + 1) || 99;
/** Compara dos lenguajes por prioridad y después alfabéticamente. */
export const compararLenguajes = (a, b) => posLenguaje(a) - posLenguaje(b) || String(a).localeCompare(String(b));

/** dd/mm/aaaa a partir de "aaaa-mm-dd..." */
export const fechaDMA = d => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "Sin fecha");

/** Círculo de color con el ícono del tipo de actividad. */
export const iconoTipo = t => html`<span class="tipo-circulo ${t === "examen" ? "tipo-examen" : "tipo-entrega"}"
    title="${t === "examen" ? "Examen" : "Entrega"}">${icono(t === "examen" ? "star" : "upload")}</span>`;

/** Celda de fecha límite: fecha arriba y hora de cierre abajo. */
export const celdaFecha = d => d
    ? html`<div class="celda-fecha"><strong>${icono("calendar")} ${fechaDMA(d)}</strong><small>${icono("clock")} 23:59</small></div>`
    : html`<span class="muted">Sin fecha</span>`;

/** Etiquetas debajo del título de una actividad: tipo y clase. */
export const etiquetasActividad = a => html`<div class="act-etiquetas">
    <span class="etq etq-tipo">${a.tipo === "examen" ? "Examen" : "Entrega"}</span>
    <span class="etq etq-clase">${icono("class")} ${a.clase ? `Clase ${a.clase.orden}: ${a.clase.titulo}` : "Actividad general"}</span></div>`;

/** Inicial grande para el bloque de color de un curso. */
export const bloqueCurso = c => html`<div class="curso-bloque ${claseLenguaje(c.lenguaje)}"><span>${c.codigo}</span></div>`;
