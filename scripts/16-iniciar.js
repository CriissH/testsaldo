/**
 * ============================================================
 *  ARRANQUE DE LA APLICACIÓN
 * ------------------------------------------------------------
 *  Este es el último script que se carga. Para este punto ya
 *  están definidas todas las funciones y ya se conectaron todos
 *  los eventos (15-eventos.js), así que acá simplemente se dibuja
 *  la app por primera vez y se chequea si hay una actualización
 *  disponible (no aplica en Android).
 * ============================================================
 */

renderizar();

if (!/Android/i.test(navigator.userAgent)) {
  setTimeout(() => verificarActualizacion(false, false), 1200);
}
