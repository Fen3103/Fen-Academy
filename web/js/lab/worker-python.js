// Ejecuta Python (Pyodide) aislado de la página, en un worker propio solo para Python.
// Pyodide se descarga la primera vez y queda en la caché del navegador.

importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const listo = loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" }).then(py => {
    py.runPython(`
import builtins, sys
_input_original = builtins.input
def _preparar(prueba):
    def entrada(mensaje=""):
        if not prueba:
            print(mensaje, end="")
        try:
            valor = _input_original()
        except EOFError:
            raise EOFError("input() necesita un dato: escribilo en «Entrada» (uno por línea)") from None
        if not prueba:
            print(valor)
        return valor
    builtins.input = entrada
`);
    postMessage({ tipo: "listo" });
    return py;
}).catch(err => {
    postMessage({ tipo: "fin", error: "No se pudo cargar Python. Revisá tu conexión a Internet y volvé a intentar. (" + err.message + ")" });
    throw err;
});

self.onmessage = async ({ data }) => {
    const py = await listo;
    const { codigo, entradas, prueba } = data;
    const cola = [...entradas];
    const decoder = new TextDecoder();
    py.setStdout({ write: buf => { postMessage({ tipo: "salida", texto: decoder.decode(buf) }); return buf.length; } });
    py.setStderr({ write: buf => { postMessage({ tipo: "salida", texto: decoder.decode(buf) }); return buf.length; } });
    py.setStdin({ stdin: () => (cola.length ? cola.shift() : undefined), autoEOF: true });
    try {
        py.globals.get("_preparar")(!!prueba);
        const espacio = py.globals.get("dict")();
        espacio.set("__name__", "__main__");
        await py.runPythonAsync(codigo, { globals: espacio, filename: "programa.py" });
        espacio.destroy();
        postMessage({ tipo: "fin" });
    } catch (err) {
        // Deja solo la parte del error que corresponde al código del estudiante.
        let texto = String(err.message || err);
        const i = texto.indexOf('File "programa.py"');
        if (i >= 0) texto = "Traceback (most recent call last):\n  " + texto.slice(i);
        const lineas = [...texto.matchAll(/File "programa\.py", line (\d+)/g)];
        const linea = lineas.length ? Number(lineas[lineas.length - 1][1]) : null;
        postMessage({ tipo: "fin", error: texto.trim(), linea });
    }
};
