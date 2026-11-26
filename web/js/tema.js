// Tema (oscuro / claro crema / automático) y color de acento.
// Se guarda en este dispositivo (localStorage, para pintar al instante) y en la
// cuenta (metadatos del usuario en Supabase), así se comparte entre PC y celular.
import { html } from "./ui.js";
import { sb } from "./api.js";

export const ACENTOS = [
    ["naranja", "Naranja", "#ff7b00"], ["azul", "Azul", "#3b82f6"], ["violeta", "Violeta", "#8b5cf6"],
    ["verde", "Verde", "#10b981"], ["rosa", "Rosa", "#ec4899"], ["cian", "Cian", "#06b6d4"], ["rojo", "Rojo", "#ef4444"],
];
export const TEMAS = [["oscuro", "Oscuro"], ["claro", "Claro crema"], ["auto", "Automático"]];

const leer = (k, def) => { try { return localStorage.getItem(k) || def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export const temaGuardado = () => leer("fen-tema", "oscuro");
export const acentoGuardado = () => leer("fen-acento", "naranja");

const sistemaClaro = () => window.matchMedia?.("(prefers-color-scheme: light)").matches;
export const temaEfectivo = (t = temaGuardado()) => t === "auto" ? (sistemaClaro() ? "claro" : "oscuro") : t;

export function aplicarTema() {
    const raiz = document.documentElement;
    raiz.dataset.tema = temaEfectivo();
    raiz.dataset.acento = acentoGuardado();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", raiz.dataset.tema === "claro" ? "#f3ecdf" : "#070a16");
}

const VALIDOS_TEMA = ["oscuro", "claro", "auto"];
const validoAcento = a => ACENTOS.some(([id]) => id === a);

function guardarEnCuenta() {
    sb.auth.getSession().then(({ data }) => {
        if (!data.session) return;
        return sb.auth.updateUser({ data: { tema: temaGuardado(), acento: acentoGuardado() } });
    }).catch(err => console.warn("No se pudo guardar la apariencia en la cuenta", err));
}

export function elegirTema(t) { guardar("fen-tema", t); aplicarTema(); guardarEnCuenta(); }
export function elegirAcento(a) { guardar("fen-acento", a); aplicarTema(); guardarEnCuenta(); }

/** Al iniciar sesión: si la cuenta tiene apariencia guardada, se usa la de la cuenta. */
export function aparienciaDeCuenta(meta) {
    if (!meta) return;
    let cambio = false;
    if (VALIDOS_TEMA.includes(meta.tema) && meta.tema !== temaGuardado()) { guardar("fen-tema", meta.tema); cambio = true; }
    if (validoAcento(meta.acento) && meta.acento !== acentoGuardado()) { guardar("fen-acento", meta.acento); cambio = true; }
    if (cambio) aplicarTema();
    // Cuenta sin apariencia guardada todavía: sube la de este dispositivo.
    if (!meta.tema && !meta.acento && (temaGuardado() !== "oscuro" || acentoGuardado() !== "naranja")) guardarEnCuenta();
}
export function alternarTema() { elegirTema(temaEfectivo() === "claro" ? "oscuro" : "claro"); }

window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", () => {
    if (temaGuardado() === "auto") aplicarTema();
});

// Bloque para la página de Ajustes.
export function selectorApariencia() {
    const t = temaGuardado(), a = acentoGuardado();
    return html`
<section class="course-panel apariencia">
    <div class="panel-title">Apariencia</div>
    <p class="muted panel-help">Se guarda en tu cuenta: la vas a ver igual en la PC y en el celular.</p>
    <h3 class="apariencia-sub">Tema</h3>
    <div class="temas-opciones">
        ${TEMAS.map(([id, txt]) => html`
        <button type="button" class="tema-opcion ${t === id ? "activa" : ""}" data-tema-opcion="${id}">
            <span class="tema-muestra tema-muestra-${id}"><i></i><i></i><i></i></span>
            <span>${txt}</span>
        </button>`)}
    </div>
    <h3 class="apariencia-sub">Color de acento</h3>
    <div class="acentos-opciones">
        ${ACENTOS.map(([id, txt, color]) => html`
        <button type="button" class="acento-opcion ${a === id ? "activa" : ""}" data-acento-opcion="${id}" title="${txt}" aria-label="${txt}" style="--c:${color}">
            <span></span><small>${txt}</small>
        </button>`)}
    </div>
</section>`;
}
