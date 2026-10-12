/**
 * ============================================================
 *  INTERFAZ (núcleo de renderizado y navegación)
 * ------------------------------------------------------------
 *  La función renderizar() es el punto de entrada: se llama
 *  cada vez que algo cambia en el estado, y vuelve a dibujar
 *  todas las vistas. También viven acá la navegación entre
 *  secciones, el manejo genérico de modales, el panel principal
 *  (dashboard) y la vista de Configuración.
 * ============================================================
 */

// Abre/cierra un modal por su id.
function abrirModal(id) { document.getElementById(id).hidden = false; }
function cerrarModal(id) { document.getElementById(id).hidden = true; }

/**
 * Cambia la vista visible (dashboard, gastos, categorías, etc.),
 * actualiza el ítem activo del menú y el título de la página.
 */
function navegar(vista) {
  document.querySelectorAll(".view").forEach(seccion => seccion.classList.remove("active-view"));
  document.getElementById(`view-${vista}`).classList.add("active-view");
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === vista));
  const titulos = {
    dashboard: "Resumen financiero",
    statistics: "Estadísticas",
    expenses: "Movimientos",
    categories: "Categorías",
    savings: "Ahorrado",
    "income-history-view": "Historial de ingresos",
    collective: "Compra colectiva",
    debts: "Deudas",
    "recurring-all": "Gestión de recurrentes",
    reports: "Reportes y respaldos",
    settings: "Configuración"
  };
  document.getElementById("page-title").textContent = titulos[vista];
  window.scrollTo({ top: 0, behavior: "auto" });
}

/**
 * Dibuja el panel principal: presupuesto restante, progreso del
 * gasto, proyección mensual, el gráfico de dona por categoría y
 * la actividad reciente.
 */
