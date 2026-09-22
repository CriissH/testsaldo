/**
 * ============================================================
 *  RECURRENTES (gastos e ingresos que se repiten)
 * ------------------------------------------------------------
 *  Un gasto o ingreso "recurrente" es una plantilla (guardada
 *  dentro de estado.expenses con recurring=true) que puede
 *  repetirse todos los días, un día fijo de la semana, o un día
 *  fijo del mes. Cada vez que el usuario lo confirma ("yes"), se
 *  genera un gasto real de una sola vez conectado a esa
 *  plantilla mediante recurringSourceId.
 *
 *  El "estado" de cada ocurrencia (aprobado/rechazado/pendiente)
 *  se guarda en estado.recurringConfirmations, usando una clave
 *  que combina el id de la plantilla con la fecha (o el mes, si
 *  es mensual).
 * ============================================================
 */

// Clave única para guardar la confirmación de una plantilla en una fecha dada.
function claveConfirmacionRecurrente(plantilla, fechaReferencia = new Date()) {
  if (plantilla.frequency === "monthly") {
    const anio = fechaReferencia.getFullYear();
    const mes = String(fechaReferencia.getMonth() + 1).padStart(2, "0");
    return `${plantilla.id}_${anio}-${mes}`;
  }
  return `${plantilla.id}_${claveFechaCiclo(fechaReferencia)}`;
}

// Plantillas recurrentes (de gasto o ingreso) que "tocan" hoy según su frecuencia.
function plantillasRecurrentesDeHoy() {
  const diaSemana = fechaEfectiva().getDay();
  const fechaActual = fechaEfectiva();
  const diaDelMes = fechaActual.getDate();
  return estado.expenses.filter(item => item.recurring && (
    item.frequency === "daily"
    || (item.frequency === "weekly" && Number(item.weekday) === diaSemana)
    || (item.frequency === "monthly" && Math.min(Number(item.monthlyDay), diasDelMes(fechaActual.getFullYear(), fechaActual.getMonth())) === diaDelMes)
  ));
}

// Recurrentes de hoy que todavía no fueron confirmados, rechazados ni pospuestos.
function recurrentesPendientes() {
  const confirmaciones = estado.recurringConfirmations || {};
  return plantillasRecurrentesDeHoy().filter(plantilla => {
    const clave = claveConfirmacionRecurrente(plantilla, fechaEfectiva());
    const valor = confirmaciones[clave];
    return valor !== "yes" && valor !== "no" && valor !== "deferred";
  });
}

// Todas las plantillas de GASTO recurrente con frecuencia mensual.
function plantillasRecurrentesMensuales() {
  return estado.expenses.filter(item => item.recurring && item.recurringType !== "income" && item.frequency === "monthly");
}

// Recurrentes mensuales aún sin confirmar ni rechazar.
function plantillasRecurrentesMensualesPendientes() {
  const ahora = fechaEfectiva();
  return plantillasRecurrentesMensuales().filter(plantilla =>
    estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, ahora)] !== "yes" &&
    estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, ahora)] !== "no"
  );
}

// Alias usado por la interfaz para mostrar los recurrentes mensuales pendientes.
function recurrentesMensualesPendientes() {
  return plantillasRecurrentesMensualesPendientes();
}

/**
 * Confirma, rechaza o pospone la ocurrencia de hoy de una
 * plantilla recurrente. Si se aprueba un GASTO recurrente, se
 * crea el gasto real del día; si luego se destapa que no era
 * "yes", ese gasto generado se elimina.
 */
function confirmarRecurrente(idPlantilla, estadoNuevo) {
  const plantilla = estado.expenses.find(item => item.id === idPlantilla);
  if (!plantilla) return;
  if (!estado.recurringConfirmations) estado.recurringConfirmations = {};

  const clave = claveConfirmacionRecurrente(plantilla, fechaEfectiva());
  const yaEstabaAprobado = estado.recurringConfirmations[clave] === "yes";

  estado.recurringConfirmations[clave] = estadoNuevo;

  // Solo crea el gasto físico si se aprueba y no estaba aprobado previamente
  if (estadoNuevo === "yes" && !yaEstabaAprobado && plantilla.recurringType !== "income") {
    estado.expenses.push({
      id: crypto.randomUUID(),
      description: plantilla.description,
      amount: Number(plantilla.amount),
      categoryId: plantilla.categoryId,
      date: claveDeHoy(),
      recurring: false,
      recurringSourceId: plantilla.id // vínculo con la plantilla que lo generó
    });
  } else if (estadoNuevo !== "yes" && yaEstabaAprobado && plantilla.recurringType !== "income") {
    // Si se pasa de "aprobado" a otro estado, se borra el gasto que se había generado
    const indiceHijo = estado.expenses.findIndex(item => item.recurringSourceId === plantilla.id && item.date === claveDeHoy());
    if (indiceHijo !== -1) estado.expenses.splice(indiceHijo, 1);
  }

  guardarEstado();
  renderizar();
  mostrarAviso(
    estadoNuevo === "yes"
      ? (plantilla.recurringType === "income" ? "Ingreso recurrente validado." : "Gasto confirmado y sumado.")
      : estadoNuevo === "no"
        ? "Pago marcado como rechazado."
        : "Pago desplazado: quedará pendiente."
  );
}

