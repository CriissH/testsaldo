/**
 * Diagnóstico local de Saldo.
 * Mantiene un registro acotado en localStorage y también escribe en Logcat/DevTools.
 */
(function inicializarSistemaDeLogs(global) {
  const CLAVE = "saldo-runtime-logs-v1";
  const MAXIMO = 1000;
  const inicio = Date.now();
  let secuencia = 0;
  let registros = [];
  let escrituraNativaPendiente = Promise.resolve();

  function guardarEnDocumentos() {
    const fs = global.__TAURI__?.fs;
    const base = global.__TAURI__?.fs?.BaseDirectory?.Document;
    if (!fs?.writeTextFile || !base) return;
    const contenido = JSON.stringify(registros.slice(-MAXIMO), null, 2);
    escrituraNativaPendiente = escrituraNativaPendiente
      .then(async () => {
        if (fs.mkdir) await fs.mkdir("Saldo/Logs", { baseDir: base, recursive: true });
        await fs.writeTextFile("Saldo/Logs/runtime.json", contenido, { baseDir: base });
      })
      .catch(error => global.console?.error?.("[Saldo logs] No se pudo escribir Documentos/Saldo/Logs", error));
  }

  function leer() {
    try {
      const guardado = JSON.parse(global.localStorage?.getItem(CLAVE) || "[]");
      return Array.isArray(guardado) ? guardado.slice(-MAXIMO) : [];
    } catch (error) {
      return [{ nivel: "error", etapa: "logs", mensaje: "No se pudo leer el registro", error: String(error) }];
    }
  }

  function guardar() {
    try {
      global.localStorage?.setItem(CLAVE, JSON.stringify(registros.slice(-MAXIMO)));
    } catch (error) {
      global.console?.error?.("[Saldo logs] No se pudo guardar el registro", error);
    }
  }

  function normalizar(valor) {
    if (valor instanceof Error) return { name: valor.name, message: valor.message, stack: valor.stack };
    if (typeof valor === "undefined") return undefined;
    try {
      JSON.stringify(valor);
      return valor;
    } catch {
      return String(valor);
    }
  }

  function registrar(nivel, etapa, mensaje, datos) {
    const entrada = {
      id: ++secuencia,
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - inicio,
      nivel,
      etapa,
      mensaje,
      datos: normalizar(datos)
    };
    registros.push(entrada);
    if (registros.length > MAXIMO) registros = registros.slice(-MAXIMO);
    guardar();
    guardarEnDocumentos();
    const salida = `[Saldo][${nivel}][${etapa}] ${mensaje}`;
    if (nivel === "error") global.console?.error?.(salida, datos || "");
    else if (nivel === "warn") global.console?.warn?.(salida, datos || "");
    else global.console?.info?.(salida, datos || "");
    return entrada;
  }

  registros = leer();
  global.SaldoLogs = {
    debug: (etapa, mensaje, datos) => registrar("debug", etapa, mensaje, datos),
    info: (etapa, mensaje, datos) => registrar("info", etapa, mensaje, datos),
    warn: (etapa, mensaje, datos) => registrar("warn", etapa, mensaje, datos),
    error: (etapa, mensaje, datos) => registrar("error", etapa, mensaje, datos),
    obtener: () => registros.slice(),
    limpiar: () => { registros = []; guardar(); registrar("info", "logs", "Registro limpiado"); },
    exportar: () => JSON.stringify(registros, null, 2),
    descargar: () => {
      const blob = new Blob([JSON.stringify(registros, null, 2)], { type: "application/json" });
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(blob);
      enlace.download = `saldo-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
      registrar("info", "logs", "Registro exportado");
    },
    envolverFunciones: () => {
      const nombres = Object.getOwnPropertyNames(global);
      let envueltas = 0;
      nombres.forEach(nombre => {
        if (["SaldoLogs", "inicializarSistemaDeLogs", "setTimeout", "setInterval"].includes(nombre)) return;
        let funcion;
        try { funcion = global[nombre]; } catch { return; }
        if (typeof funcion !== "function" || funcion.__saldoEnvuelta) return;
        const envuelta = function (...argumentos) {
          const inicioFuncion = Date.now();
          registrar("debug", `funcion:${nombre}`, "Inicio", { argumentos });
          try {
            const resultado = funcion.apply(this, argumentos);
            if (resultado && typeof resultado.then === "function") {
              return resultado.then(valor => {
                registrar("debug", `funcion:${nombre}`, "Fin asincrónico", { duracionMs: Date.now() - inicioFuncion });
                return valor;
              }).catch(error => {
                registrar("error", `funcion:${nombre}`, "Error asincrónico", { duracionMs: Date.now() - inicioFuncion, error });
                throw error;
              });
            }
            registrar("debug", `funcion:${nombre}`, "Fin", { duracionMs: Date.now() - inicioFuncion });
            return resultado;
          } catch (error) {
            registrar("error", `funcion:${nombre}`, "Error", { duracionMs: Date.now() - inicioFuncion, error });
            throw error;
          }
        };
        Object.defineProperty(envuelta, "__saldoEnvuelta", { value: true });
        try { global[nombre] = envuelta; envueltas += 1; } catch { /* APIs no reemplazables */ }
      });
      registrar("info", "logs", "Funciones envueltas para diagnóstico", { cantidad: envueltas });
    }
  };

  global.addEventListener?.("error", evento => {
    global.SaldoLogs.error("window:error", evento.message || "Error no controlado", {
      archivo: evento.filename, linea: evento.lineno, columna: evento.colno, error: evento.error
    });
  });
  global.onerror = (mensaje, archivo, linea, columna, error) => {
    global.SaldoLogs.error("window:onerror", String(mensaje || "Error no controlado"), {
      archivo, linea, columna, error
    });
    return false;
  };
  global.addEventListener?.("unhandledrejection", evento => {
    global.SaldoLogs.error("window:unhandledrejection", "Promesa rechazada sin manejar", evento.reason);
  });
  registrar("info", "bootstrap", "Sistema de logs inicializado", { userAgent: global.navigator?.userAgent });
})(window);
