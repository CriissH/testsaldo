/**
 * ============================================================
 *  PROYECCIÓN MENSUAL
 * ------------------------------------------------------------
 *  Estima cuánto dinero va a quedar disponible a fin de ciclo,
 *  restando al presupuesto de hoy los gastos recurrentes que
 *  todavía faltan ocurrir (y que no fueron excluidos de la
 *  proyección ni ya rechazados).
 *
 *  NOTA DE REFACTOR: este archivo reemplaza al antiguo
 *  "scripts/monthly-projection.js". Ese archivo original
 *  declaraba varias funciones (normalizeRecurringMovement,
 *  normalizeMovementStatus, y una versión de calculateProjection
 *  con 4 parámetros) que en realidad nunca se usaban: quedaban
 *  "pisadas" por funciones del mismo nombre definidas más abajo
 *  en app.js, o directamente no eran llamadas desde ningún
 *  lado. Se eliminó ese código muerto y se dejó una sola versión
 *  de cada función, ya unificada acá.
 * ============================================================
 */

/**
 * Helper puro (sin tocar el DOM ni el estado global) que calcula
 * cuánto quedaría del presupuesto restante si se descuentan los
 * gastos recurrentes pendientes indicados. Recibe una lista de
 * objetos { amount } y devuelve un único número.
 */
function calcularProyeccionMensual(presupuestoRestante, gastosRecurrentesPendientes) {
  const totalPendiente = (gastosRecurrentesPendientes || []).reduce((suma, gasto) => suma + Number(gasto.amount || 0), 0);
  return Number(presupuestoRestante || 0) - totalPendiente;
}

// Cuenta cuántas veces cae un día de la semana determinado dentro de un rango de fechas.
function contarDiasEnRango(fechaInicio, fechaFin, diaSemanaBuscado) {
  const inicio = new Date(fechaInicio.getTime());
  const fin = new Date(fechaFin.getTime());
  inicio.setHours(12, 0, 0, 0);
  fin.setHours(12, 0, 0, 0);
  let cantidad = 0;
  for (const fecha = new Date(inicio); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
    if (fecha.getDay() === Number(diaSemanaBuscado)) cantidad += 1;
  }
  return cantidad;
}

