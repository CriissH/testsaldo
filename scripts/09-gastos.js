/**
 * ============================================================
 *  GASTOS
 * ------------------------------------------------------------
 *  Gastos "de una sola vez" del ciclo actual: cálculo del
 *  presupuesto restante, tabla de gastos con búsqueda/filtro,
 *  edición (corrección) de un gasto ya cargado, y el listado de
 *  "actividad reciente" que combina gastos e ingresos.
 * ============================================================
 */

// Gastos (de una vez o generados por un recurrente) que caen dentro del ciclo actual.
function gastosDelCicloActual() { return estado.expenses.filter(esCicloActual); }

// De esos, solo los que NO son plantillas recurrentes (o sea, gastos reales ya confirmados).
function gastosConfirmados() { return gastosDelCicloActual().filter(item => !item.recurring); }

// Presupuesto restante: ingreso actual menos lo ya gastado y confirmado.
function calcularPresupuestoRestante() {
  const gastadoConfirmado = gastosConfirmados().reduce((suma, item) => suma + Number(item.amount || 0), 0);
  return ingresoActual() - gastadoConfirmado;
}

// Agrupa una lista de gastos sumando los importes por categoría.
function agruparPorCategoria(gastos) {
  return gastos.reduce((grupos, item) => {
    grupos[item.categoryId] = (grupos[item.categoryId] || 0) + Number(item.amount);
    return grupos;
  }, {});
}

// Mezcla gastos e ingresos del historial en una sola lista ordenada por fecha (más reciente primero).
function movimientosDeActividad() {
  const gastos = estado.expenses
    .filter(item => !item.recurring && item.date)
    .map(item => ({ ...item, movementType: "expense" }));
  const ingresos = (estado.incomeHistory || [])
    .filter(item => Number(item.amount || 0) !== 0 && item.date)
    .map(item => ({ ...item, description: item.reason || "Ingreso", movementType: "income" }));
  return [...gastos, ...ingresos].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id || "").localeCompare(String(a.id || "")));
}

// HTML de una fila de movimiento (gasto o ingreso) para el listado de actividad reciente.
function filaDeGasto(item) {
  const categoria = obtenerCategoria(item.categoryId);
  const esIngreso = item.movementType === "income";
  const detalle = esIngreso ? `Ingreso · ${formatearFecha(item.date)}` : `${escaparHtml(categoria.name)} · ${formatearFecha(item.date)}`;
  return `<div class="expense-row ${esIngreso ? "income-row" : "expense-movement-row"}"><div class="expense-avatar ${esIngreso ? "income-avatar" : ""}" style="background:${esIngreso ? "#e5f5ec" : `${categoria.color}20`};color:${esIngreso ? "var(--green)" : categoria.color}">${esIngreso ? "↗" : categoria.icon}</div><div class="expense-info"><strong>${escaparHtml(item.description)}</strong><span>${detalle}</span></div><span class="expense-value ${esIngreso ? "income-value" : ""}">${esIngreso ? "+" : "−"}${formatearMoneda(Math.abs(Number(item.amount || 0)))}</span></div>`;
}

// Texto "MODIFICADO · fecha" que se muestra junto a un gasto que fue corregido.
function etiquetaModificacionGasto(item) {
  return item.modified ? `<span class="modified-tag">MODIFICADO · ${formatearFecha(item.modified.date)}</span>` : "";
}

// Razón elegida (o escrita) en el formulario de corrección de un gasto.
function obtenerRazonEdicionGasto() {
  const seleccionada = document.getElementById("expense-edit-reason").value;
  return seleccionada === "Otro" ? document.getElementById("expense-edit-custom-reason").value.trim() : seleccionada;
}

// Abre el modal para corregir un gasto ya cargado.
function abrirEditorDeGasto(id) {
  gastoAEditar = estado.expenses.find(item => item.id === id);
  if (!gastoAEditar) return;
  document.getElementById("expense-edit-description").value = gastoAEditar.description;
  document.getElementById("expense-edit-amount").value = gastoAEditar.amount;
  completarCategoriaEdicionGasto(gastoAEditar.categoryId);
  document.getElementById("expense-edit-reason").value = "";
  document.getElementById("expense-edit-custom-reason-label").hidden = true;
  document.getElementById("expense-edit-custom-reason").required = false;
  abrirModal("expense-edit-modal");
}

// Dibuja la tabla de gastos (vista "Gastos"), aplicando el buscador y el filtro por categoría.
function renderizarGastos() {
  const consulta = (document.getElementById("expense-search")?.value || "").toLowerCase();
  const filtro = document.getElementById("expense-filter")?.value || "all";

  const gastos = gastosConfirmados()
    .filter(item => item.description.toLowerCase().includes(consulta) && (filtro === "all" || item.categoryId === filtro))
    .sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById("expense-table").innerHTML = gastos.map(item => {
    const categoria = obtenerCategoria(item.categoryId);

    // Si tiene recurringSourceId, sabemos que viene de un pago recurrente aprobado
    const esEtiquetaRecurrente = item.recurring || item.recurringSourceId;
    const etiquetaTipo = esEtiquetaRecurrente
      ? '<span class="recurring-tag">Recurrente</span>'
      : '<span class="muted">Único</span>';

    return `<tr>
      <td><strong>${escaparHtml(item.description)}</strong>${etiquetaModificacionGasto(item)}</td>
      <td><span class="table-category"><i class="legend-dot" style="background:${categoria.color}"></i>${escaparHtml(categoria.name)}</span></td>
      <td>${formatearFecha(item.date)}</td>
      <td>${etiquetaTipo}</td>
      <td class="align-right"><strong>${formatearMoneda(item.amount)}</strong></td>
      <td class="align-right">
        <button class="edit-button" data-edit-expense="${item.id}" aria-label="Corregir gasto" title="Corregir gasto">✎</button>
        <button class="delete-button" data-delete-expense="${item.id}" aria-label="Eliminar gasto">×</button>
      </td>
    </tr>`;
  }).join("");

  document.getElementById("expense-empty").style.display = gastos.length ? "none" : "block";

  const selectorFiltro = document.getElementById("expense-filter");
  const filtroActual = selectorFiltro.value;
  selectorFiltro.innerHTML = `<option value="all">Todas las categorías</option>${estado.categories.map(categoria => `<option value="${categoria.id}">${escaparHtml(categoria.name)}</option>`).join("")}`;
  selectorFiltro.value = estado.categories.some(categoria => categoria.id === filtroActual) ? filtroActual : "all";

  renderizarWidgetGastosRecurrentes();
}
