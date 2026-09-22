/**
 * ============================================================
 *  COMPRA COLECTIVA
 * ------------------------------------------------------------
 *  Herramienta para dividir gastos entre varias personas (ej:
 *  un viaje en grupo). Se trabaja sobre un "borrador"
 *  (collectiveDraft) hasta que se decide cerrarlo, momento en el
 *  que pasa a la lista de eventos colectivos terminados.
 * ============================================================
 */

// Devuelve el borrador actual, asegurándose de que tenga la forma correcta.
function borradorColectivo() {
  if (!estado.collectiveDraft || !Array.isArray(estado.collectiveDraft.people) || !Array.isArray(estado.collectiveDraft.expenses)) {
    estado.collectiveDraft = structuredClone(estadoPorDefecto.collectiveDraft);
  }
  return estado.collectiveDraft;
}

// Personas que participan de una compra puntual (si no se especifica, participan todas).
function personasIncluidasColectivo(evento, compra) {
  const personas = evento.people || [];
  if (!Array.isArray(compra.includedIds)) return personas;
  const incluidas = personas.filter(persona => compra.includedIds.includes(persona.id));
  return incluidas.length ? incluidas : personas;
}

/**
 * Calcula, para el borrador actual, cuánto pagó y cuánto le
 * corresponde a cada persona, y arma la lista mínima de
 * transferencias necesarias para que todos queden equilibrados.
 */
function calcularLiquidacionColectiva(evento = borradorColectivo()) {
  const personas = evento.people || [];
  const total = (evento.expenses || []).reduce((suma, item) => suma + Number(item.amount || 0), 0);

  const desgloseCompras = (evento.expenses || []).map(compra => {
    const incluidas = personasIncluidasColectivo(evento, compra);
    const importe = Number(compra.amount || 0);
    const parte = incluidas.length ? importe / incluidas.length : 0;
    return {
      ...compra,
      amount: importe,
      includedIds: incluidas.map(persona => persona.id),
      excludedIds: personas.filter(persona => !incluidas.some(candidata => candidata.id === persona.id)).map(persona => persona.id),
      share: parte
    };
  });

  const parteIgualitaria = personas.length ? total / personas.length : 0;
  const balances = personas.map(persona => ({
    ...persona,
    paid: desgloseCompras.filter(item => item.payerId === persona.id).reduce((suma, item) => suma + item.amount, 0),
    owed: desgloseCompras.reduce((suma, item) => suma + (item.includedIds.includes(persona.id) ? item.share : 0), 0)
  }));
  balances.forEach(persona => { persona.balance = persona.paid - persona.owed; });

  const acreedores = balances.filter(persona => persona.balance > 0.005).map(persona => ({ ...persona, amount: persona.balance }));
  const deudores = balances.filter(persona => persona.balance < -0.005).map(persona => ({ ...persona, amount: -persona.balance }));

  const transferencias = [];
  deudores.forEach(deudor => {
    let restante = deudor.amount;
    acreedores.forEach(acreedor => {
      if (restante <= 0.005 || acreedor.amount <= 0.005) return;
      const importe = Math.min(restante, acreedor.amount);
      transferencias.push({ from: deudor.name, to: acreedor.name, amount: importe });
      restante -= importe;
      acreedor.amount -= importe;
    });
  });

  return { total, share: parteIgualitaria, balances, transfers: transferencias, expenses: desgloseCompras };
}

// Agrupa las transferencias por quién las tiene que hacer (para mostrarlas por persona).
function agruparTransferenciasColectivas(transferencias) {
  return transferencias.reduce((grupos, transferencia) => {
    (grupos[transferencia.from] ||= []).push(transferencia);
    return grupos;
  }, {});
}

// Guarda el borrador actual y vuelve a dibujar la vista.
function guardarBorradorColectivo() {
  estado.collectiveDraft = borradorColectivo();
  guardarEstado();
  renderizarColectivo();
}

