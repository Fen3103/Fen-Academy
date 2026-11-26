// Pantallas del ADMINISTRADOR: usuarios, roles y materias.
import { sb, q, rpc, ErrorFen } from "../api.js";
import { html, raw, fecha, nombreRol, exito } from "../ui.js";

const nulo = v => (v === undefined || String(v).trim() === "" ? null : String(v).trim());
const ROLES = ["estudiante", "profesor", "admin"];

function datosCurso(d) {
    const nivel = Number(d.nivel);
    if (!Number.isInteger(nivel) || nivel < 1) throw new ErrorFen("El nivel debe ser un número entero desde 1.");
    return { codigo: d.codigo.trim(), nombre: d.nombre.trim(), lenguaje: d.lenguaje.trim(), nivel,
             descripcion: nulo(d.descripcion), profesor_id: nulo(d.profesor_id) };
}

const selectProfesor = (profesores, actual) => html`<select name="profesor_id"><option value="">Sin profesor</option>
    ${profesores.map(p => html`<option value="${p.id}" ${raw(p.id === actual ? "selected" : "")}>${p.nombre}</option>`)}</select>`;

export async function inicio({ perfil }) {
    const [usuarios, cursos] = await Promise.all([
        q(sb.rpc("admin_usuarios")),
        q(sb.from("cursos").select("*, matriculas(count)").order("lenguaje").order("nivel").order("codigo")),
    ]);
    const profesores = usuarios.filter(u => u.rol === "profesor");
    const lenguajes = [...new Set(cursos.map(c => c.lenguaje))];

    return {
        titulo: "Administración",
        html: html`
<section class="stats-grid stats-grid-3">
    <div class="stat-card"><span>Estudiantes</span><strong>${usuarios.filter(u => u.rol === "estudiante").length}</strong></div>
    <div class="stat-card"><span>Profesores</span><strong>${profesores.length}</strong></div>
    <div class="stat-card"><span>Cursos</span><strong>${cursos.length}</strong></div>
</section>

<section class="course-panel" id="usuarios">
    <div class="panel-title">Usuarios y roles</div>
    <p class="muted panel-help">Las cuentas nuevas se registran como estudiante. Cambiá el rol a <strong>Profesor</strong> para poder asignarle cursos.</p>
    <div class="evaluation-wrapper"><table class="evaluation-table">
        <thead><tr><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Registro</th><th>Rol</th><th></th></tr></thead>
        <tbody>${usuarios.map(u => {
            const yo = u.id === perfil.id;
            return html`<tr>
                <td>${u.nombre}</td><td>@${u.usuario}</td><td>${u.email}</td><td>${fecha(u.fecha_registro)}</td>
                <td>${yo ? html`<span class="rol-badge rol-badge-${u.rol}">${nombreRol(u.rol)} (vos)</span>` : html`
                    <form data-accion="cambiarRol" data-id="${u.id}" class="inline-admin-form">
                        <select name="rol">${ROLES.map(r => html`<option value="${r}" ${raw(r === u.rol ? "selected" : "")}>${nombreRol(r)}</option>`)}</select>
                        <button class="admin-btn" type="submit">Guardar</button></form>`}</td>
                <td>${yo ? "" : html`<button type="button" class="admin-btn danger" data-accion="eliminarUsuario" data-id="${u.id}"
                    data-confirm="¿Eliminar a ${u.nombre}? Se borran su cuenta, matrículas, entregas y exámenes. No se puede deshacer.">Eliminar</button>`}</td></tr>`;
        })}</tbody>
    </table></div>
</section>

<section class="course-panel admin-section" id="cursos">
    <div class="panel-title">Materias (cursos)</div>
    <p class="muted panel-help">Cada lenguaje es una ruta por niveles: para entrar al nivel 2 hay que aprobar el nivel 1, etc.
        El código debe ser único (ej. <strong>PY-1</strong>, <strong>JAVA-1</strong>, <strong>JS-1</strong>) para no confundir lenguajes parecidos.</p>
    <div class="admin-course-form">
        <h3>Crear curso</h3>
        <form data-accion="crearCurso">
            <input type="text" name="codigo" placeholder="Código (ej: PY-4)" required maxlength="20">
            <input type="text" name="nombre" placeholder="Nombre del curso" required>
            <input type="text" name="lenguaje" placeholder="Lenguaje (ej: Python)" required list="lenguajes">
            <datalist id="lenguajes">${lenguajes.map(l => html`<option value="${l}"></option>`)}</datalist>
            <input type="number" name="nivel" placeholder="Nivel (1, 2, 3...)" min="1" required>
            ${selectProfesor(profesores, null)}
            <textarea name="descripcion" placeholder="Descripción"></textarea>
            <button class="admin-btn" type="submit">Crear curso</button>
        </form>
    </div>
    <div class="evaluation-wrapper"><table class="evaluation-table">
        <thead><tr><th>Código</th><th>Curso</th><th>Lenguaje</th><th>Nivel</th><th>Estudiantes</th><th>Profesor</th><th></th></tr></thead>
        <tbody>
            ${cursos.map(c => html`<tr>
                <td><strong>${c.codigo}</strong></td>
                <td><a class="activity-link" href="#/docente/curso/${c.id}">${c.nombre}</a></td>
                <td>${c.lenguaje}</td><td>${c.nivel}</td><td>${c.matriculas[0]?.count ?? 0}</td>
                <td><form data-accion="asignar" data-id="${c.id}" class="inline-admin-form">${selectProfesor(profesores, c.profesor_id)}
                    <button class="admin-btn" type="submit">Guardar</button></form></td>
                <td><div class="resource-card-actions">
                    <a class="admin-btn" href="#/admin/curso/${c.id}">Editar</a>
                    <button type="button" class="admin-btn danger" data-accion="eliminarCurso" data-id="${c.id}"
                        data-confirm="¿Eliminar ${c.codigo} con todas sus clases, actividades, exámenes y entregas? No se puede deshacer.">Eliminar</button>
                </div></td></tr>`)}
            ${cursos.length ? "" : html`<tr><td colspan="7">No hay cursos.</td></tr>`}
        </tbody>
    </table></div>
</section>`,
        acciones: {
            async cambiarRol(d) { await rpc("admin_cambiar_rol", { p_usuario: d.id, p_rol: d.rol }); exito("Rol actualizado."); },
            async eliminarUsuario(d) { await rpc("admin_eliminar_usuario", { p_usuario: d.id }); exito("Usuario eliminado."); },
            async crearCurso(d) { await q(sb.from("cursos").insert(datosCurso(d))); exito("Curso creado."); },
            async asignar(d) { await q(sb.from("cursos").update({ profesor_id: nulo(d.profesor_id) }).eq("id", d.id)); exito("Profesor asignado."); },
            async eliminarCurso(d) {
                // Los archivos se borran primero (el permiso depende de que el curso exista).
                const [acts, recs] = await Promise.all([
                    q(sb.from("actividades").select("id, entregas(archivo_path)").eq("curso_id", d.id)),
                    q(sb.from("recursos").select("archivo_path").eq("curso_id", d.id)),
                ]);
                const rutas = [...acts.flatMap(a => a.entregas.map(e => e.archivo_path)), ...recs.map(r => r.archivo_path)].filter(Boolean);
                if (rutas.length) await sb.storage.from("archivos").remove(rutas);
                await q(sb.from("cursos").delete().eq("id", d.id));
                exito("Curso eliminado.");
            },
        },
    };
}

