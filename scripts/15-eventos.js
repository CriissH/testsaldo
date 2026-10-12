/**
 * ============================================================
 *  EVENTOS
 * ------------------------------------------------------------
 *  Acá se conectan todos los elementos del HTML con las
 *  funciones de negocio de los demás módulos.
 * ============================================================
 */

/* ---------- Clics delegados (un solo listener para todo el documento) ---------- */

document.addEventListener("click", evento => {
  const navegacion = evento.target.closest("[data-view]");
  if (navegacion) navegar(navegacion.dataset.view);

  const enlace = evento.target.closest("[data-view-link]");
  if (enlace) navegar(enlace.dataset.viewLink);

  const categoriaGastos = evento.target.closest("[data-category-expenses]");
  if (categoriaGastos && !evento.target.closest("button")) {
    abrirGastosDeCategoria(categoriaGastos.dataset.categoryExpenses);
    return;
  }

  const filtroRecurrente = evento.target.closest("[data-recurring-mobile-filter]");
  if (filtroRecurrente) {
    filtroRecurrentesMovil = filtroRecurrente.dataset.recurringMobileFilter;
    document.querySelectorAll("[data-recurring-mobile-filter]").forEach(tab => tab.classList.toggle("active", tab === filtroRecurrente));
    renderizarTodosLosRecurrentes();
    return;
  }

  const cerrar = evento.target.closest("[data-close-modal]");
  if (cerrar) cerrarModal(cerrar.dataset.closeModal);

  const abrirOtroModal = evento.target.closest("[data-open-modal]");
  if (abrirOtroModal) abrirModal(abrirOtroModal.dataset.openModal);

  if (evento.target.id === "new-expense-button" || evento.target.id === "new-expense-button-2") {
    document.getElementById("expense-form").reset();
    completarSelectorDeCategorias();
    document.getElementById("expense-modal-title").textContent = "Registrar gasto";
    document.getElementById("date-input").value = hoyISO();
    document.getElementById("recurring-is-projected").checked = true;
    if (typeof cambiarPestanaGasto === "function") cambiarPestanaGasto("unico");
    abrirModal("expense-modal");
  }

  if (evento.target.id === "income-button") {
    document.getElementById("income-form").reset();
    if (typeof cambiarPestanaIngreso === "function") cambiarPestanaIngreso("sumar");
    abrirModal("income-modal");
  }

  const editarRecurrente = evento.target.closest("[data-edit-recurring]");
  if (editarRecurrente) abrirEditorRecurrente(editarRecurrente.dataset.editRecurring);

  const eliminarRecurrente = evento.target.closest("[data-delete-recurring]");
  if (eliminarRecurrente) { recurrenteAEliminar = eliminarRecurrente.dataset.deleteRecurring; abrirModal("recurring-delete-modal"); }

  const editarGasto = evento.target.closest("[data-edit-expense]");
  if (editarGasto) abrirEditorDeGasto(editarGasto.dataset.editExpense);

  if (evento.target.id === "pending-banner-button") navegar("recurring-all");

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

document.addEventListener("keydown", evento => {
  const categoriaGastos = evento.target.closest("[data-category-expenses]");
  if (categoriaGastos && (evento.key === "Enter" || evento.key === " ")) {
    evento.preventDefault();
    abrirGastosDeCategoria(categoriaGastos.dataset.categoryExpenses);
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

document.getElementById("expense-form")?.addEventListener("submit", evento => {
  evento.preventDefault();
  const esRecurrente = !document.getElementById("tab-expense-recurrente").hidden;
  
  const descripcion = esRecurrente 
    ? document.getElementById("recurring-desc-input").value.trim() 
    : document.getElementById("description-input").value.trim();
    
  const importe = Number(esRecurrente 
    ? document.getElementById("recurring-amount-input").value 
    : document.getElementById("amount-input").value);
    
  const categoriaId = esRecurrente 
    ? document.getElementById("recurring-category-input").value 
    : document.getElementById("category-input").value;

  if (descripcion.length < 2 || /^\d+$/.test(descripcion)) return mostrarAviso("La descripción debe tener al menos 2 caracteres.", true);
  if (!Number.isFinite(importe) || importe <= 0) return mostrarAviso("Indica un importe mayor que cero.", true);

if (!esRecurrente) {
    const valorFechaIngresada = document.getElementById("date-input").value;
    const fechaIngresada = new Date(`${valorFechaIngresada}T12:00:00`);
    if (!valorFechaIngresada || fechaIngresada < obtenerInicioCiclo() || fechaIngresada > obtenerFinCiclo()) {
      return mostrarAviso(`La fecha debe estar dentro del ciclo actual: ${formatearFecha(claveFechaCiclo(obtenerInicioCiclo()))} al ${formatearFecha(claveFechaCiclo(obtenerFinCiclo()))}.`, true);
    }
    estado.expenses.push({
      id: crypto.randomUUID(),
      description: descripcion,
      amount: importe,
      categoryId: categoriaId,
      date: valorFechaIngresada,
      recurring: false,
      recurringType: "expense",
      isProjected: true
    });
  } else {
    const frecuencia = document.getElementById("recurring-frequency-select").value;
    let diaSemana = null;
    
    if (frecuencia === "semanal" || frecuencia === "weekly") {
      const botonesActivos = document.querySelectorAll("#expense-days-container button.active");
      if (botonesActivos.length > 0) {
        diaSemana = Array.from(botonesActivos).map(b => Number(b.dataset.day));
      } else {
        diaSemana = [new Date((document.getElementById("recurring-start-date").value || hoyISO()) + "T12:00:00").getDay()];
      }
    }
    
    estado.expenses.push({
      id: crypto.randomUUID(),
      description: descripcion,
      amount: importe,
      categoryId: categoriaId,
      date: document.getElementById("recurring-start-date").value || hoyISO(),
      recurring: true,
      recurringType: "expense",
      frequency: frecuencia,
      weekday: diaSemana,
      monthlyDay: (frecuencia === "mensual" || frecuencia === "quincenal") ? new Date((document.getElementById("recurring-start-date").value || hoyISO()) + "T12:00:00").getDate() : null,
      isProjected: document.getElementById("recurring-is-projected").checked
    });
  }

  guardarEstado();
  evento.target.reset();
  cerrarModal("expense-modal");
  renderizar();
  mostrarAviso("Movimiento guardado correctamente.");
});

/* ---------- Proyección ---------- */

document.getElementById("projection-detail-button")?.addEventListener("click", () => {
  renderizarDetalleProyeccion();
  abrirModal("projection-detail-modal");
});

/* ---------- Categorías ---------- */

document.getElementById("category-form")?.addEventListener("submit", evento => {
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

document.getElementById("expense-edit-reason")?.addEventListener("change", evento => {
  const esOtro = evento.target.value === "Otro";
  document.getElementById("expense-edit-custom-reason-label").hidden = !esOtro;
  document.getElementById("expense-edit-custom-reason").required = esOtro;
});

document.getElementById("expense-edit-form")?.addEventListener("submit", evento => {
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

document.getElementById("recurring-edit-scope")?.addEventListener("change", actualizarAyudaEdicionRecurrente);

document.getElementById("recurring-edit-form")?.addEventListener("submit", evento => {
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

/* ---------- Ingresos ---------- */

document.getElementById("income-form")?.addEventListener("submit", evento => {
  evento.preventDefault();
  
  const isSumar = !document.getElementById("tab-income-sumar").hidden;
  const isFijar = !document.getElementById("tab-income-fijar").hidden;
  const isRecurrente = !document.getElementById("tab-income-recurrente").hidden;
  
  let importe, razon, actionType;

  if (isSumar) {
    importe = Number(document.getElementById("income-sumar-amount").value);
    razon = document.getElementById("income-sumar-reason").value.trim() || "Ingreso extra";
    actionType = "addition";
  } else if (isFijar) {
    importe = Number(document.getElementById("income-fijar-amount").value);
    razon = document.getElementById("income-fijar-reason").value.trim() || "Ajuste manual de saldo";
    actionType = "current";
  } else if (isRecurrente) {
    importe = Number(document.getElementById("income-recurrente-amount").value);
    razon = document.getElementById("income-recurring-desc").value.trim() || "Ingreso recurrente";
    actionType = "recurring";
  }

  if (!Number.isFinite(importe) || importe <= 0) return mostrarAviso("Indica un importe mayor a cero.", true);

if (actionType === "recurring") {
    const frecuencia = document.getElementById("income-recurring-frequency").value;
    const startDate = document.getElementById("income-recurring-date").value || hoyISO();
    const dateObj = new Date(startDate + "T12:00:00");
    
    let diaSemana = null;
    if (frecuencia === "semanal" || frecuencia === "weekly") {
      const botonesActivos = document.querySelectorAll("#income-days-container button.active");
      if (botonesActivos.length > 0) {
        diaSemana = Array.from(botonesActivos).map(b => Number(b.dataset.day));
      } else {
        diaSemana = [dateObj.getDay()];
      }
    }
    
    estado.expenses.push({ 
      id: crypto.randomUUID(), 
      description: razon, 
      amount: importe, 
      categoryId: estado.categories[0].id, 
      date: startDate, 
      recurring: true, 
      recurringType: "income", 
      frequency: frecuencia, 
      weekday: diaSemana, 
      monthlyDay: (frecuencia === "mensual" || frecuencia === "quincenal") ? dateObj.getDate() : null, 
      isProjected: true 
    });
    mostrarAviso("Ingreso recurrente creado correctamente.");
  } else {
    const entrada = { id: crypto.randomUUID(), amount: importe, reason: razon, date: hoyISO(), cutoffDay: estado.cutoffDay, type: actionType };
    
    if (actionType === "current") {
      const gastosYaCargados = gastosConfirmados().reduce((total, gasto) => total + Number(gasto.amount || 0), 0);
      // "Fijar" define el presupuesto restante actual. Los recurrentes
      // solo deben descontarse en la proyección, no en este saldo.
      estado.currentCycleIncome = importe + gastosYaCargados;
      estado.incomeNotice = `Presupuesto restante fijado en ${formatearMoneda(importe)} el ${formatearFecha(hoyISO())}. Se contemplaron ${formatearMoneda(gastosYaCargados)} de gastos ya cargados. Razón: ${razon}.`;
      estado.incomeHistory.push(entrada);
      mostrarAviso("Monto actual sobrescrito y fijado.");
    } else if (actionType === "addition") {
      estado.currentCycleIncome = ingresoActual() + importe;
      estado.incomeNotice = `Se sumaron ${formatearMoneda(importe)} el ${formatearFecha(hoyISO())}. Razón: ${razon}.`;
      estado.incomeHistory.push(entrada);
      mostrarAviso("Monto sumado correctamente al saldo actual.");
    }
  }
  
  guardarEstado();
  evento.target.reset();
  cerrarModal("income-modal");
  renderizar();
});

/* ---------- Compra colectiva ---------- */

document.getElementById("collective-config-form")?.addEventListener("submit", evento => {
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

document.getElementById("collective-expense-form")?.addEventListener("submit", evento => {
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

document.getElementById("collective-people")?.addEventListener("change", () => {});
document.getElementById("collective-receipt-button")?.addEventListener("click", imprimirComprobanteColectivo);
document.getElementById("collective-reset-button")?.addEventListener("click", reiniciarColectivo);
document.getElementById("open-tutorial-button")?.addEventListener("click", () => { location.href = "tutorial.html?desde=app"; });
document.getElementById("collective-save-debts-button")?.addEventListener("click", abrirModalDeudasColectivo);
document.getElementById("collective-self")?.addEventListener("change", actualizarVistaPreviaDeudasColectivo);
document.getElementById("collective-debts-confirm")?.addEventListener("click", confirmarDeudasColectivo);

/* ---------- Ahorros ---------- */

document.getElementById("deposit-savings-button")?.addEventListener("click", () => abrirModalDeAhorro("deposit"));
document.getElementById("withdraw-savings-button")?.addEventListener("click", () => abrirModalDeAhorro("withdrawal"));

document.getElementById("new-savings-goal-button")?.addEventListener("click", () => {
  document.getElementById("savings-goal-form").reset();
  document.getElementById("savings-goal-modal-title").textContent = "Nueva meta";
  actualizarSugerenciaMetaDeAhorro();
  abrirModal("savings-goal-modal");
});

document.getElementById("savings-goal-target")?.addEventListener("input", actualizarSugerenciaMetaDeAhorro);
document.getElementById("savings-goal-date")?.addEventListener("change", actualizarSugerenciaMetaDeAhorro);

document.getElementById("savings-action")?.addEventListener("change", evento => {
  document.getElementById("savings-modal-title").textContent = evento.target.value === "deposit" ? "Ingresar ahorro" : "Extraer ahorro";
});

document.getElementById("savings-date-today")?.addEventListener("change", evento => {
  document.getElementById("savings-date").disabled = evento.target.checked;
});

document.getElementById("savings-form")?.addEventListener("submit", evento => {
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

document.getElementById("savings-goal-form")?.addEventListener("submit", evento => {
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

/* ---------- Bienvenida (onboarding) ---------- */

// Función para alternar la vista entre Fijo y Variable en el Onboarding
window.seleccionarTipoOnboarding = function(tipo) {
  const cardFixed = document.getElementById('card-fixed');
  const cardVariable = document.getElementById('card-variable');
  const radioFixed = document.getElementById('radio-fixed');
  const radioVariable = document.getElementById('radio-variable');
  const dynamicContainer = document.getElementById('dynamic-fields');

  if (tipo === 'fixed') {
    cardFixed.classList.add('selected');
    cardVariable.classList.remove('selected');
    radioFixed.checked = true;
    radioVariable.checked = false;

    dynamicContainer.innerHTML = `
      <div class="field-group">
        <label>¿Cuánto recibes de ingreso neto (en mano)?</label>
        <input type="number" id="welcome-income-input" min="0.01" step="0.01" placeholder="Ej: 250000" required />
        <span class="field-note">Dinero real disponible tras descuentos y aportes.</span>
      </div>
      <div class="field-group">
        <label>¿Qué día recibes tu ingreso?</label>
        <input type="number" id="welcome-cutoff-input" min="1" max="31" placeholder="Ej: 5" required />
        <span class="field-note">El ciclo de gastos se reinicia en este día de cada mes.</span>
      </div>
      <div class="field-group" style="margin-bottom: 0;">
        <label>📈 Estimado de aumento mensual (%) <span style="font-weight: normal; color: var(--muted);">(Opcional)</span></label>
        <input type="number" id="welcome-growth-input" value="0" step="0.5" />
        <span class="field-note">Por defecto en 0%. Úsalo para proyectar aumentos en ciclos futuros.</span>
      </div>
    `;
  } else {
    cardVariable.classList.add('selected');
    cardFixed.classList.remove('selected');
    radioVariable.checked = true;
    radioFixed.checked = false;

    dynamicContainer.innerHTML = `
      <div class="field-group" style="margin-bottom: 0;">
        <label>¿Qué día del mes se reinicia tu ciclo?</label>
        <input type="number" id="welcome-cutoff-input" min="1" max="31" placeholder="Ej: 1" required />
        <span class="field-note">Tu presupuesto inicial arrancará en $0 y se alimentará de los ingresos manuales que cargues durante el mes.</span>
      </div>
    `;
  }
};

document.getElementById("welcome-form")?.addEventListener("submit", evento => {
  evento.preventDefault();
  
  const esVariable = document.getElementById("radio-variable").checked;
  const inputIngreso = document.getElementById("welcome-income-input");
  const inputCorte = document.getElementById("welcome-cutoff-input");
  const inputAumento = document.getElementById("welcome-growth-input");

  // Si es variable, el ingreso base es 0
  estado.income = esVariable ? 0 : Number(inputIngreso.value);
  estado.cutoffDay = Number(inputCorte.value);
  
  // Guardamos las nuevas variables en el estado (útiles para futuras actualizaciones de Saldo)
  estado.incomeType = esVariable ? "variable" : "fixed";
  estado.estimatedGrowth = (!esVariable && inputAumento) ? (Number(inputAumento.value) || 0) : 0;

  estado.onboardingComplete = true;
  estado.lastCycleStart = claveFechaCiclo(obtenerInicioCiclo());
  
  estado.incomeHistory.push({ 
    id: crypto.randomUUID(), 
    amount: estado.income, 
    reason: "Configuración inicial", 
    date: hoyISO(), 
    cutoffDay: estado.cutoffDay, 
    type: "current" 
  });
  
  guardarEstado();
  cerrarModal("welcome-modal");
  renderizar();
  mostrarAviso("¡Listo! Tu presupuesto ya está configurado.");
});

document.getElementById("welcome-import-button")?.addEventListener("click", () => document.getElementById("welcome-import-file").click());
document.getElementById("welcome-import-file")?.addEventListener("change", evento => {
  archivoImportacionBienvenida = evento.target.files[0] || null;
  const botonConfirmar = document.getElementById("welcome-import-confirm");
  document.getElementById("welcome-import-status").textContent = archivoImportacionBienvenida
    ? `${archivoImportacionBienvenida.name} seleccionado. Confirma para restaurar.`
    : "Después de seleccionarlo, confirma la importación.";
  botonConfirmar.hidden = !archivoImportacionBienvenida;
  evento.target.value = "";
});
document.getElementById("welcome-import-confirm")?.addEventListener("click", () => {
  if (!archivoImportacionBienvenida) return;
  importarRespaldo(archivoImportacionBienvenida);
  archivoImportacionBienvenida = null;
  document.getElementById("welcome-import-confirm").hidden = true;
});

/* ---------- Gastos: búsqueda, filtro y estadísticas ---------- */

document.getElementById("expense-search")?.addEventListener("input", renderizarGastos);
document.getElementById("expense-filter")?.addEventListener("change", evento => {
  filtroCategoriaGastos = evento.target.value;
  renderizarGastos();
});
document.getElementById("stats-period")?.addEventListener("change", renderizarEstadisticas);
document.getElementById("android-notifications-button")?.addEventListener("click", activarNotificacionesAndroid);
document.getElementById("debug-notification-button")?.addEventListener("click", lanzarNotificacionPruebaAndroid);
document.getElementById("export-logs-button")?.addEventListener("click", () => {
  SaldoLogs.info("diagnostico", "Exportación solicitada desde Configuración");
  SaldoLogs.descargar();
  mostrarAviso("Registro de ejecución exportado.");
});
document.getElementById("clear-logs-button")?.addEventListener("click", () => {
  SaldoLogs.limpiar();
  mostrarAviso("Registro de ejecución limpiado.");
});

/* ---------- Reportes, respaldos y sistema ---------- */

document.getElementById("pdf-button")?.addEventListener("click", () => { navegar("reports"); setTimeout(() => window.print(), 100); });
document.getElementById("export-button")?.addEventListener("click", exportarRespaldo);
document.getElementById("restore-button")?.addEventListener("click", () => document.getElementById("import-file").click());
document.getElementById("import-button")?.addEventListener("click", () => document.getElementById("import-file").click());
document.getElementById("import-file")?.addEventListener("change", evento => { if (evento.target.files[0]) importarRespaldo(evento.target.files[0]); evento.target.value = ""; });

document.getElementById("reset-system-button")?.addEventListener("click", () => {
  document.getElementById("reset-form").reset();
  document.getElementById("confirm-reset-button").disabled = true;
  abrirModal("reset-modal");
});

document.getElementById("unlock-debug-button")?.addEventListener("click", () => {
  const clave = window.prompt("Contraseña de desarrollador");
  if (clave === "cris") {
    depuracionDesbloqueada = true;
    renderizarConfiguracion();
    mostrarAviso("Opciones de desarrollador desbloqueadas.");
  } else if (clave !== null) {
    mostrarAviso("Contraseña incorrecta.", true);
  }
});

document.getElementById("reset-password")?.addEventListener("input", evento => {
  document.getElementById("confirm-reset-button").disabled = evento.target.value !== "CONFIRMAR";
});

document.getElementById("reset-form")?.addEventListener("submit", evento => {
  evento.preventDefault();
  if (document.getElementById("reset-password").value !== "CONFIRMAR") return;
  localStorage.removeItem(CLAVE_ALMACENAMIENTO);
  estado = clonarDatos(estadoPorDefecto);
  evento.target.reset();
  cerrarModal("reset-modal");
  navegar("dashboard");
  renderizar();
  mostrarAviso("Sistema reiniciado. Comienza una nueva configuración.");
});

document.getElementById("check-update-button")?.addEventListener("click", () => verificarActualizacion(true, true));

// ESTE ES EL EVENTO DEL MODO OSCURO QUE SE HABÍA PERDIDO
document.getElementById("dark-mode-toggle")?.addEventListener("change", evento => {
  estado.darkMode = evento.target.checked;
  guardarEstado();
  document.body.classList.toggle("dark-mode", estado.darkMode);
});

document.getElementById("advance-cycle-button")?.addEventListener("click", () => {
  if (estado.dateMode !== "debug") return mostrarAviso("Activa la fecha DEBUG para avanzar el día.", true);
  const siguiente = fechaEfectiva();
  siguiente.setDate(siguiente.getDate() + 1);
  estado.debugDate = `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, "0")}-${String(siguiente.getDate()).padStart(2, "0")}`;
  guardarEstado();
  renderizar();
  mostrarAviso(`Fecha DEBUG avanzada al ${formatearFecha(estado.debugDate)}.`);
});

document.getElementById("date-mode-input")?.addEventListener("change", evento => {
  estado.dateMode = evento.target.value;
  if (estado.dateMode === "debug" && !estado.debugDate) estado.debugDate = hoyISO();
  guardarEstado();
  renderizar();
});

document.getElementById("save-debug-date-button")?.addEventListener("click", () => {
  const valor = document.getElementById("debug-date-input").value;
  if (!valor) return mostrarAviso("Selecciona una fecha DEBUG.", true);
  estado.dateMode = "debug";
  estado.debugDate = valor;
  guardarEstado();
  renderizar();
  mostrarAviso("Fecha DEBUG guardada.");
});

/* ---------- Actualizaciones (Tauri) ---------- */

document.getElementById("export-update-button")?.addEventListener("click", () => {
  exportarRespaldo();
  respaldoDeActualizacionExportado = true;
  document.getElementById("continue-update-button").disabled = false;
  mostrarAviso("Respaldo exportado. Ya puedes continuar.");
});

document.getElementById("dismiss-update-button")?.addEventListener("click", () => {
  if (actualizacionDisponible?.version) localStorage.setItem("saldo-dismissed-update", actualizacionDisponible.version);
  cerrarModal("update-modal");
  mostrarAviso("Podrás actualizar cuando quieras desde Configuración → Actualizaciones.");
});

document.getElementById("continue-update-button")?.addEventListener("click", () => {
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

// (El indicador de scroll ahora es automático: ver 19-scroll-hint.js)

/* ---------- Configuración (Cambio de Modo - A prueba de fallos) ---------- */

// Escuchar cambios en vivo en el selector de modalidad (Delegado)
document.addEventListener("change", evento => {
  if (evento.target.id === "settings-income-type") {
    const esVariable = evento.target.value === "variable";
    const camposFijos = document.getElementById("settings-fixed-fields");
    const inputIngreso = document.getElementById("income-input");
    const labelCorte = document.getElementById("cutoff-label-text");
    const hintCorte = document.getElementById("cutoff-hint-text");
    
    if (camposFijos) camposFijos.hidden = esVariable;
    if (inputIngreso) inputIngreso.required = !esVariable;
    
    if (labelCorte) {
      labelCorte.textContent = esVariable ? "Fecha de cierre o reinicio" : "Fecha de cobro";
    }
    if (hintCorte) {
      hintCorte.textContent = esVariable ? "Día del mes en que arranca tu nuevo ciclo" : "Día del mes en que recibes tu ingreso";
    }
  }
});

/* ---------- Configuración: Cambio de Modo con Modal Estilizado ---------- */

let datosPendientesConfiguracion = null;

document.addEventListener("submit", evento => {
  if (evento.target.id === "settings-form") {
    evento.preventDefault();
    
    const nuevoModoEsVariable = document.getElementById("settings-income-type").value === "variable";
    const antiguoModoEraVariable = estado.incomeType === "variable";
    const nuevoIngreso = Number(document.getElementById("income-input").value) || 0;
    const nuevoCorte = Number(document.getElementById("cutoff-input").value);

    // CASO CLAVE: Si estaba en variable y pasa a fijo con un monto > 0
    if (antiguoModoEraVariable && !nuevoModoEsVariable && nuevoIngreso > 0) {
      
      // Guardamos temporalmente los datos para usarlos cuando el usuario elija
      datosPendientesConfiguracion = { nuevoIngreso, nuevoCorte };

      // Actualizamos el texto dinámico con el monto formateado
      const textoModal = document.getElementById("income-transition-text");
      if (textoModal) {
        textoModal.innerHTML = t("¿Deseas sumar los <b>{}</b> al ciclo actual de inmediato?", formatearMoneda(nuevoIngreso));
      }

      // Abrimos nuestro modal con estilo Saldo
      abrirModal("income-transition-modal");
      return;
    }

    // Comportamiento normal para cualquier otro cambio de configuración
    estado.incomeType = nuevoModoEsVariable ? "variable" : "fixed";
    estado.income = nuevoModoEsVariable ? 0 : nuevoIngreso;
    estado.cutoffDay = nuevoCorte;
    
    if (nuevoModoEsVariable) {
      estado.currentCycleIncome = null;
    }
    
    guardarEstado();
    renderizar();
    mostrarAviso("Configuración guardada correctamente.");
  }
});

// Botón: Sumar ahora (Aceptar)
document.getElementById("income-transition-confirm")?.addEventListener("click", () => {
  if (!datosPendientesConfiguracion) return;
  const { nuevoIngreso, nuevoCorte } = datosPendientesConfiguracion;

  estado.incomeType = "fixed";
  estado.cutoffDay = nuevoCorte;
  estado.currentCycleIncome = (estado.currentCycleIncome || 0) + nuevoIngreso;
  estado.income = nuevoIngreso;
  estado.incomeHistory.push({
    id: crypto.randomUUID(),
    amount: nuevoIngreso,
    reason: "Cambio de modo a Fijo (Aplicado al ciclo actual)",
    date: hoyISO(),
    type: "addition"
  });

  guardarEstado();
  cerrarModal("income-transition-modal");
  renderizar();
  mostrarAviso("Configuración guardada. Ingreso sumado al ciclo actual.");
  datosPendientesConfiguracion = null;
});

// Botón: Aplicar en próximo ciclo (Cancelar)
document.getElementById("income-transition-cancel")?.addEventListener("click", () => {
  if (!datosPendientesConfiguracion) return;
  const { nuevoIngreso, nuevoCorte } = datosPendientesConfiguracion;

  // Calculamos la fecha exacta del próximo ciclo
  const hoy = fechaEfectiva();
  let anio = hoy.getFullYear();
  let mes = hoy.getMonth();
  if (hoy.getDate() >= nuevoCorte) {
    mes += 1;
    if (mes > 11) { mes = 0; anio += 1; }
  }
  const maxDias = diasDelMes(anio, mes);
  const diaRealCorte = Math.min(nuevoCorte, maxDias);
  const fechaProximoCorte = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(diaRealCorte).padStart(2, "0")}`;

  estado.incomeType = "fixed";
  estado.cutoffDay = nuevoCorte;
  
  // Activamos la bandera de espera visual y programamos el pendiente oficial
  estado.incomeWaitingForNextCycle = true;
  estado.pendingIncome = {
    amount: nuevoIngreso,
    cutoffDay: nuevoCorte,
    effectiveDate: fechaProximoCorte,
    reason: "Nuevo ingreso base (Próximo ciclo)"
  };

  guardarEstado();
  cerrarModal("income-transition-modal");
  renderizar();
  mostrarAviso(`Configuración guardada. El ingreso se aplicará el ${formatearFecha(fechaProximoCorte)}.`);
  datosPendientesConfiguracion = null;
});