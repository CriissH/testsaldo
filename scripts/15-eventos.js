/**
 * ============================================================
 *  EVENTOS
 * ------------------------------------------------------------
 *  Acá se conectan todos los elementos del HTML con las
 *  funciones de negocio de los demás módulos. Está ordenado en
 *  bloques temáticos: clics delegados en document, formularios
 *  (submit), y cambios de campos (change/input).
 *
 *  Este módulo NO dibuja nada ni calcula nada por sí mismo: solo
 *  escucha al usuario y llama a las funciones correspondientes.
 *  El arranque de la aplicación (el primer renderizar()) está en
 *  16-iniciar.js, para separar "conectar los eventos" de
 *  "arrancar la app".
 * ============================================================
 */

/* ---------- Clics delegados (un solo listener para todo el documento) ---------- */

document.addEventListener("click", evento => {
  const navegacion = evento.target.closest("[data-view]");
  if (navegacion) navegar(navegacion.dataset.view);

  const enlace = evento.target.closest("[data-view-link]");
  if (enlace) navegar(enlace.dataset.viewLink);

  const cerrar = evento.target.closest("[data-close-modal]");
  if (cerrar) cerrarModal(cerrar.dataset.closeModal);

  const abrirOtroModal = evento.target.closest("[data-open-modal]");
  if (abrirOtroModal) abrirModal(abrirOtroModal.dataset.openModal);

  if (evento.target.id === "new-expense-button" || evento.target.id === "new-expense-button-2") {
    completarSelectorDeCategorias();
    document.getElementById("expense-modal-title").textContent = "Registrar gasto";
    document.getElementById("recurring-input").checked = false;
    document.getElementById("recurring-is-projected").checked = true;
    document.getElementById("date-input").value = hoyISO();
    document.getElementById("recurring-monthly-day").value = "";
    document.getElementById("recurring-options").hidden = true;
    document.getElementById("recurring-weekday-label").hidden = true;
    document.getElementById("recurring-monthly-date-label").hidden = true;
    document.getElementById("date-input").required = true;
    abrirModal("expense-modal");
  }

  if (evento.target.id === "income-button") { actualizarFormularioIngreso(); abrirModal("income-modal"); }

  const editarRecurrente = evento.target.closest("[data-edit-recurring]");
  if (editarRecurrente) abrirEditorRecurrente(editarRecurrente.dataset.editRecurring);

  const eliminarRecurrente = evento.target.closest("[data-delete-recurring]");
  if (eliminarRecurrente) { recurrenteAEliminar = eliminarRecurrente.dataset.deleteRecurring; abrirModal("recurring-delete-modal"); }

  const editarGasto = evento.target.closest("[data-edit-expense]");
  if (editarGasto) abrirEditorDeGasto(editarGasto.dataset.editExpense);

  if (evento.target.id === "pending-banner-button") document.getElementById("recurring-bar").scrollIntoView({ behavior: "smooth", block: "end" });

  if (evento.target.id === "income-success-dismiss") {
    avisoIngresoDescartado = true;
    document.getElementById("income-success-banner").hidden = true;
  }

  const botonConfirmar = evento.target.closest("[data-confirm-recurring]");
  if (botonConfirmar) confirmarRecurrente(botonConfirmar.dataset.confirmRecurring, "yes");

  const botonRechazar = evento.target.closest("[data-reject-recurring]");
  if (botonRechazar) confirmarRecurrente(botonRechazar.dataset.rejectRecurring, "no");

  const botonPosponer = evento.target.closest("[data-defer-recurring]");
  if (botonPosponer) confirmarRecurrente(botonPosponer.dataset.deferRecurring, "deferred");

  const selectorEstadoRecurrente = evento.target.closest("[data-recurring-state]");
  if (selectorEstadoRecurrente && selectorEstadoRecurrente.value) {
    confirmarRecurrente(selectorEstadoRecurrente.dataset.recurringState, selectorEstadoRecurrente.value);
  }

  if (evento.target.id === "open-welcome-button") {
    document.getElementById("welcome-modal").hidden = false;
    setTimeout(() => document.getElementById("welcome-income-input").focus(), 0);
  }

  if (evento.target.id === "new-category-button") abrirEditorDeCategoria();

  const editarCategoria = evento.target.closest("[data-edit-category]");
  if (editarCategoria) abrirEditorDeCategoria(editarCategoria.dataset.editCategory);

  const color = evento.target.closest("[data-color]");
  if (color) { colorSeleccionado = color.dataset.color; construirSelectorDeColor(); }

  const icono = evento.target.closest("[data-icon]");
  if (icono) {
    iconoSeleccionado = icono.dataset.icon;
    construirSelectorDeIcono();
  }

  const botonEliminarGasto = evento.target.closest("[data-delete-expense]");
  if (botonEliminarGasto) { gastoAEliminar = botonEliminarGasto.dataset.deleteExpense; abrirModal("delete-modal"); }

  if (evento.target.id === "confirm-delete") {
    estado.expenses = estado.expenses.filter(item => item.id !== gastoAEliminar);
    guardarEstado();
    cerrarModal("delete-modal");
    renderizar();
    mostrarAviso("Gasto eliminado");
  }

  if (evento.target.id === "confirm-recurring-delete") {
    if (recurrenteAEliminar) {
      estado.expenses = estado.expenses.filter(item => item.id !== recurrenteAEliminar);
      Object.keys(estado.recurringConfirmations || {}).forEach(clave => { if (clave.startsWith(`${recurrenteAEliminar}_`)) delete estado.recurringConfirmations[clave]; });
      guardarEstado();
    }
    cerrarModal("recurring-delete-modal");
    renderizar();
    mostrarAviso("Gasto recurrente eliminado");
  }

  const eliminarCategoria = evento.target.closest("[data-delete-category]");
  if (eliminarCategoria) {
    if (estado.categories.length <= 1) return mostrarAviso("Debes conservar al menos una categoría.", true);
    const tieneGastos = estado.expenses.some(item => item.categoryId === eliminarCategoria.dataset.deleteCategory);
    if (tieneGastos) return mostrarAviso("No puedes eliminar una categoría con gastos asociados.", true);
    estado.categories = estado.categories.filter(item => item.id !== eliminarCategoria.dataset.deleteCategory);
    guardarEstado();
    renderizar();
    mostrarAviso("Categoría eliminada");
  }

  const eliminarMetaAhorro = evento.target.closest("[data-delete-savings-goal]");
  if (eliminarMetaAhorro) {
    estado.savingsGoals = (estado.savingsGoals || []).filter(item => item.id !== eliminarMetaAhorro.dataset.deleteSavingsGoal);
    guardarEstado();
    renderizar();
    mostrarAviso("Meta de ahorro eliminada.");
  }
});

