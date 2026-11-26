// Arranque de la página: sesión, menú según el rol y "router" por #hash.
//
// Cada pantalla es una función async que devuelve { titulo, html, acciones }.
//  - html: el contenido (siempre con valores escapados, ver ui.js).
//  - acciones: funciones que se ejecutan al enviar <form data-accion="x">
//    o al hacer clic en <button data-accion="x">. Si terminan bien, la
//    pantalla se vuelve a dibujar con los datos nuevos.
import { sb, configurado, rpc, mensajeDeError } from "./api.js";
import { html, e, nombreRol, mensajesHtml, error as flashError } from "./ui.js";
import * as auth from "./vistas/auth.js";
import * as est from "./vistas/estudiante.js";
import * as prof from "./vistas/profesor.js";
import * as adm from "./vistas/admin.js";
import * as cuenta from "./vistas/cuenta.js";

const app = document.getElementById("app");
const E = "estudiante", P = "profesor", A = "admin";

// [patrón, pantalla, roles permitidos]
const RUTAS = [
    ["inicio", est.inicio, [E]],
    ["matricula", est.matricula, [E]],
    ["progreso", est.progreso, [E]],
    ["curso/:id", est.curso, [E]],
    ["actividad/:id", est.actividad, [E]],
    ["examen/:id", est.rendir, [E]],
    ["docente", prof.inicio, [P, A]],
    ["docente/curso/:id", prof.curso, [P, A]],
    ["docente/examen/:id", prof.examen, [P, A]],
    ["docente/revisar/:id", prof.revisar, [P, A]],
    ["admin", adm.inicio, [A]],
    ["admin/curso/:id", adm.editarCurso, [A]],
    ["perfil", cuenta.perfil, [E, P, A]],
    ["ajustes", cuenta.ajustes, [E, P, A]],
];

const INICIO = { estudiante: "inicio", profesor: "docente", admin: "admin" };

let perfil = null;          // perfil del usuario con sesión (o null)
let acciones = {};          // acciones de la pantalla actual
let limpiar = null;         // función para cortar timers de la pantalla anterior
let modoRecuperacion = false;