// Intenta interpretar un valor como fecha; si no se puede, devuelve la fecha de respaldo (fallback).
function interpretarFechaProyeccion(valor, respaldo) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return new Date(valor.getTime());
  if (typeof valor === "string" || typeof valor === "number") {
    const origen = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00` : valor;
    const interpretada = new Date(origen);
    if (!Number.isNaN(interpretada.getTime())) return interpretada;
  }
  return new Date(respaldo.getTime());
}

/**
 * Normaliza una plantilla recurrente para poder proyectarla:
 * asegura que tenga una fecha, frecuencia en minúsculas, un día
 * de semana válido y la marca isProjected (si el usuario decidió
 * excluirla del cálculo de proyección).
 */
function normalizarRecurrenteParaProyeccion(plantilla, fechaRespaldo = fechaEfectiva()) {
  const fechaOriginal = interpretarFechaProyeccion(plantilla.date || plantilla.recurringDate || plantilla.dueDate || plantilla.createdAt, fechaRespaldo);
  const frecuencia = String(plantilla.frequency || "daily").toLowerCase();
  const valorDiaSemana = Number(plantilla.weekday);
  const diaSemana = Number.isInteger(valorDiaSemana) && valorDiaSemana >= 0 && valorDiaSemana <= 6
    ? valorDiaSemana
    : fechaOriginal.getDay();
  return {
    ...plantilla,
    date: fechaOriginal,
    frequency: frecuencia,
    weekday: diaSemana,
    isProjected: plantilla.isProjected == null ? true : plantilla.isProjected === true
  };
}

// Normaliza un texto de estado (aprobado/rechazado/pendiente) sin importar tildes ni mayúsculas.
function normalizarEstadoProyeccion(estadoTexto) {
  const normalizado = String(estadoTexto || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["aprobado", "aprobada", "pagado", "pagada", "confirmado", "confirmada", "yes"].includes(normalizado)) return "approved";
  if (["rechazado", "rechazada", "cancelado", "cancelada", "no"].includes(normalizado)) return "rejected";
  return "pending";
}

// Estado actual (aprobado/rechazado/pendiente) de una plantilla en una fecha de referencia.
function estadoActualProyeccion(plantilla, fechaReferencia) {
  const estadoExplicito = plantilla.status || plantilla.state || plantilla.confirmationStatus;
  if (estadoExplicito) return normalizarEstadoProyeccion(estadoExplicito);
  const confirmacion = estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, fechaReferencia)];
  return normalizarEstadoProyeccion(confirmacion || (plantilla.confirmed ? "confirmed" : ""));
}

// Todas las fechas dentro de un rango en las que corresponde una plantilla recurrente.
function fechasRecurrentesEnRango(plantilla, fechaInicio, fechaFin) {
  const fechas = [];
  const inicio = new Date(fechaInicio.getTime());
  const fin = new Date(fechaFin.getTime());
  inicio.setHours(12, 0, 0, 0);
  fin.setHours(12, 0, 0, 0);
  for (const fecha = new Date(inicio); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
    const coincide = plantilla.frequency === "daily"
      || (plantilla.frequency === "weekly" && Number(plantilla.weekday) === fecha.getDay())
      || (plantilla.frequency === "monthly" && Math.min(Number(plantilla.monthlyDay || 1), diasDelMes(fecha.getFullYear(), fecha.getMonth())) === fecha.getDate());
    if (coincide) fechas.push(new Date(fecha.getTime()));
  }
  return fechas;
}

// Cantidad de ocurrencias pendientes (ni aprobadas ni rechazadas) de una plantilla, dentro de un rango.
function ocurrenciasProyectadas(plantilla, fechaInicio = fechaEfectiva(), fechaFin = obtenerFinCiclo()) {
  const normalizada = normalizarRecurrenteParaProyeccion(plantilla, fechaInicio);
  if (!normalizada.isProjected) return 0;
  const inicio = new Date(fechaInicio.getTime());
  const fin = new Date(fechaFin.getTime());
  inicio.setHours(12, 0, 0, 0);
  fin.setHours(12, 0, 0, 0);
  const fechas = normalizada.frequency === "monthly"
    ? [inicio]
    : fechasRecurrentesEnRango(normalizada, inicio, fin);
  return fechas.filter(fecha => {
    const estadoOcurrencia = estadoActualProyeccion(normalizada, fecha);
    return estadoOcurrencia !== "approved" && estadoOcurrencia !== "rejected";
  }).length;
}

// Desglose completo: por cada gasto recurrente, cuánto impacto tiene en lo que resta del ciclo.
function desgloseProyeccion() {
  const inicio = fechaEfectiva();
  const fin = obtenerFinCiclo();
  return estado.expenses.filter(item => item.recurring && item.recurringType !== "income").map(item => {
    const normalizado = normalizarRecurrenteParaProyeccion(item, inicio);
    const ocurrencias = ocurrenciasProyectadas(normalizado, inicio, fin);
    return { item: normalizado, occurrences: ocurrencias, impact: Number(normalizado.amount || 0) * ocurrencias, excluded: normalizado.isProjected === false };
  });
}

// Proyección final: lo que resta hoy, menos el impacto de los recurrentes pendientes (no excluidos).
function calcularProyeccion() {
  const restante = ingresoActual() - gastosConfirmados().reduce((suma, item) => suma + Number(item.amount || 0), 0);
  const gastosPendientes = desgloseProyeccion().filter(entrada => !entrada.excluded && entrada.impact > 0);
  return calcularProyeccionMensual(restante, gastosPendientes.map(entrada => ({ amount: entrada.impact })));
}

// Nombre corto usado por el resto de la app para pedir el valor de proyección.
function valorProyeccionMensual() { return calcularProyeccion(); }

// Calcula cuánto se sugiere ahorrar por mes para alcanzar una meta de ahorro, según la proyección disponible.
function calcularRecomendacionMeta(meta) {
  const disponible = Math.max(0, valorProyeccionMensual());
  const limiteSeguro = Math.max(0, Math.floor((ingresoActual() - gastosConfirmados().reduce((suma, item) => suma + Number(item.amount || 0), 0)) * 0.3));
  const mesesParaLaMeta = meta.targetDate
    ? Math.max(1, Math.ceil((new Date(`${meta.targetDate}T12:00:00`).getTime() - fechaEfectiva().getTime()) / (1000 * 60 * 60 * 24 * 30.4375)))
    : 6;
  const requeridoPorMes = Math.ceil(Number(meta.targetAmount || 0) / mesesParaLaMeta);
  const sugeridoPorMes = Math.min(requeridoPorMes, disponible || requeridoPorMes);
  return {
    available: disponible,
    monthsToTarget: mesesParaLaMeta,
    requiredMonthly: requeridoPorMes,
    suggestedMonthly: Math.min(sugeridoPorMes, limiteSeguro),
    safeLimit: limiteSeguro,
    goalCauses: disponible > 0
      ? `${formatearMoneda(Math.min(sugeridoPorMes, limiteSeguro))} por mes durante ${mesesParaLaMeta} meses`
      : `${formatearMoneda(requeridoPorMes)} por mes durante ${mesesParaLaMeta} meses`,
    status: disponible > 0 ? "factible" : "revisar"
  };
}

// Dibuja el modal con el detalle completo de la proyección (movimientos pendientes y excluidos).
function renderizarDetalleProyeccion() {
  const desglose = desgloseProyeccion();
  const proyectados = desglose.filter(entrada => !entrada.excluded && entrada.impact > 0);
  const excluidos = desglose.filter(entrada => entrada.excluded);
  const inicio = fechaEfectiva();
  const fin = obtenerFinCiclo();
  document.getElementById("projection-detail-cycle").textContent = `Ciclo actual: ${formatearFecha(claveFechaCiclo(inicio))} – ${formatearFecha(claveFechaCiclo(fin))}`;

  const fila = entrada => {
    const frecuencia = entrada.item.frequency === "daily" ? "Diaria" : entrada.item.frequency === "weekly" ? "Semanal" : "Mensual";
    const cuenta = `${formatearMoneda(entrada.item.amount)} × ${entrada.occurrences} ${entrada.occurrences === 1 ? "ocurrencia restante" : "ocurrencias restantes"}`;
    return `<div class="projection-detail-row"><div><strong>${escaparHtml(entrada.item.description)}</strong><span>${frecuencia}</span></div><span>${cuenta}</span><b>−${formatearMoneda(entrada.impact)}</b></div>`;
  };

  document.getElementById("projection-detail-content").innerHTML =
    `<div class="projection-detail-current"><span>Presupuesto actual hoy</span><strong>${formatearMoneda(ingresoActual() - gastosConfirmados().reduce((suma, item) => suma + Number(item.amount || 0), 0))}</strong></div>` +
    `<h3>Movimientos recurrentes pendientes</h3>${proyectados.length ? proyectados.map(fila).join("") : '<div class="empty-state compact">No hay movimientos proyectados pendientes.</div>'}` +
    `<div class="projection-detail-total"><span>Total impacto proyectado</span><strong>−${formatearMoneda(proyectados.reduce((suma, entrada) => suma + entrada.impact, 0))}</strong></div>` +
    `<div class="projection-detail-result"><span>Proyección a fin de mes</span><strong>${formatearMoneda(valorProyeccionMensual())}</strong></div>` +
    `<h3>Movimientos excluidos</h3>${excluidos.length ? excluidos.map(entrada => `<div class="projection-excluded-row">• ${escaparHtml(entrada.item.description)} · ${formatearMoneda(entrada.item.amount)} <span>[Excluido]</span></div>`).join("") : '<div class="empty-state compact">No hay movimientos excluidos.</div>'}`;
}
