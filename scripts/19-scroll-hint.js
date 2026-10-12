/**
 * ============================================================
 *  INDICADOR "HAY MÁS ABAJO" (automático)
 * ------------------------------------------------------------
 *  Agrega un botoncito flotante "Ver más ↓" a cualquier contenedor
 *  con scroll vertical cuyo contenido no entre de una sola vez:
 *  todos los .modal (incluye bottom sheets del celular) y cualquier
 *  elemento con el atributo data-scroll-hint.
 *
 *  - Aparece solo si hay contenido oculto abajo y se va al llegar al final.
 *  - Al tocarlo, baja un poco.
 *  - Detecta modales nuevos y cambios de contenido sin tocar nada más.
 * ============================================================
 */
(function () {
  const SELECTOR = ".modal, [data-scroll-hint]";
  const TEXTO = "Ver más";
  const MARGEN_FINAL = 12; // px de tolerancia para considerar "llegó al fondo"
  const observados = new WeakSet();

  function crearIndicador(contenedor) {
    const hint = document.createElement("div");
    hint.className = "scroll-hint";
    hint.setAttribute("data-scroll-hint-el", "");
    hint.innerHTML = `<button type="button" class="scroll-hint-pill" tabindex="-1" aria-label="Desplazar hacia abajo">${TEXTO} <span class="scroll-hint-arrow" aria-hidden="true">↓</span></button>`;
    hint.querySelector("button").addEventListener("click", () => {
      contenedor.scrollBy({ top: Math.max(120, contenedor.clientHeight * 0.75), behavior: "smooth" });
    });
    return hint;
  }

  function adjuntar(contenedor) {
    if (observados.has(contenedor)) return;
    observados.add(contenedor);

    const hint = crearIndicador(contenedor);
    let pendiente = false;

    function actualizar() {
      pendiente = false;
      // Si algún render reemplazó el contenido, lo dejamos de nuevo como último hijo.
      if (contenedor.lastElementChild !== hint) contenedor.appendChild(hint);
      const hayScroll = contenedor.scrollHeight - contenedor.clientHeight > 4;
      const alFondo = contenedor.scrollTop + contenedor.clientHeight >= contenedor.scrollHeight - MARGEN_FINAL;
      hint.classList.toggle("visible", hayScroll && !alFondo);
    }
    function programar() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(actualizar);
    }

    contenedor.appendChild(hint);
    contenedor.addEventListener("scroll", programar, { passive: true });
    window.addEventListener("resize", programar);
    if ("ResizeObserver" in window) new ResizeObserver(programar).observe(contenedor);
    new MutationObserver(programar).observe(contenedor, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style", "class"]
    });
    programar();
  }

  function escanear(raiz) {
    if (raiz.nodeType !== 1) return;
    if (raiz.matches(SELECTOR)) adjuntar(raiz);
    raiz.querySelectorAll(SELECTOR).forEach(adjuntar);
  }

  function iniciar() {
    escanear(document.body);
    // Modales o paneles creados después
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(escanear)))
      .observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();