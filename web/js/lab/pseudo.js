// Intérprete de pseudocódigo en español (sintaxis parecida a PSeInt, perfil flexible).
// No toca el DOM: lo usa worker-pseudo.js para ejecutar aislado de la página.
//
// Admite: Algoritmo/Proceso, Definir … Como, Dimension, Leer, Escribir (Sin Saltar),
// asignación con <- o =, Si/SiNo, Según, Mientras, Repetir … Hasta Que, Para … Con Paso,
// Funcion/SubProceso (con Por Referencia), arreglos desde 1 y funciones de texto y matemáticas.

export class ErrorPseudo extends Error {
    constructor(mensaje, linea) { super(linea ? `Línea ${linea}: ${mensaje}` : mensaje); this.linea = linea; }
}

const sinTildes = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// ------------------------------------------------------------ léxico ---

function tokenizar(texto, linea) {
    const t = [];
    let i = 0;
    while (i < texto.length) {
        const c = texto[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === "/" && texto[i + 1] === "/") break;                       // comentario
        if (`"'“”‘’`.includes(c)) {
            // Los teclados de celular ponen comillas “curvas”: valen igual que las rectas.
            const cierres = `"“”`.includes(c) ? `"“”` : `'‘’`;
            let j = i + 1;
            while (j < texto.length && !cierres.includes(texto[j])) j++;
            if (j >= texto.length) throw new ErrorPseudo("falta cerrar las comillas del texto", linea);
            t.push({ k: "txt", v: texto.slice(i + 1, j) });
            i = j + 1; continue;
        }
        const num = texto.slice(i).match(/^\d+(\.\d+)?/);
        if (num) { t.push({ k: "num", v: Number(num[0]) }); i += num[0].length; continue; }
        const id = texto.slice(i).match(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ_]*/);
        if (id) { t.push({ k: "id", v: id[0], n: sinTildes(id[0]) }); i += id[0].length; continue; }
        const op = ["<-", "<=", ">=", "<>", "==", "!=", "&&", "||"].find(o => texto.startsWith(o, i));
        if (op) { t.push({ k: "op", v: { "&&": "&", "||": "|" }[op] || op }); i += 2; continue; }
        if (c === "←") { t.push({ k: "op", v: "<-" }); i++; continue; }
        if ("+-*/^%()[],:;=<>&|~".includes(c)) { t.push({ k: "op", v: c }); i++; continue; }
        throw new ErrorPseudo(`no se reconoce el símbolo «${c}»`, linea);
    }
    return t;
}

// --------------------------------------------------------- expresiones ---

class Lector {
    constructor(toks, linea) { this.t = toks; this.i = 0; this.linea = linea; }
    ver(o = 0) { return this.t[this.i + o]; }
    fin() { return this.i >= this.t.length; }
    es(v) { const x = this.ver(); return x && (x.k === "op" ? x.v === v : x.k === "id" && x.n === v); }
    tomar(v) { if (this.es(v)) { this.i++; return true; } return false; }
    exigir(v, que) { if (!this.tomar(v)) throw new ErrorPseudo(que || `se esperaba «${v}»`, this.linea); }
    error(m) { throw new ErrorPseudo(m, this.linea); }