function renderizarPanel() {
  const gastos = gastosConfirmados(), gastado = gastos.reduce((suma, item) => suma + Number(item.amount), 0);
  const restante = calcularPresupuestoRestante(), presupuesto = ingresoActual();
  const montoProyeccion = valorProyeccionMensual();
  const ingresoRecurrenteMensual = totalIngresoRecurrenteMensual();
  const totalRecurrentePendiente = desgloseProyeccion().filter(entrada => !entrada.excluded).reduce((suma, entrada) => suma + entrada.impact, 0);
  const leyendaProyeccion = totalRecurrentePendiente || ingresoRecurrenteMensual
    ? `Quedaría ${formatearMoneda(montoProyeccion)} con ${formatearMoneda(totalRecurrentePendiente)} en gastos recurrentes pendientes.`
    : "Sin gastos recurrentes mensuales.";
  const totalIngresoPendiente = ingresoRecurrentePendiente().reduce((suma, item) => suma + Number(item.amount || 0), 0);
  const leyendaIngresoProyeccion = totalIngresoPendiente ? ` Si validas los ingresos recurrentes, sumaría ${formatearMoneda(totalIngresoPendiente)}.` : "";

  document.getElementById("remaining-amount").textContent = formatearMonedaCompacta(restante);
  document.getElementById("remaining-exact").textContent = formatearMoneda(restante);

  let textoRestante = "Configura tu ingreso mensual para comenzar";
  const hayPendiente = estado.incomeWaitingForNextCycle && estado.pendingIncome && fechaEfectiva() < new Date(`${estado.pendingIncome.effectiveDate}T00:00:00`);

  if (presupuesto > 0) {
    textoRestante = restante >= 0 ? "Disponible para el resto del ciclo" : "Has superado tu presupuesto";
  } else if (hayPendiente) {
    textoRestante = `Ingreso programado para el ${formatearFecha(estado.pendingIncome.effectiveDate)}`;
  } else if (estado.incomeType === "variable") {
    textoRestante = restante >= 0 ? "Modo variable: suma tus ingresos del mes" : "Has gastado más de lo que ingresaste";
  }
  document.getElementById("remaining-caption").textContent = textoRestante;
  
  const aviso = document.getElementById("income-notice");
  const hayEsperaActiva = estado.incomeWaitingForNextCycle && estado.pendingIncome && fechaEfectiva() < new Date(`${estado.pendingIncome.effectiveDate}T00:00:00`);

  if (hayEsperaActiva) {
    aviso.textContent = `Modo fijo programado: Tus gastos actuales corren por tu cuenta y los ${formatearMoneda(estado.pendingIncome.amount)} ingresarán el ${formatearFecha(estado.pendingIncome.effectiveDate)}.`;
    aviso.hidden = false;
  } else if (estado.incomeNotice) {
    aviso.textContent = estado.incomeNotice;
    aviso.hidden = false;
  } else {
    aviso.hidden = true;
    // Si ya pasó la fecha y seguía la bandera activa, nos aseguramos de apagarla
    if (estado.incomeWaitingForNextCycle) {
      estado.incomeWaitingForNextCycle = false;
      guardarEstado();
    }
  }

  document.getElementById("spent-caption").textContent = `${formatearMonedaCompacta(gastado)} gastados`;
  document.getElementById("budget-caption").textContent = `${formatearMonedaCompacta(presupuesto)} de presupuesto`;
  document.getElementById("budget-progress").style.width = `${presupuesto ? Math.min(Math.max(gastado / presupuesto * 100, 0), 100) : 0}%`;
  document.getElementById("income-stat").textContent = formatearMonedaCompacta(presupuesto);
  document.getElementById("income-stat-full").textContent = formatearMoneda(presupuesto);
  document.getElementById("spent-stat").textContent = formatearMonedaCompacta(gastado);
  document.getElementById("spent-stat-full").textContent = formatearMoneda(gastado);

  const promedio = gastos.length ? gastado / gastos.length : 0;
  document.getElementById("average-stat").textContent = formatearMonedaCompacta(promedio);
  document.getElementById("average-stat-full").textContent = formatearMoneda(promedio);
  document.getElementById("count-stat").textContent = gastos.length;

  document.getElementById("monthly-projection-amount").textContent = formatearMonedaCompacta(montoProyeccion);
  document.getElementById("monthly-projection-exact").textContent = formatearMoneda(montoProyeccion);
  document.getElementById("monthly-projection-caption").textContent = `${leyendaProyeccion}${leyendaIngresoProyeccion}`;
  renderizarAvisoIngresoAprobado();

  const agrupado = agruparPorCategoria(gastos), grupos = Object.entries(agrupado).filter(([, valor]) => valor > 0);
  const total = grupos.reduce((suma, [, valor]) => suma + valor, 0);
  document.getElementById("chart-total").textContent = formatearMoneda(total);
  document.getElementById("chart-empty").style.display = grupos.length ? "none" : "block";
  document.getElementById("category-legend").innerHTML = grupos.map(([id, valor]) => {
    const categoria = obtenerCategoria(id);
    return `<div class="legend-row"><i class="legend-dot" style="background:${categoria.color}"></i><span>${escaparHtml(categoria.name)}</span><span>${formatearMoneda(valor)}</span></div>`;
  }).join("");

  let cursor = 0;
  const tramos = grupos.map(([id, valor]) => { const inicio = cursor; cursor += valor / total * 360; return `${obtenerCategoria(id).color} ${inicio}deg ${cursor}deg`; });
  document.getElementById("donut-chart").style.background = grupos.length ? `conic-gradient(${tramos.join(",")})` : "#e9f1ed";

  const recientes = movimientosDeActividad().slice(0, 4);
  document.getElementById("recent-empty").style.display = recientes.length ? "none" : "block";
  document.getElementById("recent-expenses").innerHTML = recientes.map(filaDeGasto).join("");
}

