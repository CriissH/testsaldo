/**
 * ============================================================
 *  ESTADÍSTICAS Y REPORTES
 * ------------------------------------------------------------
 *  Vista "Estadísticas" (gasto por categoría, promedio, mayor
 *  categoría) y vista "Reportes" (resumen del ciclo, historial
 *  de ingresos y de correcciones, y consejo de a qué recurrente
 *  conviene pagarle primero según lo disponible hoy).
 * ============================================================
 */

// Dibuja las barras de gasto por categoría y los insights de la vista "Estadísticas".
function renderizarEstadisticas() {
  const periodoTodo = document.getElementById("stats-period")?.value === "all";
  const gastos = periodoTodo ? estado.expenses.filter(item => !item.recurring) : gastosConfirmados();
  const agrupado = agruparPorCategoria(gastos);
  const grupos = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
  const maximo = grupos[0]?.[1] || 1;
  const total = grupos.reduce((suma, [, monto]) => suma + monto, 0);

  document.getElementById("stats-total-caption").textContent = `Total ${periodoTodo ? "histórico" : "del ciclo"} · ${formatearMoneda(total)}`;
  document.getElementById("stats-empty").style.display = grupos.length ? "none" : "block";
  document.getElementById("bar-list").innerHTML = grupos.map(([id, monto]) => {
    const categoria = obtenerCategoria(id);
    return `<div><div class="bar-label"><span>${escaparHtml(categoria.name)}</span><span>${formatearMoneda(monto)} · ${total ? Math.round(monto / total * 100) : 0}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${monto / maximo * 100}%;background:${categoria.color}"></div></div></div>`;
  }).join("");

  const categoriaMasGastada = grupos[0] ? obtenerCategoria(grupos[0][0]).name : "Sin datos";
  document.getElementById("insights-list").innerHTML =
    `<div class="insight"><strong>${categoriaMasGastada}</strong><span>Tu categoría con mayor gasto</span></div>` +
    `<div class="insight"><strong>${formatearMoneda(gastos.length ? total / gastos.length : 0)}</strong><span>Promedio por movimiento</span></div>` +
    `<div class="insight"><strong>${gastos.filter(item => item.recurring).length}</strong><span>Gastos recurrentes registrados</span></div>`;
}

// Dibuja el resumen y los tres historiales de la vista "Reportes".
function renderizarReportes() {
  const gastos = gastosConfirmados(), gastado = gastos.reduce((suma, item) => suma + Number(item.amount), 0);

  document.getElementById("report-summary").innerHTML =
    `<div class="summary-grid"><div class="summary-box"><span>Ingreso mensual</span><strong>${formatearMoneda(ingresoActual())}</strong></div><div class="summary-box"><span>Gastos del ciclo</span><strong>${formatearMoneda(gastado)}</strong></div><div class="summary-box"><span>Presupuesto restante</span><strong>${formatearMoneda(ingresoActual() - gastado)}</strong></div></div>`;

  renderizarConsejoDePago();

  const historialIngresos = [...estado.incomeHistory].reverse();
  document.getElementById("income-history").innerHTML = historialIngresos.length
    ? historialIngresos.map(item => `<div class="income-history-row"><div><strong>${escaparHtml(item.reason)}</strong><span>${formatearFecha(item.date)} · ${item.type === "next" ? "Próximo ciclo" : item.type === "addition" ? "Adición al monto actual" : item.type === "next-applied" ? "Aplicado al iniciar ciclo" : "Monto actual"}</span></div><b>${item.type === "addition" ? "+" : ""}${formatearMoneda(item.amount)}</b></div>`).join("")
    : `<div class="empty-state compact">Todavía no hay modificaciones de ingreso.</div>`;

  const historialRecurrentes = [...(estado.recurringHistory || [])].reverse();
  document.getElementById("recurring-history").innerHTML = historialRecurrentes.length
    ? historialRecurrentes.map(item => {
        const cambioDia = item.weekday !== undefined && item.previousWeekday !== item.weekday
          ? ` · Día cambiado a ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][Number(item.weekday)]}`
          : "";
        return `<div class="income-history-row modification-row"><div><strong>${escaparHtml(item.description)}</strong><span>${formatearFecha(item.date)} · ${item.scope === "cycle" ? "Todo el ciclo actual" : "A partir de la corrección"}${cambioDia}</span></div><b>${formatearMoneda(item.previousAmount)} → ${formatearMoneda(item.amount)}</b></div>`;
      }).join("")
    : `<div class="empty-state compact">Todavía no hay cambios de gastos recurrentes.</div>`;

  const historialGastos = [...(estado.expenseHistory || [])].reverse();
  document.getElementById("expense-history").innerHTML = historialGastos.length
    ? historialGastos.map(item => `<div class="income-history-row modification-row"><div><strong>MODIFICADO · ${escaparHtml(item.description)}</strong><span>${formatearFecha(item.date)} · ${escaparHtml(item.reason)}</span></div><b>${formatearMoneda(item.previousAmount)} → ${formatearMoneda(item.amount)}</b></div>`).join("")
    : `<div class="empty-state compact">Todavía no hay gastos corregidos.</div>`;
}