    expr() { return this.o(); }
    o() { let a = this.y(); while (this.tomar("O") || this.tomar("|")) a = { k: "bin", op: "O", a, b: this.y() }; return a; }
    y() { let a = this.no(); while (this.tomar("Y") || this.tomar("&")) a = { k: "bin", op: "Y", a, b: this.no() }; return a; }
    no() { if (this.tomar("NO") || this.tomar("~")) return { k: "no", a: this.no() }; return this.comp(); }
    comp() {
        let a = this.suma();
        for (;;) {
            const x = this.ver();
            if (!x || x.k !== "op" || !["=", "==", "<>", "!=", "<", ">", "<=", ">="].includes(x.v)) return a;
            this.i++;
            const op = { "==": "=", "!=": "<>" }[x.v] || x.v;
            a = { k: "bin", op, a, b: this.suma() };
        }
    }
    suma() {
        let a = this.mult();
        for (;;) {
            if (this.tomar("+")) a = { k: "bin", op: "+", a, b: this.mult() };
            else if (this.tomar("-")) a = { k: "bin", op: "-", a, b: this.mult() };
            else return a;
        }
    }
    mult() {
        let a = this.unario();
        for (;;) {
            if (this.tomar("*")) a = { k: "bin", op: "*", a, b: this.unario() };
            else if (this.tomar("/")) a = { k: "bin", op: "/", a, b: this.unario() };
            else if (this.tomar("%") || this.tomar("MOD")) a = { k: "bin", op: "MOD", a, b: this.unario() };
            else return a;
        }
    }
    unario() {
        if (this.tomar("-")) return { k: "neg", a: this.unario() };
        if (this.tomar("+")) return this.unario();
        return this.potencia();
    }
    potencia() {
        const a = this.primario();
        if (this.tomar("^")) return { k: "bin", op: "^", a, b: this.unario() };
        return a;
    }
    primario() {
        const x = this.ver();
        if (!x) this.error("falta una expresión");
        if (x.k === "num") { this.i++; return { k: "val", v: x.v }; }
        if (x.k === "txt") { this.i++; return { k: "val", v: x.v }; }
        if (this.tomar("(")) { const e = this.expr(); this.exigir(")", "falta cerrar un paréntesis «)»"); return e; }
        if (x.k === "id") {
            this.i++;
            if (x.n === "VERDADERO") return { k: "val", v: true };
            if (x.n === "FALSO") return { k: "val", v: false };
            if (this.tomar("(")) {
                const args = [];
                if (!this.tomar(")")) {
                    do args.push(this.expr()); while (this.tomar(","));
                    this.exigir(")", `falta cerrar el paréntesis de ${x.v}(…)`);
                }
                return { k: "llamar", n: x.n, nombre: x.v, args };
            }
            if (this.tomar("[")) {
                const idx = [];
                do idx.push(this.expr()); while (this.tomar(","));
                this.exigir("]", `falta cerrar el corchete de ${x.v}[…]`);
                return { k: "var", n: x.n, nombre: x.v, idx };
            }
            return { k: "var", n: x.n, nombre: x.v };
        }
        this.error(`no se esperaba «${x.v}»`);
    }
    destino() {
        const x = this.ver();
        if (!x || x.k !== "id") this.error("se esperaba el nombre de una variable");
        const e = this.primario();
        if (e.k !== "var") this.error(`«${x.v}» no es una variable`);
        return e;
    }
}

// ----------------------------------------------------------- sentencias ---

const ABRE = { SI: "FINSI", MIENTRAS: "FINMIENTRAS", PARA: "FINPARA", SEGUN: "FINSEGUN", REPETIR: "HASTA QUE",
    ALGORITMO: "FINALGORITMO", PROCESO: "FINPROCESO", FUNCION: "FINFUNCION", SUBPROCESO: "FINSUBPROCESO" };
const NOMBRE = { FINSI: "FinSi", FINMIENTRAS: "FinMientras", FINPARA: "FinPara", FINSEGUN: "FinSegún",
    FINALGORITMO: "FinAlgoritmo", FINPROCESO: "FinProceso", FINFUNCION: "FinFunción", FINSUBPROCESO: "FinSubProceso" };

/** Primera palabra clave de la línea, uniendo las de dos palabras ("Fin Si", "Si No", "Hasta Que"). */
function clave(toks) {
    const a = toks[0]?.k === "id" ? toks[0].n : null, b = toks[1]?.k === "id" ? toks[1].n : null;
    if (!a) return [null, 0];
    if (a === "FIN" && b) return ["FIN" + b, 2];
    if (a === "SI" && b === "NO") return ["SINO", 2];
    if (a === "HASTA" && b === "QUE") return ["HASTA QUE", 2];
    if (a === "MIENTRAS" && b === "QUE") return ["MIENTRAS QUE", 2];
    if (a === "DE" && b === "OTRO" && toks[2]?.n === "MODO") return ["DE OTRO MODO", 3];
    if (a === "OTRO" && b === "MODO") return ["DE OTRO MODO", 2];
    if (a === "DIMENSIONAR") return ["DIMENSION", 1];
    if (a === "IMPRIMIR" || a === "MOSTRAR") return ["ESCRIBIR", 1];
    if (a === "FINSEGUN" || a === "FINSEGÚN") return ["FINSEGUN", 1];
    return [a, 1];
}

