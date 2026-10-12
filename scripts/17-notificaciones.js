/**
 * Notificaciones del sistema exclusivamente para Android.
 * La aplicación debe estar abierta para evaluar los avisos; no se
 * solicitan permisos ni se muestran notificaciones en PC.
 */

const CLAVE_NOTIFICACIONES_ANDROID = "saldo-android-notifications";
const CLAVE_ULTIMA_NOTIFICACION_ANDROID = "saldo-android-last-notification";

function esAndroid() {
  return /Android/i.test(navigator.userAgent)
    || Boolean(window.__TAURI_INTERNALS__ && window.__TAURI__?.notification);
}

function apiNotificacionesTauri() {
  return window.__TAURI__?.notification || null;
}

function notificacionesAndroidDisponibles() {
  return esAndroid() && Boolean(
    apiNotificacionesTauri()?.sendNotification
    || "Notification" in window
  );
}

async function permisoNotificacionesAndroid() {
  const api = apiNotificacionesTauri();
  if (api?.isPermissionGranted) return api.isPermissionGranted();
  return "Notification" in window && Notification.permission === "granted";
}

async function solicitarPermisoNotificacionesAndroid() {
  const api = apiNotificacionesTauri();
  if (api?.requestPermission) return api.requestPermission();
  if ("Notification" in window) return Notification.requestPermission();
  return "denied";
}

async function notificacionesAndroidActivadas() {
  return localStorage.getItem(CLAVE_NOTIFICACIONES_ANDROID) === "enabled"
    && notificacionesAndroidDisponibles()
    && await permisoNotificacionesAndroid();
}

async function enviarNotificacionSistema(titulo, mensaje, clave, detalle = mensaje) {
  const api = apiNotificacionesTauri();
  if (api?.sendNotification) {
    await api.sendNotification({
      title: titulo,
      body: mensaje,
      largeBody: detalle,
      summary: "Saldo · Gestión de gastos",
      icon: "saldo_notification",
      iconColor: "#177b55"
    });
    return;
  }
  new Notification(titulo, { body: mensaje, tag: clave });
}

async function actualizarControlNotificacionesAndroid() {
  const tarjeta = document.getElementById("android-notifications-card");
  const tarjetaDebug = document.getElementById("android-debug-notification-card");
  const boton = document.getElementById("android-notifications-button");
  const estadoTexto = document.getElementById("android-notifications-status");
  if (!tarjeta || !boton || !estadoTexto) return;
  tarjeta.hidden = !esAndroid();
  if (tarjetaDebug) tarjetaDebug.hidden = !esAndroid();
  if (!esAndroid()) return;

  if (!notificacionesAndroidDisponibles()) {
    boton.hidden = true;
    estadoTexto.textContent = "Tu dispositivo no permite notificaciones del sistema desde esta instalación.";
  } else if (await notificacionesAndroidActivadas()) {
    boton.textContent = "Notificaciones activadas";
    boton.disabled = true;
    estadoTexto.textContent = "Recibirás avisos sobre recurrentes pendientes y presupuesto bajo.";
  } else if (await permisoNotificacionesAndroid() === false) {
    boton.textContent = "Permiso bloqueado";
    boton.disabled = true;
    estadoTexto.textContent = "Habilita las notificaciones de Saldo desde los permisos de Android.";
  }
}

async function activarNotificacionesAndroid() {
  if (!notificacionesAndroidDisponibles()) {
    mostrarAviso("Las notificaciones del sistema solo están disponibles en Android.", true);
    return;
  }
  const permiso = await solicitarPermisoNotificacionesAndroid();
  if (permiso !== "granted" && permiso !== true) {
    mostrarAviso("No se habilitaron las notificaciones.", true);
    actualizarControlNotificacionesAndroid();
    return;
  }
  localStorage.setItem(CLAVE_NOTIFICACIONES_ANDROID, "enabled");
  actualizarControlNotificacionesAndroid();
  mostrarAviso("Notificaciones activadas correctamente.");
  await enviarNotificacionSistema("Saldo", "Te avisaremos sobre eventos importantes de tu presupuesto.", `enabled-${Date.now()}`);
}

async function enviarNotificacionAndroid(titulo, mensaje, clave, detalle = mensaje) {
  if (!await notificacionesAndroidActivadas() || localStorage.getItem(CLAVE_ULTIMA_NOTIFICACION_ANDROID) === clave) return;
  localStorage.setItem(CLAVE_ULTIMA_NOTIFICACION_ANDROID, clave);
  await enviarNotificacionSistema(titulo, mensaje, clave, detalle);
}

async function lanzarNotificacionPruebaAndroid() {
  if (!notificacionesAndroidDisponibles()) {
    mostrarAviso("Las notificaciones de prueba solo están disponibles en Android.", true);
    return;
  }
  if (!await permisoNotificacionesAndroid()) {
    const permiso = await solicitarPermisoNotificacionesAndroid();
    if (permiso !== "granted" && permiso !== true) {
      mostrarAviso("Primero debes permitir las notificaciones de Android.", true);
      actualizarControlNotificacionesAndroid();
      return;
    }
    localStorage.setItem(CLAVE_NOTIFICACIONES_ANDROID, "enabled");
  }
  await enviarNotificacionSistema(
    "Saldo · Prueba",
    "La notificación del sistema funciona correctamente.",
    `debug-${Date.now()}`,
    "Icono y detalle expandido activos. Saldo puede avisarte sobre tu presupuesto y tus movimientos recurrentes."
  );
  mostrarAviso("Notificación de prueba enviada.");
}

async function revisarNotificacionesAndroid() {
  if (!await notificacionesAndroidActivadas() || !estado.onboardingComplete) return;
  const fecha = hoyISO();
  const pendientes = recurrentesPendientes().length + recurrentesMensualesPendientes().length;
  if (pendientes > 0) {
    await enviarNotificacionAndroid(
      "Recurrentes pendientes",
      `Tienes ${pendientes} ${pendientes === 1 ? "movimiento pendiente" : "movimientos pendientes"} para revisar.`,
      `pending-${fecha}-${pendientes}`,
      `Hay ${pendientes} ${pendientes === 1 ? "movimiento recurrente pendiente" : "movimientos recurrentes pendientes"} en el ciclo actual. Abre Saldo, revisa sus importes y confirma o pospone cada movimiento.`
    );
  }

  const presupuesto = ingresoActual();
  const restante = calcularPresupuestoRestante();
  if (presupuesto > 0 && restante >= 0 && restante <= presupuesto * 0.2) {
    await enviarNotificacionAndroid(
      "Presupuesto bajo",
      `Te quedan ${formatearMoneda(restante)} disponibles en este ciclo.`,
      `budget-${fecha}-${Math.round(restante)}`,
      `El presupuesto del ciclo es ${formatearMoneda(presupuesto)} y el saldo disponible quedó en ${formatearMoneda(restante)}. Revisa tus gastos por categoría antes de registrar nuevos movimientos.`
    );
  }
}