// Sugiere, entre los recurrentes pendientes, a cuáles conviene pagarles primero con el presupuesto disponible.
function renderizarConsejoDePago() {
  const contenedor = document.getElementById("payment-advice");
  if (!contenedor) return;

  const restante = calcularPresupuestoRestante();
  const ingresoProgramado = plantillasIngresoRecurrente().reduce((suma, item) => suma + Number(item.amount || 0), 0);

  const gastos = estado.expenses.filter(item => item.recurring && item.recurringType !== "income").map(plantilla => {
    const vencimiento = proximaFechaRecurrente(plantilla);
    const estadoEtiqueta = obtenerEtiquetaEstadoRecurrente(plantilla);
    return { template: plantilla, due: vencimiento, status: estadoEtiqueta };
  }).sort((a, b) => a.due - b.due);

  if (!gastos.length) {
    contenedor.innerHTML = '<div class="empty-state compact">No hay pagos recurrentes para priorizar.</div>';
    return;
  }

  contenedor.innerHTML =
    `<div class="payment-advice-summary">Disponible ahora: <strong>${formatearMoneda(restante)}</strong>${ingresoProgramado ? ` · Otros ingresos programados: <strong>${formatearMoneda(ingresoProgramado)}</strong>` : ""} · Proyección: <strong>${formatearMoneda(valorProyeccionMensual())}</strong></div>` +
    gastos.map(({ template, due, status }) => {
      const importe = Number(template.amount || 0);
      const puedePagar = restante >= importe;
      const urgencia = due <= fechaEfectiva() ? "Vencido o vence hoy" : `Vence el ${formatearFecha(claveFechaCiclo(due))}`;
      return `<div class="payment-advice-row"><div><strong>${escaparHtml(template.description)}</strong><span>${urgencia} · ${status.label}</span></div><b>${formatearMoneda(importe)}</b><em class="${puedePagar ? "advice-ok" : "advice-wait"}">${puedePagar ? "Conviene abonar" : "Esperar ingreso"}</em></div>`;
    }).join("");
}

// HTML del historial de ingresos (reutilizado por la página dedicada de historial).
function marcadoHistorialIngresos() {
  const historial = [...estado.incomeHistory].reverse();
  return historial.length
    ? historial.map(item => `<div class="income-history-row"><div><strong>${escaparHtml(item.reason || "Ingreso inicial")}</strong><span>${formatearFecha(item.date)} · ${item.type === "next" ? "Próximo ciclo" : item.type === "addition" ? "Adición al monto actual" : item.type === "next-applied" ? "Aplicado al iniciar ciclo" : "Monto actual"}</span></div><b>${item.type === "addition" ? "+" : ""}${formatearMoneda(item.amount)}</b></div>`).join("")
    : `<div class="empty-state compact">Todavía no hay modificaciones de ingreso.</div>`;
}

// Dibuja la página dedicada "Historial de ingresos".
function renderizarPaginaHistorialIngresos() {
  document.getElementById("income-history-page").innerHTML = marcadoHistorialIngresos();
}