// Etiqueta y clase CSS a mostrar según el estado actual de un recurrente.
function obtenerEtiquetaEstadoRecurrente(plantilla) {
  const clave = claveConfirmacionRecurrente(plantilla, fechaEfectiva());
  if (estado.recurringConfirmations[clave] === "yes") return { label: "Confirmado", className: "recurring-status confirmed" };
  if (estado.recurringConfirmations[clave] === "no") return { label: "Rechazado", className: "recurring-status rejected" };
  if (estado.recurringConfirmations[clave] === "deferred") return { label: "Pendiente", className: "recurring-status pending" };
  if (estado.recurringConfirmations[clave] === "overdue") return { label: "Vencido", className: "recurring-status rejected" };

  if (plantilla.frequency !== "monthly") {
    if (recurrentesPendientes().some(item => item.id === plantilla.id)) return { label: "Esperando", className: "recurring-status pending" };
    return { label: "Sin confirmar", className: "recurring-status pending" };
  }

  const ahora = fechaEfectiva();
  const diaDelMes = Number(plantilla.monthlyDay || 1);
  const fechaVencimiento = new Date(ahora.getFullYear(), ahora.getMonth(), diaDelMes);
  const confirmado = Boolean(estado.recurringConfirmations[clave]);
  if (confirmado) return { label: "Confirmado", className: "recurring-status confirmed" };
  if (ahora >= fechaVencimiento) return { label: "Vencido", className: "recurring-status overdue" };
  return { label: "Pendiente", className: "recurring-status pending" };
}

// Próxima fecha (desde hoy) en la que corresponde una plantilla recurrente.
function proximaFechaRecurrente(plantilla) {
  const inicio = new Date(fechaEfectiva().getFullYear(), fechaEfectiva().getMonth(), fechaEfectiva().getDate());
  for (let desplazamiento = 0; desplazamiento <= 370; desplazamiento += 1) {
    const candidata = new Date(inicio.getTime());
    candidata.setDate(inicio.getDate() + desplazamiento);
    if ((plantilla.frequency === "daily")
      || (plantilla.frequency === "weekly" && candidata.getDay() === Number(plantilla.weekday))
      || (plantilla.frequency === "monthly" && candidata.getDate() === Math.min(Number(plantilla.monthlyDay || 1), diasDelMes(candidata.getFullYear(), candidata.getMonth())))) return candidata;
  }
  return inicio;
}

// Actualiza el texto de ayuda del modal "Modificar recurrente" según el alcance elegido.
function actualizarAyudaEdicionRecurrente() {
  const alcance = document.getElementById("recurring-edit-scope").value;
  document.getElementById("recurring-edit-help").textContent = alcance === "cycle"
    ? "Se actualizarán también las confirmaciones de este gasto dentro del ciclo actual y quedará registrado en el historial."
    : "Solo se aplicará a las próximas confirmaciones. Los importes ya registrados no cambiarán.";
}

// Abre el modal para modificar el importe (y otros datos) de un recurrente.
function abrirEditorRecurrente(id) {
  recurrenteAEditar = estado.expenses.find(item => item.id === id);
  if (!recurrenteAEditar) return;
  document.getElementById("recurring-edit-title").textContent = `Modificar ${recurrenteAEditar.description}`;
  document.getElementById("recurring-edit-amount").value = recurrenteAEditar.amount;
  document.getElementById("recurring-edit-weekday").value = String(Number(recurrenteAEditar.weekday ?? 1));
  document.getElementById("recurring-edit-weekday-label").hidden = recurrenteAEditar.frequency !== "weekly";
  document.getElementById("recurring-edit-monthly-day").value = recurrenteAEditar.monthlyDay || "";
  document.getElementById("recurring-edit-monthly-date-label").hidden = recurrenteAEditar.frequency !== "monthly";
  document.getElementById("recurring-edit-is-projected").checked = recurrenteAEditar.isProjected !== false;
  document.getElementById("recurring-edit-scope").value = "cycle";
  actualizarAyudaEdicionRecurrente();
  abrirModal("recurring-edit-modal");
}

