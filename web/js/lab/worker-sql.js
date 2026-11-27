// Ejecuta SQL (SQLite con sql.js) aislado de la página, en un worker propio solo para SQL.
// Cada ejecución usa una base nueva en memoria: el script crea sus tablas y datos.

const VERSION = "1.10.3";
importScripts(`https://cdnjs.cloudflare.com/ajax/libs/sql.js/${VERSION}/sql-wasm.js`);

const listo = initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${VERSION}/${f}` })
    .then(SQL => { postMessage({ tipo: "listo" }); return SQL; })
    .catch(err => {
        postMessage({ tipo: "fin", error: "No se pudo cargar SQLite. Revisá tu conexión a Internet. (" + err.message + ")" });
        throw err;
    });

self.onmessage = async ({ data }) => {
    const SQL = await listo;
    const db = new SQL.Database();
    const tablas = [];
    let cambios = 0;
    try {
        // Sentencia por sentencia, para mostrar cada SELECT y saber dónde falló.
        for (const st of db.iterateStatements(data.codigo)) {
            const columnas = st.getColumnNames();
            const filas = [];
            while (st.step()) {
                if (filas.length < 500) filas.push(st.get());
            }
            const sql = st.getSQL().trim();
            st.free();
            if (columnas.length) tablas.push({ sql, columnas, filas });
            else cambios += db.getRowsModified();
        }
        postMessage({ tipo: "fin", tablas, cambios });
    } catch (err) {
        postMessage({ tipo: "fin", tablas, cambios, error: "Error de SQL: " + err.message });
    } finally {
        db.close();
    }
};