export function analizar(fuente) {
    // Líneas → tokens. Un ";" fuera de texto separa sentencias.
    const lineas = [];
    fuente.split(/\r?\n/).forEach((txt, i) => {
        const toks = tokenizar(txt, i + 1);
        let actual = [];
        for (const t of toks) {
            if (t.k === "op" && t.v === ";") { if (actual.length) lineas.push({ n: i + 1, t: actual }); actual = []; }
            else actual.push(t);
        }
        if (actual.length) lineas.push({ n: i + 1, t: actual });
    });

    let p = 0;
    const funciones = {};
    let principal = null;

    function bloque(cierres, abre) {
        const cuerpo = [];
        for (;;) {
            if (p >= lineas.length) {
                if (!abre) return { cuerpo, cierre: null };
                const esperado = cierres.map(c => NOMBRE[c] || (c === "HASTA QUE" ? "Hasta Que" : c)).join(" o ");
                throw new ErrorPseudo(`falta ${esperado} para el ${abre.nombre} de la línea ${abre.linea}`);
            }
            const L = lineas[p];
            const [k] = clave(L.t);
            if (cierres.includes(k)) return { cuerpo, cierre: k, linea: L };
            if (abre && k?.startsWith("FIN") && NOMBRE[k]) {
                const esperado = cierres.filter(c => NOMBRE[c] || c === "HASTA QUE").map(c => NOMBRE[c] || "Hasta Que")[0];
                throw new ErrorPseudo(`falta ${esperado} para cerrar el ${abre.nombre} de la línea ${abre.linea} (llegó ${NOMBRE[k]} antes)`, L.n);
            }
            if (abre?.segun && esCaso(L)) return { cuerpo, cierre: "CASO", linea: L };
            p++;
            cuerpo.push(sentencia(L));
        }
    }

    function esCaso(L) {
        let nivel = 0;
        for (const t of L.t) {
            if (t.k === "op" && (t.v === "(" || t.v === "[")) nivel++;
            if (t.k === "op" && (t.v === ")" || t.v === "]")) nivel--;
            if (t.k === "op" && t.v === ":" && nivel === 0) return true;
        }
        return false;
    }

    function resto(L, desde) { return new Lector(L.t.slice(desde), L.n); }

    function sentencia(L) {
        const [k, usados] = clave(L.t);
        const r = resto(L, usados);
        const n = L.n;
        const nombre = L.t[0]?.v;
        const terminar = () => { if (!r.fin()) r.error(`sobra «${r.ver().v}» al final de la instrucción`); };
        switch (k) {
            case "DEFINIR": {
                const vars = [];
                do { const x = r.ver(); if (x?.k !== "id") r.error("se esperaba el nombre de una variable"); r.i++; vars.push(x); } while (r.tomar(","));
                let tipo = null;
                if (r.tomar("COMO") || r.tomar("ES")) {
                    const x = r.ver(); if (x?.k !== "id") r.error("falta el tipo (Entero, Real, Cadena o Lógico)"); r.i++;
                    tipo = { ENTERO: "entero", REAL: "real", NUMERO: "real", NUMERICO: "real", CADENA: "texto", TEXTO: "texto",
                        CARACTER: "texto", LOGICO: "logico", BOOLEANO: "logico" }[x.n];
                    if (!tipo) r.error(`el tipo «${x.v}» no existe; usá Entero, Real, Cadena o Lógico`);
                } else r.error("falta «Como» y el tipo, por ejemplo: Definir edad Como Entero");
                terminar();
                return { k: "definir", n, vars, tipo };
            }
            case "DIMENSION": {
                const arr = [];
                do {
                    const x = r.ver(); if (x?.k !== "id") r.error("se esperaba el nombre del arreglo"); r.i++;
                    r.exigir("[", `falta el tamaño entre corchetes, por ejemplo: Dimension ${x.v}[10]`);
                    const dims = []; do dims.push(r.expr()); while (r.tomar(","));
                    r.exigir("]", "falta cerrar el corchete «]»");
                    arr.push({ x, dims });
                } while (r.tomar(","));
                terminar();
                return { k: "dimension", n, arr };
            }
            case "ESCRIBIR": {
                const partes = [];
                let saltar = true;
                if (!r.fin()) do {
                    if (r.es("SIN") && ["SALTAR", "BAJAR"].includes(r.ver(1)?.n)) break;
                    partes.push(r.expr());
                } while (r.tomar(","));
                if (r.tomar("SIN")) { if (!r.tomar("SALTAR") && !r.tomar("BAJAR")) r.error("se esperaba «Sin Saltar»"); saltar = false; }
                terminar();
                return { k: "escribir", n, partes, saltar };
            }
            case "LEER": {
                const dest = [];
                do dest.push(r.destino()); while (r.tomar(","));
                terminar();
                return { k: "leer", n, dest };
            }
            case "SI": {
                const cond = r.expr();
                r.tomar("ENTONCES");
                terminar();
                if (lineas[p] && clave(lineas[p].t)[0] === "ENTONCES" && lineas[p].t.length === 1) p++;
                const abre = { nombre: "Si", linea: n };
                const a = bloque(["SINO", "FINSI"], abre);
                p++;
                let sino = [];
                if (a.cierre === "SINO") { sino = bloque(["FINSI"], abre).cuerpo; p++; }
                return { k: "si", n, cond, entonces: a.cuerpo, sino };
            }
            case "MIENTRAS": {
                const cond = r.expr(); r.tomar("HACER"); terminar();
                const b = bloque(["FINMIENTRAS"], { nombre: "Mientras", linea: n }); p++;
                return { k: "mientras", n, cond, cuerpo: b.cuerpo };
            }
            case "REPETIR": {
                terminar();
                const b = bloque(["HASTA QUE", "MIENTRAS QUE"], { nombre: "Repetir", linea: n }); p++;
                const [kc, u] = clave(b.linea.t);
                const rc = resto(b.linea, u);
                const cond = rc.expr();
                if (!rc.fin()) rc.error(`sobra «${rc.ver().v}»`);
                return { k: "repetir", n, cuerpo: b.cuerpo, cond, hasta: kc === "HASTA QUE", nCond: b.linea.n };
            }
            case "PARA": {
                if (r.es("CADA")) r.error("«Para Cada» no está disponible; usá Para i <- 1 Hasta n");
                const v = r.destino();
                if (!r.tomar("<-") && !r.tomar("=")) r.error("falta el valor inicial, por ejemplo: Para i <- 1 Hasta 10 Hacer");
                const desde = r.expr();
                r.exigir("HASTA", "falta «Hasta» en el Para");
                const hasta = r.expr();
                let paso = null;
                if (r.tomar("CON")) { r.exigir("PASO", "se esperaba «Con Paso»"); paso = r.expr(); }
                r.tomar("HACER"); terminar();
                const b = bloque(["FINPARA"], { nombre: "Para", linea: n }); p++;
                return { k: "para", n, v, desde, hasta, paso, cuerpo: b.cuerpo };
            }
            case "SEGUN": {
                const valor = r.expr(); r.tomar("HACER"); terminar();
                const abre = { nombre: "Según", linea: n, segun: true };
                const casos = [];
                let otro = null;
                const previo = bloque(["FINSEGUN", "DE OTRO MODO"], abre);
                if (previo.cuerpo.length) throw new ErrorPseudo("dentro de Según, cada opción empieza con su valor y dos puntos, por ejemplo: 1:", previo.cuerpo[0].n);
                let actual = previo;
                while (actual.cierre === "CASO" || actual.cierre === "DE OTRO MODO") {
                    const L = actual.linea;
                    p++;
                    let i = 0, nivel = 0;
                    for (; i < L.t.length; i++) {
                        const t = L.t[i];
                        if (t.k === "op" && (t.v === "(" || t.v === "[")) nivel++;
                        if (t.k === "op" && (t.v === ")" || t.v === "]")) nivel--;
                        if (t.k === "op" && t.v === ":" && nivel === 0) break;
                    }
                    const despues = L.t.slice(i + 1);
                    const extra = despues.length ? [sentencia({ n: L.n, t: despues })] : [];
                    if (actual.cierre === "DE OTRO MODO") {
                        const b = bloque(["FINSEGUN"], abre);
                        otro = [...extra, ...b.cuerpo];
                        actual = b;
                        break;
                    }
                    const rv = new Lector(L.t.slice(0, i), L.n);
                    const valores = []; do valores.push(rv.expr()); while (rv.tomar(","));
                    if (!rv.fin()) rv.error(`sobra «${rv.ver().v}» antes de los dos puntos`);
                    const b = bloque(["FINSEGUN", "DE OTRO MODO"], abre);
                    casos.push({ valores, cuerpo: [...extra, ...b.cuerpo], n: L.n });
                    actual = b;
                }
                p++;
                return { k: "segun", n, valor, casos, otro };
            }
            case "ESPERAR": return { k: "nada", n };
            case "BORRAR": case "LIMPIAR": return { k: "limpiar", n };
            case "ENTONCES": throw new ErrorPseudo("«Entonces» sin un «Si» antes", n);
            case "SINO": throw new ErrorPseudo("«SiNo» sin un «Si» antes", n);
            case "HACER": throw new ErrorPseudo("«Hacer» suelto: va al final de la línea del Mientras, Para o Según", n);
        }
        if (k?.startsWith("FIN")) throw new ErrorPseudo(`«${L.t.slice(0, usados).map(x => x.v).join(" ")}» sin un bloque abierto que cerrar`, n);
        if (["ALGORITMO", "PROCESO", "FUNCION", "SUBPROCESO"].includes(k)) throw new ErrorPseudo(`no se puede abrir ${nombre} dentro de otro bloque; ¿falta cerrar el anterior?`, n);

        // Asignación o llamada a subproceso.
        const r2 = new Lector(L.t, n);
        const x = r2.ver();
        if (x?.k === "id") {
            if (r2.ver(1)?.k === "op" && r2.ver(1).v === "(") {
                const e = r2.primario();
                if (r2.fin()) return { k: "llamada", n, e };
                r2.i = 0;
            }
            const dest = r2.destino();
            if (r2.tomar("<-") || r2.tomar("=")) {
                const valor = r2.expr();
                if (!r2.fin()) r2.error(`sobra «${r2.ver().v}» al final de la asignación`);
                return { k: "asignar", n, dest, valor };
            }
            if (r2.fin()) throw new ErrorPseudo(`no se entiende «${x.v}»: ¿falta «<-» para asignarle un valor?`, n);
        }
        throw new ErrorPseudo(`no se entiende la instrucción «${L.t.map(t => t.k === "txt" ? `"${t.v}"` : t.v).join(" ")}»`, n);
    }

    while (p < lineas.length) {
        const L = lineas[p];
        const [k, usados] = clave(L.t);
        if (k === "ALGORITMO" || k === "PROCESO") {
            if (principal) throw new ErrorPseudo("solo puede haber un Algoritmo", L.n);
            p++;
            const b = bloque([ABRE[k]], { nombre: k === "ALGORITMO" ? "Algoritmo" : "Proceso", linea: L.n });
            p++;
            principal = { cuerpo: b.cuerpo, n: L.n, fin: b.linea.n };
        } else if (k === "FUNCION" || k === "SUBPROCESO") {
            const r = resto(L, usados);
            let ret = null;
            const x = r.ver();
            if (x?.k !== "id") r.error("falta el nombre de la función");
            if (r.ver(1)?.k === "op" && (r.ver(1).v === "<-" || r.ver(1).v === "=")) { ret = x; r.i += 2; }
            const nom = r.ver();
            if (nom?.k !== "id") r.error("falta el nombre de la función");
            r.i++;
            const params = [];
            if (r.tomar("(")) {
                if (!r.tomar(")")) {
                    do {
                        const pr = r.ver(); if (pr?.k !== "id") r.error("se esperaba el nombre de un parámetro"); r.i++;
                        let ref = false;
                        if (r.tomar("POR")) { if (r.tomar("REFERENCIA")) ref = true; else r.exigir("VALOR", "se esperaba «Por Valor» o «Por Referencia»"); }
                        params.push({ x: pr, ref });
                    } while (r.tomar(","));
                    r.exigir(")", "falta cerrar el paréntesis de los parámetros");
                }
            }
            if (!r.fin()) r.error(`sobra «${r.ver().v}»`);
            p++;
            const b = bloque([ABRE[k], "FINFUNCION", "FINSUBPROCESO"], { nombre: k === "FUNCION" ? "Función" : "SubProceso", linea: L.n });
            p++;
            if (funciones[nom.n]) throw new ErrorPseudo(`la función ${nom.v} ya existe`, L.n);
            funciones[nom.n] = { nombre: nom.v, ret, params, cuerpo: b.cuerpo, n: L.n };
        } else if (!L.t.length) p++;
        else throw new ErrorPseudo(principal ? "hay instrucciones después de FinAlgoritmo" : "el programa debe empezar con «Algoritmo nombre» y terminar con «FinAlgoritmo»", L.n);
    }
    if (!principal) throw new ErrorPseudo("falta el bloque «Algoritmo nombre» … «FinAlgoritmo»");
    return { principal, funciones };
}

