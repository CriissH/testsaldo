/**
 * ============================================================
 *  RECURRENTES (gastos e ingresos que se repiten)
 * ------------------------------------------------------------
 *  Un gasto o ingreso "recurrente" es una plantilla (guardada
 *  dentro de estado.expenses con recurring=true).
 * ============================================================
 */

function fechaVencimientoMensual(plantilla, fechaReferencia = new Date()) {
  const diaCorte = Number(estado.cutoffDay || 1);
  const diaVencimiento = Number(plantilla.monthlyDay || 1);
  
  let anio = fechaReferencia.getFullYear();
  let mes = fechaReferencia.getMonth();
  
  // 1. Determinar en qué mes inició el ciclo actual
  if (fechaReferencia.getDate() < diaCorte) {
     mes -= 1;
     if (mes < 0) { 
       mes = 11; 
       anio -= 1; 
     }
  }
  
  // 2. Determinar en qué mes cae el vencimiento dentro de ESTE ciclo
  let mesVencimiento = mes;
  let anioVencimiento = anio;
  
  if (diaVencimiento < diaCorte) {
     mesVencimiento += 1;
     if (mesVencimiento > 11) { 
       mesVencimiento = 0; 
       anioVencimiento += 1; 
     }
  }
  
  // 3. Ajustar por si el mes no tiene suficientes días (ej. 31 en noviembre)
  const maxDias = new Date(anioVencimiento, mesVencimiento + 1, 0).getDate();
  return new Date(anioVencimiento, mesVencimiento, Math.min(diaVencimiento, maxDias));
}

function claveConfirmacionRecurrente(plantilla, fechaReferencia = new Date()) {
  // Para los mensuales, la clave es la fecha exacta de VENCIMIENTO (única e inamovible durante todo el ciclo)
  if (plantilla.frequency === "monthly" || plantilla.frequency === "mensual") {
    const fVenc = fechaVencimientoMensual(plantilla, fechaReferencia);
    const yyyy = fVenc.getFullYear();
    const mm = String(fVenc.getMonth() + 1).padStart(2, '0');
    const dd = String(fVenc.getDate()).padStart(2, '0');
    return `${plantilla.id}_${yyyy}-${mm}-${dd}`;
  }
  
  // Para diarios, semanales o quincenales, la clave es la ocurrencia del día exacto
  const yyyy = fechaReferencia.getFullYear();
  const mm = String(fechaReferencia.getMonth() + 1).padStart(2, '0');
  const dd = String(fechaReferencia.getDate()).padStart(2, '0');
  return `${plantilla.id}_${yyyy}-${mm}-${dd}`;
}
// === FUNCIÓN NUEVA CENTRALIZADA PARA FORMATEAR TEXTO ===
function formatearFrecuenciaTexto(plantilla) {
  const freq = plantilla.frequency;
  if (freq === "daily" || freq === "diario") return "Diario";
  if (freq === "monthly" || freq === "mensual") return `Mensual (Día ${plantilla.monthlyDay})`;
  if (freq === "quincenal") return "Quincenal";
  if (freq === "weekly" || freq === "semanal") {
    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    if (Array.isArray(plantilla.weekday)) {
      return `Semanal (${plantilla.weekday.map(d => dias[d]).join(", ")})`;
    }
    return `Semanal (${dias[Number(plantilla.weekday)] || ""})`;
  }
  return "Recurrente";
}