// Clic en "Eliminar compra" dentro de la compra colectiva.
document.addEventListener("click", evento => {
  const eliminarCompraColectiva = evento.target.closest("[data-delete-collective-expense]");
  if (!eliminarCompraColectiva) return;
  const eventoColectivo = borradorColectivo();
  eventoColectivo.expenses = eventoColectivo.expenses.filter(item => item.id !== eliminarCompraColectiva.dataset.deleteCollectiveExpense);
  guardarBorradorColectivo();
});

// PC: cuando se cambia el estado de un recurrente desde el <select>.
document.addEventListener("change", evento => {
  if (evento.target.classList.contains("recurring-state-select")) {
    const idPlantilla = evento.target.dataset.recurringState;
    const estadoElegido = evento.target.value;
    if (estadoElegido) {
      confirmarRecurrente(idPlantilla, estadoElegido);
      evento.target.value = ""; // Resetea el texto visualmente
    }
  }
});

// Móvil: botones compactos de acción rápida para recurrentes.
document.addEventListener("click", evento => {
  const botonAccion = evento.target.closest(".rab-btn");
  if (botonAccion) {
    confirmarRecurrente(botonAccion.dataset.tid, botonAccion.dataset.action);
  }
});

// Cierra cualquier modal si se hace clic fuera de su contenido (en el fondo oscuro).
window.addEventListener("click", evento => { if (evento.target.classList.contains("modal-backdrop")) cerrarModal(evento.target.id); });

/* ---------- Formulario: nuevo gasto ---------- */

