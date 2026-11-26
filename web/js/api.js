// Cliente de Supabase y helpers para hablar con la base.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const configurado = !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_ANON_KEY.includes("TU-ANON");

export const sb = configurado ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const BUCKET = "archivos";
export const MAX_BYTES = 16 * 1024 * 1024;
export const EXT_ENTREGAS = ["pdf", "zip", "txt", "md", "py", "ipynb", "js", "ts", "html", "css", "sql", "java", "c", "cpp", "cs", "json"];
export const EXT_RECURSOS = [...EXT_ENTREGAS, "doc", "docx", "ppt", "pptx", "xls", "xlsx", "png", "jpg", "jpeg"];

/** Error con un mensaje en castellano para mostrar al usuario. */
export class ErrorFen extends Error {}

const TRADUCCIONES = [
    [/Invalid login credentials/i, "Correo o contraseña incorrectos."],
    [/Email not confirmed/i, "Tenés que confirmar tu correo: revisá tu bandeja de entrada (y spam)."],
    [/User already registered/i, "Ya existe una cuenta con ese correo."],
    [/Password should be at least/i, "La contraseña debe tener al menos 6 caracteres."],
    [/rate limit/i, "Demasiados intentos. Esperá un momento y probá de nuevo."],
    [/duplicate key.*usuario/i, "Ese nombre de usuario ya está en uso."],
    [/duplicate key.*codigo/i, "Ya existe un curso con ese código."],
    [/duplicate key/i, "Ese dato ya existe."],
    [/row-level security|permission denied/i, "No tenés permiso para hacer eso."],
    [/Payload too large|exceeded the maximum/i, "El archivo supera los 16 MB."],
    [/Failed to fetch|NetworkError/i, "No hay conexión con el servidor. Revisá tu internet."],
];

export function mensajeDeError(e) {
    const msg = e?.message || String(e);
    for (const [re, texto] of TRADUCCIONES) if (re.test(msg)) return texto;
    return msg;
}

/** Ejecuta una consulta de supabase-js y devuelve data, o lanza un ErrorFen. */
export async function q(promesa) {
    const { data, error } = await promesa;
    if (error) throw new ErrorFen(mensajeDeError(error));
    return data;
}

export const rpc = (fn, args = {}) => q(sb.rpc(fn, args));

/** Sube un archivo al bucket y devuelve su ruta. */
export async function subirArchivo(carpeta, archivo, extensiones) {
    const ext = (archivo.name.split(".").pop() || "").toLowerCase();
    if (!extensiones.includes(ext)) throw new ErrorFen(`Tipo de archivo no permitido (.${ext}). Permitidos: ${extensiones.join(", ")}.`);
    if (archivo.size > MAX_BYTES) throw new ErrorFen("El archivo supera los 16 MB.");
    const limpio = archivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
    const ruta = `${carpeta}/${Date.now()}-${limpio}`;
    await q(sb.storage.from(BUCKET).upload(ruta, archivo, { contentType: archivo.type || "application/octet-stream" }));
    return ruta;
}

/** Abre un archivo privado con un enlace temporal (60 s). */
export async function descargar(ruta, nombre) {
    const { signedUrl } = await q(sb.storage.from(BUCKET).createSignedUrl(ruta, 60, { download: nombre || true }));
    window.location.href = signedUrl;
}

export async function borrarArchivos(rutas) {
    const lista = rutas.filter(Boolean);
    if (lista.length) await sb.storage.from(BUCKET).remove(lista);
}

// ------------------------------------------------------------------ notas ---

/** Última entrega de cada actividad (las entregas vienen ordenadas o no). */
export function ultimaPorActividad(entregas) {
    const m = new Map();
    for (const e of entregas) {
        const prev = m.get(e.actividad_id);
        if (!prev || e.fecha_entrega > prev.fecha_entrega || (e.fecha_entrega === prev.fecha_entrega && e.id > prev.id)) m.set(e.actividad_id, e);
    }
    return m;
}

/** Nota del curso = Σ (nota de la actividad × su valor %), con la última entrega de cada actividad. */
export function resumen(actividades, ultimas) {
    let nota = 0, evaluado = 0, total = 0, entregadas = 0;
    for (const a of actividades) {
        const valor = Number(a.valor);
        total += valor;
        const e = ultimas.get(a.id);
        if (e) entregadas++;
        if (e && e.nota !== null) { nota += Number(e.nota) * valor / 100; evaluado += valor; }
    }
    const r2 = x => Math.round(x * 100) / 100;
    return {
        nota: r2(nota), evaluado: r2(evaluado), total: r2(total), entregadas, cantidad: actividades.length,
        porcentaje: actividades.length ? Math.round(entregadas * 100 / actividades.length) : 0,
    };
}

export const aporte = (a, e) => (e && e.nota !== null ? Math.round(Number(e.nota) * Number(a.valor)) / 100 : null);

/** Requisito de un curso: aprobar el nivel anterior más alto que exista en el mismo lenguaje. */
export function requisito(curso, cursos) {
    const mismos = cursos.filter(c => c.lenguaje.toLowerCase() === curso.lenguaje.toLowerCase() && c.nivel < curso.nivel);
    if (!mismos.length) return null;
    const nivel = Math.max(...mismos.map(c => c.nivel));
    return mismos.filter(c => c.nivel === nivel);
}

/** Mezcla determinista: cada estudiante ve siempre el mismo orden (distinto al de sus compañeros). */
export function mezclar(lista, semilla) {
    const r = [...lista];
    let s = 0;
    for (const ch of String(semilla)) s = (Math.imul(s, 31) + ch.charCodeAt(0)) | 0;
    const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) | 0; return ((s >>> 0) % 1e9) / 1e9; };
    for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
}
