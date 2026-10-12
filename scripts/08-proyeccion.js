/**
 * ============================================================
 *  PROYECCIÓN MENSUAL
 * ------------------------------------------------------------
 *  Estima cuánto dinero va a quedar disponible a fin de ciclo,
 *  restando al presupuesto de hoy los gastos recurrentes que
 *  todavía faltan ocurrir (y que no fueron excluidos de la
 *  proyección ni ya rechazados).
 * ============================================================
 */

function calcularProyeccionMensual(presupuestoRestante, gastosRecurrentesPendientes) {
  const totalPendiente = (gastosRecurrentesPendientes || []).reduce((suma, gasto) => suma + Number(gasto.amount || 0), 0);
  return Number(presupuestoRestante || 0) - totalPendiente;
}

function contarDiasEnRango(fechaInicio, fechaFin, diaSemanaBuscado) {
  const inicio = new Date(fechaInicio.getTime());
  const fin = new Date(fechaFin.getTime());
  inicio.setHours(12, 0, 0, 0);
  fin.setHours(12, 0, 0, 0);
  let cantidad = 0;
  for (const fecha = new Date(inicio); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
    if (Array.isArray(diaSemanaBuscado)) {
      if (diaSemanaBuscado.includes(fecha.getDay())) cantidad += 1;
    } else {
      if (fecha.getDay() === Number(diaSemanaBuscado)) cantidad += 1;
    }
  }
  return cantidad;
}

