// Comportamiento compartido por todas las páginas.

// Menú lateral plegable
document.querySelectorAll("[data-toggle-sidebar]").forEach(btn => {
    btn.addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("collapsed"));
});

// Pestañas: <button data-tab="id"> muestra <div class="tab-content" id="id">
function mostrarTab(id) {
    const panel = document.getElementById(id);
    const boton = document.querySelector(`.course-menu-tab[data-tab="${id}"]`);
    if (!panel || !boton) return;
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active-tab"));
    document.querySelectorAll(".course-menu-tab").forEach(t => t.classList.remove("active"));
    panel.classList.add("active-tab");
    boton.classList.add("active");
}

document.querySelectorAll(".course-menu-tab[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
        mostrarTab(btn.dataset.tab);
        const url = new URL(window.location);
        url.searchParams.set("tab", btn.dataset.tab);
        history.replaceState(null, "", url);
    });
});

const tabInicial = new URLSearchParams(window.location.search).get("tab");
if (tabInicial) mostrarTab(tabInicial);

// Botón que abre/cierra un panel: <button data-toggle="id-del-panel">
document.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => document.getElementById(btn.dataset.toggle).classList.toggle("open"));
});

// Formularios con confirmación: <form data-confirm="¿Seguro?">
document.querySelectorAll("form[data-confirm]").forEach(form => {
    form.addEventListener("submit", e => {
        const mensaje = form.dataset.confirm;
        if (mensaje && !confirm(mensaje)) e.preventDefault();
    });
});

// Filas clicables: <tr data-href="/ruta">
document.querySelectorAll("[data-href]").forEach(fila => {
    fila.addEventListener("click", () => (window.location.href = fila.dataset.href));
});