document.getElementById("expense-form").addEventListener("submit", evento => {
  evento.preventDefault();
  const esRecurrente = document.getElementById("recurring-input").checked;
  const frecuencia = esRecurrente ? document.getElementById("recurring-frequency").value : null;
  const fechaGasto = esRecurrente && frecuencia !== "monthly" ? hoyISO() : document.getElementById("date-input").value;
  const descripcion = document.getElementById("description-input").value.trim();
  const importe = Number(document.getElementById("amount-input").value);

  if (descripcion.length < 2 || /^\d+$/.test(descripcion)) return mostrarAviso("La descripción debe tener al menos 2 caracteres y no puede ser solo numérica.", true);
  if (!Number.isFinite(importe) || importe <= 0) return mostrarAviso("Indica un importe mayor que cero.", true);

  const diaMensual = frecuencia === "monthly" ? Number(document.getElementById("recurring-monthly-day").value) : null;
  if (frecuencia === "monthly" && (!diaMensual || diaMensual < 1 || diaMensual > 31)) return mostrarAviso("Indica un día de facturación entre 1 y 31.", true);

  const valorFechaIngresada = document.getElementById("date-input").value;
  if (!esRecurrente) {
    const fechaIngresada = new Date(`${valorFechaIngresada}T12:00:00`);
    if (!valorFechaIngresada || fechaIngresada < obtenerInicioCiclo() || fechaIngresada > obtenerFinCiclo()) {
      return mostrarAviso(`La fecha debe estar dentro del ciclo actual: ${formatearFecha(claveFechaCiclo(obtenerInicioCiclo()))} al ${formatearFecha(claveFechaCiclo(obtenerFinCiclo()))}.`, true);
    }
  }

  estado.expenses.push({
    id: crypto.randomUUID(),
    description: descripcion,
    amount: importe,
    categoryId: document.getElementById("category-input").value,
    date: fechaGasto,
    recurring: esRecurrente,
    recurringType: esRecurrente ? "expense" : null,
    frequency: frecuencia,
    weekday: frecuencia === "weekly" ? Number(document.getElementById("recurring-weekday").value) : null,
    monthlyDay: diaMensual,
    isProjected: esRecurrente ? document.getElementById("recurring-is-projected").checked : true
  });

  guardarEstado();
  evento.target.reset();
  cerrarModal("expense-modal");
  renderizar();
  mostrarAviso("Gasto guardado correctamente");
});

// Muestra/oculta los campos según si el gasto es recurrente y con qué frecuencia.
function actualizarCamposRecurrente(frecuencia) {
  const esRecurrente = document.getElementById("recurring-input").checked;
  document.getElementById("recurring-weekday-label").hidden = !esRecurrente || frecuencia !== "weekly";
  document.getElementById("recurring-monthly-date-label").hidden = !esRecurrente || frecuencia !== "monthly";
  document.getElementById("expense-date-label").hidden = esRecurrente;
  document.getElementById("date-input").required = !esRecurrente;
}

document.getElementById("recurring-input").addEventListener("change", evento => {
  document.getElementById("recurring-options").hidden = !evento.target.checked;
  if (!evento.target.checked) document.getElementById("expense-date-label").hidden = false;
  else actualizarCamposRecurrente(document.getElementById("recurring-frequency").value);
});
document.getElementById("recurring-frequency").addEventListener("change", evento => actualizarCamposRecurrente(evento.target.value));

/* ---------- Proyección ---------- */

document.getElementById("projection-detail-button").addEventListener("click", () => {
  renderizarDetalleProyeccion();
  abrirModal("projection-detail-modal");
});

/* ---------- Categorías ---------- */

document.getElementById("category-form").addEventListener("submit", evento => {
  evento.preventDefault();
  const nombre = document.getElementById("category-name-input").value.trim();
  if (estado.categories.some(categoria => categoria.name.toLowerCase() === nombre.toLowerCase() && categoria.id !== categoriaAEditar)) {
    return mostrarAviso("Ya existe una categoría con ese nombre.", true);
  }
  if (categoriaAEditar) {
    const categoria = estado.categories.find(item => item.id === categoriaAEditar);
    if (categoria) Object.assign(categoria, { name: nombre, color: colorSeleccionado, icon: iconoSeleccionado });
  } else {
    estado.categories.push({ id: `category-${Date.now()}`, name: nombre, color: colorSeleccionado, icon: iconoSeleccionado });
  }
  const estabaEditando = Boolean(categoriaAEditar);
  guardarEstado();
  evento.target.reset();
  categoriaAEditar = null;
  cerrarModal("category-modal");
  renderizar();
  mostrarAviso(estabaEditando ? "Categoría actualizada" : "Categoría creada");
});