// Dibuja la vista de Configuración (y las herramientas de depuración, si están desbloqueadas).
function renderizarConfiguracion() {
  const selectModo = document.getElementById("settings-income-type");
  const camposFijos = document.getElementById("settings-fixed-fields");
  const inputIngreso = document.getElementById("income-input");
  const inputCorte = document.getElementById("cutoff-input");
  const labelCorte = document.getElementById("cutoff-label-text");
  const hintCorte = document.getElementById("cutoff-hint-text");

  // Si existe el estado, usarlo; si no, por defecto a 'fixed'
  const modoActual = estado.incomeType === "variable" ? "variable" : "fixed";

  // Rellenar valores guardados
  if (selectModo) selectModo.value = modoActual;
  if (inputIngreso) inputIngreso.value = estado.income || "";
  if (inputCorte) inputCorte.value = estado.cutoffDay || 1;

  // Lógica de mostrar/ocultar y cambiar textos según el modo guardado
  const esVariable = (modoActual === "variable");
  
  if (camposFijos && inputIngreso) {
    camposFijos.hidden = esVariable;
    inputIngreso.required = !esVariable; // Solo es obligatorio si el modo es FIJO
  }
  
  // Cambiamos los textos dinámicamente
  if (labelCorte) {
    labelCorte.textContent = esVariable ? "Fecha de cierre o reinicio" : "Fecha de cobro";
  }
  if (hintCorte) {
    hintCorte.textContent = esVariable ? "Día del mes en que arranca tu nuevo ciclo" : "Día del mes en que recibes tu ingreso";
  }

  // Zona de herramientas Debug
  document.getElementById("debug-tools-panel").hidden = !depuracionDesbloqueada;
  if (!depuracionDesbloqueada) return;
  document.getElementById("date-mode-input").value = estado.dateMode;
  document.getElementById("debug-date-input").value = estado.debugDate || hoyISO();
  document.getElementById("debug-date-label").hidden = estado.dateMode !== "debug";
  const botonAvanzar = document.getElementById("advance-cycle-button");
  botonAvanzar.disabled = estado.dateMode !== "debug";
  botonAvanzar.title = estado.dateMode === "debug" ? "Avanzar un día de prueba" : "Activa la fecha DEBUG para usar esta herramienta";
}

// Actualiza la tarjeta de "Ciclo actual" de la barra lateral.
function actualizarCiclo() {
  const inicio = obtenerInicioCiclo(), fin = new Date(inicio);
  fin.setMonth(fin.getMonth() + 1);
  fin.setDate(fin.getDate() - 1);
  document.getElementById("cycle-label").textContent = estado.income
    ? `${formatearFecha(inicio.toISOString().slice(0, 10))} – ${formatearFecha(fin.toISOString().slice(0, 10))}`
    : "Sin configurar";
  document.getElementById("cycle-date").textContent = estado.income ? `Corte el día ${estado.cutoffDay}` : "Configura tu fecha de corte";
  document.getElementById("current-date").textContent = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(fechaEfectiva());
}

/**
 * Punto de entrada principal: recalcula todo lo que depende del
 * tiempo (cierre de ciclos, ingresos pendientes) y vuelve a
 * dibujar cada vista de la aplicación.
 */
