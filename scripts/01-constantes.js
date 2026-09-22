/**
 * ============================================================
 *  CONSTANTES
 * ------------------------------------------------------------
 *  Todo lo que NO cambia mientras la app corre: la clave de
 *  localStorage, la versión, la paleta de colores/íconos para
 *  categorías, y la "forma" inicial del estado de la app
 *  (defaultState) que se usa la primera vez que alguien abre
 *  Saldo o cuando se reinicia el sistema.
 *
 *  IMPORTANTE: los nombres de las propiedades dentro de los
 *  objetos (por ejemplo "income", "expenses", "categoryId",
 *  "recurringType", etc.) NO se tradujeron. Esos nombres viajan
 *  tal cual dentro del localStorage del usuario y dentro de los
 *  archivos de respaldo (backup) ya exportados, así que
 *  cambiarlos rompería la compatibilidad con datos existentes.
 * ============================================================
 */

// Clave con la que se guarda todo el estado en localStorage.
var CLAVE_ALMACENAMIENTO = "saldo-expenses-v1";

// Versión mostrada en Configuración y usada al chequear actualizaciones.
var VERSION_APP = "1.0.15";

// Colores predefinidos para crear/editar categorías.
var paleta = [
  "#177b55", "#ed9c54", "#8b7ee7", "#5c9ee8", "#d95f59",
  "#51a68b", "#c77bcb", "#a1a85d", "#e4b341", "#369a7c",
  "#d16b94", "#7b8781", "#2e5b7a", "#d97859", "#9c81e8"
];

// Íconos (emoji/símbolos) disponibles para categorías.
var iconos = ["⌂", "▣", "◇", "✦", "♧", "●", "◆", "◉", "🚗", "🚌", "🚲", "🏥", "💡", "🎁", "🛒", "🐾"];

// Categorías con las que arranca cualquier instalación nueva de Saldo.
var categoriasPorDefecto = [
  { id: "food", name: "Alimentación", color: "#177b55", icon: "▣" },
  { id: "home", name: "Hogar", color: "#ed9c54", icon: "⌂" },
  { id: "transport", name: "Transporte", color: "#8b7ee7", icon: "🚗" },
  { id: "leisure", name: "Ocio", color: "#5c9ee8", icon: "✦" },
  { id: "health", name: "Salud", color: "#d95f59", icon: "🏥" },
  { id: "services", name: "Servicios", color: "#5c9ee8", icon: "💡" },
  { id: "gifts", name: "Regalos", color: "#c77bcb", icon: "🎁" }
];

// Forma inicial completa del estado de la aplicación.
var estadoPorDefecto = {
  backupVersion: 2,
  income: 0,
  currentCycleIncome: null,
  cutoffDay: 1,
  onboardingComplete: false,
  pendingIncome: null,
  incomeHistory: [],
  recurringConfirmations: {},
  recurringHistory: [],
  expenseHistory: [],
  incomeNotice: "",
  darkMode: false,
  testCycleOverride: null,
  dateMode: "system",
  debugDate: null,
  lastCycleStart: null,
  savingsBalance: 0,
  savingsHistory: [],
  savingsMovements: [],
  savingsGoals: [],
  collectiveEvents: [],
  collectiveDraft: { name: "", people: [], expenses: [] },
  categories: structuredClone(categoriasPorDefecto),
  expenses: []
};
