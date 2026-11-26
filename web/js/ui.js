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

const chip = (clase, texto) => html`<span class="estado-chip ${clase}">${texto}</span>`;

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
    const items = m.map(([t, txt]) => html`<div class="${auth ? "msg-" + t : "alert " + t}">${txt}</div>`);
    return auth ? html`${items}` : html`<div class="alerts-box no-side-padding">${items}</div>`;
}

/** Pestañas de un curso: [{id, texto, icono}]. La activa se recuerda en la URL (?tab=). */
export function tabs(lista, activa) {
    return html`<section class="course-menu-tabs">${lista.map(t => html`
        <button type="button" class="course-menu-tab ${t.id === activa ? "active" : ""}" data-tab="${t.id}">
            <span class="tab-icon tab-icon-${t.icono}"></span> ${t.texto}
        </button>`)}</section>`;
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
