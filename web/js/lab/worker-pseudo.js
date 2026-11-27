// Ejecuta pseudocódigo aislado de la página (worker propio, solo para pseudocódigo).
import { ejecutar } from "./pseudo.js";

self.onmessage = ({ data }) => {
    const { codigo, entradas, prueba, traza } = data;
    let buffer = "";
    const vaciar = () => { if (buffer) { postMessage({ tipo: "salida", texto: buffer }); buffer = ""; } };
    try {
        const r = ejecutar(codigo, {
            entradas, eco: !prueba, traza,
            escribir: s => { buffer += s; if (buffer.length > 4000) vaciar(); },
        });
        vaciar();
        postMessage({ tipo: "fin", filas: r.filas });
    } catch (err) {
        vaciar();
        postMessage({ tipo: "fin", error: err.message, linea: err.linea });
    }
};
