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
    expenses: "Gastos",
    categories: "Categorías",
    savings: "Ahorrado",
    "income-history-view": "Historial de ingresos",
    collective: "Compra colectiva",
    "recurring-all": "Todos los gastos recurrentes",
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
  document.getElementById("remaining-caption").textContent = presupuesto
    ? (restante >= 0 ? "Disponible para el resto del ciclo" : "Has superado tu presupuesto")
    : "Configura tu ingreso mensual para comenzar";

  const aviso = document.getElementById("income-notice");
  if (estado.incomeNotice) {
    aviso.textContent = estado.incomeNotice;
    aviso.hidden = false;
  } else {
    aviso.hidden = true;
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
  document.getElementById("income-input").value = estado.income || "";
  document.getElementById("cutoff-input").value = estado.cutoffDay || 1;
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
  document.getElementById("setup-required-card").hidden = Boolean(estado.onboardingComplete && estado.income > 0);
  cerrarCiclosCompletados();
  aplicarIngresoPendiente();
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
  renderizarConfirmacionRecurrentes();
  document.getElementById("installed-version").textContent = VERSION_APP;
  document.getElementById("dark-mode-toggle").checked = estado.darkMode;
  if (!estado.onboardingComplete) {
    document.getElementById("welcome-modal").hidden = false;
    setTimeout(() => document.getElementById("welcome-income-input").focus(), 0);
  }
}
