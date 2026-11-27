// Perfil (solo lectura) y Ajustes (apariencia, datos personales y contraseña): comunes a los tres roles.
import { sb, q, rpc, ErrorFen } from "../api.js";
import { html, fecha, nombreRol, exito, icono } from "../ui.js";
import { selectorApariencia } from "../tema.js";

export async function perfil() {
    const p = await rpc("mi_perfil");
    return {
        titulo: "Perfil",
        html: html`
<section class="profile-hero">
    <div class="profile-large-avatar">${(p.nombre || "?").slice(0, 1).toUpperCase()}</div>
    <div><h1>${p.nombre}</h1><p>${nombreRol(p.rol)} · @${p.usuario}</p></div>
    <a class="admin-btn secundario perfil-editar" href="#/ajustes">${icono("engranaje")} Editar en Ajustes</a>
</section>
<section class="course-panel">
    <div class="panel-title">Datos de cuenta</div>
    <div class="profile-details">
        <div><span>Nombre</span><strong>${p.nombre}</strong></div>
        <div><span>Usuario</span><strong>${p.usuario}</strong></div>
        <div><span>Rol</span><strong>${nombreRol(p.rol)}</strong></div>
        <div><span>Correo</span><strong>${p.email ?? "—"}</strong></div>
        <div><span>Fecha de nacimiento</span><strong>${p.fecha_nacimiento ?? "Sin registrar"}</strong></div>
        <div><span>Registro</span><strong>${fecha(p.fecha_registro)}</strong></div>
    </div>
</section>`,
    };
}

export async function ajustes(ctx) {
    const p = await rpc("mi_perfil");
    const texto = {
        estudiante: html`Podés matricularte en cursos, ver las clases, entregar trabajos (archivo o enlace a tu repositorio de GitHub),
            rendir exámenes y seguir tus notas. El siguiente nivel se habilita cuando <strong>aprobás</strong> el anterior.`,
        profesor: html`Gestionás los cursos que impartís: clases, actividades con su porcentaje, exámenes,
            calificaciones, recursos, anuncios y las fechas y nota mínima de cada curso.`,
        admin: html`Administrás usuarios, roles y materias. También podés entrar a cualquier curso desde el panel docente.`,
    }[p.rol];
    return {
        titulo: "Ajustes",
        html: html`
${selectorApariencia()}
<section class="profile-grid">
    <article class="course-panel">
        <div class="panel-title">Datos personales</div>
        <form data-accion="guardarDatos" class="profile-form">
            <label for="nombre">Nombre completo</label>
            <input id="nombre" name="nombre" type="text" value="${p.nombre}" required>
            <label for="usuario">Usuario</label>
            <input id="usuario" name="usuario" type="text" value="${p.usuario}" required pattern="[A-Za-z0-9._-]{3,30}">
            <label for="fecha">Fecha de nacimiento</label>
            <input id="fecha" name="fecha_nacimiento" type="date" value="${p.fecha_nacimiento ?? ""}">
            <button type="submit" class="primary-action">Guardar datos</button>
        </form>
    </article>
    <article class="course-panel">
        <div class="panel-title">Contraseña</div>
        <form data-accion="cambiarPassword" class="profile-form">
            <label for="password">Nueva contraseña</label>
            <input id="password" name="password" type="password" autocomplete="new-password" minlength="6" required>
            <label for="confirmar">Confirmar nueva contraseña</label>
            <input id="confirmar" name="confirmar" type="password" autocomplete="new-password" required>
            <button type="submit" class="primary-action">Cambiar contraseña</button>
        </form>
    </article>
</section>
<section class="course-panel">
    <div class="panel-title">Tu cuenta</div>
    <div class="course-list">
        <div class="course-item"><h3>Rol: ${nombreRol(p.rol)}</h3><p>${texto}</p></div>
        <div class="course-item"><h3>Correo</h3><p>${p.email ?? "—"}</p></div>
    </div>
</section>`,
        acciones: {
            async guardarDatos(d) {
                await q(sb.from("perfiles").update({
                    nombre: d.nombre.trim(), usuario: d.usuario.trim(), fecha_nacimiento: d.fecha_nacimiento || null,
                }).eq("id", p.id));
                await ctx.refrescarPerfil();
                exito("Datos actualizados.");
            },
            async cambiarPassword(d) {
                if (d.password !== d.confirmar) throw new ErrorFen("Las contraseñas no coinciden.");
                await q(sb.auth.updateUser({ password: d.password }));
                exito("Contraseña cambiada.");
            },
        },
    };
}
