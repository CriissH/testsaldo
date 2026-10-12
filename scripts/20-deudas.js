/**
 * ============================================================
 *  DEUDAS
 * ------------------------------------------------------------
 *  Control de lo que te deben y lo que debés, unificado por
 *  persona. Los datos viven en estado.debts (cifrados junto al
 *  resto del estado y incluidos en los respaldos).
 *
 *  Cada deuda: { id, person, type, amount, reason, date }
 *    - type: "te-deben" (te deben a vos) | "debes" (le debés)
 *    - date: "AAAA-MM-DD"
 * ============================================================
 */

// Clave para agrupar personas sin importar mayúsculas, tildes ni espacios ("Ana", "ana ", "Aná").
function claveDePersonaDeuda(nombre) {
  return String(nombre || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Agrupa las deudas por persona y calcula totales y balance neto.
function agruparDeudasPorPersona() {
  const grupos = {};
  let totalTeDeben = 0, totalDebes = 0;
  (estado.debts || []).forEach(deuda => {
    const clave = claveDePersonaDeuda(deuda.person);
    const grupo = grupos[clave] || (grupos[clave] = { nombre: deuda.person, movimientos: [], teDeben: 0, debes: 0 });
    grupo.movimientos.push(deuda);
    const importe = Number(deuda.amount || 0);
    if (deuda.type === "te-deben") { grupo.teDeben += importe; totalTeDeben += importe; }
    else { grupo.debes += importe; totalDebes += importe; }
  });
  const personas = Object.values(grupos).map(p => ({ ...p, neto: p.teDeben - p.debes }));
  personas.forEach(p => p.movimientos.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id))));
  personas.sort((a, b) => Math.abs(b.neto) - Math.abs(a.neto) || a.nombre.localeCompare(b.nombre));
  return { personas, totalTeDeben, totalDebes };
}

function renderizarDeudas() {
  const lista = document.getElementById("debt-list");
  if (!lista || !estado) return;
  const { personas, totalTeDeben, totalDebes } = agruparDeudasPorPersona();

  document.getElementById("debt-total-owed").textContent = formatearMoneda(totalTeDeben);
  document.getElementById("debt-total-owe").textContent = formatearMoneda(totalDebes);

  if (!personas.length) {
    lista.innerHTML = '<div class="empty-state compact">No hay deudas registradas.</div>';
    return;
  }

  lista.innerHTML = personas.map(persona => {
    const movimientos = persona.movimientos.map(mov => {
      const esMas = mov.type === "te-deben";
      return `<div class="debt-move">
        <div class="debt-move-info"><strong>${escaparHtml(mov.reason)}</strong><span>${formatearFecha(mov.date)}</span></div>
        <div class="debt-move-amount ${esMas ? "plus" : "minus"}">${esMas ? "+" : "−"}${formatearMoneda(mov.amount)}</div>
        <button type="button" class="delete-button" data-debt-delete="${escaparHtml(mov.id)}" title="Eliminar" aria-label="Eliminar movimiento">×</button>
      </div>`;
    }).join("");

    return `<article class="debt-person">
      <div class="debt-person-head">
        <div class="debt-person-id"><span class="debt-avatar">${escaparHtml(persona.nombre.charAt(0).toUpperCase())}</span><strong>${escaparHtml(persona.nombre)}</strong></div>
        <div class="debt-net ${persona.neto < 0 ? "negative" : ""}"><span>Balance neto</span><strong>${formatearMoneda(persona.neto)}</strong></div>
      </div>
      <div class="debt-detail-label">Detalle de movimientos (${persona.movimientos.length})</div>
      <div class="debt-moves">${movimientos}</div>
    </article>`;
  }).join("");
}

/* ---------- Modal "Registrar deuda" ---------- */

function abrirModalDeuda() {
  document.getElementById("debt-form").reset();
  ocultarSugerenciasDeuda();
  abrirModal("debt-modal");
  setTimeout(() => document.getElementById("debt-person").focus(), 0);
}

function ocultarSugerenciasDeuda() {
  const caja = document.getElementById("debt-suggestions");
  if (caja) caja.hidden = true;
}

// Muestra los nombres ya usados que coincidan con lo escrito.
function filtrarSugerenciasDeuda(texto) {
  const caja = document.getElementById("debt-suggestions");
  if (!caja) return;
  const buscado = claveDePersonaDeuda(texto);
  const nombres = [...new Map((estado.debts || []).map(d => [claveDePersonaDeuda(d.person), d.person])).values()];
  const filtrados = nombres.filter(n => claveDePersonaDeuda(n).includes(buscado));
  if (!filtrados.length || (filtrados.length === 1 && claveDePersonaDeuda(filtrados[0]) === buscado)) {
    caja.hidden = true;
    return;
  }
  caja.innerHTML = filtrados.map(n => `<button type="button" class="debt-suggestion" data-debt-suggest="${escaparHtml(n)}">${escaparHtml(n)}</button>`).join("");
  caja.hidden = false;
}

function guardarDeuda(evento) {
  evento.preventDefault();
  const persona = document.getElementById("debt-person").value.trim();
  const importe = Number(document.getElementById("debt-amount").value);
  const motivo = document.getElementById("debt-reason").value.trim();
  if (!persona || !motivo || !(importe > 0)) return;

  // Si la persona ya existe con otra grafía ("ana"), conservamos el nombre original.
  const existente = (estado.debts || []).find(d => claveDePersonaDeuda(d.person) === claveDePersonaDeuda(persona));

  estado.debts = estado.debts || [];
  estado.debts.push({
    id: `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    person: existente ? existente.person : persona,
    type: document.getElementById("debt-type").value === "debes" ? "debes" : "te-deben",
    amount: importe,
    reason: motivo,
    date: hoyISO()
  });
  guardarEstado();
  cerrarModal("debt-modal");
  renderizarDeudas();
  mostrarAviso("Deuda registrada");
}

/* ---------- Eventos ---------- */

document.getElementById("debt-new-button")?.addEventListener("click", abrirModalDeuda);
document.getElementById("debt-form")?.addEventListener("submit", guardarDeuda);

const campoPersonaDeuda = document.getElementById("debt-person");
campoPersonaDeuda?.addEventListener("input", () => filtrarSugerenciasDeuda(campoPersonaDeuda.value));
campoPersonaDeuda?.addEventListener("focus", () => filtrarSugerenciasDeuda(campoPersonaDeuda.value));

document.addEventListener("click", evento => {
  const sugerencia = evento.target.closest("[data-debt-suggest]");
  if (sugerencia) {
    campoPersonaDeuda.value = sugerencia.dataset.debtSuggest;
    ocultarSugerenciasDeuda();
    return;
  }
  if (!evento.target.closest(".debt-person-field")) ocultarSugerenciasDeuda();

  const eliminar = evento.target.closest("[data-debt-delete]");
  if (eliminar) {
    estado.debts = (estado.debts || []).filter(d => d.id !== eliminar.dataset.debtDelete);
    guardarEstado();
    renderizarDeudas();
    mostrarAviso("Movimiento eliminado");
  }
});
