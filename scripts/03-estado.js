/**
 * ============================================================
 *  ESTADO DE LA APLICACIÓN
 * ------------------------------------------------------------
 *  Acá vive el "estado" (todos los datos del usuario: ingresos,
 *  gastos, categorías, ahorros, etc.) y las funciones para
 *  leerlo/guardarlo en localStorage. También quedan declaradas
 *  las variables globales "de trabajo" que usa la interfaz
 *  (qué se está editando en este momento, qué color quedó
 *  seleccionado, etc.).
 * ============================================================
 */

// Estado completo de la app. Se carga una sola vez al iniciar.
var estado = cargarEstado();

// --- Variables de trabajo de la interfaz (no se guardan en disco) ---
var colorSeleccionado = paleta[0];
var iconoSeleccionado = iconos[0];
var categoriaAEditar = null;
var gastoAEliminar = null;
var recurrenteAEditar = null;
var recurrenteAEliminar = null;
var gastoAEditar = null;
var actualizacionDisponible = null;
var respaldoDeActualizacionExportado = false;
var archivoImportacionBienvenida = null;
var avisoIngresoDescartado = false;
var depuracionDesbloqueada = false;

/**
 * Lee el estado guardado en localStorage y lo "repara"/completa
 * con cualquier dato nuevo que se haya agregado en versiones
 * más recientes de Saldo (migraciones suaves), para que usuarios
 * con datos viejos no pierdan información al actualizar la app.
 */
function cargarEstado() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_ALMACENAMIENTO));
    if (!guardado) return structuredClone(estadoPorDefecto);

    const gastos = (guardado.expenses || [])
      .map(item => item.recurring && !item.frequency ? { ...item, frequency: "daily", weekday: null } : item)
      .map(item => item.recurring && item.frequency === "monthly" && !item.monthlyDay && typeof item.recurringDate === "string"
        ? { ...item, monthlyDay: Number(item.recurringDate.slice(8, 10)) }
        : item)
      .map(item => item.recurring ? { ...item, isProjected: item.isProjected !== false } : item);

    const categorias = [...(guardado.categories || [])];
    categoriasPorDefecto.forEach(categoria => { if (!categorias.some(item => item.id === categoria.id)) categorias.push({ ...categoria }); });
    gastos.forEach(item => { if (item.recurring && !item.recurringType) item.recurringType = "expense"; });

    return {
      ...estadoPorDefecto,
      ...guardado,
      backupVersion: 2,
      onboardingComplete: guardado.onboardingComplete ?? Number(guardado.income) > 0,
      categories: categorias,
      expenses: gastos,
      incomeHistory: guardado.incomeHistory || [],
      recurringConfirmations: guardado.recurringConfirmations || {},
      recurringHistory: guardado.recurringHistory || [],
      expenseHistory: guardado.expenseHistory || [],
      incomeNotice: guardado.incomeNotice || "",
      darkMode: Boolean(guardado.darkMode),
      currentCycleIncome: guardado.currentCycleIncome == null ? null : Number(guardado.currentCycleIncome),
      testCycleOverride: guardado.testCycleOverride || null,
      dateMode: guardado.dateMode === "debug" ? "debug" : "system",
      debugDate: guardado.debugDate || null,
      lastCycleStart: guardado.lastCycleStart || null,
      savingsBalance: Number(guardado.savingsBalance || 0),
      savingsHistory: guardado.savingsHistory || [],
      savingsMovements: guardado.savingsMovements || [],
      savingsGoals: guardado.savingsGoals || [],
      collectiveEvents: guardado.collectiveEvents || [],
      collectiveDraft: guardado.collectiveDraft && Array.isArray(guardado.collectiveDraft.people) && Array.isArray(guardado.collectiveDraft.expenses)
        ? guardado.collectiveDraft
        : structuredClone(estadoPorDefecto.collectiveDraft)
    };
  } catch {
    return structuredClone(estadoPorDefecto);
  }
}

// Persiste el estado completo en localStorage.
function guardarEstado() {
  localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(estado));
}
