// Contenido con formato (Markdown) para clases, consignas y anuncios:
// **negrita**, listas, enlaces, bloques de código con colores y videos de YouTube.
// El texto se guarda tal cual en la base; se convierte aquí, ya limpio de HTML peligroso.

const CDN = {
    marked: "https://cdn.jsdelivr.net/npm/marked@12.0.2/+esm",
    purify: "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm",
    hljs: "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/es/highlight.min.js",
};

let libs = null;
function cargar() {
    libs ??= Promise.all([import(CDN.marked), import(CDN.purify), import(CDN.hljs)])
        .then(([m, p, h]) => ({ marked: m.marked, purify: p.default, hljs: h.default }));
    return libs;
}

const YOUTUBE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/i;

/** Convierte todos los bloques .md que haya dentro de raiz. */
export async function renderMarkdown(raiz) {
    const bloques = [...raiz.querySelectorAll(".md:not([data-listo])")];
    if (!bloques.length) return;
    let l;
    try { l = await cargar(); } catch { bloques.forEach(b => b.classList.add("md-plano")); return; }
    for (const el of bloques) {
        const fuente = el.textContent;
        el.innerHTML = l.purify.sanitize(l.marked.parse(fuente, { gfm: true, breaks: true }));
        el.dataset.listo = "1";

        el.querySelectorAll("a[href]").forEach(a => {
            a.target = "_blank"; a.rel = "noopener noreferrer";
            // Un enlace de YouTube solo en su línea se muestra como video.
            const id = a.href.match(YOUTUBE)?.[1];
            const p = a.parentElement;
            if (id && p?.tagName === "P" && p.textContent.trim() === a.textContent.trim()) {
                const marco = document.createElement("div");
                marco.className = "md-video";
                const iframe = document.createElement("iframe");
                iframe.src = `https://www.youtube-nocookie.com/embed/${id}`;
                iframe.title = "Video de YouTube";
                iframe.loading = "lazy";
                iframe.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
                iframe.allowFullscreen = true;
                marco.append(iframe);
                p.replaceWith(marco);
            }
        });

        el.querySelectorAll("pre > code").forEach(code => {
            try { l.hljs.highlightElement(code); } catch { /* lenguaje desconocido */ }
            const pre = code.parentElement;
            const lang = [...code.classList].find(c => c.startsWith("language-"))?.slice(9);
            const barra = document.createElement("div");
            barra.className = "md-code-barra";
            barra.innerHTML = `<span></span><button type="button" data-copiar>Copiar</button>`;
            barra.firstChild.textContent = lang || "código";
            pre.prepend(barra);
        });
    }
}

/** Botón Copiar de los bloques de código. */
export async function copiarCodigo(boton) {
    const code = boton.closest("pre")?.querySelector("code");
    if (!code) return;
    try {
        await navigator.clipboard.writeText(code.innerText);
        boton.textContent = "¡Copiado!";
    } catch { boton.textContent = "No se pudo copiar"; }
    setTimeout(() => (boton.textContent = "Copiar"), 1500);
}

/** Texto de ayuda para los formularios que aceptan formato. */
export const AYUDA_MD = "Admite formato: **negrita**, - listas, [enlaces](https://…), código entre ``` (por ejemplo ```python) y un enlace de YouTube solo en una línea se muestra como video.";