// Dibuja toda la vista "Compra colectiva": participantes, compras cargadas, balances y transferencias.
function renderizarColectivo() {
  const evento = borradorColectivo();
  const inputPersonas = document.getElementById("collective-people");
  if (!inputPersonas) return;

  document.getElementById("collective-name").value = evento.name || "";
  inputPersonas.value = evento.people.map(persona => persona.name).join("\n");

  const selectorPagador = document.getElementById("collective-payer");
  selectorPagador.innerHTML = evento.people.map(persona => `<option value="${persona.id}">${escaparHtml(persona.name)}</option>`).join("");

  const personasIncluidas = document.getElementById("collective-included-people");
  if (personasIncluidas) {
    personasIncluidas.innerHTML = evento.people.map(persona => `<label class="checkbox-label collective-person-option"><input type="checkbox" name="collective-included-person" value="${persona.id}" checked /><span class="checkbox-custom"></span><span>${escaparHtml(persona.name)}</span></label>`).join("");
  }

  document.getElementById("collective-no-people").hidden = evento.people.length > 0;

  document.getElementById("collective-expenses").innerHTML = evento.expenses.map(item => {
    const persona = evento.people.find(candidata => candidata.id === item.payerId);
    const incluidas = personasIncluidasColectivo(evento, item);
    const excluidas = evento.people.filter(candidata => !incluidas.some(seleccionada => seleccionada.id === candidata.id));
    return `<div class="collective-expense-row"><div><strong>${escaparHtml(item.reason)}</strong><span>${escaparHtml(persona?.name || "Sin persona")} · Incluye: ${escaparHtml(incluidas.map(candidata => candidata.name).join(", "))}${excluidas.length ? ` · Excluye: ${escaparHtml(excluidas.map(candidata => candidata.name).join(", "))}` : ""}</span></div><b>${formatearMoneda(item.amount)}</b><button class="delete-button" data-delete-collective-expense="${item.id}" aria-label="Eliminar compra">×</button></div>`;
  }).join("");

  const resultado = calcularLiquidacionColectiva(evento);
  document.getElementById("collective-total").textContent = formatearMoneda(resultado.total);
  document.getElementById("collective-share").textContent = formatearMoneda(resultado.share);

  const transferenciasAgrupadas = agruparTransferenciasColectivas(resultado.transfers);
  document.getElementById("collective-settlements").innerHTML = resultado.transfers.length
    ? Object.entries(transferenciasAgrupadas).map(([desde, transferencias]) =>
        `<div class="collective-payer-group"><h3>${escaparHtml(desde)} debe transferir</h3>${transferencias.map(item => `<div class="collective-transfer"><span>A <strong>${escaparHtml(item.to)}</strong></span><b>${formatearMoneda(item.amount)}</b></div>`).join("")}<div class="collective-payer-total">Total de ${escaparHtml(desde)}: <strong>${formatearMoneda(transferencias.reduce((suma, item) => suma + item.amount, 0))}</strong></div></div>`
      ).join("")
    : `<div class="empty-state compact">${evento.people.length > 1 && evento.expenses.length ? "Todos quedan equilibrados." : "Agrega personas y compras para calcular las transferencias."}</div>`;

  document.getElementById("collective-balances").innerHTML = resultado.balances.map(persona =>
    `<div class="collective-balance"><span>${escaparHtml(persona.name)}</span><span>Pagó ${formatearMoneda(persona.paid)} · Le corresponde ${formatearMoneda(persona.owed)}</span><b class="${persona.balance >= 0 ? "savings-positive" : "savings-negative"}">${persona.balance >= 0 ? "+" : "−"}${formatearMoneda(Math.abs(persona.balance))}</b></div>`
  ).join("");
}

/**
 * Genera un comprobante en HTML (listo para imprimir/guardar)
 * con el detalle de la compra colectiva, y dispara su descarga.
 */
