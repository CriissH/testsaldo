/**
 * ============================================================
 *  ESTADÍSTICAS Y REPORTES
 * ------------------------------------------------------------
 */

let filtroEstadisticas = "current";
let modoComparacionActivo = false;
let eventosEstadisticasInicializados = false;

function inicializarEventosEstadisticas() {
  if (eventosEstadisticasInicializados) return;

  const contenedorFiltros = document.getElementById("stats-filter-group");
  const selectorRango = document.getElementById("custom-range-picker");
  const selectorCiclo = document.getElementById("custom-cycle-picker");
  const selectCicloObj = document.getElementById("stats-cycle-select");
  const btnComparar = document.getElementById("compare-cycles-btn");
  const btnAplicarRango = selectorRango ? selectorRango.querySelector(".button-primary") : null;

  if (contenedorFiltros) {
    const botonesFiltro = contenedorFiltros.querySelectorAll(".filter-btn");
    botonesFiltro.forEach(btn => {
      btn.onclick = (e) => {
        const botonClickeado = e.currentTarget;

        botonesFiltro.forEach(b => b.classList.remove("active"));
        botonClickeado.classList.add("active");
        
        filtroEstadisticas = botonClickeado.dataset.period || "current";

        if (selectorRango) selectorRango.hidden = (filtroEstadisticas !== "custom");
        if (selectorCiclo) selectorCiclo.hidden = (filtroEstadisticas !== "cycle");

        if (filtroEstadisticas !== "custom") {
          renderizarEstadisticas();
        }
      };
    });
  }

  if (btnAplicarRango) {
    btnAplicarRango.onclick = () => renderizarEstadisticas();
  }

  if (selectCicloObj) {
    selectCicloObj.onchange = () => renderizarEstadisticas();
  }

  if (btnComparar) {
    btnComparar.onclick = () => {
      modoComparacionActivo = !modoComparacionActivo;
      if (modoComparacionActivo) {
        btnComparar.innerHTML = '<span style="font-size: 16px; margin-right: 5px;">✕</span> Quitar comparación';
        btnComparar.classList.remove("button-secondary");
        btnComparar.classList.add("button-ghost");
      } else {
        btnComparar.innerHTML = '<span style="font-size: 16px; margin-right: 5px;">⇋</span> Comparar';
        btnComparar.classList.remove("button-ghost");
        btnComparar.classList.add("button-secondary");
      }
      renderizarEstadisticas();
    };
  }

  eventosEstadisticasInicializados = true;
}

function poblarSelectorCiclos() {
  const select = document.getElementById("stats-cycle-select");
  if (!select || !estado) return;  
  
  const valorPrevio = select.value;
  const ciclosGuardados = (estado.savingsHistory || []).slice().reverse();
  
  if (ciclosGuardados.length === 0) {
    select.innerHTML = '<option value="">No hay ciclos anteriores guardados</option>';
    select.disabled = true;
    return;
  }
  
  select.disabled = false;
  select.innerHTML = ciclosGuardados.map(c => {
    const d = new Date(c.start + "T12:00:00");
    const mesAnio = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(d);
    const titulo = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);
    return '<option value="' + c.start + '|' + c.end + '">' + titulo + ' (' + formatearFecha(c.start) + ' a ' + formatearFecha(c.end) + ')</option>';
  }).join("");

  if (valorPrevio && Array.from(select.options).some(o => o.value === valorPrevio)) {
    select.value = valorPrevio;
  }
}

function obtenerRangoPorFiltro(filtro) {
  if (filtro === "current") {
    return { inicio: obtenerInicioCiclo(), fin: obtenerFinCiclo() };
  } else if (filtro === "prev") {
    const inicioActual = obtenerInicioCiclo();
    const inicioAnterior = new Date(inicioActual);
    inicioAnterior.setMonth(inicioAnterior.getMonth() - 1);
    const finAnterior = new Date(inicioActual);
    finAnterior.setDate(finAnterior.getDate() - 1);
    return { inicio: inicioAnterior, fin: finAnterior };
  } else if (filtro === "cycle") {
    const select = document.getElementById("stats-cycle-select");
    if (select && select.value) {
      const partes = select.value.split("|");
      return { 
        inicio: new Date(partes[0] + "T00:00:00"), 
        fin: new Date(partes[1] + "T23:59:59") 
      };
    }
    return { inicio: null, fin: null };
  } else if (filtro === "custom") {
    const desde = document.getElementById("stats-date-from")?.value;
    const hasta = document.getElementById("stats-date-to")?.value;
    return {
      inicio: desde ? new Date(desde + "T00:00:00") : null,
      fin: hasta ? new Date(hasta + "T23:59:59") : null
    };
  }
  return { inicio: null, fin: null };
}

