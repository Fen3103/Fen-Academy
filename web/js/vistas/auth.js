// Login, registro y recuperación de contraseña (pantallas sin menú).
import { sb, q, ErrorFen } from "../api.js";
import { html, exito } from "../ui.js";

const urlDeVuelta = () => location.origin + location.pathname;

export function sinConfigurar() {
    return {
        titulo: "Configuración pendiente", auth: true,
        html: html`<h2>Falta conectar Supabase</h2>
            <p>Editá <strong>js/config.js</strong> con la URL y la <em>anon key</em> de tu proyecto.
               Los pasos están en el README del repositorio.</p>`,
    };
}

export function login() {
    return {
        titulo: "Iniciar sesión", auth: true,
        html: html`
<p>Tu plataforma para aprender programación.</p>
<h2>Iniciar sesión</h2>
<p>Entrá como estudiante, profesor o administrador.</p>
<form data-accion="entrar">
    <input type="email" name="email" placeholder="Correo" required autocomplete="email" autofocus>
    <input type="password" name="password" placeholder="Contraseña" required autocomplete="current-password">
    <button type="submit">Entrar</button>
</form>
<p style="margin-top:16px;">¿No tenés cuenta? <a href="#/registro">Registrate como estudiante</a></p>
<p><a href="#/recuperar">¿Olvidaste tu contraseña?</a></p>`,
        acciones: {
            async entrar(d) {
                await q(sb.auth.signInWithPassword({ email: d.email.trim(), password: d.password }));
                return false;   // onAuthStateChange redirige al panel del rol
            },
        },
    };
}

export function registro(ctx) {
    return {
        titulo: "Registro", auth: true,
        html: html`
<p>Creá tu cuenta de estudiante.</p>
<h2>Registro</h2>
<p>Los profesores son habilitados por un administrador.</p>
<form data-accion="registrar">
    <input type="text" name="nombre" placeholder="Nombre completo" required>
    <input type="text" name="usuario" placeholder="Elegí tu usuario" required pattern="[A-Za-z0-9._-]{3,30}"
           title="Entre 3 y 30 letras, números, punto, guion o guion bajo" autocomplete="username">
    <input type="email" name="email" placeholder="Correo" required autocomplete="email">
    <input type="password" name="password" placeholder="Contraseña (mínimo 6 caracteres)" required minlength="6" autocomplete="new-password">
    <input type="password" name="confirmar" placeholder="Confirmar contraseña" required autocomplete="new-password">
    <button type="submit">Registrarme</button>
</form>
<p style="margin-top:16px;">¿Ya tenés cuenta? <a href="#/login">Iniciá sesión</a></p>`,
        acciones: {
            async registrar(d) {
                if (d.password !== d.confirmar) throw new ErrorFen("Las contraseñas no coinciden.");
                const { data: libre } = await sb.rpc("usuario_disponible", { p_usuario: d.usuario.trim() });
                if (libre === false) throw new ErrorFen("Ese usuario ya existe.");
                const r = await q(sb.auth.signUp({
                    email: d.email.trim(), password: d.password,
                    // Siempre se crea como estudiante: el rol lo decide la base, no este formulario.
                    options: { data: { nombre: d.nombre.trim(), usuario: d.usuario.trim() }, emailRedirectTo: urlDeVuelta() },
                }));
                if (!r.session) {
                    exito("Cuenta creada. Te enviamos un correo: abrí el enlace para confirmarla y después iniciá sesión.");
                    ctx.ir("login");
                }
                return false;
            },
        },
    };
}

export function recuperar(ctx) {
    return {
        titulo: "Recuperar contraseña", auth: true,
        html: html`
<h2>Recuperar contraseña</h2>
<p>Te enviamos un enlace para elegir una contraseña nueva.</p>
<form data-accion="enviar">
    <input type="email" name="email" placeholder="Correo de tu cuenta" required autocomplete="email">
    <button type="submit">Enviar enlace</button>
</form>
<p style="margin-top:16px;"><a href="#/login">Volver a iniciar sesión</a></p>`,
        acciones: {
            async enviar(d) {
                await q(sb.auth.resetPasswordForEmail(d.email.trim(), { redirectTo: urlDeVuelta() }));
                exito("Si el correo está registrado, vas a recibir el enlace en unos minutos.");
                ctx.ir("login");
                return false;
            },
        },
    };
}

export function nuevaPassword(ctx) {
    return {
        titulo: "Nueva contraseña", auth: true,
        html: html`
<h2>Elegí tu nueva contraseña</h2>
<form data-accion="guardar">
    <input type="password" name="password" placeholder="Nueva contraseña (mínimo 6)" required minlength="6" autocomplete="new-password">
    <input type="password" name="confirmar" placeholder="Confirmar contraseña" required autocomplete="new-password">
    <button type="submit">Guardar</button>
</form>`,
        acciones: {
            async guardar(d) {
                if (d.password !== d.confirmar) throw new ErrorFen("Las contraseñas no coinciden.");
                await q(sb.auth.updateUser({ password: d.password }));
                ctx.terminarRecuperacion();
                exito("Contraseña actualizada.");
                await ctx.refrescarPerfil();
                ctx.ir("");
                return false;
            },
        },
    };
}