/* ---------- Corrección de gastos ---------- */

document.getElementById("expense-edit-reason").addEventListener("change", evento => {
  const esOtro = evento.target.value === "Otro";
  document.getElementById("expense-edit-custom-reason-label").hidden = !esOtro;
  document.getElementById("expense-edit-custom-reason").required = esOtro;
});

document.getElementById("expense-edit-form").addEventListener("submit", evento => {
  evento.preventDefault();
  if (!gastoAEditar) return;
  const razon = obtenerRazonEdicionGasto();
  const descripcion = document.getElementById("expense-edit-description").value.trim();
  const importe = Number(document.getElementById("expense-edit-amount").value);
  const categoriaId = document.getElementById("expense-edit-category").value;

  if (!razon) return mostrarAviso("Selecciona o escribe una razón para la corrección.", true);
  if (descripcion.length < 2) return mostrarAviso("La descripción debe tener al menos 2 caracteres.", true);
  if (!Number.isFinite(importe) || importe <= 0) return mostrarAviso("Indica un importe mayor que cero.", true);

  const importeAnterior = Number(gastoAEditar.amount);
  gastoAEditar.description = descripcion;
  gastoAEditar.amount = importe;
  gastoAEditar.categoryId = categoriaId;
  gastoAEditar.modified = { reason: razon, date: hoyISO() };
  estado.expenseHistory = estado.expenseHistory || [];
  estado.expenseHistory.push({ id: crypto.randomUUID(), expenseId: gastoAEditar.id, description: descripcion, previousAmount: importeAnterior, amount: importe, reason: razon, date: hoyISO() });
  guardarEstado();
  cerrarModal("expense-edit-modal");
  renderizar();
  mostrarAviso("Gasto corregido y registrado en el historial.");
});

/* ---------- Recurrente: edición ---------- */

document.getElementById("recurring-edit-scope").addEventListener("change", actualizarAyudaEdicionRecurrente);

document.getElementById("recurring-edit-form").addEventListener("submit", evento => {
  evento.preventDefault();
  if (!recurrenteAEditar) return;
  const importe = Number(document.getElementById("recurring-edit-amount").value);
  const alcance = document.getElementById("recurring-edit-scope").value;
  const importeAnterior = Number(recurrenteAEditar.amount);
  const diaSemanaAnterior = recurrenteAEditar.weekday;
  const seProyectabaAntes = recurrenteAEditar.isProjected !== false;
  const nuevoDiaSemana = recurrenteAEditar.frequency === "weekly" ? Number(document.getElementById("recurring-edit-weekday").value) : recurrenteAEditar.weekday;
  const nuevoDiaMensual = recurrenteAEditar.frequency === "monthly" ? Number(document.getElementById("recurring-edit-monthly-day").value) : recurrenteAEditar.monthlyDay;
  const seProyectaAhora = document.getElementById("recurring-edit-is-projected").checked;

  if (recurrenteAEditar.frequency === "monthly" && (!nuevoDiaMensual || nuevoDiaMensual < 1 || nuevoDiaMensual > 31)) {
    return mostrarAviso("Indica un día de facturación entre 1 y 31.", true);
  }

  recurrenteAEditar.amount = importe;
  recurrenteAEditar.weekday = nuevoDiaSemana;
  recurrenteAEditar.isProjected = seProyectaAhora;
  if (recurrenteAEditar.frequency === "monthly") recurrenteAEditar.monthlyDay = nuevoDiaMensual;

  if (alcance === "cycle") {
    const inicioCicloTexto = obtenerInicioCiclo().toISOString().slice(0, 10);
    estado.expenses.forEach(item => {
      if (item.recurringSourceId === recurrenteAEditar.id && item.date >= inicioCicloTexto) item.amount = importe;
    });
    estado.recurringHistory = estado.recurringHistory || [];
    estado.recurringHistory.push({
      id: crypto.randomUUID(),
      recurringId: recurrenteAEditar.id,
      description: recurrenteAEditar.description,
      previousAmount: importeAnterior,
      amount: importe,
      previousWeekday: diaSemanaAnterior,
      weekday: nuevoDiaSemana,
      previousIsProjected: seProyectabaAntes,
      isProjected: seProyectaAhora,
      scope: alcance,
      date: hoyISO()
    });
    mostrarAviso("Importe actualizado para todo el ciclo actual.");
  } else {
    mostrarAviso("Importe actualizado para las próximas confirmaciones.");
  }

  guardarEstado();
  cerrarModal("recurring-edit-modal");
  renderizar();
});

