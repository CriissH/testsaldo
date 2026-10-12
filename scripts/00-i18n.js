/**
 * ============================================================
 *  MULTILENGUAJE (i18n)
 * ------------------------------------------------------------
 *  El español es el idioma base: el texto original de la app es
 *  la "clave" de traducción. Cada idioma vive en su propio archivo
 *  (scripts/idiomas/en.js, pt.js, fr.js, de.js, it.js) y solo
 *  contiene { "texto en español": "traducción" }.
 *
 *  Cómo se traduce:
 *   1. Automático: un observador recorre el texto de la pantalla
 *      (y los atributos placeholder / title / aria-label / alt) y
 *      lo reemplaza si existe en el diccionario. Funciona también
 *      con todo lo que la app dibuja después con innerHTML.
 *   2. Con parámetros: una clave puede llevar "{}" donde van datos
 *      variables (importes, fechas, nombres):
 *          "Hay {} para confirmar": "There are {1} to confirm"
 *      En la traducción se usa {1}, {2}… para poder reordenar.
 *      Los datos que se reemplazan también se traducen si coinciden
 *      con el diccionario (ej. "lunes" → "Monday").
 *   3. Los textos unidos con " · " se traducen por partes.
 *   4. Desde código: t("Se guardaron {} deudas", n)  y  tHtml(html).
 *
 *  Agregar un idioma: copiar scripts/idiomas/en.js, traducir los
 *  valores, sumarlo en IDIOMAS (abajo) y en index.html.
 * ============================================================
 */