function renderizar() {
  document.body.classList.toggle("dark-mode", estado.darkMode);
 // Considera que está configurado si completó el onboarding, si tiene ingreso > 0, o si hay un ingreso pendiente programado
  const estaConfigurado = Boolean(estado.onboardingComplete && (estado.income > 0 || estado.incomeType === "variable" || estado.pendingIncome));
  document.getElementById("setup-required-card").hidden = estaConfigurado; aplicarIngresoPendiente();
  renderizarPanel();
  renderizarGastos();
  renderizarCategorias();
  renderizarEstadisticas();
  renderizarReportes();
  renderizarPaginaHistorialIngresos();
  renderizarAhorros();
  renderizarConfiguracion();
  actualizarCiclo();
  renderizarRecurrentesBarraLateral();
  renderizarTodosLosRecurrentes();
  renderizarColectivo();
  renderizarDeudas();
  renderizarConfirmacionRecurrentes();
  document.getElementById("installed-version").textContent = VERSION_APP;
  document.getElementById("dark-mode-toggle").checked = estado.darkMode;
  actualizarControlNotificacionesAndroid();
  revisarNotificacionesAndroid();
  if (!estado.onboardingComplete) {
    document.getElementById("welcome-modal").hidden = false;
    setTimeout(() => document.getElementById("welcome-income-input").focus(), 0);
  }
}
// ==========================================
// Control de Pestañas (Modales de Ingresos/Gastos)
// ==========================================
window.cambiarPestanaGasto = function(pestana) {
  const tabUnico = document.getElementById("tab-expense-unico");
  const tabRecurrente = document.getElementById("tab-expense-recurrente");
  const btnUnico = document.getElementById("btn-expense-unico");
  const btnRecurrente = document.getElementById("btn-expense-recurrente");
  const submitBtn = document.getElementById("expense-submit-btn");
  if (!tabUnico || !tabRecurrente) return;
  const inactiveStyle = "flex:1; padding:10px; border-radius:8px; font-weight:bold; font-size:12px; border:none; cursor:pointer; background:transparent; color:var(--muted); transition:0.2s;";
  const activeStyleGreen = "flex:1; padding:10px; border-radius:8px; font-weight:bold; font-size:12px; border:none; cursor:pointer; background:var(--green); color:#fff; transition:0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.1);";
  if (pestana === "unico") {
    tabUnico.hidden = false; tabRecurrente.hidden = true;
    if (btnUnico) btnUnico.style = activeStyleGreen;
    if (btnRecurrente) btnRecurrente.style = inactiveStyle;
    if (submitBtn) { submitBtn.textContent = "Guardar gasto"; submitBtn.className = "button button-primary"; }
  } else {
    tabUnico.hidden = true; tabRecurrente.hidden = false;
    if (btnRecurrente) btnRecurrente.style = activeStyleGreen;
    if (btnUnico) btnUnico.style = inactiveStyle;
    if (submitBtn) { submitBtn.textContent = "Crear recurrente"; submitBtn.className = "button button-primary"; }
    const catInput = document.getElementById("category-input");
    const recCatInput = document.getElementById("recurring-category-input");
    if (catInput && recCatInput) recCatInput.innerHTML = catInput.innerHTML;
    const startDate = document.getElementById("recurring-start-date");
    if (startDate && !startDate.value) startDate.value = hoyISO();
    actualizarFrecuenciaGasto();
  }
};

window.actualizarFrecuenciaGasto = function() {
  const select = document.getElementById("recurring-frequency-select");
  if (!select) return;
  const freq = select.value;
  const uiFecha = document.getElementById("ui-expense-fecha");
  const uiSemanal = document.getElementById("ui-expense-semanal");
  const uiDiario = document.getElementById("ui-expense-diario");
  if (uiFecha) uiFecha.hidden = (freq !== "mensual" && freq !== "quincenal");
  if (uiSemanal) uiSemanal.hidden = (freq !== "semanal");
  if (uiDiario) uiDiario.hidden = (freq !== "diario");
};

window.alternarDiaGasto = function(btn) {
  btn.classList.toggle("active");
  const container = document.getElementById("expense-days-container");
  if (!container) return;
  
  const activeDays = container.querySelectorAll(".day-btn.active");
  if (activeDays.length === 7) {
    const select = document.getElementById("recurring-frequency-select");
    if (select) { select.value = "diario"; actualizarFrecuenciaGasto(); }
    container.querySelectorAll(".day-btn").forEach(b => b.classList.remove("active"));
  }
};

