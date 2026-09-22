/**
 * ============================================================
 *  CATEGORÍAS
 * ------------------------------------------------------------
 *  Todo lo relacionado a las categorías de gasto: buscarlas,
 *  completar los <select>, armar el selector visual de color e
 *  ícono, abrir su editor y pintar la grilla de la vista
 *  "Categorías".
 * ============================================================
 */

// Devuelve la categoría por id, o una categoría "vacía" de respaldo si no existe.
function obtenerCategoria(id) {
  return estado.categories.find(categoria => categoria.id === id) || { name: "Sin categoría", color: "#aab2ad", icon: "•" };
}

// Llena el <select> de categorías del formulario "Nuevo gasto".
function completarSelectorDeCategorias() {
  document.getElementById("category-input").innerHTML = estado.categories
    .map(categoria => `<option value="${categoria.id}">${escaparHtml(categoria.name)}</option>`)
    .join("");
}

// Llena el <select> de categorías del modal "Corregir gasto".
function completarCategoriaEdicionGasto(idSeleccionado) {
  document.getElementById("expense-edit-category").innerHTML = estado.categories
    .map(categoria => `<option value="${categoria.id}" ${categoria.id === idSeleccionado ? "selected" : ""}>${escaparHtml(categoria.name)}</option>`)
    .join("");
}

/**
 * Dibuja el selector de colores del modal de categorías: los
 * colores fijos de la paleta más un botón de color personalizado
 * (input type="color") que se actualiza en vivo sin redibujar
 * todo el modal.
 */
function construirSelectorDeColor() {
  const esPersonalizado = !paleta.includes(colorSeleccionado);
  const valorPersonalizado = esPersonalizado ? colorSeleccionado : "#000000";

  // Dibuja los colores fijos
  const htmlPredefinidos = paleta.map(color =>
    `<button type="button" class="color-option ${color === colorSeleccionado && !esPersonalizado ? "selected" : ""}" style="background:${color}" data-color="${color}" aria-label="Seleccionar color"></button>`
  ).join("");

  // Dibuja el botón de color personalizado
  const htmlPersonalizado = `
    <div class="color-option custom-color-wrapper ${esPersonalizado ? "selected" : ""}" style="background:${esPersonalizado ? valorPersonalizado : 'transparent'}" title="Elegir color personalizado">
      <span class="custom-color-icon" style="display: ${esPersonalizado ? 'none' : 'block'}">+</span>
      <input type="color" id="custom-color-input" class="custom-color-picker" value="${valorPersonalizado}" />
    </div>`;

  document.getElementById("color-picker").innerHTML = htmlPredefinidos + htmlPersonalizado;

  // Escucha cambios en vivo del selector nativo sin recargar todo el modal
  const inputPersonalizado = document.getElementById("custom-color-input");
  if (inputPersonalizado) {
    inputPersonalizado.addEventListener("input", evento => {
      colorSeleccionado = evento.target.value;
      const contenedor = evento.target.parentElement;

      // Actualiza la UI visualmente
      contenedor.style.background = colorSeleccionado;
      contenedor.querySelector(".custom-color-icon").style.display = "none";

      // Remueve la selección de los otros colores y se la da a este
      document.querySelectorAll(".color-option").forEach(el => el.classList.remove("selected"));
      contenedor.classList.add("selected");
    });
  }
}

// Dibuja el selector de íconos del modal de categorías.
function construirSelectorDeIcono() {
  const contenedor = document.getElementById("icon-picker");
  if (!contenedor) return;
  contenedor.innerHTML = iconos.map(icono =>
    `<button type="button" class="icon-option ${icono === iconoSeleccionado ? "selected" : ""}" data-icon="${icono}">${icono}</button>`
  ).join("");
}

// Abre el modal para crear (id null) o editar una categoría existente.
function abrirEditorDeCategoria(id = null) {
  categoriaAEditar = id;
  const categoria = id ? estado.categories.find(item => item.id === id) : null;
  colorSeleccionado = categoria?.color || paleta[0];
  iconoSeleccionado = categoria?.icon || iconos[0];
  document.getElementById("category-modal-title").textContent = categoria ? "Editar categoría" : "Nueva categoría";
  document.getElementById("category-submit-button").textContent = categoria ? "Guardar cambios" : "Crear categoría";
  document.getElementById("category-name-input").value = categoria?.name || "";
  construirSelectorDeColor();
  construirSelectorDeIcono();
  abrirModal("category-modal");
}

// Dibuja la grilla de categorías con la cantidad de gastos de cada una.
function renderizarCategorias() {
  const confirmados = estado.expenses.reduce((resultado, item) => { if (!item.recurring) resultado[item.categoryId] = (resultado[item.categoryId] || 0) + 1; return resultado; }, {});
  const recurrentes = estado.expenses.reduce((resultado, item) => { if (item.recurring) resultado[item.categoryId] = (resultado[item.categoryId] || 0) + 1; return resultado; }, {});

  document.getElementById("category-grid").innerHTML = estado.categories.map((categoria, indice) => {
    const cantidadConfirmados = confirmados[categoria.id] || 0;
    const cantidadRecurrentes = recurrentes[categoria.id] || 0;
    const resumen = `${cantidadConfirmados} ${cantidadConfirmados === 1 ? "gasto confirmado" : "gastos confirmados"}${cantidadRecurrentes ? ` · ${cantidadRecurrentes} recurrente${cantidadRecurrentes === 1 ? "" : "s"}` : ""}`;
    return `<article class="category-card"><div class="category-card-actions"><button class="category-menu" data-edit-category="${categoria.id}" title="Editar categoría">✎</button><button class="category-menu" data-delete-category="${categoria.id}" title="Eliminar categoría">×</button></div><div class="category-icon" style="color:${categoria.color};background:${categoria.color}20">${categoria.icon || iconos[indice % iconos.length]}</div><strong>${escaparHtml(categoria.name)}</strong><span>${resumen}</span></article>`;
  }).join("");
}
