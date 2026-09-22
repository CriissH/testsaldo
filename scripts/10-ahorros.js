/**
 * ============================================================
 *  AHORROS
 * ------------------------------------------------------------
 *  Saldo ahorrado (que se va acumulando automáticamente al
 *  cerrar cada ciclo, ver 04-ciclos.js), movimientos manuales de
 *  ahorro (ingresar/extraer) y metas de ahorro con una
 *  recomendación de cuánto destinar cada mes.
 * ============================================================
 */

// Fecha de hoy (real, no la de DEBUG) en formato "AAAA-MM-DD". Se usa como valor por defecto en los formularios de ahorro.
function hoyDelSistemaISO() {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

// Abre el modal de ahorro en modo "Ingresar" o "Extraer".
function abrirModalDeAhorro(accion) {
  document.getElementById("savings-action").value = accion;
  document.getElementById("savings-modal-title").textContent = accion === "deposit" ? "Ingresar ahorro" : "Extraer ahorro";
  document.getElementById("savings-date").value = hoyDelSistemaISO();
  document.getElementById("savings-date-today").checked = true;
  abrirModal("savings-modal");
}

// Actualiza el texto de sugerencia ("cuánto podrías ahorrar por mes") del modal de nueva meta.
function actualizarSugerenciaMetaDeAhorro() {
  const objetivo = Number(document.getElementById("savings-goal-target")?.value || 0);
  if (!objetivo) {
    document.getElementById("savings-goal-suggestion").textContent = `Tu proyección mensual disponible: ${formatearMoneda(valorProyeccionMensual())}`;
    return;
  }
  const meses = document.getElementById("savings-goal-date")?.value
    ? Math.max(1, Math.ceil((new Date(`${document.getElementById("savings-goal-date").value}T12:00:00`).getTime() - fechaEfectiva().getTime()) / (1000 * 60 * 60 * 24 * 30.4375)))
    : 6;
  const requerido = Math.ceil(objetivo / meses);
  const disponible = Math.max(0, valorProyeccionMensual());
  const presupuestoRestante = Math.max(0, calcularPresupuestoRestante());
  const limiteSeguro = Math.floor(presupuestoRestante * 0.3);
  const sugerido = Math.min(requerido, disponible || requerido, limiteSeguro);
  document.getElementById("savings-goal-suggestion").textContent = `Tu proyección mensual disponible: ${formatearMoneda(disponible)} · límite prudente (30%): ${formatearMoneda(limiteSeguro)} · sugerido: ${formatearMoneda(sugerido)} por mes durante ${meses} meses.`;
}

// Dibuja las tarjetas de metas de ahorro con su barra de progreso y recomendación.
function renderizarMetasDeAhorro() {
  const metas = estado.savingsGoals || [];
  const lista = document.getElementById("savings-goals-list");
  if (!lista) return;
  if (!metas.length) {
    lista.innerHTML = '<div class="empty-state compact">Aún no creaste metas de ahorro. Define tu primer objetivo.</div>';
    return;
  }
  lista.innerHTML = metas.map(meta => {
    const recomendacion = calcularRecomendacionMeta(meta);
    const progreso = Math.min(100, Math.round((estado.savingsBalance / Number(meta.targetAmount || 1)) * 100));
    return `<div class="savings-goal-card"><div class="savings-goal-header"><div><h3>${escaparHtml(meta.name)}</h3><span>Objetivo ${formatearMoneda(meta.targetAmount)}</span></div><button class="delete-button" data-delete-savings-goal="${meta.id}" title="Eliminar meta">×</button></div><div class="savings-goal-progress"><span style="width:${progreso}%"></span></div><div class="savings-goal-meta"><strong>${recomendacion.goalCauses}</strong><span>${recomendacion.available > 0 ? `Tienes ${formatearMoneda(recomendacion.available)} de proyección mensual disponible.` : "Tu proyección mensual actual no alcanza este objetivo con el presupuesto actual."}</span></div></div>`;
  }).join("");
}

// Dibuja el saldo total, el historial de cierres de ciclo y los movimientos manuales de ahorro.
function renderizarAhorros() {
  const historial = [...(estado.savingsHistory || [])].reverse();
  document.getElementById("savings-total").textContent = formatearMoneda(estado.savingsBalance);
  document.getElementById("savings-total-stat").textContent = formatearMoneda(estado.savingsBalance);
  const movimientos = [...(estado.savingsMovements || [])].reverse();
  document.getElementById("savings-cycle-count").textContent = historial.length;
  document.getElementById("savings-empty").style.display = historial.length || movimientos.length ? "none" : "block";
  document.getElementById("savings-history").innerHTML =
    historial.map(item => `<div class="income-history-row savings-history-row"><div><strong>${formatearFecha(item.start)} – ${formatearFecha(item.end)}</strong><span>Ingreso ${formatearMoneda(item.income)} · Gastado ${formatearMoneda(item.spent)}</span></div><b>+${formatearMoneda(item.transferred)}</b></div>`).join("") +
    movimientos.map(item => `<div class="income-history-row savings-history-row"><div><strong>${item.type === "deposit" ? "Ingreso de ahorro" : "Extracción de ahorro"}</strong><span>${formatearFecha(item.date)} · ${escaparHtml(item.reason)}</span></div><b class="${item.type === "deposit" ? "savings-positive" : "savings-negative"}">${item.type === "deposit" ? "+" : "−"}${formatearMoneda(item.amount)}</b></div>`).join("");
  renderizarMetasDeAhorro();
}