// ----------------------------------------------------------- ejecución ---

class Arreglo {
    constructor(dims) { this.dims = dims; this.datos = new Array(dims.reduce((a, b) => a * b, 1)).fill(undefined); }
    pos(idx, nombre, n) {
        if (idx.length !== this.dims.length) throw new ErrorPseudo(`${nombre} tiene ${this.dims.length} dimensión(es) y se usaron ${idx.length} índices`, n);
        let p = 0;
        idx.forEach((v, i) => {
            if (typeof v !== "number" || !Number.isInteger(v)) throw new ErrorPseudo(`el índice de ${nombre} debe ser un número entero`, n);
            if (v < 1 || v > this.dims[i]) throw new ErrorPseudo(`el índice ${v} está fuera de ${nombre} (va de 1 a ${this.dims[i]})`, n);
            p = p * this.dims[i] + (v - 1);
        });
        return p;
    }
}

export function formatear(v) {
    if (v === true) return "VERDADERO";
    if (v === false) return "FALSO";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
    if (v instanceof Arreglo) return "[" + v.datos.map(x => (x === undefined ? "?" : formatear(x))).join(", ") + "]";
    return String(v);
}

const MAX_PASOS = 2_000_000;
const MAX_TRAZA = 1000;

/**
 * Ejecuta el programa.
 * entradas: datos para Leer (uno por línea). eco: mostrar en la salida lo que se leyó.
 * traza: guardar la prueba de escritorio (variables después de cada paso).
 */
