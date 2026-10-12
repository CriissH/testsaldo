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
// Calcula el promedio de ahorro real de los últimos ciclos cerrados (máximo 3 para ser reciente)
function promedioAhorroHistorico() {
  if (!estado.savingsHistory || estado.savingsHistory.length === 0) return null;
  // Tomamos hasta los últimos 3 ciclos para reflejar tu estilo de vida actual
  const ultimos = estado.savingsHistory.slice(-3);
  const suma = ultimos.reduce((acc, ciclo) => acc + Number(ciclo.transferred || 0), 0);
  return Math.round(suma / ultimos.length);
}

// "1 mes" / "12 meses" en el idioma activo.
function textoMeses(n) { return n === 1 ? t("1 mes") : t("{#} meses", n); }

// Actualiza el texto de sugerencia ("cuánto podrías ahorrar por mes") del modal de nueva meta.
function actualizarSugerenciaMetaDeAhorro() {
  const inputValor = document.getElementById("savings-goal-target"); 
  const inputFecha = document.getElementById("savings-goal-date");
  const cajaSugerencia = document.getElementById("savings-goal-suggestion"); 

  if (!inputValor || !cajaSugerencia) return;

  const valor = Number(inputValor.value);
  if (!valor || valor <= 0) {
    cajaSugerencia.innerHTML = "Ingresa un valor objetivo para ver sugerencias.";
    cajaSugerencia.style.background = "var(--paper)";
    cajaSugerencia.style.color = "var(--muted)";
    return;
  }

  const proyeccionTeorica = valorProyeccionMensual(); 
  const promedioHistorico = promedioAhorroHistorico(); 

  let limitePrudente = 0;
  let textoBasadoEn = "";

  // === LA NUEVA INTELIGENCIA ESTADÍSTICA ===
  if (promedioHistorico !== null) {
    // Usamos la estadística real del usuario
    limitePrudente = promedioHistorico;
    textoBasadoEn = t("tu promedio de ahorro real ({})", formatearMoneda(promedioHistorico));
  } else {
    // Usuario nuevo: estimamos 30% del teórico como fallback
    limitePrudente = proyeccionTeorica > 0 ? Math.round(proyeccionTeorica * 0.3) : 0;
    textoBasadoEn = t("tu proyección libre teórica (30%: {})", formatearMoneda(limitePrudente));
  }
  
  if (inputFecha && inputFecha.value) {
    // --- SI EL USUARIO DEFINIÓ UNA FECHA LÍMITE ---
    const fechaMeta = new Date(inputFecha.value + "T12:00:00");
    const hoy = typeof fechaEfectiva === 'function' ? fechaEfectiva() : new Date();
    
    let meses = (fechaMeta.getFullYear() - hoy.getFullYear()) * 12 + (fechaMeta.getMonth() - hoy.getMonth());
    if (meses < 1) meses = 1; 
    
    const cuotaNecesaria = valor / meses;
    
    if (proyeccionTeorica <= 0 && promedioHistorico === null) {
        cajaSugerencia.innerHTML = `<span style="color: #d93025; font-weight: 600;">Sin fondos libres</span><br>Tus gastos programados consumen tu presupuesto.`;
        cajaSugerencia.style.background = "#fce8e6";
        cajaSugerencia.style.color = "#d93025";
    } else if (cuotaNecesaria > limitePrudente * 1.5) { 
        // Si supera por más de un 50% su capacidad real, es muy agresivo
        cajaSugerencia.innerHTML = `<span style="color: #d93025; font-weight: 600;">¡Objetivo muy agresivo!</span><br>${t("Necesitas ahorrar <b>{}</b>/mes. Esto supera con creces {}. Intenta extender la fecha.", formatearMoneda(cuotaNecesaria), textoBasadoEn)}`;
        cajaSugerencia.style.background = "#fce8e6";
        cajaSugerencia.style.color = "#d93025";
    } else if (cuotaNecesaria > limitePrudente) {
        cajaSugerencia.innerHTML = `<span style="color: #e37400; font-weight: 600;">Atención</span><br>${t("Necesitas <b>{}</b>/mes. Requerirá ajustar tus gastos diarios, ya que supera levemente {}.", formatearMoneda(cuotaNecesaria), textoBasadoEn)}`;
        cajaSugerencia.style.background = "#fef7e0";
        cajaSugerencia.style.color = "#e37400";
    } else {
        cajaSugerencia.innerHTML = `<span style="color: var(--green); font-weight: 600;">¡Meta alcanzable!</span><br>${t("Ahorrando <b>{}</b>/mes durante {} lograrás tu objetivo cómodamente.", formatearMoneda(cuotaNecesaria), textoMeses(meses))}`;
        cajaSugerencia.style.background = "#eef7f1";
        cajaSugerencia.style.color = "var(--ink)";
    }
  } else {
    // --- SI NO PUSO FECHA (CÁLCULO AUTOMÁTICO) ---
    if (limitePrudente <= 0) {
        cajaSugerencia.innerHTML = `<span style="color: #e37400; font-weight: 600;">Difícil estimar</span><br>Tus registros indican que el presupuesto está ajustado. Revisa tus gastos diarios para poder empezar a ahorrar.`;
        cajaSugerencia.style.background = "#fef7e0";
        cajaSugerencia.style.color = "#e37400";
        return;
    }
    
    const mesesEstimados = Math.ceil(valor / (limitePrudente || 1));
    
    cajaSugerencia.innerHTML = `${t("Basado en {}, te sugerimos ahorrar <b>{}</b>/mes.", textoBasadoEn, formatearMoneda(limitePrudente))}<br>${t("Alcanzarías tu meta en <b>{}</b>.", textoMeses(mesesEstimados))}`;
    cajaSugerencia.style.background = "#eef7f1";
    cajaSugerencia.style.color = "var(--ink)";
  }
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

  // 1. Armamos el HTML de los cierres de ciclo (siempre son ingresos al ahorro)
  const htmlHistorial = historial.map(item => `
    <div class="savings-history-row">
      <div class="savings-icon">↗</div>
      <div class="savings-info">
        <strong>${formatearFecha(item.start)} – ${formatearFecha(item.end)}</strong>
        <span>Ingreso ${formatearMoneda(item.income)} · Gastado ${formatearMoneda(item.spent)}</span>
      </div>
      <div class="savings-amount">+${formatearMoneda(item.transferred)}</div>
    </div>
  `).join("");

  // 2. Armamos el HTML de los movimientos manuales (pueden ser ingresos o extracciones)
  const htmlMovimientos = movimientos.map(item => {
    const esIngreso = item.type === "deposit";
    const iconoFlecha = esIngreso ? '↗' : '↘';
    const prefijo = esIngreso ? '+' : '−';
    const titulo = esIngreso ? "Ingreso de ahorro" : "Extracción de ahorro";
    
    return `
      <div class="savings-history-row">
        <div class="savings-icon">${iconoFlecha}</div>
        <div class="savings-info">
          <strong>${titulo}</strong>
          <span>${formatearFecha(item.date)} · ${escaparHtml(item.reason)}</span>
        </div>
        <div class="savings-amount">${prefijo}${formatearMoneda(item.amount)}</div>
      </div>
    `;
  }).join("");

  // 3. Juntamos ambas listas y las inyectamos en la pantalla
  document.getElementById("savings-history").innerHTML = htmlHistorial + htmlMovimientos;
  
  renderizarMetasDeAhorro();
}