/* ---------- Compra colectiva ---------- */

document.getElementById("income-action").addEventListener("change", actualizarFormularioIngreso);

document.getElementById("collective-config-form").addEventListener("submit", evento => {
  evento.preventDefault();
  const nombres = document.getElementById("collective-people").value.split(/\r?\n|,/).map(nombre => nombre.trim()).filter(Boolean);
  if (nombres.length < 2) return mostrarAviso("Indica al menos dos personas.", true);
  const unicos = nombres.map(nombre => nombre.toLowerCase());
  if (new Set(unicos).size !== unicos.length) return mostrarAviso("Cada persona debe tener un nombre diferente.", true);

  const eventoColectivo = borradorColectivo();
  eventoColectivo.name = document.getElementById("collective-name").value.trim() || "Compra colectiva";
  eventoColectivo.people = nombres.map((nombre, indice) => ({ id: eventoColectivo.people[indice]?.id || crypto.randomUUID(), name: nombre }));
  eventoColectivo.expenses = eventoColectivo.expenses.filter(item => eventoColectivo.people.some(persona => persona.id === item.payerId));
  guardarBorradorColectivo();
  mostrarAviso("Participantes configurados.");
});

document.getElementById("collective-expense-form").addEventListener("submit", evento => {
  evento.preventDefault();
  const eventoColectivo = borradorColectivo();
  const importe = Number(document.getElementById("collective-expense-amount").value);
  const razon = document.getElementById("collective-expense-reason").value.trim();
  const idPagador = document.getElementById("collective-payer").value;
  const idsIncluidos = [...document.querySelectorAll("input[name='collective-included-person']:checked")].map(input => input.value);

  if (!idPagador || !importe || importe <= 0 || !razon) return mostrarAviso("Completa quién pagó, el importe y la razón.", true);
  if (!idsIncluidos.length) return mostrarAviso("Incluye al menos una persona en el reparto.", true);
  if (!idsIncluidos.includes(idPagador)) return mostrarAviso("El pagador debe estar incluido en el reparto.", true);

  eventoColectivo.expenses.push({ id: crypto.randomUUID(), payerId: idPagador, amount: importe, reason: razon, includedIds: idsIncluidos });
  guardarBorradorColectivo();
  evento.target.reset();
  mostrarAviso("Compra colectiva agregada.");
});

document.getElementById("collective-people").addEventListener("change", () => {});
document.getElementById("collective-receipt-button").addEventListener("click", imprimirComprobanteColectivo);
document.getElementById("collective-reset-button").addEventListener("click", reiniciarColectivo);

/* ---------- Ahorros ---------- */

document.getElementById("deposit-savings-button").addEventListener("click", () => abrirModalDeAhorro("deposit"));
document.getElementById("withdraw-savings-button").addEventListener("click", () => abrirModalDeAhorro("withdrawal"));

document.getElementById("new-savings-goal-button").addEventListener("click", () => {
  document.getElementById("savings-goal-form").reset();
  document.getElementById("savings-goal-modal-title").textContent = "Nueva meta";
  actualizarSugerenciaMetaDeAhorro();
  abrirModal("savings-goal-modal");
});

document.getElementById("savings-goal-target").addEventListener("input", actualizarSugerenciaMetaDeAhorro);
document.getElementById("savings-goal-date").addEventListener("change", actualizarSugerenciaMetaDeAhorro);

document.getElementById("savings-action").addEventListener("change", evento => {
  document.getElementById("savings-modal-title").textContent = evento.target.value === "deposit" ? "Ingresar ahorro" : "Extraer ahorro";
});

