// Perfil y ajustes: lo que comparten los tres roles.
import { sb, q, rpc, ErrorFen } from "../api.js";
import { html, fecha, nombreRol, exito } from "../ui.js";

export async function perfil(ctx) {
    const p = await rpc("mi_perfil");
    return {
        titulo: "Perfil",
        html: html`
<section class="profile-hero">
    <div class="profile-large-avatar">${(p.nombre || "?").slice(0, 1).toUpperCase()}</div>
    <div><h1>${p.nombre}</h1><p>${nombreRol(p.rol)} · @${p.usuario}</p></div>
</section>
<section class="profile-grid">
    <article class="course-panel">
        <div class="panel-title">Datos de cuenta</div>
        <div class="profile-details">
            <div><span>Nombre</span><strong>${p.nombre}</strong></div>
            <div><span>Usuario</span><strong>${p.usuario}</strong></div>
            <div><span>Rol</span><strong>${nombreRol(p.rol)}</strong></div>
            <div><span>Correo</span><strong>${p.email ?? "—"}</strong></div>
            <div><span>Fecha de nacimiento</span><strong>${p.fecha_nacimiento ?? "Sin registrar"}</strong></div>
            <div><span>Registro</span><strong>${fecha(p.fecha_registro)}</strong></div>
        </div>
    </article>
    <article class="course-panel">
        <div class="panel-title">Editar perfil</div>
        <form data-accion="guardar" class="profile-form">
            <label for="nombre">Nombre completo</label>
            <input id="nombre" name="nombre" type="text" value="${p.nombre}" required>
            <label for="usuario">Usuario</label>
            <input id="usuario" name="usuario" type="text" value="${p.usuario}" required pattern="[A-Za-z0-9._-]{3,30}">
            <label for="fecha">Fecha de nacimiento</label>
            <input id="fecha" name="fecha_nacimiento" type="date" value="${p.fecha_nacimiento ?? ""}">
            <div class="form-divider"></div>
            <label for="password">Nueva contraseña</label>
            <input id="password" name="password" type="password" autocomplete="new-password" minlength="6" placeholder="Dejar en blanco para mantener la actual">
            <label for="confirmar">Confirmar nueva contraseña</label>
            <input id="confirmar" name="confirmar" type="password" autocomplete="new-password">
            <button type="submit" class="primary-action">Guardar cambios</button>
        </form>
    </article>
</section>`,
        acciones: {
            async guardar(d) {
                if (d.password && d.password !== d.confirmar) throw new ErrorFen("Las contraseñas no coinciden.");
                await q(sb.from("perfiles").update({
                    nombre: d.nombre.trim(), usuario: d.usuario.trim(), fecha_nacimiento: d.fecha_nacimiento || null,
                }).eq("id", p.id));
                if (d.password) await q(sb.auth.updateUser({ password: d.password }));
                await ctx.refrescarPerfil();
                exito("Perfil actualizado correctamente.");
            },
        },
    };
}

export function ajustes({ perfil }) {
    const texto = {
        estudiante: html`Podés matricularte en cursos, ver las clases, entregar trabajos (archivo o enlace a tu repositorio de GitHub),
            rendir exámenes y seguir tus notas. Para avanzar de nivel, tu profesor tiene que marcarte como <strong>Aprobado</strong>.`,
        profesor: html`Gestionás los cursos que el administrador te asignó: clases, actividades con su porcentaje, exámenes,
            calificaciones, recursos y el estado final de cada estudiante.`,
        admin: html`Administrás usuarios, roles y materias. También podés entrar a cualquier curso desde el panel docente.`,
    }[perfil.rol];
    return {
        titulo: "Ajustes",
        html: html`
<section class="course-panel">
    <div class="panel-title">Tu cuenta</div>
    <div class="course-list">
        <div class="course-item"><h3>Rol: ${nombreRol(perfil.rol)}</h3><p>${texto}</p></div>
        <div class="course-item"><h3>Datos personales y contraseña</h3>
            <p>Se cambian desde <a class="activity-link" href="#/perfil">Perfil</a>.</p></div>
    </div>
</section>`,
    };
}
