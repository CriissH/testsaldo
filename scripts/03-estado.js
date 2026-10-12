/**
 * ============================================================
 *  ESTADO DE LA APLICACIÓN (SEGURO)
 * ------------------------------------------------------------
 *  El estado ya no se carga automáticamente. Se mantiene en 
 *  null hasta que el usuario ingresa la clave maestra.
 * ============================================================
 */

var estado = null;
var masterPassword = null; // Mantenemos la clave en memoria RAM por sesión

// Variables de trabajo de la interfaz
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
 * Intenta descifrar la bóveda. Si es la primera vez o si los 
 * datos estaban en texto plano (JSON viejo), los migra y los cifra.
 */
async function desbloquearAplicacion(password) {
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    let datosEnCrudo = null;

    if (!guardado) {
      // 1. Primera instalación: No hay datos en el equipo
      datosEnCrudo = structuredClone(estadoPorDefecto);
    } else if (guardado.trim().startsWith("{")) {
      // 2. MIGRACIÓN: Datos antiguos en texto plano
      datosEnCrudo = JSON.parse(guardado);
    } else {
      // 3. Flujo Seguro: Intentamos abrir el candado criptográfico
      datosEnCrudo = await SaldoCrypto.descifrarEstado(guardado, password);
      if (!datosEnCrudo) return false; // CLAVE INCORRECTA
    }

    // Reparación y fusión de compatibilidad (Tu lógica original intacta)
    const gastos = (datosEnCrudo.expenses || [])
      .map(item => item.recurring && !item.frequency ? { ...item, frequency: "daily", weekday: null } : item)
      .map(item => item.recurring && item.frequency === "monthly" && !item.monthlyDay && typeof item.recurringDate === "string"
        ? { ...item, monthlyDay: Number(item.recurringDate.slice(8, 10)) } : item)
      .map(item => item.recurring ? { ...item, isProjected: item.isProjected !== false } : item);

    const categorias = [...(datosEnCrudo.categories || [])];
    categoriasPorDefecto.forEach(categoria => { if (!categorias.some(item => item.id === categoria.id)) categorias.push({ ...categoria }); });
    gastos.forEach(item => { if (item.recurring && !item.recurringType) item.recurringType = "expense"; });

    estado = {
      ...estadoPorDefecto,
      ...datosEnCrudo,
      backupVersion: 2,
      onboardingComplete: datosEnCrudo.onboardingComplete ?? Number(datosEnCrudo.income) > 0,
      categories: categorias,
      expenses: gastos,
      incomeHistory: datosEnCrudo.incomeHistory || [],
      recurringConfirmations: datosEnCrudo.recurringConfirmations || {},
      recurringHistory: datosEnCrudo.recurringHistory || [],
      expenseHistory: datosEnCrudo.expenseHistory || [],
      incomeNotice: datosEnCrudo.incomeNotice || "",
      darkMode: Boolean(datosEnCrudo.darkMode),
      currentCycleIncome: datosEnCrudo.currentCycleIncome == null ? null : Number(datosEnCrudo.currentCycleIncome),
      testCycleOverride: datosEnCrudo.testCycleOverride || null,
      dateMode: datosEnCrudo.dateMode === "debug" ? "debug" : "system",
      debugDate: datosEnCrudo.debugDate || null,
      lastCycleStart: datosEnCrudo.lastCycleStart || null,
      savingsBalance: Number(datosEnCrudo.savingsBalance || 0),
      savingsHistory: datosEnCrudo.savingsHistory || [],
      savingsMovements: datosEnCrudo.savingsMovements || [],
      savingsGoals: datosEnCrudo.savingsGoals || [],
      collectiveEvents: datosEnCrudo.collectiveEvents || [],
      debts: Array.isArray(datosEnCrudo.debts) ? datosEnCrudo.debts : [],
      collectiveDraft: datosEnCrudo.collectiveDraft && Array.isArray(datosEnCrudo.collectiveDraft.people) && Array.isArray(datosEnCrudo.collectiveDraft.expenses)
        ? datosEnCrudo.collectiveDraft : structuredClone(estadoPorDefecto.collectiveDraft)
    };

    masterPassword = password;
    
    // Forzamos guardado inmediato. Si venía en plano, quedará encriptado para siempre.
    guardarEstado(); 
    return true;

  } catch (error) {
    console.error("Error crítico en la bóveda:", error);
    return false;
  }
}

/**
 * Encripta el objeto en segundo plano antes de enviarlo al disco duro.
 */
async function guardarEstado() {
  if (!estado || !masterPassword) return;
  const cifrado = await SaldoCrypto.cifrarEstado(estado, masterPassword);
  if (cifrado) {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, cifrado);
  }
}