document.getElementById("savings-date-today").addEventListener("change", evento => {
  document.getElementById("savings-date").disabled = evento.target.checked;
});

document.getElementById("savings-form").addEventListener("submit", evento => {
  evento.preventDefault();
  const tipo = document.getElementById("savings-action").value;
  const importe = Number(document.getElementById("savings-amount").value);
  const razon = document.getElementById("savings-reason").value.trim();
  const fecha = document.getElementById("savings-date-today").checked ? hoyDelSistemaISO() : document.getElementById("savings-date").value;

  if (!importe || importe <= 0 || !razon || !fecha) return mostrarAviso("Completa monto, razón y fecha.", true);
  if (tipo === "withdrawal" && importe > Number(estado.savingsBalance || 0)) return mostrarAviso("No puedes extraer más que el ahorro disponible.", true);

  estado.savingsBalance += tipo === "deposit" ? importe : -importe;
  estado.savingsMovements = estado.savingsMovements || [];
  estado.savingsMovements.push({ id: crypto.randomUUID(), type: tipo === "deposit" ? "deposit" : "withdrawal", amount: importe, reason: razon, date: fecha });
  guardarEstado();
  evento.target.reset();
  document.getElementById("savings-date-today").checked = true;
  document.getElementById("savings-date").value = hoyDelSistemaISO();
  cerrarModal("savings-modal");
  renderizar();
  mostrarAviso(tipo === "deposit" ? "Ahorro ingresado correctamente." : "Ahorro extraído correctamente.");
});

document.getElementById("savings-goal-form").addEventListener("submit", evento => {
  evento.preventDefault();
  const nombre = document.getElementById("savings-goal-name").value.trim();
  const objetivo = Number(document.getElementById("savings-goal-target").value);
  const fecha = document.getElementById("savings-goal-date").value;

  if (!nombre || !objetivo || objetivo <= 0) return mostrarAviso("Completa el nombre y el valor objetivo.", true);

  const meses = fecha
    ? Math.max(1, Math.ceil((new Date(`${fecha}T12:00:00`).getTime() - fechaEfectiva().getTime()) / (1000 * 60 * 60 * 24 * 30.4375)))
    : 6;

  estado.savingsGoals = estado.savingsGoals || [];
  estado.savingsGoals.push({
    id: crypto.randomUUID(),
    name: nombre,
    targetAmount: objetivo,
    targetDate: fecha || null,
    recommendedMonthly: Math.max(0, Math.min(Math.ceil(objetivo / Math.max(1, meses)), Math.max(0, valorProyeccionMensual())))
  });

  guardarEstado();
  evento.target.reset();
  cerrarModal("savings-goal-modal");
  renderizar();
  mostrarAviso("Meta de ahorro creada.");
});

/* ---------- Ingresos ---------- */

document.getElementById("income-reason").addEventListener("change", evento => {
  document.getElementById("income-custom-reason-label").hidden = evento.target.value !== "Otro";
  document.getElementById("income-custom-reason").required = evento.target.value === "Otro";
});
document.getElementById("income-action").addEventListener("change", actualizarFormularioIngreso);
document.getElementById("income-recurring-frequency").addEventListener("change", actualizarFormularioIngreso);