function imprimirComprobanteColectivo() {
  const evento = borradorColectivo(), resultado = calcularLiquidacionColectiva(evento);
  if (!evento.people.length || !evento.expenses.length) return mostrarAviso("Agrega personas y compras antes de generar el comprobante.", true);

  const transferenciasAgrupadas = agruparTransferenciasColectivas(resultado.transfers);
  const tarjetasTransferencia = Object.entries(transferenciasAgrupadas).map(([desde, transferencias]) =>
    `<article class="transfer-card"><div class="transfer-card-heading"><div><span class="eyebrow">Transferir desde</span><h3>${escaparHtml(desde)}</h3></div><span class="transfer-total">${formatearMoneda(transferencias.reduce((suma, item) => suma + item.amount, 0))}</span></div><div class="transfer-list">${transferencias.map(item => `<div class="transfer-row"><span>Transferir a <strong>${escaparHtml(item.to)}</strong></span><strong>${formatearMoneda(item.amount)}</strong></div>`).join("")}</div></article>`
  ).join("");

  const listaPersonas = evento.people.map(persona => escaparHtml(persona.name)).join(", ");

  const filasCompras = resultado.expenses.map(item => {
    const pagador = evento.people.find(persona => persona.id === item.payerId);
    const incluidas = evento.people.filter(persona => item.includedIds.includes(persona.id));
    const excluidas = evento.people.filter(persona => item.excludedIds.includes(persona.id));
    return `<tr><td><strong>${escaparHtml(item.reason)}</strong><span class="cell-detail">Pagó ${escaparHtml(pagador?.name || "Sin persona")}</span></td><td>${formatearMoneda(item.amount)}</td><td>${escaparHtml(incluidas.map(persona => persona.name).join(", "))}</td><td>${escaparHtml(excluidas.map(persona => persona.name).join(", ") || "Ninguna")}</td><td>${formatearMoneda(item.share)}</td></tr>`;
  }).join("");

  const filasBalances = resultado.balances.map(persona =>
    `<tr><td>${escaparHtml(persona.name)}</td><td>${formatearMoneda(persona.paid)}</td><td>${formatearMoneda(persona.owed)}</td><td class="${persona.balance >= 0 ? "positive" : "negative"}">${persona.balance >= 0 ? "+" : "−"}${formatearMoneda(Math.abs(persona.balance))}</td></tr>`
  ).join("");

  const generadoEl = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

  const html = `<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Comprobante - ${escaparHtml(evento.name || "Compra colectiva")}</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#19352b;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45}main{width:210mm;min-height:297mm;margin:0 auto;padding:18mm 16mm 16mm}.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #177b55}.brand{display:flex;align-items:center;gap:10px}.logo{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:#177b55;color:#fff;font-size:24px;font-weight:700}.app-name{font-size:18px;font-weight:700;color:#177b55}.app-caption{display:block;color:#6c837a;font-size:10px}.metadata{text-align:right;color:#557268;font-size:10px}.metadata strong{display:block;color:#177b55;font-size:11px}.title-block{padding:24px 0 18px}.eyebrow{display:block;margin:0 0 5px;color:#177b55;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase}.title-block h1{margin:0;color:#177b55;font-size:27px;line-height:1.1}.event-name{margin:7px 0 0;color:#19352b;font-size:16px;font-weight:700}.participants{margin:6px 0 0;color:#6c837a;font-size:10px}.summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:25px}.summary-card{padding:14px 16px;border:1px solid #cfe2d8;border-radius:10px;background:#e7f1ec}.summary-label{display:block;color:#557268;font-size:10px}.summary-value{display:block;margin-top:3px;color:#177b55;font-size:20px;font-weight:700}.section{margin-top:24px;break-inside:avoid}.section-heading{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #cfe2d8;padding-bottom:7px}.section-heading h2{margin:0;color:#177b55;font-size:15px;letter-spacing:.3px}.section-heading span{color:#6c837a;font-size:10px}.transfer-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.transfer-card{border:1px solid #cfe2d8;border-radius:9px;overflow:hidden;break-inside:avoid}.transfer-card-heading{display:flex;justify-content:space-between;gap:8px;padding:11px 12px;background:#e7f1ec}.transfer-card h3{margin:0;color:#19352b;font-size:13px}.transfer-total{color:#177b55;font-size:13px;font-weight:700}.transfer-list{padding:4px 12px 8px}.transfer-row{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #edf4f0}.transfer-row:last-child{border-bottom:0}.transfer-row strong{color:#177b55}.empty{padding:14px;border:1px dashed #aacbbd;border-radius:8px;color:#557268;background:#f7fbf9}.table-wrap{overflow:hidden;border:1px solid #cfe2d8;border-radius:8px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:8px 9px;border-bottom:1px solid #e0ece6;text-align:left;vertical-align:top;word-wrap:break-word}th{background:#e7f1ec;color:#356455;font-size:9px;text-transform:uppercase;letter-spacing:.4px}td{color:#27483c;font-size:10px}tbody tr:last-child td{border-bottom:0}.cell-detail{display:block;margin-top:2px;color:#6c837a;font-size:9px}th:nth-child(1){width:28%}th:nth-child(2){width:14%}th:nth-child(3){width:22%}th:nth-child(4){width:20%}th:nth-child(5){width:16%}.positive{color:#177b55;font-weight:700}.negative{color:#a05252;font-weight:700}.balance-table th:nth-child(1){width:34%}.balance-table th:nth-child(2),.balance-table th:nth-child(3),.balance-table th:nth-child(4){width:22%}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #cfe2d8;color:#6c837a;font-size:9px;text-align:center}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}main{margin:0}}
</style></head><body><main><header class="header"><div class="brand"><div class="logo">S</div><div><div class="app-name">Saldo</div><span class="app-caption">Gestión personal</span></div></div><div class="metadata"><strong>Versión ${escaparHtml(VERSION_APP)}</strong>Generado el ${escaparHtml(generadoEl)}</div></header><section class="title-block"><span class="eyebrow">Comprobante</span><h1>COMPROBANTE DE COMPRA COLECTIVA</h1><p class="event-name">${escaparHtml(evento.name || "Compra colectiva")}</p><p class="participants">Participantes: ${listaPersonas}</p></section><section class="summary"><div class="summary-card"><span class="summary-label">Total de la compra</span><strong class="summary-value">${formatearMoneda(resultado.total)}</strong></div><div class="summary-card"><span class="summary-label">Parte por persona</span><strong class="summary-value">${formatearMoneda(resultado.share)}</strong></div></section><section class="section"><div class="section-heading"><h2>TRANSFERENCIAS A REALIZAR</h2><span>${resultado.transfers.length ? `${resultado.transfers.length} transferencia${resultado.transfers.length === 1 ? "" : "s"}` : "Sin pendientes"}</span></div>${tarjetasTransferencia ? `<div class="transfer-grid">${tarjetasTransferencia}</div>` : `<div class="empty">No hay transferencias pendientes. Todas las personas quedan equilibradas.</div>`}</section><section class="section"><div class="section-heading"><h2>COMPRAS REGISTRADAS</h2><span>${resultado.expenses.length} compra${resultado.expenses.length === 1 ? "" : "s"}</span></div><div class="table-wrap"><table><thead><tr><th>Compra y pagó</th><th>Importe</th><th>Incluidos</th><th>Excluidos</th><th>Parte por persona</th></tr></thead><tbody>${filasCompras}</tbody></table></div></section><section class="section"><div class="section-heading"><h2>BALANCES</h2><span>Resumen por persona</span></div><div class="table-wrap"><table class="balance-table"><thead><tr><th>Persona</th><th>Pagó</th><th>Le corresponde</th><th>Balance</th></tr></thead><tbody>${filasBalances}</tbody></table></div></section><footer class="footer">Comprobante generado por Saldo · Los importes reflejan las compras y exclusiones registradas.</footer></main></body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `${(evento.name || "compra-colectiva").replace(/[^\wáéíóúñü -]/gi, "").trim().replace(/\s+/g, "-") || "compra-colectiva"}-comprobante.html`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  mostrarAviso("Comprobante descargado correctamente.");
}

// Cierra el borrador actual (lo archiva en collectiveEvents si tiene datos) y empieza uno nuevo.
function reiniciarColectivo() {
  estado.collectiveEvents = estado.collectiveEvents || [];
  if (borradorColectivo().people.length || borradorColectivo().expenses.length) {
    estado.collectiveEvents.push({ ...borradorColectivo(), completedAt: new Date().toISOString() });
  }
  estado.collectiveDraft = structuredClone(estadoPorDefecto.collectiveDraft);
  guardarEstado();
  renderizarColectivo();
  mostrarAviso("Pestaña de compra colectiva reiniciada.");
}
