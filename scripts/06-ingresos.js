/**
 * ============================================================
 *  INGRESOS
 * ------------------------------------------------------------
 *  Cálculo del ingreso del ciclo (base + ingresos recurrentes ya
 *  confirmados), manejo de los "ingresos recurrentes" y aplicación de
 *  un ingreso que quedó programado para el próximo ciclo.
 * ============================================================
 */

function ingresoBase() {
  const hayPendienteActivo = estado.incomeWaitingForNextCycle && estado.pendingIncome && fechaEfectiva() < new Date(`${estado.pendingIncome.effectiveDate}T00:00:00`);
  if (hayPendienteActivo) {
    return Number(estado.currentCycleIncome || 0);
  }
  return estado.currentCycleIncome == null ? Number(estado.income || 0) : Number(estado.currentCycleIncome);
}

function plantillasIngresoRecurrente() {
  return estado.expenses.filter(item => item.recurring && item.recurringType === "income");
}

function fechasOcurrenciaRecurrente(plantilla, inicio, fin) {
  const fechas = [];
  const fechaCreacion = new Date((plantilla.date || hoyISO()) + "T00:00:00");
  const inicioReal = new Date(Math.max(inicio.getTime(), fechaCreacion.getTime()));

  for (const fecha = new Date(inicioReal.getTime()); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
    let coincide = false;
    const freq = plantilla.frequency;

    if (freq === "daily" || freq === "diario") {
      coincide = true;
    } else if (freq === "weekly" || freq === "semanal") {
      const diaActual = fecha.getDay();
      if (Array.isArray(plantilla.weekday)) {
        coincide = plantilla.weekday.includes(diaActual);
      } else {
        coincide = Number(plantilla.weekday) === diaActual;
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

function totalIngresoRecurrenteConfirmado(hasta = fechaEfectiva()) {
  const inicio = obtenerInicioCiclo();
  return plantillasIngresoRecurrente().reduce((total, plantilla) =>
    fechasOcurrenciaRecurrente(plantilla, inicio, hasta).reduce((suma, fecha) => {
      const clave = claveConfirmacionRecurrente(plantilla, fecha);
      return suma + (estado.recurringConfirmations[clave] === "yes" ? Number(plantilla.amount || 0) : 0);
    }, total), 0);
}

function ingresoActual() {
  return ingresoBase() + totalIngresoRecurrenteConfirmado();
}

function totalIngresoRecurrenteMensual() {
  return plantillasIngresoRecurrente().filter(item => item.frequency === "monthly" || item.frequency === "mensual").reduce((suma, item) => suma + Number(item.amount || 0), 0);
}

function ingresoRecurrentePendiente() {
  const ahora = fechaEfectiva();
  return plantillasIngresoRecurrente().filter(plantilla => {
    const freq = plantilla.frequency;
    const fechaVencimiento = (freq === "monthly" || freq === "mensual")
      ? fechaVencimientoMensual(plantilla, ahora)
      : null;
    if (!fechaVencimiento || ahora < fechaVencimiento) return false;
    const estadoConfirmacion = estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, ahora)];
    return estadoConfirmacion !== "yes" && estadoConfirmacion !== "no";
  });
}

function ingresoRecurrenteAprobado() {
  const ahora = fechaEfectiva();
  return plantillasIngresoRecurrente().find(plantilla => estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, ahora)] === "yes");
}

function aplicarIngresoPendiente() {
  if (!estado.pendingIncome || fechaEfectiva() < new Date(`${estado.pendingIncome.effectiveDate}T00:00:00`)) return;
  const pendiente = estado.pendingIncome;
  estado.income = pendiente.amount;
  estado.currentCycleIncome = null;
  estado.cutoffDay = pendiente.cutoffDay;
  estado.incomeWaitingForNextCycle = false; // Apagamos el cartel de espera
  estado.incomeHistory.push({ ...pendiente, type: "next-applied", date: hoyISO() });
  estado.pendingIncome = null;
  guardarEstado();
} 

function razonDeIngreso() { 
  const seleccionada = document.getElementById("income-reason").value;
  return seleccionada === "Otro" ? document.getElementById("income-custom-reason").value.trim() : seleccionada;
}

/**
 * Ajusta qué campos se muestran en el formulario "Modificar
 * ingreso" según la acción elegida (adición, monto actual,
 * próximo ciclo o ingreso recurrente).
 */
/*function actualizarFormularioIngreso() {
  const accion = document.getElementById("income-action").value;
  const etiquetaCorte = document.getElementById("income-cutoff-label");
  const etiquetaMonto = document.getElementById("income-amount-label");
  const opcionesRecurrente = document.getElementById("income-recurring-options");
  document.getElementById("income-change-cutoff").value = estado.cutoffDay;
  const esRecurrente = accion === "recurring";
  etiquetaCorte.hidden = esRecurrente || accion !== "next";
  document.getElementById("income-change-cutoff").required = accion === "next";
  etiquetaMonto.firstChild.textContent = accion === "addition" ? "Monto a sumar" : accion === "current" ? "Nuevo monto actual" : esRecurrente ? "Importe del ingreso recurrente" : "Nuevo monto mensual";
  opcionesRecurrente.hidden = !esRecurrente;
  document.getElementById("income-reason-label").hidden = esRecurrente;
  document.getElementById("income-reason").required = !esRecurrente;
  document.getElementById("income-custom-reason-label").hidden = esRecurrente || document.getElementById("income-reason").value !== "Otro";
  document.getElementById("income-custom-reason").required = !esRecurrente && document.getElementById("income-reason").value === "Otro";
  document.getElementById("income-recurring-weekday-label").hidden = !esRecurrente || document.getElementById("income-recurring-frequency").value !== "weekly";
  document.getElementById("income-recurring-monthly-label").hidden = !esRecurrente || document.getElementById("income-recurring-frequency").value !== "monthly";
}*/