document.getElementById("income-form").addEventListener("submit", evento => {
  evento.preventDefault();
  const accion = document.getElementById("income-action").value;
  const importe = Number(document.getElementById("income-change-amount").value);
  const razon = razonDeIngreso();

  if (!importe || importe <= 0) return mostrarAviso("Indica un importe válido.", true);
  if (accion !== "recurring" && !razon) return mostrarAviso("Selecciona o escribe una razón para el cambio.", true);

  if (accion === "recurring") {
    const frecuencia = document.getElementById("income-recurring-frequency").value;
    const diaMensual = frecuencia === "monthly" ? Number(document.getElementById("income-recurring-monthly-day").value) : null;
    if (frecuencia === "monthly" && (!diaMensual || diaMensual < 1 || diaMensual > 31)) return mostrarAviso("Indica un día de cobro entre 1 y 31.", true);
    estado.expenses.push({
      id: crypto.randomUUID(),
      description: "Ingreso recurrente",
      amount: importe,
      categoryId: estado.categories[0].id,
      date: hoyISO(),
      recurring: true,
      recurringType: "income",
      frequency: frecuencia,
      weekday: frecuencia === "weekly" ? Number(document.getElementById("income-recurring-weekday").value) : null,
      monthlyDay: diaMensual,
      isProjected: document.getElementById("income-recurring-is-projected").checked
    });
    guardarEstado();
    cerrarModal("income-modal");
    renderizar();
    mostrarAviso("Ingreso recurrente creado.");
    return;
  }

  const entrada = { id: crypto.randomUUID(), amount: importe, reason: razon, date: hoyISO(), cutoffDay: estado.cutoffDay, type: accion };
  if (accion === "next") {
    entrada.cutoffDay = Number(document.getElementById("income-change-cutoff").value);
    entrada.effectiveDate = proximaFechaCiclo().toISOString().slice(0, 10);
    estado.pendingIncome = entrada;
    mostrarAviso("El nuevo ingreso se aplicará al próximo ciclo.");
  } else if (accion === "current") {
    estado.currentCycleIncome = importe;
    estado.incomeNotice = `Este monto fue seteado el ${formatearFecha(hoyISO())}. Razón: ${razon}.`;
    estado.incomeHistory.push(entrada);
    mostrarAviso("Monto actual actualizado.");
  } else {
    estado.currentCycleIncome = ingresoActual() + importe;
    estado.incomeNotice = `Se sumaron ${formatearMoneda(importe)} el ${formatearFecha(hoyISO())}. Razón: ${razon}.`;
    estado.incomeHistory.push(entrada);
    mostrarAviso("Adición aplicada al monto actual.");
  }

  guardarEstado();
  cerrarModal("income-modal");
  renderizar();
});

/* ---------- Bienvenida (onboarding) ---------- */

document.getElementById("welcome-form").addEventListener("submit", evento => {
  evento.preventDefault();
  estado.income = Number(document.getElementById("welcome-income-input").value);
  estado.cutoffDay = Number(document.getElementById("welcome-cutoff-input").value);
  estado.onboardingComplete = true;
  estado.lastCycleStart = claveFechaCiclo(obtenerInicioCiclo());
  estado.incomeHistory.push({ id: crypto.randomUUID(), amount: estado.income, reason: "Configuración inicial", date: hoyISO(), cutoffDay: estado.cutoffDay, type: "current" });
  guardarEstado();
  cerrarModal("welcome-modal");
  renderizar();
  mostrarAviso("¡Listo! Tu presupuesto ya está configurado.");
});

document.getElementById("welcome-import-button").addEventListener("click", () => document.getElementById("welcome-import-file").click());
document.getElementById("welcome-import-file").addEventListener("change", evento => {
  archivoImportacionBienvenida = evento.target.files[0] || null;
  const botonConfirmar = document.getElementById("welcome-import-confirm");
  document.getElementById("welcome-import-status").textContent = archivoImportacionBienvenida
    ? `${archivoImportacionBienvenida.name} seleccionado. Confirma para restaurar los datos.`
    : "Después de seleccionarlo, confirma la importación.";
  botonConfirmar.hidden = !archivoImportacionBienvenida;
  evento.target.value = "";
});
document.getElementById("welcome-import-confirm").addEventListener("click", () => {
  if (!archivoImportacionBienvenida) return;
  importarRespaldo(archivoImportacionBienvenida);
  archivoImportacionBienvenida = null;
  document.getElementById("welcome-import-confirm").hidden = true;
});

/* ---------- Gastos: búsqueda, filtro y estadísticas ---------- */

document.getElementById("expense-search").addEventListener("input", renderizarGastos);
document.getElementById("expense-filter").addEventListener("change", renderizarGastos);
document.getElementById("stats-period").addEventListener("change", renderizarEstadisticas);

/* ---------- Reportes, respaldos y sistema ---------- */

document.getElementById("pdf-button").addEventListener("click", () => { navegar("reports"); setTimeout(() => window.print(), 100); });
document.getElementById("export-button").addEventListener("click", exportarRespaldo);
document.getElementById("restore-button").addEventListener("click", () => document.getElementById("import-file").click());
document.getElementById("import-button").addEventListener("click", () => document.getElementById("import-file").click());
document.getElementById("import-file").addEventListener("change", evento => { if (evento.target.files[0]) importarRespaldo(evento.target.files[0]); evento.target.value = ""; });

