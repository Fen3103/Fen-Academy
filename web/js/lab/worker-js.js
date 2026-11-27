// Ejecuta JavaScript aislado de la página: sin acceso al DOM, a la sesión ni a Supabase.
// Se crea un worker nuevo en cada ejecución, así un programa no deja nada para el siguiente.

self.onmessage = async ({ data }) => {
    const { codigo, entradas, prueba } = data;
    const cola = [...entradas];
    const enviar = texto => postMessage({ tipo: "salida", texto });
    const mostrar = v => {
        if (typeof v === "string") return v;
        if (v === undefined) return "undefined";
        if (typeof v === "function") return `[Function ${v.name || "anónima"}]`;
        if (v instanceof Error) return `${v.name}: ${v.message}`;
        try { return JSON.stringify(v, (k, x) => (typeof x === "bigint" ? x + "n" : x)) ?? String(v); } catch { return String(v); }
    };
    const log = (...a) => enviar(a.map(mostrar).join(" ") + "\n");
    self.console = { log, info: log, warn: log, error: log, debug: log, table: log };
    self.prompt = (mensaje = "") => {
        if (!cola.length) throw new Error("prompt() necesita un dato: escribilo en «Entrada» (uno por línea)");
        const v = cola.shift();
        if (!prueba) enviar(`${mensaje}${v}\n`);
        return v;
    };
    self.alert = m => enviar(String(m ?? "") + "\n");

    try {
        const Asincrona = Object.getPrototypeOf(async function () {}).constructor;
        await new Asincrona(`"use strict";\n${codigo}\n//# sourceURL=programa.js`)();
        postMessage({ tipo: "fin" });
    } catch (err) {
        // Línea del error en el código del estudiante: el navegador agrega 2 líneas de encabezado y "use strict" otra.
        const m = String(err?.stack || "").match(/programa\.js:(\d+)/);
        const linea = m ? Number(m[1]) - 3 : null;
        const texto = err instanceof Error ? `${err.name}: ${err.message}` : `Error: ${mostrar(err)}`;
        postMessage({ tipo: "fin", error: linea > 0 ? `Línea ${linea}: ${texto}` : texto, linea: linea > 0 ? linea : null });
    }
};