export function ir(ruta) {
    const destino = "#/" + ruta.replace(/^#?\//, "");
    if (location.hash === destino) dibujar(); else location.hash = destino;
}

function leerHash() {
    const [ruta, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
    return { ruta, query: new URLSearchParams(query) };
}

function buscarRuta(ruta) {
    for (const [patron, fn, roles] of RUTAS) {
        const p = patron.split("/"), r = ruta.split("/");
        if (p.length !== r.length) continue;
        const params = {};
        if (p.every((s, i) => (s.startsWith(":") ? ((params[s.slice(1)] = decodeURIComponent(r[i])), true) : s === r[i])))
            return { fn, roles, params };
    }
    return null;
}

async function cargarPerfil() {
    const { data } = await sb.auth.getSession();
    if (!data.session) { perfil = null; return; }
    perfil = await rpc("mi_perfil");
    if (!perfil) {   // la cuenta fue eliminada por un admin
        await sb.auth.signOut();
        flashError("Tu cuenta ya no existe.");
    }
}

function menu(rutaActual) {
    const items = {
        estudiante: [["inicio", "Inicio"], ["matricula", "Matrícula"], ["progreso", "Progreso"]],
        profesor: [["docente", "Mis cursos"]],
        admin: [["admin", "Administración"], ["docente", "Panel docente"]],
    }[perfil.rol];
    const activo = r => {
        const raiz = rutaActual.split("/")[0];
        if (r === "progreso") return ["progreso", "curso", "actividad", "examen"].includes(raiz);
        return raiz === r;
    };
    return [...items, ["perfil", "Perfil"], ["ajustes", "Ajustes"]]
        .map(([r, t]) => html`<a href="#/${r}" class="nav-item ${activo(r) ? "active" : ""}">${t}</a>`);
}

function layout(rutaActual, vista) {
    const inicial = (perfil.nombre || "?").slice(0, 1).toUpperCase();
    document.body.className = `dashboard-body rol-${perfil.rol}`;
    return html`
<div class="dashboard-layout">
    <aside class="sidebar">
        <div>
            <div class="logo-box"><h2>Fen Academy</h2></div>
            <div class="profile-strip">
                <div class="profile-avatar">${inicial}</div>
                <div class="profile-info">
                    <h3>${perfil.nombre}</h3>
                    <p><span class="rol-badge rol-badge-${perfil.rol}">${nombreRol(perfil.rol)}</span></p>
                </div>
            </div>
            <nav class="sidebar-nav">${menu(rutaActual)}</nav>
        </div>
        <button type="button" class="logout-link" data-salir>Cerrar sesión</button>
    </aside>
    <main class="dashboard-main">
        <header class="topbar">
            <div class="topbar-left">
                <button class="menu-toggle" type="button" data-toggle-sidebar>☰</button>
                <span>${vista.seccion || vista.titulo}</span>
            </div>
            <div class="topbar-right">
                ${vista.volver ? html`<a href="#/${vista.volver[0]}" class="topbar-link">← ${vista.volver[1]}</a>` : ""}
                <strong>${perfil.nombre}</strong>
                <div class="topbar-avatar">${inicial}</div>
            </div>
        </header>
        <div id="mensajes">${vista.cargando ? "" : mensajesHtml()}</div>
        ${vista.html}
    </main>
</div>
<footer class="footer-bar"><span>© Fen Academy</span><span>Powered by Fen</span></footer>`;
}

function layoutAuth(vista) {
    document.body.className = "";
    return html`<div class="auth-page"><div class="auth-box"><h1>Fen Academy</h1>
        <div id="mensajes">${mensajesHtml(true)}</div>${vista.html}</div></div>`;
}

let dibujando = 0;
export async function dibujar() {
    const turno = ++dibujando;
    if (limpiar) { limpiar(); limpiar = null; }
    const { ruta, query } = leerHash();
    const ctx = {
        perfil, params: {}, query, ir, recargar: dibujar, alSalir: f => (limpiar = f),
        terminarRecuperacion: () => { modoRecuperacion = false; },
        refrescarPerfil: async () => { await cargarPerfil(); ctx.perfil = perfil; },
    };

    let vista;
    try {
        if (!configurado) vista = auth.sinConfigurar();
        else if (modoRecuperacion) vista = auth.nuevaPassword(ctx);
        else if (!perfil) vista = ruta === "registro" ? auth.registro(ctx) : ruta === "recuperar" ? auth.recuperar(ctx) : auth.login(ctx);
        else {
            const encontrada = buscarRuta(ruta);
            if (!encontrada) return ir(INICIO[perfil.rol]);
            if (!encontrada.roles.includes(perfil.rol)) {
                flashError("Esa sección no está disponible para tu rol.");
                return ir(INICIO[perfil.rol]);
            }
            ctx.params = encontrada.params;
            app.innerHTML = layout(ruta, { titulo: "Cargando…", cargando: true, html: html`<p class="muted panel-help">Cargando…</p>` });
            vista = await encontrada.fn(ctx);
        }
    } catch (err) {
        console.error(err);
        vista = { titulo: "Error", html: html`<section class="course-panel"><div class="panel-title">No se pudo cargar</div>
            <p class="muted panel-help">${mensajeDeError(err)}</p></section>` };
    }
    if (turno !== dibujando) return;   // el usuario ya navegó a otra pantalla

    acciones = vista.acciones || {};
    document.title = `${vista.titulo || "Inicio"} | Fen Academy`;
    app.innerHTML = vista.auth || !perfil || modoRecuperacion || !configurado ? layoutAuth(vista) : layout(ruta, vista);
    vista.alMontar?.(app, ctx);
}

/** Muestra un error sin redibujar (así no se pierde lo que el usuario escribió). */
function mostrarError(texto) {
    const caja = document.getElementById("mensajes");
    const enAuth = !!document.querySelector(".auth-box");
    if (caja) caja.innerHTML = enAuth ? `<div class="msg-error">${e(texto)}</div>`
        : `<div class="alerts-box no-side-padding"><div class="alert error">${e(texto)}</div></div>`;
    caja?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function ejecutar(nombre, el, datos) {
    const fn = acciones[nombre];
    if (!fn) return;
    const botones = el.tagName === "FORM" ? el.querySelectorAll("button") : [el];
    botones.forEach(b => (b.disabled = true));
    try {
        const resultado = await fn(datos, el);
        if (resultado !== false) await dibujar();
    } catch (err) {
        console.error(err);
        mostrarError(mensajeDeError(err));
        botones.forEach(b => (b.disabled = false));
    }
}

// --------------------------------------------------------------- eventos ---

document.addEventListener("submit", ev => {
    const form = ev.target.closest("form[data-accion]");
    if (!form) return;
    ev.preventDefault();
    if (form.dataset.confirm && !confirm(form.dataset.confirm)) return;
    const datos = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll("input[type=file]").forEach(i => (datos[i.name] = i.files[0] || null));
    ejecutar(form.dataset.accion, form, { ...form.dataset, ...datos });
});

document.addEventListener("click", ev => {
    const boton = ev.target.closest("button[data-accion]");
    if (boton && !boton.form) {
        if (boton.dataset.confirm && !confirm(boton.dataset.confirm)) return;
        return ejecutar(boton.dataset.accion, boton, { ...boton.dataset });
    }
    if (ev.target.closest("[data-toggle-sidebar]")) document.querySelector(".sidebar")?.classList.toggle("collapsed");
    const toggle = ev.target.closest("[data-toggle]");
    if (toggle) document.getElementById(toggle.dataset.toggle)?.classList.toggle("open");
    if (ev.target.closest("[data-salir]")) sb.auth.signOut();

    // Pestañas: <button data-tab="id"> muestra <div class="tab-content" id="id">
    const tab = ev.target.closest(".course-menu-tab[data-tab]");
    if (tab) {
        document.querySelectorAll(".tab-content").forEach(t => t.classList.toggle("active-tab", t.id === tab.dataset.tab));
        document.querySelectorAll(".course-menu-tab").forEach(t => t.classList.toggle("active", t === tab));
        const { ruta, query } = leerHash();
        query.set("tab", tab.dataset.tab);
        history.replaceState(null, "", `#/${ruta}?${query}`);
    }

    // Filas clicables: <tr data-href="#/ruta">
    const fila = ev.target.closest("[data-href]");
    if (fila && !ev.target.closest("a, button, input, select, textarea")) location.hash = fila.dataset.href;
});

window.addEventListener("hashchange", dibujar);

// ----------------------------------------------------------------- inicio ---

if (configurado) {
    sb.auth.onAuthStateChange((evento, sesion) => {
        // supabase-js repite SIGNED_IN al volver a la pestaña: si ya es el mismo usuario, no redibujamos
        // (así no se borra, por ejemplo, un examen a medio responder).
        if (evento === "SIGNED_IN" && perfil && sesion?.user?.id === perfil.id) return;
        if (evento === "PASSWORD_RECOVERY") modoRecuperacion = true;
        if (evento === "SIGNED_OUT") { perfil = null; modoRecuperacion = false; }
        if (["SIGNED_IN", "SIGNED_OUT", "PASSWORD_RECOVERY"].includes(evento)) {
            // Fuera del callback (supabase-js no permite consultas adentro).
            setTimeout(async () => {
                try { await cargarPerfil(); } catch (err) { flashError(mensajeDeError(err)); perfil = null; }
                if (evento === "SIGNED_OUT" || evento === "SIGNED_IN") {
                    const { ruta } = leerHash();
                    if (evento === "SIGNED_IN" && perfil && (!ruta || ["login", "registro", "recuperar"].includes(ruta))) return ir(INICIO[perfil.rol]);
                    if (evento === "SIGNED_OUT" && ruta !== "login") return ir("login");
                }
                dibujar();
            }, 0);
        }
    });
    try { await cargarPerfil(); } catch (err) { flashError(mensajeDeError(err)); }
}
dibujar();