document.getElementById("reset-system-button").addEventListener("click", () => {
  document.getElementById("reset-form").reset();
  document.getElementById("confirm-reset-button").disabled = true;
  abrirModal("reset-modal");
});

document.getElementById("unlock-debug-button").addEventListener("click", () => {
  const clave = window.prompt("Contraseña de desarrollador");
  if (clave === "cris") {
    depuracionDesbloqueada = true;
    renderizarConfiguracion();
    mostrarAviso("Opciones de desarrollador desbloqueadas.");
  } else if (clave !== null) {
    mostrarAviso("Contraseña incorrecta.", true);
  }
});

document.getElementById("reset-password").addEventListener("input", evento => {
  document.getElementById("confirm-reset-button").disabled = evento.target.value !== "CONFIRMAR";
});

document.getElementById("reset-form").addEventListener("submit", evento => {
  evento.preventDefault();
  if (document.getElementById("reset-password").value !== "CONFIRMAR") return;
  localStorage.removeItem(CLAVE_ALMACENAMIENTO);
  estado = structuredClone(estadoPorDefecto);
  evento.target.reset();
  cerrarModal("reset-modal");
  navegar("dashboard");
  renderizar();
  mostrarAviso("Sistema reiniciado. Comienza una nueva configuración.");
});

document.getElementById("check-update-button").addEventListener("click", () => verificarActualizacion(true, true));

document.getElementById("dark-mode-toggle").addEventListener("change", evento => {
  estado.darkMode = evento.target.checked;
  guardarEstado();
  document.body.classList.toggle("dark-mode", estado.darkMode);
});

document.getElementById("advance-cycle-button").addEventListener("click", () => {
  if (estado.dateMode !== "debug") return mostrarAviso("Activa la fecha DEBUG para avanzar el día.", true);
  const siguiente = fechaEfectiva();
  siguiente.setDate(siguiente.getDate() + 1);
  estado.debugDate = `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, "0")}-${String(siguiente.getDate()).padStart(2, "0")}`;
  guardarEstado();
  renderizar();
  mostrarAviso(`Fecha DEBUG avanzada al ${formatearFecha(estado.debugDate)}.`);
});

document.getElementById("date-mode-input").addEventListener("change", evento => {
  estado.dateMode = evento.target.value;
  if (estado.dateMode === "debug" && !estado.debugDate) estado.debugDate = hoyISO();
  guardarEstado();
  renderizar();
});

document.getElementById("save-debug-date-button").addEventListener("click", () => {
  const valor = document.getElementById("debug-date-input").value;
  if (!valor) return mostrarAviso("Selecciona una fecha DEBUG.", true);
  estado.dateMode = "debug";
  estado.debugDate = valor;
  guardarEstado();
  renderizar();
  mostrarAviso("Fecha DEBUG guardada.");
});

/* ---------- Actualizaciones (Tauri) ---------- */

document.getElementById("export-update-button").addEventListener("click", () => {
  exportarRespaldo();
  respaldoDeActualizacionExportado = true;
  document.getElementById("continue-update-button").disabled = false;
  mostrarAviso("Respaldo exportado. Ya puedes continuar.");
});

document.getElementById("dismiss-update-button").addEventListener("click", () => {
  if (actualizacionDisponible?.version) localStorage.setItem("saldo-dismissed-update", actualizacionDisponible.version);
  cerrarModal("update-modal");
  mostrarAviso("Podrás actualizar cuando quieras desde Configuración → Actualizaciones.");
});

document.getElementById("continue-update-button").addEventListener("click", () => {
  if (!respaldoDeActualizacionExportado || !actualizacionDisponible) return;
  const boton = document.getElementById("continue-update-button");
  boton.disabled = true;
  boton.textContent = "Instalando actualización…";
  actualizacionDisponible.downloadAndInstall()
    .then(() => window.__TAURI__?.process?.relaunch?.())
    .catch(() => {
      boton.disabled = false;
      boton.textContent = "2. Instalar actualización";
      mostrarAviso("No se pudo instalar la actualización. Puedes intentarlo nuevamente.", true);
    });
});