// Dibuja el listado completo de recurrentes (vista "Todos los gastos recurrentes").
function renderizarTodosLosRecurrentes() {
  const plantillas = estado.expenses.filter(item => item.recurring);
  document.getElementById("recurring-all-empty").style.display = plantillas.length ? "none" : "block";

  document.getElementById("recurring-all-list").innerHTML = plantillas.map(plantilla => {
    const categoria = obtenerCategoria(plantilla.categoryId);
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const frecuencia = plantilla.frequency === "daily"
      ? "Diario"
      : plantilla.frequency === "monthly"
        ? `Mensual (Día ${plantilla.monthlyDay})`
        : `Semanal (${dias[Number(plantilla.weekday)]})`;

    const estadoEtiqueta = obtenerEtiquetaEstadoRecurrente(plantilla);
    const esIngreso = plantilla.recurringType === "income";

    return `<div class="recurring-all-row">
      <div class="recurring-item-icon" style="background:${categoria.color}20;color:${categoria.color}">${esIngreso ? "↗" : categoria.icon}</div>
      <div class="expense-info">
        <strong>${escaparHtml(plantilla.description)}</strong>
        <span class="cat-label">${esIngreso ? "Ingreso recurrente" : escaparHtml(categoria.name)}</span>
        <span class="freq-label">${frecuencia}</span>
      </div>
      <b>${formatearMoneda(plantilla.amount)}</b>
      <span class="${estadoEtiqueta.className}">${estadoEtiqueta.label}</span>

      <!-- DESKTOP: LISTA DESPLEGABLE -->
      <select class="recurring-state-select desktop-only-select" data-recurring-state="${plantilla.id}" aria-label="Cambiar estado">
        <option value="">Cambiar estado</option>
        <option value="no">Rechazado</option>
        <option value="deferred">Pendiente</option>
        <option value="overdue">Vencido</option>
        <option value="yes">Aprobado</option>
      </select>

      <!-- MÓVIL: BOTONES COMPACTOS -->
      <div class="recurring-action-wrapper mobile-only-actions">
        <span class="recurring-action-label">Cambiar estado</span>
        <div class="recurring-action-grid">
          <button class="rab-btn rab-yes" data-action="yes" data-tid="${plantilla.id}" title="Aprobar">✓</button>
          <button class="rab-btn rab-no" data-action="no" data-tid="${plantilla.id}" title="Rechazar">×</button>
          <button class="rab-btn rab-defer" data-action="deferred" data-tid="${plantilla.id}" title="Pendiente">⏳</button>
          <button class="rab-btn rab-overdue" data-action="overdue" data-tid="${plantilla.id}" title="Vencido">⚠</button>
        </div>
      </div>

      <button class="edit-button" data-edit-recurring="${plantilla.id}" title="Modificar recurrente">✎</button>
      <button class="delete-button" data-delete-recurring="${plantilla.id}" title="Eliminar recurrente">×</button>
    </div>`;
  }).join("");
}

// Dibuja la lista corta de recurrentes en la barra lateral (máximo 3).
function renderizarRecurrentesBarraLateral() {
  const plantillas = estado.expenses.filter(item => item.recurring);
  document.getElementById("sidebar-recurring-count").textContent = plantillas.length;
  document.getElementById("sidebar-recurring-empty").hidden = plantillas.length > 0;
  const visibles = plantillas.slice(0, 3);
  document.getElementById("sidebar-recurring-more").hidden = false;
  document.getElementById("sidebar-recurring-list").innerHTML = visibles.map(plantilla => {
    const categoria = obtenerCategoria(plantilla.categoryId);
    const frecuencia = plantilla.frequency === "daily"
      ? "Diario"
      : plantilla.frequency === "monthly"
        ? `Mensual · día ${plantilla.monthlyDay}`
        : `Cada ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][Number(plantilla.weekday)] || "semana"}`;
    return `<div class="sidebar-recurring-item"><button class="sidebar-recurring-main" data-edit-recurring="${plantilla.id}"><span class="sidebar-recurring-dot" style="background:${categoria.color}"></span><span class="sidebar-recurring-info"><strong>${escaparHtml(plantilla.description)}</strong><small>${frecuencia} · ${formatearMoneda(plantilla.amount)}</small></span><span class="sidebar-edit-icon">✎</span></button><button class="sidebar-recurring-delete" data-delete-recurring="${plantilla.id}" title="Eliminar recurrente" aria-label="Eliminar recurrente">×</button></div>`;
  }).join("");
}