export async function editarCurso({ params, ir }) {
    const id = Number(params.id);
    const [[c], usuarios, todos] = await Promise.all([
        q(sb.from("cursos").select("*").eq("id", id)),
        q(sb.rpc("admin_usuarios")),
        q(sb.from("cursos").select("lenguaje")),
    ]);
    if (!c) throw new ErrorFen("El curso no existe.");
    const lenguajes = [...new Set(todos.map(x => x.lenguaje))];
    return {
        titulo: "Editar " + c.codigo, volver: ["admin", "Volver"],
        html: html`
<section class="course-panel">
    <div class="panel-title">Editar curso ${c.codigo}</div>
    <form data-accion="guardar" class="form-fen">
        <label>Código (único)</label><input type="text" name="codigo" value="${c.codigo}" required maxlength="20">
        <label>Nombre</label><input type="text" name="nombre" value="${c.nombre}" required>
        <label>Lenguaje</label><input type="text" name="lenguaje" value="${c.lenguaje}" required list="lenguajes">
        <datalist id="lenguajes">${lenguajes.map(l => html`<option value="${l}"></option>`)}</datalist>
        <label>Nivel</label><input type="number" name="nivel" value="${c.nivel}" min="1" required>
        <small>Cambiar el nivel o el lenguaje cambia los requisitos de matrícula de los cursos de esa ruta.</small>
        <label>Profesor</label>${selectProfesor(usuarios.filter(u => u.rol === "profesor"), c.profesor_id)}
        <label>Descripción</label><textarea name="descripcion">${c.descripcion}</textarea>
        <button class="admin-btn" type="submit">Guardar cambios</button>
    </form>
</section>`,
        acciones: {
            async guardar(d) {
                await q(sb.from("cursos").update(datosCurso(d)).eq("id", id));
                exito("Curso actualizado.");
                ir("admin");
                return false;
            },
        },
    };
}
