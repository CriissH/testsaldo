/**
 * ============================================================
 *  RESPALDOS Y ACTUALIZACIONES
 * ------------------------------------------------------------
 *  Exportar/importar un respaldo completo (un archivo .xls
 *  legible con tablas, que además lleva todo el estado
 *  codificado en base64 dentro de un comentario HTML, para poder
 *  restaurarlo tal cual) y el chequeo de nuevas versiones de la
 *  app instalada (vía el updater de Tauri).
 * ============================================================
 */

window.addEventListener("DOMContentLoaded", () => {
  inicializarEventosRespaldo();
});

/**
 * Vincula los eventos a los botones de la sección de Reportes y Respaldos.
 */
function inicializarEventosRespaldo() {
  // 1. Botón "Generar informe PDF"
  const btnPdfElemento = document.getElementById("pdf-button") || 
                          document.getElementById("btn-export-pdf") || 
                          Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Generar informe PDF"));

  if (btnPdfElemento) {
    btnPdfElemento.onclick = () => {
      window.print();
    };
  }

  // 2. Botón "Exportar a Excel" / "Exportar respaldo"
  const btnExcelElemento = document.getElementById("export-button") || 
                            document.getElementById("btn-export-excel") || 
                            Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Exportar a Excel") || b.textContent.includes("Exportar respaldo"));

  if (btnExcelElemento) {
    btnExcelElemento.onclick = () => {
      exportarRespaldo();
    };
  }

  // 3. Botón "Importar respaldo" / "Restaurar datos"
  const botonesImportar = [
    document.getElementById("restore-button"),
    document.getElementById("import-button"),
    document.getElementById("btn-import-backup")
  ].filter(Boolean);

  if (botonesImportar.length === 0) {
    document.querySelectorAll("button").forEach(btn => {
      if (btn.textContent.includes("Importar respaldo") || btn.textContent.includes("Restaurar datos")) {
        botonesImportar.push(btn);
      }
    });
  }

  botonesImportar.forEach(btn => {
    btn.onclick = () => {
      let fileInput = document.getElementById("import-file") || document.getElementById("input-file-backup");
      if (!fileInput) {
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "input-file-backup";
        fileInput.accept = ".xls,.xlsx,.html,.json,.csv";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);
      }

      fileInput.onchange = (e) => {
        const archivo = e.target.files[0];
        if (archivo) {
          importarRespaldo(archivo);
        }
        fileInput.value = ""; // Limpiar para permitir reimportar el mismo archivo si fuese necesario
      };

      fileInput.click();
    };
  });
}

