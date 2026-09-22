/**
 * ============================================================
 *  CICLOS
 * ------------------------------------------------------------
 *  Saldo no trabaja con "meses calendario" sino con "ciclos":
 *  un período que va desde el día de corte (state.cutoffDay)
 *  hasta el día anterior al próximo corte. Este módulo calcula
 *  el inicio/fin del ciclo actual y cierra automáticamente los
 *  ciclos ya terminados, moviendo lo que sobró al ahorro.
 * ============================================================
 */

// Fecha en la que arranca el ciclo actual (según el día de corte configurado).
function obtenerInicioCiclo() {
  const ahora = fechaEfectiva();
  let anio = ahora.getFullYear(), mes = ahora.getMonth();
  if (ahora.getDate() < Number(estado.cutoffDay || 1)) mes -= 1;
  return new Date(anio, mes, Number(estado.cutoffDay || 1));
}

// Último día del ciclo actual.
function obtenerFinCiclo() {
  const fin = new Date(obtenerInicioCiclo());
  fin.setMonth(fin.getMonth() + 1);
  fin.setDate(fin.getDate() - 1);
  return fin;
}

// Representa una fecha como clave "AAAA-MM-DD" (para comparar/guardar).
function claveFechaCiclo(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

// ¿El gasto pertenece al ciclo que está corriendo ahora mismo?
function esCicloActual(gasto) {
  const fecha = new Date(`${gasto.date}T12:00:00`);
  return fecha >= obtenerInicioCiclo() && fecha <= obtenerFinCiclo();
}

// Fecha en la que arrancará el próximo ciclo (usada al programar un ingreso futuro).
function proximaFechaCiclo() {
  const inicio = obtenerInicioCiclo();
  return new Date(inicio.getFullYear(), inicio.getMonth() + 1, Number(estado.cutoffDay || 1));
}

/**
 * Revisa si hay ciclos anteriores que ya terminaron y todavía no
 * se "cerraron". Por cada uno, calcula lo que sobró del
 * presupuesto y lo transfiere automáticamente al ahorro,
 * dejando un registro en el historial de ahorros.
 */
function cerrarCiclosCompletados() {
  if (!estado.onboardingComplete) return;
  const inicioActual = obtenerInicioCiclo();

  if (!estado.lastCycleStart) {
    estado.lastCycleStart = claveFechaCiclo(inicioActual);
    guardarEstado();
    return;
  }

  let inicioAnterior = new Date(`${estado.lastCycleStart}T12:00:00`);
  let huboCambios = false;

  while (inicioAnterior < inicioActual) {
    const siguienteInicio = new Date(inicioAnterior);
    siguienteInicio.setMonth(siguienteInicio.getMonth() + 1);

    const gastosDelCiclo = estado.expenses.filter(item =>
      !item.recurring &&
      new Date(`${item.date}T12:00:00`) >= inicioAnterior &&
      new Date(`${item.date}T12:00:00`) < siguienteInicio
    );
    const gastado = gastosDelCiclo.reduce((suma, item) => suma + Number(item.amount), 0);
    const restante = Math.max(ingresoActual() - gastado, 0);

    estado.savingsBalance += restante;
    estado.savingsHistory.push({
      id: crypto.randomUUID(),
      start: claveFechaCiclo(inicioAnterior),
      end: claveFechaCiclo(new Date(siguienteInicio.getTime() - 86400000)),
      income: ingresoActual(),
      spent: gastado,
      remaining: restante,
      transferred: restante,
      date: hoyISO()
    });

    inicioAnterior = siguienteInicio;
    huboCambios = true;
  }

  estado.lastCycleStart = claveFechaCiclo(inicioActual);
  if (huboCambios) {
    estado.currentCycleIncome = null;
    guardarEstado();
  }
}