export function ejecutar(fuente, { entradas = [], eco = true, traza = false, escribir = () => {} } = {}) {
    const prog = analizar(fuente);
    const lineasFuente = fuente.split(/\r?\n/);
    const cola = [...entradas];
    let pasos = 0;
    const filas = [];
    let salidaPaso = "";
    const out = s => { salidaPaso += s; escribir(s); };

    const marco = () => ({ vars: new Map(), tipos: new Map(), nombres: new Map() });
    let pila = [marco()];
    const actual = () => pila[pila.length - 1];

    function registrar(n, nota) {
        if (++pasos > MAX_PASOS) throw new ErrorPseudo("el programa dio demasiados pasos; ¿hay un ciclo que nunca termina?", n);
        if (!traza) return;
        if (filas.length >= MAX_TRAZA) { if (filas.length === MAX_TRAZA) filas.push({ corte: true }); salidaPaso = ""; return; }
        const m = actual();
        const vars = {};
        for (const [k, v] of m.vars) vars[m.nombres.get(k) || k] = v === undefined ? "" : formatear(v);
        filas.push({ linea: n, texto: (lineasFuente[n - 1] || "").trim(), nota, vars, salida: salidaPaso, nivel: pila.length });
        salidaPaso = "";
    }

    function convertirPorTipo(v, tipo, n, nombre) {
        if (!tipo || v === undefined) return v;
        if (tipo === "entero" || tipo === "real") {
            if (typeof v !== "number") throw new ErrorPseudo(`${nombre} es numérica y se le quiso guardar ${typeof v === "boolean" ? "un valor lógico" : `el texto "${v}"`}`, n);
            if (tipo === "entero" && !Number.isInteger(v)) throw new ErrorPseudo(`${nombre} es Entero y se le quiso guardar ${formatear(v)}; usá trunc() o redon(), o definila como Real`, n);
        }
        if (tipo === "texto" && typeof v !== "string") return formatear(v);
        if (tipo === "logico" && typeof v !== "boolean") throw new ErrorPseudo(`${nombre} es Lógica y solo guarda VERDADERO o FALSO`, n);
        return v;
    }

    function leerVar(e, n) {
        const m = actual();
        if (!m.vars.has(e.n) || (m.vars.get(e.n) === undefined && !e.idx)) {
            if (!m.vars.has(e.n)) throw new ErrorPseudo(`la variable ${e.nombre} no existe o no tiene valor todavía`, n);
            throw new ErrorPseudo(`la variable ${e.nombre} todavía no tiene valor`, n);
        }
        const v = m.vars.get(e.n);
        if (e.idx) {
            if (!(v instanceof Arreglo)) throw new ErrorPseudo(`${e.nombre} no es un arreglo; ¿falta Dimension ${e.nombre}[…]?`, n);
            const x = v.datos[v.pos(e.idx.map(i => valor(i, n)), e.nombre, n)];
            if (x === undefined) throw new ErrorPseudo(`${e.nombre}[${e.idx.map(i => formatear(valor(i, n))).join(",")}] todavía no tiene valor`, n);
            return x;
        }
        return v;
    }

    function guardar(e, v, n) {
        const m = actual();
        if (e.idx) {
            const arr = m.vars.get(e.n);
            if (!(arr instanceof Arreglo)) throw new ErrorPseudo(`${e.nombre} no es un arreglo; primero escribí Dimension ${e.nombre}[tamaño]`, n);
            arr.datos[arr.pos(e.idx.map(i => valor(i, n)), e.nombre, n)] = convertirPorTipo(v, m.tipos.get(e.n), n, e.nombre);
            return;
        }
        if (m.vars.get(e.n) instanceof Arreglo && !(v instanceof Arreglo)) throw new ErrorPseudo(`${e.nombre} es un arreglo; indicá la posición, por ejemplo ${e.nombre}[1]`, n);
        m.vars.set(e.n, convertirPorTipo(v, m.tipos.get(e.n), n, e.nombre));
        if (!m.nombres.has(e.n)) m.nombres.set(e.n, e.nombre);
    }

    const num = (v, n, que) => {
        if (typeof v !== "number") throw new ErrorPseudo(`${que} necesita números y recibió ${typeof v === "string" ? `el texto "${v}"` : formatear(v)}`, n);
        return v;
    };
    const igual = (a, b) => (typeof a === "string" && typeof b === "string" ? a === b : a === b);

    const NATIVAS = {
        RC: [1, (a, n) => { if (num(a, n, "rc") < 0) throw new ErrorPseudo("no existe la raíz de un número negativo", n); return Math.sqrt(a); }],
        RAIZ: [1, (a, n) => NATIVAS.RC[1](a, n)],
        ABS: [1, (a, n) => Math.abs(num(a, n, "abs"))],
        LN: [1, (a, n) => Math.log(num(a, n, "ln"))],
        EXP: [1, (a, n) => Math.exp(num(a, n, "exp"))],
        SEN: [1, (a, n) => Math.sin(num(a, n, "sen"))],
        COS: [1, (a, n) => Math.cos(num(a, n, "cos"))],
        TAN: [1, (a, n) => Math.tan(num(a, n, "tan"))],
        ASEN: [1, (a, n) => Math.asin(num(a, n, "asen"))],
        ACOS: [1, (a, n) => Math.acos(num(a, n, "acos"))],
        ATAN: [1, (a, n) => Math.atan(num(a, n, "atan"))],
        TRUNC: [1, (a, n) => Math.trunc(num(a, n, "trunc"))],
        REDON: [1, (a, n) => Math.round(num(a, n, "redon"))],
        AZAR: [1, (a, n) => Math.floor(Math.random() * num(a, n, "azar"))],
        ALEATORIO: [2, (a, b, n) => Math.floor(num(a, n, "aleatorio") + Math.random() * (num(b, n, "aleatorio") - a + 1))],
        LONGITUD: [1, a => String(a).length],
        MAYUSCULAS: [1, a => String(a).toUpperCase()],
        MINUSCULAS: [1, a => String(a).toLowerCase()],
        SUBCADENA: [3, (s, a, b, n) => String(s).slice(num(a, n, "subcadena") - 1, num(b, n, "subcadena"))],
        CONCATENAR: [2, (a, b) => String(a) + String(b)],
        CONVERTIRANUMERO: [1, (a, n) => { const x = Number(String(a).trim().replace(",", ".")); if (String(a).trim() === "" || Number.isNaN(x)) throw new ErrorPseudo(`"${a}" no es un número`, n); return x; }],
        CONVERTIRATEXTO: [1, a => formatear(a)],
        PI: [0, () => Math.PI],
    };

    function valor(e, n) {
        switch (e.k) {
            case "val": return e.v;
            case "var":
                if (e.n === "PI" && !actual().vars.has("PI")) return Math.PI;
                return leerVar(e, n);
            case "neg": return -num(valor(e.a, n), n, "el signo menos");
            case "no": {
                const a = valor(e.a, n);
                if (typeof a !== "boolean") throw new ErrorPseudo("NO solo se aplica a valores lógicos (VERDADERO o FALSO)", n);
                return !a;
            }
            case "llamar": return llamar(e, n);
            case "bin": {
                if (e.op === "Y" || e.op === "O") {
                    const a = valor(e.a, n);
                    if (typeof a !== "boolean") throw new ErrorPseudo(`${e.op} une condiciones; a su izquierda hay ${formatear(a)}`, n);
                    if (e.op === "Y" && !a) return false;
                    if (e.op === "O" && a) return true;
                    const b = valor(e.b, n);
                    if (typeof b !== "boolean") throw new ErrorPseudo(`${e.op} une condiciones; a su derecha hay ${formatear(b)}`, n);
                    return b;
                }
                const a = valor(e.a, n), b = valor(e.b, n);
                switch (e.op) {
                    case "+":
                        if (typeof a === "string" || typeof b === "string") return formatear(a) + formatear(b);
                        return num(a, n, "la suma") + num(b, n, "la suma");
                    case "-": return num(a, n, "la resta") - num(b, n, "la resta");
                    case "*": return num(a, n, "la multiplicación") * num(b, n, "la multiplicación");
                    case "/":
                        if (num(b, n, "la división") === 0) throw new ErrorPseudo("división entre cero", n);
                        return num(a, n, "la división") / b;
                    case "MOD":
                        if (num(b, n, "MOD") === 0) throw new ErrorPseudo("MOD entre cero", n);
                        return num(a, n, "MOD") % b;
                    case "^": return Math.pow(num(a, n, "la potencia"), num(b, n, "la potencia"));
                    case "=": return igual(a, b);
                    case "<>": return !igual(a, b);
                    default: {
                        if (typeof a !== typeof b) throw new ErrorPseudo(`no se puede comparar ${formatear(a)} con ${formatear(b)}`, n);
                        return { "<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b }[e.op];
                    }
                }
            }
        }
    }

    function llamar(e, n) {
        const f = prog.funciones[e.n];
        if (!f) {
            const nat = NATIVAS[e.n];
            if (!nat) throw new ErrorPseudo(`la función ${e.nombre} no existe`, n);
            if (e.args.length !== nat[0]) throw new ErrorPseudo(`${e.nombre.toLowerCase()} necesita ${nat[0]} dato(s) y recibió ${e.args.length}`, n);
            return nat[1](...e.args.map(a => valor(a, n)), n);
        }
        if (e.args.length !== f.params.length) throw new ErrorPseudo(`${f.nombre} necesita ${f.params.length} dato(s) y recibió ${e.args.length}`, n);
        if (pila.length > 500) throw new ErrorPseudo("demasiadas llamadas una dentro de otra; ¿la función se llama a sí misma sin parar?", n);
        const args = e.args.map(a => valor(a, n));
        const m = marco();
        f.params.forEach((p, i) => { m.vars.set(p.x.n, args[i]); m.nombres.set(p.x.n, p.x.v); });
        pila.push(m);
        try {
            correr(f.cuerpo);
        } finally {
            pila.pop();
        }
        // Por Referencia: el valor final vuelve a la variable que se pasó.
        f.params.forEach((p, i) => {
            if (p.ref && e.args[i].k === "var" && !(args[i] instanceof Arreglo)) guardar(e.args[i], m.vars.get(p.x.n), n);
        });
        if (f.ret) {
            if (!m.vars.has(f.ret.n) || m.vars.get(f.ret.n) === undefined) throw new ErrorPseudo(`la función ${f.nombre} terminó sin darle valor a ${f.ret.v}`, f.n);
            return m.vars.get(f.ret.n);
        }
        return undefined;
    }

    function cond(e, n, que) {
        const v = valor(e, n);
        if (typeof v !== "boolean") throw new ErrorPseudo(`la condición del ${que} debe ser VERDADERO o FALSO, y dio ${formatear(v)}`, n);
        return v;
    }

    function correr(lista) {
        for (const s of lista) paso(s);
    }

    function paso(s) {
        const n = s.n;
        switch (s.k) {
            case "nada": registrar(n); return;
            case "limpiar": registrar(n); return;
            case "definir": {
                const m = actual();
                for (const x of s.vars) {
                    m.tipos.set(x.n, s.tipo);
                    if (!m.vars.has(x.n)) m.vars.set(x.n, undefined);
                    m.nombres.set(x.n, x.v);
                }
                registrar(n); return;
            }
            case "dimension": {
                const m = actual();
                for (const { x, dims } of s.arr) {
                    const d = dims.map(e => valor(e, n));
                    d.forEach(v => { if (!Number.isInteger(v) || v < 1) throw new ErrorPseudo(`el tamaño de ${x.v} debe ser un entero mayor que 0`, n); });
                    m.vars.set(x.n, new Arreglo(d));
                    m.nombres.set(x.n, x.v);
                }
                registrar(n); return;
            }
            case "escribir": {
                const texto = s.partes.map(p => formatear(valor(p, n))).join("");
                out(texto + (s.saltar ? "\n" : ""));
                registrar(n); return;
            }
            case "leer": {
                for (const d of s.dest) {
                    if (!cola.length) throw new ErrorPseudo(`Leer ${d.nombre} necesita un dato: escribilo en «Entrada» (uno por línea)`, n);
                    const crudo = cola.shift();
                    const m = actual();
                    const tipo = m.tipos.get(d.n);
                    let v = crudo;
                    const t = crudo.trim().replace(",", ".");
                    if (tipo === "entero" || tipo === "real") {
                        v = Number(t);
                        if (t === "" || Number.isNaN(v)) throw new ErrorPseudo(`${d.nombre} espera un número y se ingresó "${crudo}"`, n);
                        if (tipo === "entero" && !Number.isInteger(v)) throw new ErrorPseudo(`${d.nombre} es Entero y se ingresó ${crudo}`, n);
                    } else if (tipo === "logico") {
                        const u = sinTildes(t);
                        if (["VERDADERO", "V", "1", "SI"].includes(u)) v = true;
                        else if (["FALSO", "F", "0", "NO"].includes(u)) v = false;
                        else throw new ErrorPseudo(`${d.nombre} es Lógica: ingresá VERDADERO o FALSO`, n);
                    } else if (!tipo && t !== "" && !Number.isNaN(Number(t))) v = Number(t);
                    if (eco) out(crudo + "\n");
                    guardar(d, v, n);
                }
                registrar(n); return;
            }
            case "asignar": guardar(s.dest, valor(s.valor, n), n); registrar(n); return;
            case "llamada": valor(s.e, n); registrar(n); return;
            case "si": {
                const c = cond(s.cond, n, "Si");
                registrar(n, c ? "VERDADERO" : "FALSO");
                correr(c ? s.entonces : s.sino);
                return;
            }
            case "mientras": {
                for (;;) {
                    const c = cond(s.cond, n, "Mientras");
                    registrar(n, c ? "VERDADERO" : "FALSO");
                    if (!c) return;
                    correr(s.cuerpo);
                }
            }
            case "repetir": {
                for (;;) {
                    correr(s.cuerpo);
                    const c = cond(s.cond, s.nCond, s.hasta ? "Hasta Que" : "Mientras Que");
                    registrar(s.nCond, c ? "VERDADERO" : "FALSO");
                    if (s.hasta ? c : !c) return;
                }
            }
            case "para": {
                const ini = num(valor(s.desde, n), n, "el Para");
                const fin = num(valor(s.hasta, n), n, "el Para");
                let p = s.paso ? num(valor(s.paso, n), n, "el Con Paso") : (fin >= ini ? 1 : -1);
                if (p === 0) throw new ErrorPseudo("el paso del Para no puede ser 0", n);
                guardar(s.v, ini, n);
                for (;;) {
                    const v = leerVar(s.v, n);
                    const sigue = p > 0 ? v <= fin : v >= fin;
                    registrar(n, sigue ? "VERDADERO" : "FALSO");
                    if (!sigue) return;
                    correr(s.cuerpo);
                    guardar(s.v, leerVar(s.v, n) + p, n);
                }
            }
            case "segun": {
                const v = valor(s.valor, n);
                registrar(n);
                for (const c of s.casos) {
                    if (c.valores.some(x => igual(valor(x, c.n), v))) { correr(c.cuerpo); return; }
                }
                if (s.otro) correr(s.otro);
                return;
            }
        }
    }

    correr(prog.principal.cuerpo);
    registrar(prog.principal.fin);
    return { filas };
}