window.cambiarPestanaIngreso = function(pestana) {
  const tabSumar = document.getElementById("tab-income-sumar");
  const tabFijar = document.getElementById("tab-income-fijar");
  const tabRecurrente = document.getElementById("tab-income-recurrente");
  const btnSumar = document.getElementById("btn-income-sumar");
  const btnFijar = document.getElementById("btn-income-fijar");
  const btnRecurrente = document.getElementById("btn-income-recurrente");
  const submitBtn = document.getElementById("income-submit-btn");

  if (tabSumar) tabSumar.hidden = true;
  if (tabFijar) tabFijar.hidden = true;
  if (tabRecurrente) tabRecurrente.hidden = true;

  const inactiveStyle = "flex:1; padding:10px; border-radius:8px; font-weight:bold; font-size:12px; border:none; cursor:pointer; background:transparent; color:var(--muted); transition:0.2s;";
  const activeStyleGreen = "flex:1; padding:10px; border-radius:8px; font-weight:bold; font-size:12px; border:none; cursor:pointer; background:var(--green); color:#fff; transition:0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.1);";

  if (btnSumar) btnSumar.style = inactiveStyle;
  if (btnFijar) btnFijar.style = inactiveStyle;
  if (btnRecurrente) btnRecurrente.style = inactiveStyle;

  if (pestana === "sumar") {
    if (tabSumar) tabSumar.hidden = false;
    if (btnSumar) btnSumar.style = activeStyleGreen;
    if (submitBtn) { submitBtn.textContent = "Sumar al saldo"; submitBtn.className = "button button-primary"; submitBtn.style.background = ""; submitBtn.style.color = ""; }
  } else if (pestana === "fijar") {
    if (tabFijar) tabFijar.hidden = false;
    if (btnFijar) btnFijar.style = activeStyleGreen;
    if (submitBtn) { submitBtn.textContent = "Fijar saldo exacto"; submitBtn.className = "button button-primary"; submitBtn.style.background = ""; submitBtn.style.color = ""; }
  } else if (pestana === "recurrente") {
    if (tabRecurrente) tabRecurrente.hidden = false;
    if (btnRecurrente) btnRecurrente.style = activeStyleGreen;
    if (submitBtn) { submitBtn.textContent = "Guardar recurrente"; submitBtn.className = "button button-primary"; submitBtn.style.background = ""; submitBtn.style.color = ""; }
    const nextDate = document.getElementById("income-recurring-date");
    if (nextDate && !nextDate.value) nextDate.value = hoyISO();
    
    actualizarFrecuenciaIngreso();
  }
};

window.actualizarFrecuenciaIngreso = function() {
  const select = document.getElementById("income-recurring-frequency");
  if (!select) return;
  const freq = select.value;
  
  const uiFecha = document.getElementById("ui-income-fecha");
  const uiSemanal = document.getElementById("ui-income-semanal");
  const uiDiario = document.getElementById("ui-income-diario");

  if (uiFecha) uiFecha.hidden = (freq !== "mensual" && freq !== "quincenal");
  if (uiSemanal) uiSemanal.hidden = (freq !== "semanal");
  if (uiDiario) uiDiario.hidden = (freq !== "diario");
};

window.alternarDiaIngreso = function(btn) {
  btn.classList.toggle("active");
  const container = document.getElementById("income-days-container");
  if (!container) return;
  
  const activeDays = container.querySelectorAll(".day-btn.active");
  if (activeDays.length === 7) {
    const select = document.getElementById("income-recurring-frequency");
    if (select) { select.value = "diario"; actualizarFrecuenciaIngreso(); }
    container.querySelectorAll(".day-btn").forEach(b => b.classList.remove("active"));
  }
};

// Asegúrate de que en tu función 'cambiarPestanaIngreso', 
// cuando se abra la pestaña recurrente, se llame a actualizarFrecuenciaIngreso():
// (Reemplaza este fragmento dentro de cambiarPestanaIngreso)
// } else if (pestana === "recurrente") {
//   ...
//   actualizarFrecuenciaIngreso();
// }