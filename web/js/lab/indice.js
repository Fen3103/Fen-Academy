// Qué laboratorio corresponde a cada lenguaje de curso. Es liviano a propósito:
// el editor y los ejecutores (lab.js) se cargan solo al abrir un curso que tiene laboratorio.
// Cada lenguaje tiene su propio ejecutor: un curso de Java nunca ejecuta Python, y al revés.

export function labDe(lenguaje) {
    const l = String(lenguaje || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (l.includes("logica")) return "pseudocodigo";
    if (l.includes("python") || l.includes("estructuras de datos")) return "python";
    if (l.includes("javascript")) return "javascript";
    if (l.includes("funciona la web") || l.includes("html") || l.includes("css")) return "web";
    if (l.includes("bases de datos") || l.includes("sql")) return "sql";
    return null;   // C#, Java, Git, Computación básica y Proyecto integrador todavía no tienen laboratorio
}

/** Contenedor del apartado; lab.js lo llena al montar la pantalla. */
export const contenedorLab = (curso, lab, usuario) =>
    `<div class="lab" data-lab="${lab}" data-lab-curso="${Number(curso.id)}" data-lab-usuario="${String(usuario || "").replace(/[^\w-]/g, "")}"><div class="cargando-pantalla"><span class="spinner"></span>Cargando laboratorio…</div></div>`;

/** Monta el laboratorio si la pantalla tiene uno (carga lab.js recién aquí). */
export function montarLab(raiz, alSalir) {
    const el = raiz.querySelector(".lab[data-lab]");
    if (!el) return;
    import("./lab.js").then(m => m.montar(el, alSalir)).catch(err => {
        console.error(err);
        el.innerHTML = `<p class="muted lab-aviso">No se pudo cargar el laboratorio. Revisá tu conexión y recargá la página.</p>`;
    });
}