// Widget de recurrentes que aparece arriba de la vista "Gastos" (máximo 3, solo gastos, no ingresos).
function renderizarWidgetGastosRecurrentes() {
  const widget = document.getElementById("expenses-recurring-widget");
  if (!widget) return;

  const plantillas = estado.expenses.filter(item => item.recurring && item.recurringType !== "income");

  if (plantillas.length === 0) {
    widget.hidden = true;
    return;
  }

  widget.hidden = false;
  const visibles = plantillas.slice(0, 3);

  document.getElementById("expenses-recurring-list").innerHTML = visibles.map(plantilla => {
    const categoria = obtenerCategoria(plantilla.categoryId);
    const frecuencia = plantilla.frequency === "daily"
      ? "Diario"
      : plantilla.frequency === "monthly"
        ? `Mensual · día ${plantilla.monthlyDay}`
        : `Cada ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][Number(plantilla.weekday)] || "semana"}`;

    return `<div class="sidebar-recurring-item">
      <button class="sidebar-recurring-main" data-edit-recurring="${plantilla.id}">
        <span class="sidebar-recurring-dot" style="background:${categoria.color}"></span>
        <span class="sidebar-recurring-info">
          <strong>${escaparHtml(plantilla.description)}</strong>
          <small>${frecuencia} · ${formatearMoneda(plantilla.amount)}</small>
        </span>
        <span class="sidebar-edit-icon" title="Editar recurrente">✎</span>
      </button>
    </div>`;
  }).join("");
}

// Banner con los movimientos recurrentes de hoy que todavía no fueron confirmados.
function renderizarConfirmacionRecurrentes() {
  const pendientes = recurrentesPendientes();
  const mensualesPendientes = recurrentesMensualesPendientes();
  const banner = document.getElementById("pending-banner");
  const barra = document.getElementById("recurring-bar");
  const hayPospuestos = Object.values(estado.recurringConfirmations || {}).some(valor => valor === "deferred");
  const hayAviso = pendientes.length > 0 || mensualesPendientes.length > 0 || hayPospuestos;
  banner.hidden = !hayAviso;

  document.getElementById("pending-banner-title").textContent = "MOVIMIENTOS SIN CONFIRMAR";
  document.getElementById("pending-banner-copy").textContent = "Hay transacciones (ingresos o gastos) desplazadas o sin confirmar. Confírmalas cuando corresponda.";
  document.getElementById("recurring-date-label").textContent = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(fechaDeHoy());

  const todosLosPendientes = [...pendientes, ...mensualesPendientes]
    .filter(item => estado.recurringConfirmations[claveConfirmacionRecurrente(item, fechaEfectiva())] !== "deferred")
    .filter((item, indice, arreglo) => arreglo.findIndex(candidato => candidato.id === item.id) === indice);

  if (todosLosPendientes.length === 0) {
    barra.hidden = true;
    document.getElementById("recurring-items").innerHTML = "";
    return;
  }

  barra.hidden = false;
  document.getElementById("recurring-items").innerHTML = todosLosPendientes.map(plantilla => {
    const categoria = obtenerCategoria(plantilla.categoryId);
    const frecuencia = plantilla.frequency === "daily" ? "Diario" : plantilla.frequency === "weekly" ? "Semanal" : "Mensual";
    const esIngreso = plantilla.recurringType === "income";
    return `<div class="recurring-item"><div class="recurring-item-icon" style="background:${categoria.color}20;color:${categoria.color}">${esIngreso ? "↗" : categoria.icon}</div><div class="recurring-item-info"><strong>${escaparHtml(plantilla.description)}</strong><span>${esIngreso ? "Ingreso" : escaparHtml(categoria.name)} · ${frecuencia}</span></div><b>${formatearMoneda(plantilla.amount)}</b><button class="confirm-button yes" data-confirm-recurring="${plantilla.id}" title="Validar">✓</button><button class="confirm-button no" data-reject-recurring="${plantilla.id}" title="Rechazar">×</button><button class="confirm-button defer" data-defer-recurring="${plantilla.id}" title="Desplazar / dejar pendiente">…</button></div>`;
  }).join("");
}

// Banner que avisa cuando un ingreso recurrente se aprobó hoy.
function renderizarAvisoIngresoAprobado() {
  const banner = document.getElementById("income-success-banner");
  const ingreso = ingresoRecurrenteAprobado();
  if (!ingreso || avisoIngresoDescartado) {
    banner.hidden = true;
    return;
  }
  document.getElementById("income-success-copy").textContent = `Se ha aprobado un ingreso recurrente de ${formatearMoneda(ingreso.amount)} el ${formatearFecha(claveDeHoy())}`;
  banner.hidden = false;
}