function obtenerGastosEnRango(inicio, fin) {
  return estado.expenses.filter(item => {
    if (item.recurring) return false;
    const d = new Date(item.date + "T12:00:00");
    if (inicio && fin) return d >= inicio && d <= fin;
    return true;
  });
}

function renderizarEstadisticas() {
  inicializarEventosEstadisticas();
  poblarSelectorCiclos(); // <-- Se llama siempre que se renderiza

  const contenedorBarras = document.getElementById("bar-list");
  const contenedorInsights = document.getElementById("insights-list");
  const subtituloTotal = document.getElementById("stats-total-caption");
  const emptyState = document.getElementById("stats-empty");

  if (!contenedorBarras) return;

  // 1. OBTENEMOS EL PERIODO PRINCIPAL (LO QUE ELIGISTE EN LOS FILTROS)
  const rango1 = obtenerRangoPorFiltro(filtroEstadisticas);
  const gastos1 = obtenerGastosEnRango(rango1.inicio, rango1.fin);
  const agrupado1 = agruparPorCategoria(gastos1);
  const total1 = gastos1.reduce((sum, item) => sum + Number(item.amount), 0);

  // Determinar el nombre legible del periodo principal
  let nombrePeriodo1 = "Historial Completo";
  if (filtroEstadisticas === "current") nombrePeriodo1 = "Ciclo Actual";
  else if (filtroEstadisticas === "prev") nombrePeriodo1 = "Ciclo Anterior";
  else if (filtroEstadisticas === "custom") nombrePeriodo1 = "Rango Seleccionado";
  else if (filtroEstadisticas === "cycle") {
    const s = document.getElementById("stats-cycle-select");
    if (s && s.options[s.selectedIndex]) {
      nombrePeriodo1 = s.options[s.selectedIndex].text.split(" (")[0];
    } else {
      nombrePeriodo1 = "Ciclo Seleccionado";
    }
  }

  let HTMLBarras = "";
  let insightsHTML = "";

  if (modoComparacionActivo) {
    // =========================================================
    // NUEVA LÓGICA INTELIGENTE DE COMPARACIÓN
    // =========================================================
    let filtroBase = "current"; // Por defecto, comparamos contra el Ciclo Actual
    let nombrePeriodo2 = "Ciclo Actual";
    
    // PERO... si en los filtros ya elegiste "Ciclo Actual", comparamos contra el Anterior
    if (filtroEstadisticas === "current") {
      filtroBase = "prev";
      nombrePeriodo2 = "Ciclo Anterior";
    }

    const rango2 = obtenerRangoPorFiltro(filtroBase);
    const gastos2 = obtenerGastosEnRango(rango2.inicio, rango2.fin);
    const agrupado2 = agruparPorCategoria(gastos2);
    const total2 = gastos2.reduce((sum, item) => sum + Number(item.amount), 0);

    if (subtituloTotal) {
      subtituloTotal.innerHTML = '<div class="compare-legend">' +
        '<div class="compare-legend-item"><div class="compare-legend-dot" style="background: var(--green);"></div><span>' + nombrePeriodo1 + ' (' + formatearMoneda(total1) + ')</span></div>' +
        '<div class="compare-legend-item"><div class="compare-legend-dot" style="background: var(--muted); opacity: 0.5;"></div><span>' + nombrePeriodo2 + ' (' + formatearMoneda(total2) + ')</span></div>' +
        '</div>';
    }

    const todasLasCat = new Set([...Object.keys(agrupado1), ...Object.keys(agrupado2)]);
    const categoriasArray = Array.from(todasLasCat).map(id => {
      const m1 = agrupado1[id] ? agrupado1[id] : 0;
      const m2 = agrupado2[id] ? agrupado2[id] : 0;
      return { id, m1: m1, m2: m2, max: Math.max(m1, m2) };
    }).sort((a, b) => b.max - a.max);

    const maxAbsoluto = categoriasArray[0] && categoriasArray[0].max ? categoriasArray[0].max : 1;

    HTMLBarras = categoriasArray.map(c => {
      const cat = obtenerCategoria(c.id);
      const w1 = (c.m1 / maxAbsoluto) * 100;
      const w2 = (c.m2 / maxAbsoluto) * 100;
      
      return '<div class="bar-label" style="margin-bottom: 16px; display:block; min-width: 0;">' +
          '<div class="bar-label-name" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">' +
            '<i style="width:10px; height:10px; border-radius:50%; background:' + cat.color + '"></i> ' + escaparHtml(cat.name) +
          '</div>' +
          '<div class="compare-bar-group">' +
            '<div style="display: flex; justify-content: space-between; font-size: 11px; align-items:center; margin-bottom: 3px;">' +
              '<span class="compare-bar-track" style="flex:1; margin-right:12px;"><div class="compare-bar-fill" style="width: ' + w1 + '%; background: ' + cat.color + ';"></div></span>' +
              '<strong style="width: 70px; text-align:right;">' + formatearMoneda(c.m1) + '</strong>' +
            '</div>' +
            '<div style="display: flex; justify-content: space-between; font-size: 11px; align-items:center;">' +
              '<span class="compare-bar-track" style="flex:1; margin-right:12px;"><div class="compare-bar-fill" style="width: ' + w2 + '%; background: var(--muted); opacity: 0.4;"></div></span>' +
              '<strong style="width: 70px; text-align:right; color: var(--muted);">' + formatearMoneda(c.m2) + '</strong>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join("");

    const diferencia = total1 - total2;
    const textoDiferencia = diferencia > 0 ? "Gastaste " + formatearMoneda(diferencia) + " más" : "Ahorraste " + formatearMoneda(Math.abs(diferencia));
    const promedio = gastos1.length ? total1 / gastos1.length : 0;
    
    // Se actualizó el texto para reflejar dinámicamente contra qué ciclo se compara
    insightsHTML = '<div class="insight"><strong>' + textoDiferencia + '</strong><span>en total respecto a ' + nombrePeriodo2 + '</span></div>' +
      '<div class="insight"><strong>' + formatearMoneda(promedio) + '</strong><span>Tu promedio por movimiento en ' + nombrePeriodo1 + '</span></div>';

  } else {
    // MODO NORMAL (SIN COMPARAR)
    if (subtituloTotal) {
      subtituloTotal.textContent = "Total de " + nombrePeriodo1 + " · " + formatearMoneda(total1);
    }

    const grupos = Object.entries(agrupado1).sort((a, b) => b[1] - a[1]);
    const maximo = grupos[0] && grupos[0][1] ? grupos[0][1] : 1;

    HTMLBarras = grupos.map(([id, monto]) => {
      const categoria = obtenerCategoria(id);
      const porcentaje = total1 ? Math.round(monto / total1 * 100) : 0;
      return '<div>' +
          '<div class="bar-label">' +
            '<span class="bar-label-name">' + escaparHtml(categoria.name) + '</span>' +
            '<span class="bar-label-amount">' + formatearMoneda(monto) + '</span>' +
            '<span class="bar-label-percent">' + porcentaje + '%</span>' +
          '</div>' +
          '<div class="bar-track">' +
            '<div class="bar-fill" style="width:' + (monto / maximo * 100) + '%;background:' + categoria.color + '"></div>' +
          '</div>' +
        '</div>';
    }).join("");

    const categoriaMasGastada = grupos[0] ? obtenerCategoria(grupos[0][0]).name : "Sin datos";
    const promedio = gastos1.length ? total1 / gastos1.length : 0;
    insightsHTML = '<div class="insight"><strong>' + categoriaMasGastada + '</strong><span>Tu categoría con mayor gasto</span></div>' +
      '<div class="insight"><strong>' + formatearMoneda(promedio) + '</strong><span>Promedio por movimiento</span></div>' +
      '<div class="insight"><strong>' + gastos1.length + '</strong><span>Movimientos registrados en este periodo</span></div>';
  }

  if (emptyState) emptyState.style.display = HTMLBarras ? "none" : "block";
  if (contenedorBarras) contenedorBarras.innerHTML = HTMLBarras;
  if (contenedorInsights) contenedorInsights.innerHTML = insightsHTML;
}

// ====================================================================
// REPORTES
// ====================================================================

function renderizarReportes() {
  const gastos = gastosConfirmados();
  const gastado = gastos.reduce((suma, item) => suma + Number(item.amount), 0);
  const repSumm = document.getElementById("report-summary");
  
  if (repSumm) {
    repSumm.innerHTML = '<div class="summary-grid">' +
      '<div class="summary-box"><span>Ingreso mensual</span><strong>' + formatearMoneda(ingresoActual()) + '</strong></div>' +
      '<div class="summary-box"><span>Gastos abonados</span><strong>' + formatearMoneda(gastado) + '</strong></div>' +
      '<div class="summary-box"><span>Presupuesto restante</span><strong>' + formatearMoneda(ingresoActual() - gastado) + '</strong></div>' +
      '<div class="summary-box"><span>Movimientos abonados</span><strong>' + gastos.length + '</strong></div>' +
      '<div class="summary-box"><span>Promedio por movimiento</span><strong>' + formatearMoneda(gastos.length ? gastado / gastos.length : 0) + '</strong></div>' +
      '<div class="summary-box"><span>Recurrentes pendientes</span><strong>' + (recurrentesPendientes().length + recurrentesMensualesPendientes().length) + '</strong></div>' +
      '</div>';
  }
  
  renderizarInformeDeGastos(gastos, gastado);
  renderizarConsejoDePago();

  const incHist = document.getElementById("income-history");
  if (incHist) {
    incHist.innerHTML = marcadoHistorialIngresos();
  }

  const historialRecurrentes = [...(estado.recurringHistory || [])].reverse();
  const recHist = document.getElementById("recurring-history");
  if (recHist) {
    if (historialRecurrentes.length) {
      recHist.innerHTML = historialRecurrentes.map(item => { 
        const cambioDia = item.weekday !== undefined && item.previousWeekday !== item.weekday ? ' · Día cambiado a ' + ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][Number(item.weekday)] : ""; 
        const etiquetaScope = item.scope === "cycle" ? "Todo el ciclo actual" : "A partir de la corrección";
        return '<div class="income-history-row modification-row"><div><strong>' + escaparHtml(item.description) + '</strong><span>' + formatearFecha(item.date) + ' · ' + etiquetaScope + cambioDia + '</span></div><b>' + formatearMoneda(item.previousAmount) + ' → ' + formatearMoneda(item.amount) + '</b></div>'; 
      }).join("");
    } else {
      recHist.innerHTML = '<div class="empty-state compact">Todavía no hay cambios de gastos recurrentes.</div>';
    }
  }

  const historialGastos = [...(estado.expenseHistory || [])].reverse();
  const expHist = document.getElementById("expense-history");
  if (expHist) {
    if (historialGastos.length) {
      expHist.innerHTML = historialGastos.map(item => {
        const razonGasto = item.reason ? item.reason : "Corrección manual";
        return '<div class="income-history-row modification-row"><div><strong>MODIFICADO · ' + escaparHtml(item.description) + '</strong><span>' + formatearFecha(item.date) + ' · ' + escaparHtml(razonGasto) + '</span></div><b>' + formatearMoneda(item.previousAmount) + ' → ' + formatearMoneda(item.amount) + '</b></div>';
      }).join("");
    } else {
      expHist.innerHTML = '<div class="empty-state compact">Todavía no hay gastos corregidos.</div>';
    }
  }
}

function renderizarInformeDeGastos(gastos, gastado) {
  const contenedor = document.getElementById("report-expenses");
  if (!contenedor) return;

  const gastosValidos = gastos.filter(item => Number.isFinite(Number(item.amount)));
  const totalValido = gastosValidos.reduce((suma, item) => suma + Number(item.amount), 0);
  const agrupado = agruparPorCategoria(gastosValidos);
  const categorias = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
  const base = totalValido || 1;
  let acumulado = 0;
  
  const segmentos = categorias.map(([id, monto]) => { 
    const inicio = acumulado / base * 360; 
    acumulado += monto; 
    const c = obtenerCategoria(id);
    const colorCat = c && c.color ? c.color : "#aab2ad"; 
    return colorCat + ' ' + inicio + 'deg ' + (acumulado / base * 360) + 'deg'; 
  });

  let grafico = "";
  if (categorias.length) {
    const porciones = categorias.map(([id, monto]) => { 
      const categoria = obtenerCategoria(id); 
      const colorCat = categoria && categoria.color ? categoria.color : "#aab2ad";
      const porcentaje = totalValido ? Math.round(monto / totalValido * 100) : 0; 
      return '<div class="report-category-row"><span class="report-category-name"><i style="background:' + colorCat + '"></i>' + escaparHtml(categoria.name) + '</span><strong>' + formatearMoneda(monto) + '</strong><span>' + porcentaje + '%</span></div>'; 
    }).join("");
    grafico = '<div class="report-expenses-overview"><div class="report-pie-chart" style="background:conic-gradient(' + segmentos.join(",") + ')"><div class="report-pie-hole"><strong>' + formatearMoneda(totalValido) + '</strong><span>abonado</span></div></div><div class="report-category-breakdown">' + porciones + '</div></div>';
  } else {
    grafico = '<div class="report-expenses-overview report-expenses-empty"><div class="report-pie-chart" style="background:conic-gradient(#e9f1ed 0deg 360deg)"><div class="report-pie-hole"><strong>$0</strong><span>sin datos</span></div></div><div class="empty-state compact">Todavía no hay gastos abonados en el ciclo actual.</div></div>';
  }
  
  let movimientos = "";
  if (gastosValidos.length) {
    const listaMovs = [...gastosValidos].sort((a, b) => b.date.localeCompare(a.date)).map(gasto => { 
      const categoria = obtenerCategoria(gasto.categoryId); 
      const colorCat = categoria && categoria.color ? categoria.color : "#aab2ad";
      const esRecurrente = Boolean(gasto.recurringSourceId); 
      return '<div class="report-expense-row"><div class="report-expense-main"><i style="background:' + colorCat + '"></i><div><strong>' + escaparHtml(gasto.description) + '</strong><span>' + escaparHtml(categoria.name) + ' · ' + formatearFecha(gasto.date) + (esRecurrente ? ' · Recurrente' : '') + '</span></div></div><span class="report-paid-status">ABONADO</span><b>' + formatearMoneda(gasto.amount) + '</b></div>'; 
    }).join("");
    movimientos = '<div class="report-expense-list"><h3>Detalle de movimientos</h3>' + listaMovs + '</div>';
  }
  
  contenedor.innerHTML = grafico + movimientos;
}

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
  
  const lblIngresos = ingresoProgramado ? ' · Otros ingresos programados: <strong>' + formatearMoneda(ingresoProgramado) + '</strong>' : '';
  const summary = '<div class="payment-advice-summary">Disponible ahora: <strong>' + formatearMoneda(restante) + '</strong>' + lblIngresos + ' · Proyección: <strong>' + formatearMoneda(valorProyeccionMensual()) + '</strong></div>';
  
  const filas = gastos.map(({ template, due, status }) => { 
    const importe = Number(template.amount || 0); 
    const puedePagar = restante >= importe; 
    const urgencia = due <= fechaEfectiva() ? "Vencido o vence hoy" : "Vence el " + formatearFecha(claveFechaCiclo(due)); 
    const clasePagar = puedePagar ? "advice-ok" : "advice-wait";
    const textoPagar = puedePagar ? "Conviene abonar" : "Esperar ingreso";
    return '<div class="payment-advice-row"><div><strong>' + escaparHtml(template.description) + '</strong><span>' + urgencia + ' · ' + status.label + '</span></div><b>' + formatearMoneda(importe) + '</b><em class="' + clasePagar + '">' + textoPagar + '</em></div>'; 
  }).join("");

  contenedor.innerHTML = summary + filas;
}

