// Laboratorio de un curso: editor, ejecución y pruebas, solo del lenguaje de ese curso.
// Cada lenguaje corre en su propio worker (o en un iframe aislado para HTML), sin acceso
// a la página, a la sesión ni a Supabase.
import { html, raw } from "../ui.js";

const HLJS = "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/es/highlight.min.js";
const LIMITE_MS = 10000;          // tiempo máximo de una ejecución
const MAX_SALIDA = 200000;        // caracteres que se muestran como máximo

// ------------------------------------------------------------ lenguajes ---

const LABS = {
    pseudocodigo: {
        nombre: "Pseudocódigo", ext: "psc", hl: "pseudo", worker: "worker-pseudo.js", modulo: true,
        nota: "Se ejecuta en tu navegador · solo pseudocódigo",
        vistas: ["salida", "entrada", "pruebas", "paso"],
        simbolos: ["<-", "(", ")", '"', "[", "]", "=", "<>", "<", ">", "+", "-", "*", "/", ",", ":"],
        ejemplo: `Algoritmo SumaDeNumeros
    Definir n, i, suma Como Entero
    Escribir "¿Cuántos números querés sumar?"
    Leer n
    suma <- 0
    Para i <- 1 Hasta n Hacer
        suma <- suma + i
    FinPara
    Escribir "La suma de 1 a ", n, " es ", suma
FinAlgoritmo
`,
        entrada: "5",
        pruebas: [
            { entrada: "5", esperada: "¿Cuántos números querés sumar?\nLa suma de 1 a 5 es 15" },
            { entrada: "10", esperada: "¿Cuántos números querés sumar?\nLa suma de 1 a 10 es 55" },
        ],
        ayudaEntrada: "Datos para cada Leer, uno por línea.",
    },
    python: {
        nombre: "Python", ext: "py", hl: "python", worker: "worker-python.js", persistente: true,
        nota: "Se ejecuta en tu navegador · solo Python",
        cargando: "Cargando Python… La primera vez puede tardar unos segundos.",
        vistas: ["salida", "entrada", "pruebas"],
        simbolos: ["Tab", ":", "(", ")", "[", "]", "{", "}", '"', "'", "=", "+", "-", "*", "/", "#", "_", "<", ">"],
        ejemplo: `# Escribí tu programa y presioná Ejecutar (Ctrl + Enter)
nombre = input("¿Cómo te llamás? ")
n = int(input("Elegí un número: "))

for i in range(1, n + 1):
    print(f"{i} x {i} = {i * i}")

print(f"¡Listo, {nombre}!")
`,
        entrada: "Ana\n3",
        pruebas: [{ entrada: "Ana\n3", esperada: "1 x 1 = 1\n2 x 2 = 4\n3 x 3 = 9\n¡Listo, Ana!" }],
        ayudaEntrada: "Datos para cada input(), uno por línea.",
    },
    javascript: {
        nombre: "JavaScript", ext: "js", hl: "javascript", worker: "worker-js.js",
        nota: "Se ejecuta en tu navegador · solo JavaScript",
        vistas: ["salida", "entrada", "pruebas"],
        simbolos: ["Tab", "{", "}", "(", ")", ";", "=", "=>", '"', "'", "`", "[", "]", "+", "-", "*", "/", "<", ">", "!", "&&", "||"],
        ejemplo: `// Escribí tu programa y presioná Ejecutar (Ctrl + Enter)
const nombre = prompt("¿Cómo te llamás? ");
const numeros = [4, 8, 15, 16, 23, 42];

const pares = numeros.filter(n => n % 2 === 0);
const suma = numeros.reduce((total, n) => total + n, 0);

console.log(\`Hola, \${nombre}\`);
console.log("Pares:", pares);
console.log("Suma:", suma);
`,
        entrada: "Ana",
        pruebas: [{ entrada: "Ana", esperada: "Hola, Ana\nPares: [4,8,16,42]\nSuma: 108" }],
        ayudaEntrada: "Datos para cada prompt(), uno por línea.",
    },
    web: {
        nombre: "HTML, CSS y JavaScript", ext: "html", hl: "xml",
        nota: "Vista previa aislada · se actualiza mientras escribís",
        vistas: ["vista"],
        simbolos: ["Tab", "<", ">", "/", "=", '"', "{", "}", ":", ";", "(", ")", "#", "."],
        ejemplo: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 90vh; background: #f8fafc; }
    .tarjeta { background: white; padding: 24px 32px; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.08); text-align: center; }
    button { background: #ff7b00; color: white; border: 0; padding: 10px 18px; border-radius: 10px; font-size: 16px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="tarjeta">
    <h1>Hola, mundo</h1>
    <p>Clics: <strong id="clics">0</strong></p>
    <button id="boton">Sumar uno</button>
  </div>
  <script>
    let clics = 0;
    document.getElementById("boton").addEventListener("click", () => {
      clics++;
      document.getElementById("clics").textContent = clics;
      console.log("Clic número", clics);
    });
  </script>
</body>
</html>
`,
    },
    sql: {
        nombre: "SQL (SQLite)", ext: "sql", hl: "sql", worker: "worker-sql.js", persistente: true,
        nota: "Se ejecuta en tu navegador · solo SQL",
        cargando: "Cargando SQLite…",
        vistas: ["resultado"],
        simbolos: ["*", "(", ")", ",", ";", "'", "=", "<", ">", "%", "_"],
        ejemplo: `-- Cada vez que ejecutás se crea una base nueva con lo que escribas aquí.
CREATE TABLE estudiantes (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  curso TEXT,
  nota REAL
);

INSERT INTO estudiantes (nombre, curso, nota) VALUES
  ('Ana', 'Python', 92),
  ('Luis', 'Python', 78),
  ('Marta', 'JavaScript', 85),
  ('Pedro', 'JavaScript', 64);

SELECT nombre, nota FROM estudiantes WHERE nota >= 70 ORDER BY nota DESC;

SELECT curso, COUNT(*) AS estudiantes, ROUND(AVG(nota), 1) AS promedio
FROM estudiantes GROUP BY curso;
`,
    },
};

const VISTAS = { salida: "Salida", entrada: "Entrada", pruebas: "Pruebas", paso: "Paso a paso", vista: "Vista previa", resultado: "Resultado" };

// ------------------------------------------------------------ ejecutores ---

/** Un worker por lenguaje. Python y SQL quedan cargados entre ejecuciones; los demás se crean cada vez. */
class Ejecutor {
    constructor(lab) { this.lab = lab; this.w = null; this.listo = null; this.activo = null; }

    crear(alCargar) {
        const cfg = LABS[this.lab];
        this.w = new Worker(new URL(cfg.worker, import.meta.url), cfg.modulo ? { type: "module" } : undefined);
        this.w.onerror = ev => {
            ev.preventDefault?.();
            const msg = "No se pudo usar el ejecutor de " + cfg.nombre + ". Revisá tu conexión a Internet y volvé a intentar.";
            this.rechazar?.(new Error(msg));
            this.terminarActivo({ error: msg });
            this.reiniciar();
        };
        if (cfg.persistente) {
            alCargar?.();
            this.listo = new Promise((ok, mal) => {
                this.rechazar = mal;
                const escuchar = ({ data }) => {
                    if (data.tipo === "listo") { this.w.removeEventListener("message", escuchar); ok(); }
                    else if (data.tipo === "fin" && data.error) { this.w.removeEventListener("message", escuchar); this.reiniciar(); mal(new Error(data.error)); }
                };
                this.w.addEventListener("message", escuchar);
            });
        } else this.listo = Promise.resolve();
    }

    reiniciar() { this.w?.terminate(); this.w = null; this.listo = null; }

    terminarActivo(resultado) {
        const a = this.activo;
        if (!a) return;
        this.activo = null;
        clearTimeout(a.reloj);
        a.resolver(resultado);
    }

    async correr(mensaje, { alSalida, alCargar, limite = LIMITE_MS } = {}) {
        const cfg = LABS[this.lab];
        if (!cfg.persistente) this.reiniciar();
        if (!this.w) this.crear(alCargar);
        try { await this.listo; } catch (err) { return { error: err.message }; }
        return new Promise(resolver => {
            const w = this.w;
            const inicio = performance.now();
            this.activo = {
                resolver: r => {
                    w.onmessage = null;
                    if (!cfg.persistente || r.detenido || r.tiempo) this.reiniciar();
                    resolver({ ms: Math.round(performance.now() - inicio), ...r });
                },
                reloj: setTimeout(() => this.terminarActivo({ tiempo: true,
                    error: `El programa tardó más de ${limite / 1000} segundos y se detuvo. ¿Hay un ciclo que nunca termina?` }), limite),
            };
            w.onmessage = ({ data }) => {
                if (data.tipo === "salida") alSalida?.(data.texto);
                else if (data.tipo === "fin") this.terminarActivo(data);
            };
            w.postMessage(mensaje);
        });
    }

    detener() { this.terminarActivo({ detenido: true, error: "Ejecución detenida." }); }
}

const ejecutores = {};
const ejecutor = lab => (ejecutores[lab] ??= new Ejecutor(lab));

// ------------------------------------------------------------ resaltado ---

let hljs = null;
const cargarHljs = () => (hljs ??= import(HLJS).then(m => {
    const h = m.default;
    if (!h.getLanguage("pseudo")) h.registerLanguage("pseudo", hl => ({
        case_insensitive: true,
        keywords: {
            keyword: "algoritmo finalgoritmo proceso finproceso definir como dimension dimensionar leer escribir imprimir mostrar " +
                "si entonces sino finsi segun hacer finsegun otro modo mientras finmientras repetir hasta que para con paso finpara " +
                "funcion finfuncion subproceso finsubproceso por referencia valor sin saltar bajar fin de",
            type: "entero real numero numerico cadena texto caracter logico booleano",
            literal: "verdadero falso",
            built_in: "rc raiz abs ln exp sen cos tan asen acos atan trunc redon azar aleatorio longitud mayusculas minusculas " +
                "subcadena concatenar convertiranumero convertiratexto pi",
            operator: "y o no mod",
        },
        contains: [hl.QUOTE_STRING_MODE, hl.APOS_STRING_MODE, hl.C_LINE_COMMENT_MODE, hl.NUMBER_MODE,
            { className: "operator", begin: /<-|<>|<=|>=|[=<>+\-*/^%]/ }],
    }));
    return h;
}).catch(() => null));

const escapar = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

// -------------------------------------------------------------- editor ---

function crearEditor(caja, { lab, valor, alCambiar, alEjecutar }) {
    const cfg = LABS[lab];
    const ta = caja.querySelector(".lab-texto");
    const code = caja.querySelector(".lab-resaltado code");
    const nums = caja.querySelector(".lab-numeros");
    let h = null, errorLinea = null, marcada = null;

    const pintar = () => {
        const t = ta.value;
        code.innerHTML = (h ? h.highlight(t, { language: cfg.hl, ignoreIllegals: true }).value : escapar(t)) + "\n";
        const total = t.split("\n").length;
        let s = "";
        for (let i = 1; i <= total; i++) s += `<span${i === errorLinea ? ' class="error"' : i === marcada ? ' class="marcada"' : ""}>${i}</span>`;
        nums.innerHTML = s;
        sincronizar();
    };
    const sincronizar = () => {
        code.parentElement.scrollTop = ta.scrollTop;
        code.parentElement.scrollLeft = ta.scrollLeft;
        nums.scrollTop = ta.scrollTop;
    };

    const insertar = texto => {
        ta.focus();
        // execCommand conserva el deshacer (Ctrl+Z); si no existe, se inserta a mano.
        if (!document.execCommand?.("insertText", false, texto)) {
            ta.setRangeText(texto, ta.selectionStart, ta.selectionEnd, "end");
            ta.dispatchEvent(new Event("input"));
        }
    };

    ta.value = valor;
    ta.addEventListener("input", () => { errorLinea = null; pintar(); alCambiar(ta.value); });
    ta.addEventListener("scroll", sincronizar);
    ta.addEventListener("keydown", ev => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); alEjecutar(); return; }
        if (ev.key === "Tab" && !ev.shiftKey && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); insertar("    "); return; }
        if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
            // Mantiene la sangría y la aumenta después de abrir un bloque.
            const antes = ta.value.slice(0, ta.selectionStart);
            const linea = antes.slice(antes.lastIndexOf("\n") + 1);
            let sangria = linea.match(/^[ \t]*/)[0];
            const t = linea.trim();
            const abre = lab === "python" ? /:$/.test(t)
                : lab === "pseudocodigo" ? /^(algoritmo|proceso|funcion|función|subproceso|si\b|sino$|mientras|para\b|repetir$|segun|según|de otro modo)/i.test(t) || /:$/.test(t)
                : /[{(\[]$/.test(t);
            if (abre) sangria += "    ";
            ev.preventDefault();
            insertar("\n" + sangria);
        }
    });

    caja.querySelector(".lab-simbolos")?.addEventListener("pointerdown", ev => {
        const b = ev.target.closest("[data-simbolo]");
        if (!b) return;
        ev.preventDefault();    // que el teclado del celular no se cierre
        insertar(b.dataset.simbolo === "Tab" ? "    " : b.dataset.simbolo);
    });

    pintar();
    cargarHljs().then(x => { h = x; if (h) pintar(); });

    return {
        valor: () => ta.value,
        poner(v) { ta.value = v; errorLinea = null; pintar(); alCambiar(v); },
        error(n) { errorLinea = n || null; pintar(); if (n) irALinea(n); },
        marcar(n) { marcada = n || null; pintar(); if (n) irALinea(n); },
    };
    function irALinea(n) {
        const alto = parseFloat(getComputedStyle(ta).lineHeight) || 20;
        const y = (n - 1) * alto;
        if (y < ta.scrollTop || y > ta.scrollTop + ta.clientHeight - alto * 2) ta.scrollTop = Math.max(0, y - ta.clientHeight / 3);
        sincronizar();
    }
}

// ------------------------------------------------------------- pantalla ---

const normalizar = s => String(s ?? "").replace(/\r/g, "").split("\n").map(l => l.trimEnd()).join("\n").trim();
const lineasEntrada = t => { const l = String(t ?? "").replace(/\r/g, "").split("\n"); if (l.length && l[l.length - 1] === "") l.pop(); return l; };

function guardado(clave) {
    try { return JSON.parse(localStorage.getItem(clave) || "null"); } catch { return null; }
}
function guardar(clave, datos) {
    try { localStorage.setItem(clave, JSON.stringify(datos)); } catch { /* sin almacenamiento: no se guarda */ }
}

function plantilla(lab) {
    const cfg = LABS[lab];
    const ejecuta = lab !== "web";
    return html`
<div class="lab-cab">
    <div class="lab-titulo"><span class="lab-lenguaje">${cfg.nombre}</span><small>${cfg.nota}</small></div>
    <div class="lab-botones">
        <button type="button" class="admin-btn lab-btn-principal" data-lab-ejecutar title="Ctrl + Enter">▶ ${ejecuta ? "Ejecutar" : "Actualizar"}</button>
        ${cfg.vistas.includes("pruebas") ? html`<button type="button" class="admin-btn secundario" data-lab-probar>✓ Probar</button>` : ""}
        ${cfg.vistas.includes("paso") ? html`<button type="button" class="admin-btn secundario" data-lab-paso>Paso a paso</button>` : ""}
        <button type="button" class="admin-btn danger" data-lab-detener hidden>■ Detener</button>
        <button type="button" class="admin-btn secundario" data-lab-ejemplo>Ejemplo</button>
        <button type="button" class="admin-btn secundario" data-lab-descargar>Descargar</button>
    </div>
</div>
<div class="lab-cuerpo">
    <div class="lab-editor-caja">
        <div class="lab-editor">
            <div class="lab-numeros" aria-hidden="true"></div>
            <div class="lab-area">
                <pre class="lab-resaltado" aria-hidden="true"><code class="hljs"></code></pre>
                <textarea class="lab-texto" wrap="off" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
                    aria-label="Código en ${cfg.nombre}"></textarea>
            </div>
        </div>
        <div class="lab-simbolos" aria-label="Símbolos">${cfg.simbolos.map(s => html`<button type="button" data-simbolo="${s}" tabindex="-1">${s === "Tab" ? "⇥" : s}</button>`)}</div>
    </div>
    <div class="lab-panel">
        <div class="lab-pestanas" role="tablist">${cfg.vistas.map((v, i) =>
            html`<button type="button" role="tab" data-lab-pestana="${v}" class="${i === 0 ? "activa" : ""}" aria-selected="${String(i === 0)}">${VISTAS[v]}<span class="lab-contador" hidden></span></button>`)}</div>
        ${cfg.vistas.map((v, i) => html`<div class="lab-vista" data-vista="${v}" ${raw(i ? "hidden" : "")}>${vista(v, cfg)}</div>`)}
        <div class="lab-estado" aria-live="polite"></div>
    </div>
</div>`;
}

function vista(v, cfg) {
    switch (v) {
        case "salida": return html`<pre class="lab-salida"><span class="lab-gris">Presioná Ejecutar para ver el resultado.</span></pre>`;
        case "entrada": return html`<p class="lab-ayuda">${cfg.ayudaEntrada}</p>
            <textarea class="lab-entrada" spellcheck="false" autocapitalize="off" autocorrect="off" rows="6" aria-label="Entrada"></textarea>`;
        case "pruebas": return html`<p class="lab-ayuda">Cada prueba da una entrada y la salida que debería aparecer. <b>Probar</b> las ejecuta todas.</p>
            <div class="lab-pruebas"></div>
            <button type="button" class="admin-btn secundario lab-agregar" data-lab-agregar>+ Agregar prueba</button>`;
        case "paso": return html`<p class="lab-ayuda">La prueba de escritorio: cómo cambia cada variable en cada paso. Usa los datos de «Entrada».</p>
            <div class="lab-traza"><p class="lab-gris">Presioná <b>Paso a paso</b>.</p></div>`;
        case "vista": return html`<iframe class="lab-preview" title="Vista previa" sandbox="allow-scripts allow-modals allow-forms"></iframe>
            <div class="lab-consola-cab">Consola</div><pre class="lab-salida lab-consola"></pre>`;
        case "resultado": return html`<div class="lab-resultado"><p class="lab-gris">Presioná Ejecutar para ver las tablas.</p></div>`;
    }
}

// Captura console.log y errores de la vista previa (el iframe no tiene acceso a la página).
const ESPIA = `<script>(function(){function p(t,a){try{parent.postMessage({fenLab:1,t:t,m:Array.prototype.map.call(a,function(x){if(typeof x==="string")return x;try{return JSON.stringify(x)}catch(e){return String(x)}}).join(" ")},"*")}catch(e){}}
["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){p(k,arguments);o.apply(console,arguments)}});
window.addEventListener("error",function(e){p("error",[e.message+(e.lineno?" (línea "+(e.lineno-3)+")":"")])});})();<\/script>\n`;

export function montar(el, alSalir) {
    const lab = el.dataset.lab;
    const cfg = LABS[lab];
    if (!cfg) return;
    const clave = `fen-lab:${el.dataset.labUsuario}:${el.dataset.labCurso}:${lab}`;
    const previo = guardado(clave) || {};
    const estado = {
        codigo: previo.codigo ?? cfg.ejemplo,
        entrada: previo.entrada ?? cfg.entrada ?? "",
        pruebas: Array.isArray(previo.pruebas) ? previo.pruebas : (cfg.pruebas || []).map(p => ({ ...p })),
    };
    let guardarTimer = null;
    const persistir = () => { clearTimeout(guardarTimer); guardarTimer = setTimeout(() => guardar(clave, estado), 300); };

    el.innerHTML = plantilla(lab);
    const $ = s => el.querySelector(s);
    const salida = $(".lab-vista[data-vista=salida] .lab-salida");
    const estadoEl = $(".lab-estado");
    const btnDetener = $("[data-lab-detener]");
    const botones = [...el.querySelectorAll("[data-lab-ejecutar], [data-lab-probar], [data-lab-paso]")];
    let corriendo = false;
    let vistaTimer = null;

    const editor = crearEditor($(".lab-editor-caja"), {
        lab, valor: estado.codigo,
        alCambiar: v => {
            estado.codigo = v; persistir();
            if (lab === "web") { clearTimeout(vistaTimer); vistaTimer = setTimeout(actualizarVista, 700); }
        },
        alEjecutar: () => (lab === "web" ? actualizarVista() : ejecutarNormal()),
    });

    const entradaTa = $(".lab-entrada");
    if (entradaTa) {
        entradaTa.value = estado.entrada;
        entradaTa.addEventListener("input", () => { estado.entrada = entradaTa.value; persistir(); });
    }

    // En pantallas chicas el resultado queda debajo del editor: se baja hasta él al ejecutar.
    const verPanel = () => { if (window.innerWidth <= 1100) $(".lab-panel").scrollIntoView({ behavior: "smooth", block: "start" }); };
    function mostrarVista(v) {
        el.querySelectorAll("[data-lab-pestana]").forEach(b => { const a = b.dataset.labPestana === v; b.classList.toggle("activa", a); b.setAttribute("aria-selected", a); });
        el.querySelectorAll(".lab-vista").forEach(x => (x.hidden = x.dataset.vista !== v));
    }
    function ocupado(si) {
        corriendo = si;
        botones.forEach(b => (b.disabled = si));
        btnDetener.hidden = !si;
    }
    const ponerEstado = (texto, tipo = "") => { estadoEl.textContent = texto; estadoEl.className = "lab-estado " + tipo; };

    // ---- ejecutar ----
    async function ejecutarNormal() {
        if (corriendo) return;
        if (lab === "sql") return ejecutarSql();
        mostrarVista("salida");
        verPanel();
        salida.textContent = "";
        editor.error(null);
        ocupado(true);
        ponerEstado("Ejecutando…");
        let largo = 0;
        const r = await ejecutor(lab).correr(
            { codigo: editor.valor(), entradas: lineasEntrada(estado.entrada), prueba: false, traza: false },
            {
                alCargar: () => ponerEstado(cfg.cargando || "Cargando…"),
                alSalida: t => {
                    if (largo > MAX_SALIDA) return;
                    largo += t.length;
                    salida.append(largo > MAX_SALIDA ? t.slice(0, MAX_SALIDA - (largo - t.length)) + "\n… (salida recortada)" : t);
                    salida.scrollTop = salida.scrollHeight;
                },
            });
        ocupado(false);
        if (r.error) {
            const e = document.createElement("span");
            e.className = "lab-error";
            e.textContent = (salida.textContent && !salida.textContent.endsWith("\n") ? "\n" : "") + r.error;
            salida.append(e);
            editor.error(r.linea);
            ponerEstado(r.detenido ? "Detenido" : "Terminó con un error", "mal");
        } else {
            if (!salida.textContent) salida.innerHTML = '<span class="lab-gris">(El programa no mostró nada)</span>';
            ponerEstado(`Terminó bien · ${r.ms} ms`, "ok");
        }
    }

    async function ejecutarSql() {
        mostrarVista("resultado");
        verPanel();
        const caja = $(".lab-resultado");
        ocupado(true);
        ponerEstado("Ejecutando…");
        const r = await ejecutor("sql").correr({ codigo: editor.valor() }, { alCargar: () => ponerEstado(cfg.cargando) });
        ocupado(false);
        const tablas = (r.tablas || []).map(t => html`
            <div class="lab-tabla">
                <div class="lab-tabla-sql">${t.sql.length > 160 ? t.sql.slice(0, 160) + "…" : t.sql}</div>
                <div class="lab-tabla-scroll"><table>
                    <thead><tr>${t.columnas.map(c => html`<th>${c}</th>`)}</tr></thead>
                    <tbody>${t.filas.map(f => html`<tr>${f.map(v => (v === null ? html`<td class="lab-null">NULL</td>` : html`<td>${v}</td>`))}</tr>`)}</tbody>
                </table></div>
                <small class="lab-gris">${t.filas.length} fila(s)${t.filas.length >= 500 ? " (se muestran las primeras 500)" : ""}</small>
            </div>`);
        caja.innerHTML = html`${tablas}${r.error ? html`<pre class="lab-salida"><span class="lab-error">${r.error}</span></pre>` : ""}
            ${!r.error && !tablas.length ? html`<p class="lab-gris">Listo${r.cambios ? ` · ${r.cambios} fila(s) modificadas` : ""}. Agregá un SELECT para ver datos.</p>` : ""}`;
        ponerEstado(r.error ? "Terminó con un error" : `Terminó bien · ${r.ms} ms`, r.error ? "mal" : "ok");
    }

    // ---- vista previa (HTML) ----
    const iframe = $(".lab-preview");
    const consola = $(".lab-consola");
    function actualizarVista() {
        if (!iframe) return;
        consola.textContent = "";
        iframe.srcdoc = ESPIA + editor.valor();
        ponerEstado("Vista actualizada", "ok");
    }
    const alMensaje = ev => {
        if (!iframe || ev.source !== iframe.contentWindow || !ev.data?.fenLab) return;
        const linea = document.createElement("span");
        if (ev.data.t === "error") linea.className = "lab-error";
        linea.textContent = String(ev.data.m).slice(0, 5000) + "\n";
        consola.append(linea);
        consola.scrollTop = consola.scrollHeight;
    };
    if (iframe) { window.addEventListener("message", alMensaje); actualizarVista(); }

    // ---- pruebas ----
    const listaPruebas = $(".lab-pruebas");
    function dibujarPruebas(resultados = []) {
        if (!listaPruebas) return;
        listaPruebas.innerHTML = estado.pruebas.length ? html`${estado.pruebas.map((p, i) => {
            const r = resultados[i];
            return html`
            <div class="lab-prueba ${r ? (r.ok ? "ok" : "mal") : ""}" data-i="${i}">
                <div class="lab-prueba-cab"><b>Prueba ${i + 1}</b>
                    ${r ? html`<span class="lab-prueba-estado">${r.ok ? "✓ Pasó" : "✗ No pasó"}</span>` : ""}
                    <button type="button" class="lab-x" data-lab-quitar="${i}" aria-label="Quitar prueba ${i + 1}">×</button></div>
                <div class="lab-prueba-campos">
                    <label>Entrada<textarea data-campo="entrada" rows="2" spellcheck="false" autocapitalize="off">${p.entrada}</textarea></label>
                    <label>Salida esperada<textarea data-campo="esperada" rows="2" spellcheck="false" autocapitalize="off">${p.esperada}</textarea></label>
                </div>
                ${r && !r.ok ? html`<div class="lab-prueba-obtenida"><small>Salió:</small><pre>${r.error ? r.obtenida + (r.obtenida ? "\n" : "") : r.obtenida}${r.error ? html`<span class="lab-error">${r.error}</span>` : ""}</pre></div>` : ""}
            </div>`;
        })}` : html`<p class="lab-gris">No hay pruebas. Agregá una con su entrada y la salida esperada.</p>`;
    }
    listaPruebas?.addEventListener("input", ev => {
        const t = ev.target.closest("textarea[data-campo]");
        if (!t) return;
        estado.pruebas[Number(t.closest(".lab-prueba").dataset.i)][t.dataset.campo] = t.value;
        persistir();
    });
    listaPruebas?.addEventListener("click", ev => {
        const q = ev.target.closest("[data-lab-quitar]");
        if (!q) return;
        estado.pruebas.splice(Number(q.dataset.labQuitar), 1);
        persistir(); dibujarPruebas(); contador();
    });
    $("[data-lab-agregar]")?.addEventListener("click", () => {
        estado.pruebas.push({ entrada: "", esperada: "" });
        persistir(); dibujarPruebas(); contador();
        listaPruebas.querySelector(".lab-prueba:last-child textarea")?.focus();
    });
    function contador(texto = null) {
        const c = el.querySelector('[data-lab-pestana="pruebas"] .lab-contador');
        if (!c) return;
        c.hidden = !(texto ?? estado.pruebas.length);
        c.textContent = texto ?? estado.pruebas.length;
    }

    async function probar() {
        if (corriendo) return;
        mostrarVista("pruebas");
        verPanel();
        if (!estado.pruebas.length) { ponerEstado("Agregá al menos una prueba", "mal"); return; }
        editor.error(null);
        ocupado(true);
        const resultados = [];
        for (let i = 0; i < estado.pruebas.length; i++) {
            ponerEstado(`Probando ${i + 1} de ${estado.pruebas.length}…`);
            let obtenida = "";
            const p = estado.pruebas[i];
            const r = await ejecutor(lab).correr(
                { codigo: editor.valor(), entradas: lineasEntrada(p.entrada), prueba: true, traza: false },
                { alSalida: t => { if (obtenida.length < 20000) obtenida += t; }, alCargar: () => ponerEstado(cfg.cargando || "Cargando…"), limite: 5000 });
            if (r.detenido) { ocupado(false); ponerEstado("Detenido", "mal"); dibujarPruebas(resultados); return; }
            resultados.push({ ok: !r.error && normalizar(obtenida) === normalizar(p.esperada), obtenida: normalizar(obtenida), error: r.error });
            if (r.error && r.linea) editor.error(r.linea);
        }
        ocupado(false);
        dibujarPruebas(resultados);
        const bien = resultados.filter(r => r.ok).length;
        ponerEstado(`${bien} de ${resultados.length} pruebas pasaron`, bien === resultados.length ? "ok" : "mal");
        contador(`${bien}/${resultados.length}`);
    }

    // ---- paso a paso (prueba de escritorio) ----
    async function pasoAPaso() {
        if (corriendo) return;
        mostrarVista("paso");
        verPanel();
        const caja = $(".lab-traza");
        editor.error(null);
        ocupado(true);
        ponerEstado("Ejecutando paso a paso…");
        let texto = "";
        const r = await ejecutor(lab).correr(
            { codigo: editor.valor(), entradas: lineasEntrada(estado.entrada), prueba: true, traza: true },
            { alSalida: t => (texto += t) });
        ocupado(false);
        const filas = r.filas || [];
        const nombres = [];
        filas.forEach(f => f.vars && Object.keys(f.vars).forEach(k => !nombres.includes(k) && nombres.push(k)));
        let previo = {};
        const cuerpo = filas.map((f, i) => {
            if (f.corte) return html`<tr><td colspan="${nombres.length + 4}" class="lab-gris">… se muestran los primeros 1000 pasos</td></tr>`;
            const celdas = nombres.map(k => {
                const v = f.vars[k];
                const cambio = v !== undefined && v !== previo[k];
                return html`<td class="${cambio ? "cambio" : ""}">${v ?? ""}</td>`;
            });
            previo = f.vars;
            return html`<tr data-linea="${f.linea}"><td class="n">${i + 1}</td><td class="n">${f.linea}</td>
                <td class="lab-instr" title="${f.texto}">${f.nivel > 1 ? "↳ " : ""}${f.texto}${f.nota ? html` <span class="lab-nota ${f.nota === "VERDADERO" ? "v" : "f"}">${f.nota}</span>` : ""}</td>
                ${celdas}<td class="lab-salida-celda">${f.salida.replace(/\n$/, "").replace(/\n/g, " ⏎ ")}</td></tr>`;
        });
        caja.innerHTML = html`
            ${r.error ? html`<pre class="lab-salida"><span class="lab-error">${r.error}</span></pre>` : ""}
            ${filas.length ? html`<div class="lab-tabla-scroll"><table class="lab-traza-tabla">
                <thead><tr><th>Paso</th><th>Línea</th><th>Instrucción</th>${nombres.map(k => html`<th>${k}</th>`)}<th>Salida</th></tr></thead>
                <tbody>${cuerpo}</tbody></table></div>` : ""}`;
        caja.querySelectorAll("tr[data-linea]").forEach(tr => tr.addEventListener("click", () => {
            caja.querySelectorAll("tr.activa").forEach(x => x.classList.remove("activa"));
            tr.classList.add("activa");
            editor.marcar(Number(tr.dataset.linea));
        }));
        if (r.error) editor.error(r.linea);
        if (texto) salida.textContent = texto;
        ponerEstado(r.error ? "Terminó con un error" : `${filas.length} pasos`, r.error ? "mal" : "ok");
    }

    // ---- botones ----
    let ejemploTimer = null;
    el.addEventListener("click", ev => {
        const b = ev.target.closest("button");
        if (!b) return;
        if (b.dataset.labPestana) return mostrarVista(b.dataset.labPestana);
        if (b.hasAttribute("data-lab-ejecutar")) return lab === "web" ? actualizarVista() : ejecutarNormal();
        if (b.hasAttribute("data-lab-probar")) return probar();
        if (b.hasAttribute("data-lab-paso")) return pasoAPaso();
        if (b.hasAttribute("data-lab-detener")) return ejecutor(lab).detener();
        if (b.hasAttribute("data-lab-descargar")) {
            const url = URL.createObjectURL(new Blob([editor.valor()], { type: "text/plain;charset=utf-8" }));
            const a = Object.assign(document.createElement("a"), { href: url, download: `programa.${cfg.ext}` });
            document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return;
        }
        if (b.hasAttribute("data-lab-ejemplo")) {
            // Dos toques para confirmar: no se pierde el código por un clic sin querer.
            if (!b.classList.contains("confirmar") && editor.valor().trim() && editor.valor() !== cfg.ejemplo) {
                b.classList.add("confirmar"); b.textContent = "¿Reemplazar tu código?";
                clearTimeout(ejemploTimer);
                ejemploTimer = setTimeout(() => { b.classList.remove("confirmar"); b.textContent = "Ejemplo"; }, 3500);
                return;
            }
            clearTimeout(ejemploTimer);
            b.classList.remove("confirmar"); b.textContent = "Ejemplo";
            editor.poner(cfg.ejemplo);
            if (cfg.entrada !== undefined && entradaTa) { entradaTa.value = estado.entrada = cfg.entrada; }
            if (cfg.pruebas) { estado.pruebas = cfg.pruebas.map(p => ({ ...p })); dibujarPruebas(); contador(); }
            persistir();
            if (lab === "web") actualizarVista();
        }
    });

    dibujarPruebas();
    contador();

    // Python tarda en cargar: se empieza a descargar en cuanto se abre el apartado.
    if (cfg.persistente) {
        const precargar = () => { const ej = ejecutor(lab); if (!ej.w) ej.crear(() => ponerEstado(cfg.cargando)); ej.listo?.then(() => !corriendo && ponerEstado("Listo para ejecutar", "ok")).catch(err => ponerEstado(err.message, "mal")); };
        const panel = el.closest(".tab-content");
        if (!panel || panel.classList.contains("active-tab")) precargar();
        else {
            const obs = new MutationObserver(() => { if (panel.classList.contains("active-tab")) { obs.disconnect(); precargar(); } });
            obs.observe(panel, { attributes: true, attributeFilter: ["class"] });
        }
    }

    alSalir?.(() => {
        if (corriendo) ejecutor(lab).detener();
        window.removeEventListener("message", alMensaje);
        clearTimeout(guardarTimer);
        guardar(clave, estado);
    });
}