function plantillasRecurrentesDeHoy() {
  const diaSemana = fechaEfectiva().getDay();
  const fechaActual = fechaEfectiva();
  const diaDelMes = fechaActual.getDate();
  
  return estado.expenses.filter(item => {
    if (!item.recurring) return false;
    const freq = item.frequency;
    
    const fechaCreacion = new Date((item.date || hoyISO()) + "T12:00:00");
    const inicioDiaCreacion = new Date(fechaCreacion.getFullYear(), fechaCreacion.getMonth(), fechaCreacion.getDate());
    const inicioHoy = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate());
    
    if (inicioHoy < inicioDiaCreacion) return false;

    if (freq === "daily" || freq === "diario") return true;
    
    if (freq === "weekly" || freq === "semanal") {
      if (Array.isArray(item.weekday)) return item.weekday.includes(diaSemana);
      return Number(item.weekday) === diaSemana;
    }
    
    if (freq === "monthly" || freq === "mensual") {
      return Math.min(Number(item.monthlyDay || 1), diasDelMes(fechaActual.getFullYear(), fechaActual.getMonth())) === diaDelMes;
    }
    
    if (freq === "quincenal") {
      const diffTime = Math.abs(fechaActual - fechaCreacion);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays % 14 === 0;
    }
    
    return false;
  });
}

function recurrentesPendientes() {
  const confirmaciones = estado.recurringConfirmations || {};
  return plantillasRecurrentesDeHoy().filter(plantilla => {
    const clave = claveConfirmacionRecurrente(plantilla, fechaEfectiva());
    const valor = confirmaciones[clave];
    return valor !== "yes" && valor !== "no" && valor !== "deferred";
  });
}

function plantillasRecurrentesMensuales() {
  return estado.expenses.filter(item => item.recurring && item.recurringType !== "income" && (item.frequency === "monthly" || item.frequency === "mensual"));
}

function plantillasRecurrentesMensualesPendientes() {
  const ahora = fechaEfectiva();
  return plantillasRecurrentesMensuales().filter(plantilla => {
    if (ahora < fechaVencimientoMensual(plantilla, ahora)) return false;
    const confirmacion = estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, ahora)];
    return confirmacion !== "yes" && confirmacion !== "no";
  });
}

function recurrentesMensualesPendientes() {
  return plantillasRecurrentesMensualesPendientes();
}

