/**
 * ============================================================
 *  CICLOS PRESUPUESTARIOS
 * ------------------------------------------------------------
 *  Maneja las fechas de corte. Cada vez que pasa la "fecha de
 *  corte" (cutoffDay), el dinero que sobró del mes se envía
 *  automáticamente al saldo de Ahorros.
 * ============================================================
 */

function fechaEfectiva() {
  if (estado.dateMode === "debug" && estado.debugDate) {
    const arr = estado.debugDate.split("-");
    return new Date(Number(arr[0]), Number(arr[1]) - 1, Number(arr[2]), 12, 0, 0);
  }
  return new Date();
}

function hoyISO() {
  return fechaEfectiva().toISOString().slice(0, 10);
}

function hoyDelSistemaISO() {
  return new Date().toISOString().slice(0, 10);
}

function diasDelMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

function obtenerInicioCiclo(fecha = fechaEfectiva()) {
  const diaCorte = Number(estado.cutoffDay || 1);
  let anio = fecha.getFullYear();
  let mes = fecha.getMonth();
  if (fecha.getDate() < diaCorte) {
    mes -= 1;
    if (mes < 0) { mes = 11; anio -= 1; }
  }
  const maxDias = diasDelMes(anio, mes);
  return new Date(anio, mes, Math.min(diaCorte, maxDias), 12, 0, 0);
}

function obtenerFinCiclo(fecha = fechaEfectiva()) {
  const inicio = obtenerInicioCiclo(fecha);
  let anio = inicio.getFullYear();
  let mes = inicio.getMonth() + 1;
  if (mes > 11) { mes = 0; anio += 1; }
  const diaCorte = Number(estado.cutoffDay || 1);
  const maxDias = diasDelMes(anio, mes);
  const diaFin = Math.min(diaCorte, maxDias);
  const fin = new Date(anio, mes, diaFin, 12, 0, 0);
  fin.setDate(fin.getDate() - 1);
  fin.setHours(23, 59, 59);
  return fin;
}

function claveFechaCiclo(fecha = fechaEfectiva()) {
  return obtenerInicioCiclo(fecha).toISOString().slice(0, 10);
}

function claveDeHoy() {
  return hoyISO();
}

function esCicloActual(gasto) {
  if (!gasto.date) return false;
  const fechaGasto = new Date(gasto.date + "T12:00:00");
  const inicio = obtenerInicioCiclo();
  const fin = obtenerFinCiclo();
  inicio.setHours(0, 0, 0, 0);
  fin.setHours(23, 59, 59, 999);
  return fechaGasto >= inicio && fechaGasto <= fin;
}

function cerrarCiclosCompletados() {
  // Permite cerrar ciclos si hay ingreso configurado o si está en modo variable (ingreso base $0 intencional)
  if ((!estado.income && estado.incomeType !== "variable") || !estado.onboardingComplete) return;

  const inicioDeEsteMes = claveFechaCiclo(fechaEfectiva());

  if (estado.testCycleOverride) {
    estado.lastCycleStart = estado.testCycleOverride;
    estado.testCycleOverride = null;
    guardarEstado();
  }

  if (!estado.lastCycleStart) {
    estado.lastCycleStart = inicioDeEsteMes;
    
    // === NUEVO: Aseguramos que haya un registro inicial al instalar la app ===
    if (!estado.incomeHistory) estado.incomeHistory = [];
    if (estado.incomeHistory.length === 0) {
      estado.incomeHistory.push({
        amount: estado.income,
        type: "current",
        date: hoyISO(),
        reason: "Presupuesto inicial"
      });
    }
    
    guardarEstado();
    return;
  }

  if (inicioDeEsteMes !== estado.lastCycleStart) {
    // Limpiar el aviso de ingreso manual del mes pasado
    estado.incomeNotice = ""; 
    
    let fechaInicioGuardada = new Date(estado.lastCycleStart + "T12:00:00");
    let ciclosProcesados = 0;

    while (claveFechaCiclo(fechaInicioGuardada) !== inicioDeEsteMes && ciclosProcesados < 60) {
      const inicio = obtenerInicioCiclo(fechaInicioGuardada);
      const fin = obtenerFinCiclo(fechaInicioGuardada);

      const presupuestoBase = estado.currentCycleIncome == null ? Number(estado.income || 0) : Number(estado.currentCycleIncome);
      const ingresoRecurrenteMismoCiclo = estado.expenses.filter(item => item.recurring && item.recurringType === "income").reduce((total, plantilla) => {
        return total + fechasOcurrenciaRecurrente(plantilla, inicio, fin).reduce((suma, f) => {
          const c = claveConfirmacionRecurrente(plantilla, f);
          return suma + (estado.recurringConfirmations[c] === "yes" ? Number(plantilla.amount || 0) : 0);
        }, 0);
      }, 0);

      const presupuestoMensual = presupuestoBase + ingresoRecurrenteMismoCiclo;

      const gastosDelMes = estado.expenses.filter(g => {
        if (g.recurring) return false;
        if (!g.date) return false;
        const d = new Date(g.date + "T12:00:00");
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(23, 59, 59, 999);
        return d >= inicio && d <= fin;
      }).reduce((suma, g) => suma + Number(g.amount || 0), 0);

      const remanente = presupuestoMensual - gastosDelMes;

      if (remanente > 0) {
        estado.savingsBalance = Number(estado.savingsBalance || 0) + remanente;
        estado.savingsHistory = estado.savingsHistory || [];
        estado.savingsHistory.push({
          start: inicio.toISOString().slice(0, 10),
          end: fin.toISOString().slice(0, 10),
          transferred: remanente,
          date: hoyISO()
        });
      }

      // Reiniciamos el "Ingreso Actual" para el nuevo ciclo
      estado.currentCycleIncome = null;

      // Saltamos al ciclo siguiente
      fechaInicioGuardada.setDate(fechaInicioGuardada.getDate() + 32);
      fechaInicioGuardada = obtenerInicioCiclo(fechaInicioGuardada);
      ciclosProcesados++;
    }

    estado.lastCycleStart = inicioDeEsteMes;
    
    // === NUEVO: Crear un registro visual del presupuesto arrastrado para el nuevo ciclo ===
    if (!estado.incomeHistory) estado.incomeHistory = [];
    
    // Solo agregamos el registro si no aplicamos un "pendingIncome" en este exacto ciclo,
    // ya que aplicarIngresoPendiente() ya genera su propio registro.
    if (!estado.pendingIncome || inicioDeEsteMes < new Date(`${estado.pendingIncome.effectiveDate}T00:00:00`).toISOString().slice(0, 10)) {
        estado.incomeHistory.push({
          amount: estado.income,
          type: "current",
          date: hoyISO(), // Fecha de hoy (inicio del nuevo ciclo)
          reason: "Presupuesto base del ciclo"
        });
    }

    guardarEstado();
  }
}