function marcadoHistorialIngresos() {
  const historial = [...(estado.incomeHistory || [])].reverse();
  if (!historial.length) {
    return '<div class="empty-state compact">Todavía no hay modificaciones de ingreso.</div>';
  }
  return historial.map(item => {
    const labelTipo = item.type === "next" ? "Próximo ciclo" : item.type === "addition" ? "Adición al monto actual" : item.type === "next-applied" ? "Aplicado al iniciar ciclo" : "Monto actual";
    const prefijoSuma = item.type === "addition" ? "+" : "";
    const razon = item.reason ? item.reason : "Ingreso inicial";
    return '<div class="income-history-row"><div><strong>' + escaparHtml(razon) + '</strong><span>' + formatearFecha(item.date) + ' · ' + labelTipo + '</span></div><b>' + prefijoSuma + formatearMoneda(item.amount) + '</b></div>';
  }).join("");
}

// ====================================================================
// HISTORIAL DE INGRESOS (PÁGINA DEDICADA CON FILTROS)
// ====================================================================

let filtroHistorialIngresos = "current";
let eventosHistorialIngresosInicializados = false;

function inicializarEventosHistorialIngresos() {
  if (eventosHistorialIngresosInicializados) return;

  const contenedorFiltros = document.getElementById("income-history-filter-group");
  const selectorCicloDiv = document.getElementById("income-history-cycle-picker");
  const selectCicloObj = document.getElementById("income-history-cycle-select");

  if (contenedorFiltros) {
    const botonesFiltro = contenedorFiltros.querySelectorAll(".filter-btn");
    botonesFiltro.forEach(btn => {
      btn.onclick = (e) => {
        // Cambiar estilo activo
        botonesFiltro.forEach(b => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
        
        // Guardar selección y mostrar/ocultar el selector de ciclos
        filtroHistorialIngresos = e.currentTarget.dataset.period || "current";
        if (selectorCicloDiv) selectorCicloDiv.hidden = (filtroHistorialIngresos !== "cycle");

        renderizarPaginaHistorialIngresos();
      };
    });
  }

  if (selectCicloObj) {
    selectCicloObj.onchange = () => renderizarPaginaHistorialIngresos();
  }

  eventosHistorialIngresosInicializados = true;
}

function poblarSelectorCiclosIngresos() {
  const select = document.getElementById("income-history-cycle-select");
  if (!select || !estado) return;  
  
  const valorPrevio = select.value;
  const ciclosGuardados = (estado.savingsHistory || []).slice().reverse();
  
  if (ciclosGuardados.length === 0) {
    select.innerHTML = '<option value="">No hay ciclos anteriores guardados</option>';
    select.disabled = true;
    return;
  }
  
  select.disabled = false;
  select.innerHTML = ciclosGuardados.map(c => {
    const d = new Date(c.start + "T12:00:00");
    const mesAnio = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(d);
    const titulo = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);
    return '<option value="' + c.start + '|' + c.end + '">' + titulo + ' (' + formatearFecha(c.start) + ' a ' + formatearFecha(c.end) + ')</option>';
  }).join("");

  if (valorPrevio && Array.from(select.options).some(o => o.value === valorPrevio)) {
    select.value = valorPrevio;
  }
}

