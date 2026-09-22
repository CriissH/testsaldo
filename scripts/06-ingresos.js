/**
 * ============================================================
 *  INGRESOS
 * ------------------------------------------------------------
 *  Cálculo del ingreso del ciclo (base + ingresos recurrentes ya
 *  confirmados), manejo de los "ingresos recurrentes" (que en
 *  el fondo se guardan como una plantilla más dentro de
 *  estado.expenses, con recurringType "income") y aplicación de
 *  un ingreso que quedó programado para el próximo ciclo.
 * ============================================================
 */

// Ingreso "de base": el monto actual del ciclo si fue modificado, o el ingreso mensual configurado.
function ingresoBase() {
  return estado.currentCycleIncome == null ? Number(estado.income || 0) : Number(estado.currentCycleIncome);
}

// Todas las plantillas de ingreso recurrente (sueldos, extras, etc.).
function plantillasIngresoRecurrente() {
  return estado.expenses.filter(item => item.recurring && item.recurringType === "income");
}

/**
 * Dado un ingreso o gasto recurrente, devuelve todas las fechas
 * dentro de un rango en las que debería "ocurrir" según su
 * frecuencia (diaria, semanal en un día fijo, o mensual en un
 * día fijo).
 */
function fechasOcurrenciaRecurrente(plantilla, inicio, fin) {
  const fechas = [];
  for (const fecha = new Date(inicio.getTime()); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
    const coincide = plantilla.frequency === "daily"
      || (plantilla.frequency === "weekly" && Number(plantilla.weekday) === fecha.getDay())
      || (plantilla.frequency === "monthly" && Math.min(Number(plantilla.monthlyDay || 1), diasDelMes(fecha.getFullYear(), fecha.getMonth())) === fecha.getDate());
    if (coincide) fechas.push(new Date(fecha.getTime()));
  }
  return fechas;
}

// Suma de los ingresos recurrentes ya confirmados ("aprobados") en lo que va del ciclo.
function totalIngresoRecurrenteConfirmado(hasta = fechaEfectiva()) {
  const inicio = obtenerInicioCiclo();
  return plantillasIngresoRecurrente().reduce((total, plantilla) =>
    fechasOcurrenciaRecurrente(plantilla, inicio, hasta).reduce((suma, fecha) => {
      const clave = claveConfirmacionRecurrente(plantilla, fecha);
      return suma + (estado.recurringConfirmations[clave] === "yes" ? Number(plantilla.amount || 0) : 0);
    }, total), 0);
}

// Ingreso total disponible en el ciclo: base + recurrentes confirmados.
function ingresoActual() {
  return ingresoBase() + totalIngresoRecurrenteConfirmado();
}

// Suma de los ingresos recurrentes mensuales (para mostrarlos en el panel).
function totalIngresoRecurrenteMensual() {
  return plantillasIngresoRecurrente().filter(item => item.frequency === "monthly").reduce((suma, item) => suma + Number(item.amount || 0), 0);
}

// Ingresos recurrentes mensuales que ya vencieron y todavía no fueron confirmados ni rechazados.
function ingresoRecurrentePendiente() {
  const ahora = fechaEfectiva();
  return plantillasIngresoRecurrente().filter(plantilla => {
    const fechaVencimiento = plantilla.frequency === "monthly"
      ? new Date(ahora.getFullYear(), ahora.getMonth(), Number(plantilla.monthlyDay || 1))
      : null;
    if (!fechaVencimiento || ahora < fechaVencimiento) return false;
    const estadoConfirmacion = estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, ahora)];
    return estadoConfirmacion !== "yes" && estadoConfirmacion !== "no";
  });
}

// El ingreso recurrente que fue aprobado hoy (para mostrar el banner de éxito).
function ingresoRecurrenteAprobado() {
  const ahora = fechaEfectiva();
  return plantillasIngresoRecurrente().find(plantilla => estado.recurringConfirmations[claveConfirmacionRecurrente(plantilla, ahora)] === "yes");
}

/**
 * Si hay un ingreso programado para el próximo ciclo
 * (estado.pendingIncome) y ya llegó su fecha efectiva, lo aplica:
 * actualiza el ingreso mensual y el día de corte, y lo deja
 * registrado en el historial de ingresos.
 */
function aplicarIngresoPendiente() {
  if (!estado.pendingIncome || fechaEfectiva() < new Date(`${estado.pendingIncome.effectiveDate}T00:00:00`)) return;
  const pendiente = estado.pendingIncome;
  estado.income = pendiente.amount;
  estado.currentCycleIncome = null;
  estado.cutoffDay = pendiente.cutoffDay;
  estado.incomeHistory.push({ ...pendiente, type: "next-applied", date: hoyISO() });
  estado.pendingIncome = null;
  guardarEstado();
}

// Razón elegida (o escrita) en el formulario de modificación de ingreso.
function razonDeIngreso() {
  const seleccionada = document.getElementById("income-reason").value;
  return seleccionada === "Otro" ? document.getElementById("income-custom-reason").value.trim() : seleccionada;
}

/**
 * Ajusta qué campos se muestran en el formulario "Modificar
 * ingreso" según la acción elegida (adición, monto actual,
 * próximo ciclo o ingreso recurrente).
 */
function actualizarFormularioIngreso() {
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
}