function confirmarRecurrente(idPlantilla, estadoNuevo) {
  const plantilla = estado.expenses.find(item => item.id === idPlantilla);
  if (!plantilla) return;
  if (!estado.recurringConfirmations) estado.recurringConfirmations = {};

  const clave = claveConfirmacionRecurrente(plantilla, fechaEfectiva());
  const yaEstabaAprobado = estado.recurringConfirmations[clave] === "yes";

  estado.recurringConfirmations[clave] = estadoNuevo;

  if (estadoNuevo === "yes" && !yaEstabaAprobado && plantilla.recurringType !== "income") {
    estado.expenses.push({
      id: crypto.randomUUID(),
      description: plantilla.description,
      amount: Number(plantilla.amount),
      categoryId: plantilla.categoryId,
      date: claveDeHoy(),
      recurring: false,
      recurringSourceId: plantilla.id
    });
  } else if (estadoNuevo !== "yes" && yaEstabaAprobado && plantilla.recurringType !== "income") {
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

function obtenerEtiquetaEstadoRecurrente(plantilla) {
  const clave = claveConfirmacionRecurrente(plantilla, fechaEfectiva());
  if (estado.recurringConfirmations[clave] === "yes") return { label: "Confirmado", className: "recurring-status confirmed" };
  if (estado.recurringConfirmations[clave] === "no") return { label: "Rechazado", className: "recurring-status rejected" };
  if (estado.recurringConfirmations[clave] === "deferred") return { label: "Pendiente", className: "recurring-status pending" };
  if (estado.recurringConfirmations[clave] === "overdue") return { label: "Vencido", className: "recurring-status rejected" };

  if (plantilla.frequency !== "monthly" && plantilla.frequency !== "mensual") {
    if (recurrentesPendientes().some(item => item.id === plantilla.id)) return { label: "Esperando", className: "recurring-status pending" };
    return { label: "Sin confirmar", className: "recurring-status pending" };
  }

  const ahora = fechaEfectiva();
  const fechaVencimiento = fechaVencimientoMensual(plantilla, ahora);
  const confirmado = Boolean(estado.recurringConfirmations[clave]);
  if (confirmado) return { label: "Confirmado", className: "recurring-status confirmed" };
  if (ahora >= fechaVencimiento) return { label: "Vencido", className: "recurring-status overdue" };
  return { label: "Pendiente", className: "recurring-status pending" };
}

function proximaFechaRecurrente(plantilla) {
  const inicio = new Date(fechaEfectiva().getFullYear(), fechaEfectiva().getMonth(), fechaEfectiva().getDate());
  const freq = plantilla.frequency;
  
  for (let desplazamiento = 0; desplazamiento <= 370; desplazamiento += 1) {
    const candidata = new Date(inicio.getTime());
    candidata.setDate(inicio.getDate() + desplazamiento);
    
    if (freq === "daily" || freq === "diario") return candidata;
    if (freq === "weekly" || freq === "semanal") {
      if (Array.isArray(plantilla.weekday) && plantilla.weekday.includes(candidata.getDay())) return candidata;
      if (!Array.isArray(plantilla.weekday) && candidata.getDay() === Number(plantilla.weekday)) return candidata;
    }
    if ((freq === "monthly" || freq === "mensual") && candidata.getDate() === Math.min(Number(plantilla.monthlyDay || 1), diasDelMes(candidata.getFullYear(), candidata.getMonth()))) return candidata;
    if (freq === "quincenal") {
      const fechaC = new Date((plantilla.date || hoyISO()) + "T00:00:00");
      const diffTime = Math.abs(candidata - fechaC);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays % 14 === 0) return candidata;
    }
  }
  return inicio;
}

function actualizarAyudaEdicionRecurrente() {
  const alcance = document.getElementById("recurring-edit-scope").value;
  document.getElementById("recurring-edit-help").textContent = alcance === "cycle"
    ? "Se actualizarán también las confirmaciones de este gasto dentro del ciclo actual y quedará registrado en el historial."
    : "Solo se aplicará a las próximas confirmaciones. Los importes ya registrados no cambiarán.";
}

function abrirEditorRecurrente(id) {
  recurrenteAEditar = estado.expenses.find(item => item.id === id);
  if (!recurrenteAEditar) return;
  document.getElementById("recurring-edit-title").textContent = `Modificar ${recurrenteAEditar.description}`;
  document.getElementById("recurring-edit-amount").value = recurrenteAEditar.amount;
  
  // En caso de Array, mostramos el primer día (el diseño viejo del HTML no soporta selects múltiples nativos)
  document.getElementById("recurring-edit-weekday").value = String(Number(Array.isArray(recurrenteAEditar.weekday) ? recurrenteAEditar.weekday[0] : recurrenteAEditar.weekday ?? 1));
  
  const freq = recurrenteAEditar.frequency;
  document.getElementById("recurring-edit-weekday-label").hidden = (freq !== "weekly" && freq !== "semanal");
  document.getElementById("recurring-edit-monthly-day").value = recurrenteAEditar.monthlyDay || "";
  document.getElementById("recurring-edit-monthly-date-label").hidden = (freq !== "monthly" && freq !== "mensual");
  
  document.getElementById("recurring-edit-is-projected").checked = recurrenteAEditar.isProjected !== false;
  document.getElementById("recurring-edit-scope").value = "cycle";
  actualizarAyudaEdicionRecurrente();
  abrirModal("recurring-edit-modal");
}

var filtroRecurrentesMovil = "expense";

function renderizarTodosLosRecurrentes() {
  const plantillas = estado.expenses.filter(item => item.recurring);
  const esIngreso = filtroRecurrentesMovil === "income";
  const plantillasVisibles = plantillas.filter(item => esIngreso
    ? item.recurringType === "income"
    : item.recurringType !== "income");
  document.getElementById("recurring-all-empty").style.display = plantillasVisibles.length ? "none" : "block";
  document.getElementById("recurring-all-empty").textContent = esIngreso ? "No hay ingresos recurrentes." : "No hay gastos recurrentes.";

  document.getElementById("recurring-all-list").innerHTML = plantillasVisibles.map(plantilla => {
    const categoria = obtenerCategoria(plantilla.categoryId);
    const frecuencia = formatearFrecuenciaTexto(plantilla);
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

function renderizarRecurrentesBarraLateral() {
  const plantillas = estado.expenses.filter(item => item.recurring);
  document.getElementById("sidebar-recurring-count").textContent = plantillas.length;
  document.getElementById("sidebar-recurring-empty").hidden = plantillas.length > 0;
  const visibles = plantillas.slice(0, 3);
  document.getElementById("sidebar-recurring-more").hidden = false;
  
  document.getElementById("sidebar-recurring-list").innerHTML = visibles.map(plantilla => {
    const categoria = obtenerCategoria(plantilla.categoryId);
    const frecuencia = formatearFrecuenciaTexto(plantilla);
    
    return `<div class="sidebar-recurring-item"><button class="sidebar-recurring-main" data-edit-recurring="${plantilla.id}"><span class="sidebar-recurring-dot" style="background:${categoria.color}"></span><span class="sidebar-recurring-info"><strong>${escaparHtml(plantilla.description)}</strong><small>${frecuencia} · ${formatearMoneda(plantilla.amount)}</small></span><span class="sidebar-edit-icon">✎</span></button><button class="sidebar-recurring-delete" data-delete-recurring="${plantilla.id}" title="Eliminar recurrente" aria-label="Eliminar recurrente">×</button></div>`;
  }).join("");
}

function renderizarWidgetGastosRecurrentes() {
  const widget = document.getElementById("expenses-recurring-widget");
  if (!widget) return;

  const plantillas = estado.expenses.filter(item => item.recurring);

  if (plantillas.length === 0) {
    widget.hidden = true;
    return;
  }

  widget.hidden = false;
  const gastos = plantillas.filter(item => item.recurringType !== "income").length;
  const ingresos = plantillas.filter(item => item.recurringType === "income").length;
  document.getElementById("expenses-recurring-list").innerHTML =
    `<div class="recurring-count-summary"><strong>${gastos} ${gastos === 1 ? "gasto recurrente" : "gastos recurrentes"}</strong><span> · </span><strong>${ingresos} ${ingresos === 1 ? "ingreso recurrente" : "ingresos recurrentes"}</strong></div><button type="button" class="recurring-widget-link" data-view-link="recurring-all">Ver todos los recurrentes <span>→</span></button>`;
}

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

  const esAndroid = /Android/i.test(navigator.userAgent);
  const pendientesVisibles = esAndroid ? todosLosPendientes.slice(0, 1) : todosLosPendientes;
  const restantes = todosLosPendientes.length - pendientesVisibles.length;
  barra.hidden = false;
  document.getElementById("recurring-items").innerHTML = pendientesVisibles.map(plantilla => {
    const categoria = obtenerCategoria(plantilla.categoryId);
    const frecuencia = formatearFrecuenciaTexto(plantilla);
    const esIngreso = plantilla.recurringType === "income";
    
    return `<div class="recurring-item"><div class="recurring-item-icon" style="background:${categoria.color}20;color:${categoria.color}">${esIngreso ? "↗" : categoria.icon}</div><div class="recurring-item-info"><strong>${escaparHtml(plantilla.description)}</strong><span>${esIngreso ? "Ingreso" : escaparHtml(categoria.name)} · ${frecuencia}</span></div><b>${formatearMoneda(plantilla.amount)}</b><button class="confirm-button yes" data-confirm-recurring="${plantilla.id}" title="Validar">✓</button><button class="confirm-button no" data-reject-recurring="${plantilla.id}" title="Rechazar">×</button><button class="confirm-button defer" data-defer-recurring="${plantilla.id}" title="Desplazar / dejar pendiente">…</button></div>`;
  }).join("") + (esAndroid && restantes > 0
    ? `<span class="recurring-more-indicator" aria-label="Hay ${restantes} recurrentes más para confirmar"><span class="recurring-more-dots">•••</span><small>Hay ${restantes} ${restantes === 1 ? "más" : "más"} para confirmar</small></span>`
    : "");
}

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