function interpretarFechaProyeccion(valor, respaldo) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return new Date(valor.getTime());
  if (typeof valor === "string" || typeof valor === "number") {
    const origen = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00` : valor;
    const interpretada = new Date(origen);
    if (!Number.isNaN(interpretada.getTime())) return interpretada;
  }
  return new Date(respaldo.getTime());
}

function normalizarRecurrenteParaProyeccion(plantilla, fechaRespaldo = fechaEfectiva()) {
  const fechaOriginal = interpretarFechaProyeccion(plantilla.date || plantilla.recurringDate || plantilla.dueDate || plantilla.createdAt, fechaRespaldo);
  const frecuencia = String(plantilla.frequency || "daily").toLowerCase();
  
  // Respetamos si el weekday ya es un array
  let diaSemana = plantilla.weekday;
  if (!Array.isArray(diaSemana)) {
    const valorDiaSemana = Number(plantilla.weekday);
    diaSemana = Number.isInteger(valorDiaSemana) && valorDiaSemana >= 0 && valorDiaSemana <= 6
      ? valorDiaSemana
      : fechaOriginal.getDay();
  }

  return {
    ...plantilla,
    date: fechaOriginal,
    frequency: frecuencia,
    weekday: diaSemana,
    isProjected: plantilla.isProjected == null ? true : plantilla.isProjected === true
  };
}

function normalizarEstadoProyeccion(estadoTexto) {
  const normalizado = String(estadoTexto || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["aprobado", "aprobada", "pagado", "pagada", "confirmado", "confirmada", "yes"].includes(normalizado)) return "approved";
  if (["rechazado", "rechazada", "cancelado", "cancelada", "no"].includes(normalizado)) return "rejected";
  return "pending";
}

function estadoActualProyeccion(plantilla, fechaReferencia) {
  const estadoExplicito = plantilla.status || plantilla.state || plantilla.confirmationStatus;
  if (estadoExplicito) return normalizarEstadoProyeccion(estadoExplicito);
  const confirmacion = estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, fechaReferencia)];
  return normalizarEstadoProyeccion(confirmacion || (plantilla.confirmed ? "confirmed" : ""));
}

function fechasRecurrentesEnRango(plantilla, fechaInicio, fechaFin) {
  const fechas = [];
  const inicio = new Date(fechaInicio.getTime());
  const fin = new Date(fechaFin.getTime());
  inicio.setHours(12, 0, 0, 0);
  fin.setHours(12, 0, 0, 0);

  const fechaCreacion = new Date((plantilla.date || hoyISO()) + "T12:00:00");

  for (const fecha = new Date(inicio); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
    let coincide = false;
    const freq = plantilla.frequency;

    if (freq === "daily" || freq === "diario") {
      coincide = true;
    } else if (freq === "weekly" || freq === "semanal") {
      if (Array.isArray(plantilla.weekday)) {
        coincide = plantilla.weekday.includes(fecha.getDay());
      } else {
        coincide = Number(plantilla.weekday) === fecha.getDay();
      }
    } else if (freq === "monthly" || freq === "mensual") {
      coincide = Math.min(Number(plantilla.monthlyDay || 1), diasDelMes(fecha.getFullYear(), fecha.getMonth())) === fecha.getDate();
    } else if (freq === "quincenal") {
      const diffTime = Math.abs(fecha - fechaCreacion);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      coincide = diffDays % 14 === 0;
    }

    if (coincide) fechas.push(new Date(fecha.getTime()));
  }
  return fechas;
}

function ocurrenciasProyectadas(plantilla, fechaInicio = fechaEfectiva(), fechaFin = obtenerFinCiclo()) {
  const normalizada = normalizarRecurrenteParaProyeccion(plantilla, fechaInicio);
  if (!normalizada.isProjected) return 0;
  const inicio = new Date(fechaInicio.getTime());
  const fin = new Date(fechaFin.getTime());
  inicio.setHours(12, 0, 0, 0);
  fin.setHours(12, 0, 0, 0);

  const freq = normalizada.frequency;
  const fechas = (freq === "monthly" || freq === "mensual")
    ? [inicio]
    : fechasRecurrentesEnRango(normalizada, inicio, fin);
    
  return fechas.filter(fecha => {
    const estadoOcurrencia = estadoActualProyeccion(normalizada, fecha);
    return estadoOcurrencia !== "approved" && estadoOcurrencia !== "rejected";
  }).length;
}

function desgloseProyeccion() {
  const inicio = fechaEfectiva();
  const fin = obtenerFinCiclo();
  return estado.expenses.filter(item => item.recurring && item.recurringType !== "income").map(item => {
    const normalizado = normalizarRecurrenteParaProyeccion(item, inicio);
    const ocurrencias = ocurrenciasProyectadas(normalizado, inicio, fin);
    return { item: normalizado, occurrences: ocurrencias, impact: Number(normalizado.amount || 0) * ocurrencias, excluded: normalizado.isProjected === false };
  });
}

function totalGastosRecurrentesPendientes() {
  return desgloseProyeccion()
    .filter(entrada => !entrada.excluded && entrada.impact > 0)
    .reduce((total, entrada) => total + entrada.impact, 0);
}

function calcularProyeccion() {
  const restante = ingresoActual() - gastosConfirmados().reduce((suma, item) => suma + Number(item.amount || 0), 0);
  return calcularProyeccionMensual(restante, [{ amount: totalGastosRecurrentesPendientes() }]);
}

function valorProyeccionMensual() { return calcularProyeccion(); }

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

function renderizarDetalleProyeccion() {
  const desglose = desgloseProyeccion();
  const proyectados = desglose.filter(entrada => !entrada.excluded && entrada.impact > 0);
  const excluidos = desglose.filter(entrada => entrada.excluded);
  const inicio = fechaEfectiva();
  const fin = obtenerFinCiclo();
  document.getElementById("projection-detail-cycle").textContent = `Ciclo actual: ${formatearFecha(claveFechaCiclo(inicio))} – ${formatearFecha(claveFechaCiclo(fin))}`;

  const fila = entrada => {
    const freq = entrada.item.frequency;
    let frecuenciaTexto = "Recurrente";
    if (freq === "daily" || freq === "diario") frecuenciaTexto = "Diaria";
    if (freq === "weekly" || freq === "semanal") frecuenciaTexto = "Semanal";
    if (freq === "monthly" || freq === "mensual") frecuenciaTexto = "Mensual";
    if (freq === "quincenal") frecuenciaTexto = "Quincenal";

    const cuenta = `${formatearMoneda(entrada.item.amount)} × ${entrada.occurrences} ${entrada.occurrences === 1 ? "ocurrencia restante" : "ocurrencias restantes"}`;
    return `<div class="projection-detail-row"><div><strong>${escaparHtml(entrada.item.description)}</strong><span>${frecuenciaTexto}</span></div><span>${cuenta}</span><b>−${formatearMoneda(entrada.impact)}</b></div>`;
  };

  document.getElementById("projection-detail-content").innerHTML =
    `<div class="projection-detail-current"><span>Presupuesto actual hoy</span><strong>${formatearMoneda(ingresoActual() - gastosConfirmados().reduce((suma, item) => suma + Number(item.amount || 0), 0))}</strong></div>` +
    `<h3>Movimientos recurrentes pendientes</h3>${proyectados.length ? proyectados.map(fila).join("") : '<div class="empty-state compact">No hay movimientos proyectados pendientes.</div>'}` +
    `<div class="projection-detail-total"><span>Total impacto proyectado</span><strong>−${formatearMoneda(proyectados.reduce((suma, entrada) => suma + entrada.impact, 0))}</strong></div>` +
    `<div class="projection-detail-result"><span>Proyección a fin de mes</span><strong>${formatearMoneda(valorProyeccionMensual())}</strong></div>` +
    `<h3>Movimientos excluidos</h3>${excluidos.length ? excluidos.map(entrada => `<div class="projection-excluded-row">• ${escaparHtml(entrada.item.description)} ·${formatearMoneda(entrada.item.amount)} <span>[Excluido]</span></div>`).join("") : '<div class="empty-state compact">No hay movimientos excluidos.</div>'}`;
}