// Renderiza el historial de ingresos aplicando los filtros
function renderizarPaginaHistorialIngresos() {
  inicializarEventosHistorialIngresos();
  poblarSelectorCiclosIngresos();

  const contenedor = document.getElementById("income-history-page");
  if (!contenedor) return;

  // 1. Determinar el rango de fechas
  let rango = { inicio: null, fin: null };
  
  if (filtroHistorialIngresos === "current") {
    rango = { inicio: obtenerInicioCiclo(), fin: obtenerFinCiclo() };
  } else if (filtroHistorialIngresos === "cycle") {
    const select = document.getElementById("income-history-cycle-select");
    if (select && select.value) {
      const partes = select.value.split("|");
      rango = { 
        inicio: new Date(partes[0] + "T00:00:00"), 
        fin: new Date(partes[1] + "T23:59:59") 
      };
    }
  }

  // 2. Extraer historial y filtrar
  let historial = [...(estado.incomeHistory || [])].reverse();
  
  if (filtroHistorialIngresos !== "all" && rango.inicio && rango.fin) {
    historial = historial.filter(item => {
      const d = new Date(item.date + "T12:00:00");
      return d >= rango.inicio && d <= rango.fin;
    });
  }

  // 3. Renderizar resultados
  if (!historial.length) {
    contenedor.innerHTML = '<div class="empty-state compact" style="margin: 20px 0;">No hay movimientos de ingreso para el periodo seleccionado.</div>';
    return;
  }

  contenedor.innerHTML = historial.map(item => {
    const labelTipo = item.type === "next" ? "Próximo ciclo" : item.type === "addition" ? "Adición al monto actual" : item.type === "next-applied" ? "Aplicado al iniciar ciclo" : "Monto actual";
    const prefijoSuma = item.type === "addition" ? "+" : "";
    const razon = item.reason ? item.reason : "Ingreso inicial";
    return '<div class="income-history-row"><div><strong>' + escaparHtml(razon) + '</strong><span>' + formatearFecha(item.date) + ' · ' + labelTipo + '</span></div><b>' + prefijoSuma + formatearMoneda(item.amount) + '</b></div>';
  }).join("");
}