(function () {
  const IDIOMAS = {
    es: { nombre: "Español", locale: "es-AR" },
    en: { nombre: "English", locale: "en-US" },
    pt: { nombre: "Português", locale: "pt-BR" },
    fr: { nombre: "Français", locale: "fr-FR" },
    de: { nombre: "Deutsch", locale: "de-DE" },
    it: { nombre: "Italiano", locale: "it-IT" }
  };
  const CLAVE_IDIOMA = "saldo-idioma";
  const ATRIBUTOS = ["placeholder", "title", "aria-label", "alt"];
  const IGNORAR = "script,style,textarea,noscript,[data-no-i18n],[translate=no]";

  const diccionarios = {};   // { en: { clave: traducción } }
  const patrones = {};       // { en: [{ re, trad, peso }] } (claves con {})
  let idioma = "es";
  let titulo = null;         // título original de la página (en español)

  const normalizar = s => String(s).replace(/\s+/g, " ").trim();
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const guardado = () => { try { return localStorage.getItem(CLAVE_IDIOMA); } catch (e) { return null; } };

  function detectarIdioma() {
    const g = guardado();
    if (g && IDIOMAS[g]) return g;
    const lista = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "es"]);
    for (const l of lista) { const base = String(l).toLowerCase().slice(0, 2); if (IDIOMAS[base]) return base; }
    return "es";
  }

  /** Registra (o amplía) el diccionario de un idioma. */
  function registrar(codigo, mapa) {
    const d = diccionarios[codigo] || (diccionarios[codigo] = {});
    const p = patrones[codigo] || (patrones[codigo] = []);
    Object.keys(mapa).forEach(clave => {
      const k = normalizar(clave);
      d[k] = mapa[clave];
      if (k[0] !== "@" && /\{[#$]?\}/.test(k)) {   // {} = cualquier dato, {#} = solo números, {$} = importe
        const MONTO = "([-−+]?\\s?(?:\\$\\s?\\d[\\d.,\\s\\u00a0\\u202f]*|\\d[\\d.,\\s\\u00a0\\u202f]*\\s?\\$)(?:\\s?[KMkm])?)";
        const re = k.split(/(\{[#$]?\})/).map(x => (x === "{}" ? "(.+?)" : x === "{#}" ? "(\\d+)" : x === "{$}" ? MONTO : escRe(x))).join("");
        p.push({ re: new RegExp("^" + re + "$"), trad: mapa[clave], peso: k.replace(/\{[#$]?\}/g, "").length });
      }
    });
    p.sort((a, b) => b.peso - a.peso);
  }

  function rellenar(trad, params) {
    return trad.replace(/\{(\d+)\}/g, (m, i) => (params[i - 1] !== undefined ? params[i - 1] : m));
  }

  /** Busca la traducción de un texto ya normalizado. Devuelve null si no hay. */
  function buscar(clave) {
    if (idioma === "es" || !clave) return null;
    const d = diccionarios[idioma];
    if (!d) return null;
    if (Object.prototype.hasOwnProperty.call(d, clave)) return d[clave];
    for (const p of patrones[idioma] || []) {
      const m = p.re.exec(clave);
      if (m) return rellenar(p.trad, m.slice(1).map(traducirParametro));
    }
    if (/[.!?…]\s+\S/.test(clave)) {   // varias oraciones en un mismo texto: se traduce cada una
      const oraciones = clave.split(/(?<=[.!?…])\s+/);
      if (oraciones.length > 1) {
        let cambio = false;
        const salida = oraciones.map(x => { const r = buscar(x); if (r !== null) cambio = true; return r === null ? x : r; });
        if (cambio) return salida.join(" ");
      }
    }
    if (clave.includes(" · ")) {
      let cambio = false;
      const partes = clave.split(" · ").map(x => { const r = buscar(x.trim()); if (r !== null) cambio = true; return r === null ? x : r; });
      if (cambio) return partes.join(" · ");
    }
    return null;
  }

  /** Un dato dentro de un patrón: se traduce solo si coincide (ej. "lunes", "Lun, Mié"). */
  function traducirParametro(x) {
    const limpio = normalizar(x);
    const r = buscar(limpio);
    if (r !== null) return r;
    if (limpio.includes(", ")) {
      let cambio = false;
      const partes = limpio.split(", ").map(y => { const z = buscar(y); if (z !== null) cambio = true; return z === null ? y : z; });
      if (cambio) return partes.join(", ");
    }
    return x;
  }

  /** t("Hay {} gastos", 3) → texto en el idioma activo (desde código JS). */
  function t(clave, ...params) {
    const k = normalizar(clave);
    if (idioma !== "es") {
      const d = diccionarios[idioma];
      if (d && Object.prototype.hasOwnProperty.call(d, k)) return rellenar(d[k], params);
    }
    let i = 0;
    return clave.replace(/^@/, "").replace(/\{[#$]?\}/g, () => (params[i] !== undefined ? params[i++] : "{}"));
  }

  /* ---------- Traducción del DOM ---------- */

  function procesarTexto(nodo) {
    const meta = nodo.__i18n;
    const src = meta && nodo.nodeValue === meta.tr ? meta.src : nodo.nodeValue;
    const clave = normalizar(src);
    const salida = clave ? buscar(clave) : null;
    if (salida === null) {
      if (nodo.nodeValue !== src) nodo.nodeValue = src;
      nodo.__i18n = null;
      return;
    }
    const val = src.match(/^\s*/)[0] + salida + src.match(/\s*$/)[0];
    if (nodo.nodeValue !== val) nodo.nodeValue = val;
    nodo.__i18n = { src, tr: val };
  }

  function procesarAtributos(el) {
    if (!el.getAttribute) return;
    for (const a of ATRIBUTOS) {
      if (!el.hasAttribute(a)) continue;
      const meta = el.__i18na && el.__i18na[a];
      const actual = el.getAttribute(a);
      const src = meta && actual === meta.tr ? meta.src : actual;
      const salida = buscar(normalizar(src));
      el.__i18na = el.__i18na || {};
      if (salida === null) { if (actual !== src) el.setAttribute(a, src); el.__i18na[a] = null; }
      else { if (actual !== salida) el.setAttribute(a, salida); el.__i18na[a] = { src, tr: salida }; }
    }
  }

  function ignorado(nodo) {
    const padre = nodo.nodeType === 3 ? nodo.parentElement : nodo;
    return !!(padre && padre.closest && padre.closest(IGNORAR));
  }

  /** Recorre un árbol (documento, elemento o fragmento) y traduce todo su texto. */
  function aplicar(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { if (!ignorado(raiz)) procesarTexto(raiz); return; }
    if (raiz.nodeType === 1) { if (ignorado(raiz)) return; procesarAtributos(raiz); }
    const doc = raiz.ownerDocument || document;
    const w = doc.createTreeWalker(raiz, 1 | 4);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (!ignorado(n)) procesarTexto(n); }
      else if (!ignorado(n)) procesarAtributos(n);
    }
  }

  function aplicarTitulo() {
    if (titulo === null) titulo = document.title;
    const r = idioma === "es" ? null : buscar(normalizar(titulo));
    document.title = r === null ? titulo : r;
  }

  /** Traduce un fragmento HTML (como texto) sin tocar la pantalla. Útil para PDFs y exportaciones. */
  function tHtml(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    aplicar(tpl.content);
    return tpl.innerHTML;
  }

  function actualizarSelectores() {
    document.querySelectorAll("[data-idioma-select]").forEach(sel => {
      if (!sel.options.length) {
        sel.setAttribute("data-no-i18n", "");
        Object.keys(IDIOMAS).forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = IDIOMAS[c].nombre; sel.appendChild(o); });
        sel.addEventListener("change", () => establecerIdioma(sel.value));
      }
      sel.value = idioma;
    });
  }

  function establecerIdioma(codigo) {
    if (!IDIOMAS[codigo]) return;
    idioma = codigo;
    try { localStorage.setItem(CLAVE_IDIOMA, codigo); } catch (e) {}
    document.documentElement.lang = codigo;
    aplicarTitulo();
    if (document.body) aplicar(document.body);
    actualizarSelectores();
    document.dispatchEvent(new CustomEvent("saldo-idioma", { detail: codigo }));
  }

  function iniciar() {
    idioma = detectarIdioma();
    document.documentElement.lang = idioma;
    actualizarSelectores();
    aplicarTitulo();
    aplicar(document.body);
    new MutationObserver(muts => {
      if (idioma === "es") return;
      for (const m of muts) {
        if (m.type === "childList") m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) aplicar(n); });
        else if (m.type === "characterData") { if (m.target.nodeType === 3 && !ignorado(m.target)) procesarTexto(m.target); }
        else if (m.type === "attributes") { if (!ignorado(m.target)) procesarAtributos(m.target); }
      }
    }).observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATRIBUTOS });
  }

  window.IDIOMAS = IDIOMAS;
  window.t = t;
  window.tHtml = tHtml;
  window.idiomaActual = () => idioma;
  window.idiomaLocale = () => IDIOMAS[idioma].locale;
  window.SaldoI18n = { registrar, establecerIdioma, aplicar, buscar, t, normalizar, idiomas: IDIOMAS, actual: () => idioma, _dic: diccionarios };

  // Idioma activo desde ya (para que t() y los formatos funcionen antes del primer render).
  idioma = detectarIdioma();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