// Arma una tabla HTML simple para el archivo de respaldo.
function tablaDeRespaldo(titulo, encabezados, filas) {
  return `<h2>${escaparHtml(t(titulo))}</h2><table><thead><tr>${encabezados.map(encabezado => `<th>${escaparHtml(t(encabezado))}</th>`).join("")}</tr></thead><tbody>${filas.map(fila => `<tr>${fila.map(celda => `<td>${escaparHtml(typeof celda === "string" ? t(celda) : (celda ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

/**
 * Genera y descarga el respaldo completo: un .xls con tablas
 * legibles (para revisar a simple vista) y, oculto en un
 * comentario, el estado completo en base64 para poder
 * restaurarlo con total fidelidad.
 */
function exportarRespaldo() {
  const datos = JSON.stringify({ format: "saldo-backup", version: 2, exportedAt: new Date().toISOString(), state: estado });

  const secciones = [
    tablaDeRespaldo("Configuración y resumen", ["Dato", "Valor"], [
      ["Versión de aplicación", typeof VERSION_APP !== "undefined" ? VERSION_APP : "1.0.18"], ["Ingreso base", estado.income], ["Ingreso del ciclo actual", ingresoActual()], ["Día de corte", estado.cutoffDay], ["Ciclo iniciado", estado.lastCycleStart || ""], ["Saldo ahorrado", estado.savingsBalance], ["Modo oscuro", estado.darkMode ? "Sí" : "No"]
    ]),
    tablaDeRespaldo("Categorías", ["ID", "Nombre", "Color", "Ícono"], (estado.categories || []).map(item => [item.id, item.name, item.color, item.icon])),
    tablaDeRespaldo("Gastos", ["ID", "Descripción", "Importe", "Categoría", "Fecha", "Recurrente", "Frecuencia", "Día semanal", "Día mensual", "Origen recurrente"], (estado.expenses || []).map(item => [item.id, item.description, item.amount, obtenerCategoria(item.categoryId).name, item.date, item.recurring ? "Sí" : "No", item.frequency || "", item.weekday ?? "", item.monthlyDay ?? "", item.recurringSourceId || ""])),
    tablaDeRespaldo("Historial de ingresos", ["ID", "Importe", "Razón", "Fecha", "Tipo", "Fecha efectiva", "Día de corte"], (estado.incomeHistory || []).map(item => [item.id, item.amount, item.reason, item.date, item.type, item.effectiveDate || "", item.cutoffDay])),
    tablaDeRespaldo("Historial de ahorros", ["Tipo", "Importe", "Razón", "Fecha"], (estado.savingsMovements || []).map(item => [item.type, item.amount, item.reason, item.date]).concat((estado.savingsHistory || []).map(item => ["Cierre de ciclo", item.transferred, t("Ciclo {} a {}", item.start, item.end), item.date]))),
    tablaDeRespaldo("Historial de correcciones", ["Tipo", "Descripción", "Anterior", "Nuevo", "Razón", "Fecha"], (estado.expenseHistory || []).map(item => ["Gasto", item.description, item.previousAmount, item.amount, item.reason, item.date]).concat((estado.recurringHistory || []).map(item => ["Recurrente", item.description, item.previousAmount, item.amount, t("Alcance: {}", item.scope), item.date]))),
    tablaDeRespaldo("Deudas", ["Persona", "Tipo", "Importe", "Motivo", "Fecha"], (estado.debts || []).map(item => [item.person, item.type === "te-deben" ? "Me debe" : "Le debo", item.amount, item.reason, item.date])),
    tablaDeRespaldo("Compras colectivas", ["Evento", "Participantes", "Gastos", "Creado"], (estado.collectiveEvents || []).map(item => [item.name, item.people.map(persona => persona.name).join(", "), item.expenses.length, item.createdAt]))
  ].join("");

  const html = `<html><head><meta charset="UTF-8"><style>body{font-family:Arial;color:#222}table{border-collapse:collapse;margin:0 0 24px;min-width:520px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#e7f1ec}h1{color:#177b55}</style></head><body><h1>${t("Saldo - Respaldo completo")}</h1><p>${t("Este archivo contiene configuración, gastos, ingresos, ahorros, historiales, categorías y compras colectivas. Puede volver a cargarse en Saldo.")}</p>${secciones}<!--SALDO_BACKUP:${btoa(unescape(encodeURIComponent(datos)))}--></body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `saldo-respaldo-${hoyISO()}.xls`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  if (typeof mostrarAviso === "function") {
    mostrarAviso("Respaldo exportado correctamente");
  }
}

// Lee un archivo de respaldo, decodifica el estado embebido y reemplaza el estado actual.
function importarRespaldo(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const texto = lector.result;
      const codificado = texto.match(/SALDO_BACKUP:([^ -]+)/)?.[1];
      if (!codificado) throw new Error("Formato no reconocido");
      const decodificado = JSON.parse(decodeURIComponent(escape(atob(codificado))));
      const importado = decodificado.state && decodificado.format === "saldo-backup" ? decodificado.state : decodificado;
      if (!Array.isArray(importado.categories) || !Array.isArray(importado.expenses)) throw new Error("Datos inválidos");

      const categoriasImportadas = [...(importado.categories || [])];
      if (typeof categoriasPorDefecto !== "undefined") {
        categoriasPorDefecto.forEach(categoria => { if (!categoriasImportadas.some(item => item.id === categoria.id)) categoriasImportadas.push({ ...categoria }); });
      }

      estado = {
        ...(typeof estadoPorDefecto !== "undefined" ? estadoPorDefecto : {}),
        ...importado,
        backupVersion: 2,
        categories: categoriasImportadas,
        incomeHistory: importado.incomeHistory || [],
        recurringHistory: importado.recurringHistory || [],
        expenseHistory: importado.expenseHistory || [],
        savingsHistory: importado.savingsHistory || [],
        savingsMovements: importado.savingsMovements || [],
        collectiveEvents: importado.collectiveEvents || [],
        debts: importado.debts || [],
        onboardingComplete: true
      };
      if (typeof guardarEstado === "function") guardarEstado();
      if (typeof cerrarModal === "function") cerrarModal("welcome-modal");
      if (typeof renderizar === "function") renderizar();
      if (typeof mostrarAviso === "function") mostrarAviso("Respaldo completo restaurado correctamente");
    } catch (error) {
      console.error("Error al importar respaldo", error);
      if (typeof mostrarAviso === "function") mostrarAviso("No se pudo leer el respaldo. Usa un archivo exportado desde Saldo.", true);
    }
  };
  lector.readAsText(archivo);
}

/**
 * Consulta si hay una nueva versión disponible (a través del
 * updater de Tauri, solo en la versión instalada de escritorio;
 * no hace nada en Android). Si hay una novedad, abre el modal de
 * actualización.
 */
async function verificarActualizacion(mostrarSiNoHay = false, ignorarDescartada = false) {
  if (/Android/i.test(navigator.userAgent)) return;
  try {
    const actualizador = window.__TAURI__?.updater;
    if (!actualizador?.check) {
      if (mostrarSiNoHay && typeof mostrarAviso === "function") mostrarAviso("Las actualizaciones automáticas solo están disponibles en la versión instalada.", true);
      return;
    }
    const remota = await actualizador.check();
    if (remota?.available && (ignorarDescartada || remota.version !== localStorage.getItem("saldo-dismissed-update"))) {
      if (typeof actualizacionDisponible !== "undefined") actualizacionDisponible = remota;
      if (typeof respaldoDeActualizacionExportado !== "undefined") respaldoDeActualizacionExportado = false;
      const msgElem = document.getElementById("update-message");
      if (msgElem) msgElem.textContent = `Está disponible la versión ${remota.version}.`;
      const txtElem = document.getElementById("update-changes-text");
      if (txtElem && typeof formatearNotasActualizacion === "function") txtElem.textContent = formatearNotasActualizacion(remota.body);
      const btnElem = document.getElementById("continue-update-button");
      if (btnElem) btnElem.disabled = true;
      if (typeof abrirModal === "function") abrirModal("update-modal");
    } else if (mostrarSiNoHay && typeof mostrarAviso === "function") {
      mostrarAviso("Ya tienes la última versión.");
    }
  } catch (error) {
    if (mostrarSiNoHay && typeof mostrarAviso === "function") {
      mostrarAviso("No se pudo consultar la actualización publicada. Revisa tu conexión o inténtalo nuevamente.", true);
    }
  }
}