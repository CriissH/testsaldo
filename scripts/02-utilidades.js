/**
 * ============================================================
 *  UTILIDADES GENERALES
 * ------------------------------------------------------------
 *  Funciones pequeñas y reutilizables que no dependen del
 *  "estado" de negocio (o que solo lo consultan para saber qué
 *  fecha usar). Formato de moneda, formato de fecha, sanitizado
 *  de texto para insertar en HTML y el sistema de avisos (toast).
 * ============================================================
 */

// Formatea un número como pesos argentinos, sin decimales. Ej: $125.000
var formatearMoneda = valor =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valor || 0);

// Igual que formatearMoneda, pero en formato compacto. Ej: $1,2 M
var formatearMonedaCompacta = valor =>
  new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1, style: "currency", currency: "ARS" }).format(Number(valor) || 0);

// Convierte una fecha "AAAA-MM-DD" en un texto corto. Ej: "05 ene"
var formatearFecha = valor =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(`${valor}T12:00:00`)).replace(".", "");

/**
 * Devuelve la fecha que la app debe considerar "hoy".
 * Normalmente es la fecha real del sistema, pero si el modo
 * DEBUG está activo (herramienta de pruebas en Configuración),
 * se usa la fecha simulada guardada en estado.debugDate.
 */
function fechaEfectiva() {
  if (estado.dateMode === "debug" && estado.debugDate) return new Date(`${estado.debugDate}T12:00:00`);
  return new Date();
}

// Cantidad de días que tiene un mes dado (0 = enero).
function diasDelMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

// Fecha efectiva de hoy en formato "AAAA-MM-DD".
var hoyISO = () => {
  const fecha = fechaEfectiva();
  const anio = fecha.getFullYear(), mes = String(fecha.getMonth() + 1).padStart(2, "0"), dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

// Evita inyección de HTML al insertar texto de usuario dentro del DOM.
function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, caracter => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[caracter]));
}

// Muestra un mensaje flotante (toast) que desaparece solo a los 3s.
function mostrarAviso(mensaje, esError = false) {
  const region = document.getElementById("toast-region");
  region.innerHTML = `<div class="toast ${esError ? "error" : ""}">${escaparHtml(mensaje)}</div>`;
  setTimeout(() => { region.innerHTML = ""; }, 3000);
}

// Alias legible de fechaEfectiva(), usado donde se necesita "la fecha de hoy" como objeto Date.
function fechaDeHoy() { return fechaEfectiva(); }

// Alias legible de hoyISO(), usado donde se necesita "la fecha de hoy" como texto "AAAA-MM-DD".
function claveDeHoy() { return hoyISO(); }

// Limpia el texto de notas de una actualización (viene de GitHub).
function formatearNotasActualizacion(notas) {
  return String(notas || "Esta actualización incluye mejoras y correcciones.")
    .replace(/^Hay una nueva actualización\.?\s*/i, "")
    .replace(/\\n/g, "\n")
    .replace(/`n/g, "\n")
    .replace(/\r?\n-\s*/g, "\n• ");
}
