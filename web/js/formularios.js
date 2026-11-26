// Formularios: validación con mensajes en español debajo de cada campo
// y botón de ojo para ver u ocultar contraseñas.
import { icono } from "./ui.js";

/** Se llama después de cada dibujo: prepara los formularios de la pantalla. */
export function mejorarFormularios(raiz) {
    raiz.querySelectorAll("form").forEach(f => { f.noValidate = true; });
    raiz.querySelectorAll('input[type="password"]').forEach(agregarOjo);
}

function agregarOjo(input) {
    if (input.closest(".campo-pass")) return;
    const caja = document.createElement("div");
    caja.className = "campo-pass";
    input.replaceWith(caja);
    caja.append(input);
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "ojo";
    boton.dataset.ojo = "";
    boton.setAttribute("aria-label", "Mostrar contraseña");
    boton.title = "Mostrar contraseña";
    boton.innerHTML = String(icono("ojo"));
    caja.append(boton);
}

/** Alterna ver/ocultar la contraseña del botón de ojo. */
export function alternarOjo(boton) {
    const input = boton.closest(".campo-pass")?.querySelector("input");
    if (!input) return;
    const ver = input.type === "password";
    input.type = ver ? "text" : "password";
    boton.innerHTML = String(icono(ver ? "ojo-cerrado" : "ojo"));
    const txt = ver ? "Ocultar contraseña" : "Mostrar contraseña";
    boton.setAttribute("aria-label", txt);
    boton.title = txt;
    boton.classList.toggle("activo", ver);
    input.focus({ preventScroll: true });
}

function mensajeDe(el) {
    const v = el.validity;
    if (el.name === "confirmar") {
        const pass = el.form?.querySelector('[name="password"]');
        if (pass && el.value && el.value !== pass.value) return "Las contraseñas no coinciden.";
    }
    // El navegador no marca tooShort/pattern en valores pegados o autocompletados: se revisan a mano.
    if (el.value && el.minLength > 0 && el.value.length < el.minLength)
        return `Tiene que tener al menos ${el.minLength} caracteres (llevás ${el.value.length}).`;
    if (el.value && el.pattern && !new RegExp(`^(?:${el.pattern})$`, "u").test(el.value))
        return el.title || "El formato no es válido.";
    if (v.valid) return "";
    if (v.valueMissing) return el.type === "file" ? "Elegí un archivo." : el.tagName === "SELECT" ? "Elegí una opción." : "Este campo es obligatorio.";
    if (v.typeMismatch && el.type === "email") return "Escribí un correo válido, por ejemplo nombre@correo.com.";
    if (v.typeMismatch && el.type === "url") return "Escribí un enlace válido que empiece con https://";
    if (v.tooShort) return `Tiene que tener al menos ${el.minLength} caracteres (llevás ${el.value.length}).`;
    if (v.tooLong) return `Máximo ${el.maxLength} caracteres.`;
    if (v.patternMismatch) return el.title || "El formato no es válido.";
    if (v.rangeUnderflow) return `El valor mínimo es ${el.min}.`;
    if (v.rangeOverflow) return `El valor máximo es ${el.max}.`;
    if (v.stepMismatch) return "Ese valor no es válido.";
    if (v.badInput) return "Escribí un número válido.";
    return el.validationMessage || "Revisá este campo.";
}

function lugarDelMensaje(el) {
    return el.closest(".campo-pass") || el.closest(".zona-archivo") || el;
}

function marcar(el, msg) {
    const ancla = lugarDelMensaje(el);
    let aviso = ancla.nextElementSibling?.classList.contains("campo-error") ? ancla.nextElementSibling : null;
    el.classList.toggle("invalido", !!msg);
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    if (!msg) { aviso?.remove(); return; }
    if (!aviso) {
        aviso = document.createElement("small");
        aviso.className = "campo-error";
        aviso.setAttribute("role", "alert");
        ancla.after(aviso);
    }
    aviso.textContent = msg;
}

const campos = form => [...form.elements].filter(el => el.willValidate && !el.disabled && el.type !== "submit" && el.type !== "button");

/** Valida el formulario completo; marca los campos con error y enfoca el primero. */
export function validarFormulario(form) {
    let primero = null;
    for (const el of campos(form)) {
        const msg = mensajeDe(el);
        marcar(el, msg);
        if (msg && !primero) primero = el;
    }
    if (primero) {
        primero.focus({ preventScroll: true });
        primero.scrollIntoView({ behavior: "smooth", block: "center" });
        form.classList.remove("sacudir");
        void form.offsetWidth;
        form.classList.add("sacudir");
    }
    return !primero;
}

// Mientras se escribe: corrige el aviso en cuanto el campo queda bien,
// y compara la confirmación de contraseña en vivo.
document.addEventListener("input", ev => {
    const el = ev.target;
    if (!el.form || !el.willValidate) return;
    if (el.classList.contains("invalido")) marcar(el, mensajeDe(el));
    if (el.name === "confirmar" && el.value) marcar(el, mensajeDe(el));
    if (el.name === "password") {
        const conf = el.form.querySelector('[name="confirmar"]');
        if (conf?.value) marcar(conf, mensajeDe(conf));
    }
});
document.addEventListener("focusout", ev => {
    const el = ev.target;
    if (el.form?.noValidate && el.willValidate && el.value) marcar(el, mensajeDe(el));
});
