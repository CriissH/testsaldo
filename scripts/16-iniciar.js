/**
 * ============================================================
 *  ARRANQUE DE LA APLICACIÓN (INTELIGENTE Y SEGURO)
 * ------------------------------------------------------------
 */

// Al cambiar de idioma se vuelve a dibujar la pantalla (fechas e importes usan el formato del idioma).
document.addEventListener("saldo-idioma", () => {
  if (typeof estado !== "undefined" && estado && typeof renderizar === "function") renderizar();
});

document.addEventListener("DOMContentLoaded", async () => {
  const lockForm = document.getElementById("lock-form");
  const lockError = document.getElementById("lock-error");
  const lockScreen = document.getElementById("lock-screen");
  const passwordInput = document.getElementById("master-password");
  const autoLoginCheckbox = document.getElementById("auto-login-checkbox");
  const appShell = document.querySelector(".app-shell");
  const btn = lockForm ? lockForm.querySelector("button") : null;

  // 1. Detectar si es una instalación nueva o base de datos vacía
  const guardado = localStorage.getItem("saldo-expenses-v1");
  const requiereCrearClave = !guardado || guardado.trim().startsWith("{");

  // Si no hay datos, limpiamos tokens residuales y adaptamos la interfaz
  if (requiereCrearClave) {
    localStorage.removeItem("saldo-autologin-token"); // Anula auto-logins viejos
    if (lockScreen) {
      const titulo = lockScreen.querySelector(".lock-title");
      const subtitulo = lockScreen.querySelector(".lock-subtitle");
      if (titulo) titulo.innerHTML = 'Crea tu Bóveda <span id="app-version" class="version-badge">v1.0.18</span>';
      if (subtitulo) subtitulo.textContent = "Estás a un paso de proteger tus datos. Inventa una contraseña maestra para tu nueva bóveda.";
      if (passwordInput) passwordInput.placeholder = "Inventa una contraseña";
      if (btn) btn.innerHTML = "Encriptar y Comenzar &rarr;";
    }
  }

  // Función para desvanecer la bóveda limpiamente
  function mostrarAppYOcultarBloqueo() {
    renderizar(); // Dibuja el panel o modal de bienvenida
    if (appShell) {
      appShell.style.setProperty("display", "flex", "important");
      setTimeout(() => appShell.classList.add("loaded"), 30);
    }
    if (lockScreen) {
      lockScreen.classList.add("lock-fade-out");
      setTimeout(() => {
        // SOLUCIÓN DEFINITIVA: Forzamos el "display: none" ganándole al CSS
        lockScreen.style.setProperty("display", "none", "important");
        lockScreen.classList.remove("lock-fade-out");
      }, 400); 
    }
  }

  // 2. Intentar auto-login silencioso
  if (!requiereCrearClave) {
    const tokenGuardado = localStorage.getItem("saldo-autologin-token");
    if (tokenGuardado) {
      const exitoAuto = await desbloquearAplicacion(tokenGuardado);
      if (exitoAuto) {
        mostrarAppYOcultarBloqueo();
        if (!/Android/i.test(navigator.userAgent)) {
          setTimeout(() => verificarActualizacion(false, false), 1200);
        }
        return; 
      } else {
        localStorage.removeItem("saldo-autologin-token");
      }
    }
  }

  // 3. Mostrar pantalla de bloqueo si requiere clave manual
  if (lockScreen) {
    lockScreen.style.zIndex = "99999"; // Nos aseguramos de que tape todo
    lockScreen.style.setProperty("display", "flex", "important");
  }

  if (lockForm) {
    lockForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const password = passwordInput.value;
      if (!password) return;

      lockError.hidden = true;
      if (btn) {
        btn.style.width = btn.offsetWidth + "px";
        btn.innerHTML = "Procesando...";
        btn.disabled = true;
      }

      try {
        const exito = await desbloquearAplicacion(password);

        if (exito) {
          if (autoLoginCheckbox && autoLoginCheckbox.checked) {
            localStorage.setItem("saldo-autologin-token", password);
          } else {
            localStorage.removeItem("saldo-autologin-token");
          }

          mostrarAppYOcultarBloqueo();

          if (!/Android/i.test(navigator.userAgent)) {
            setTimeout(() => verificarActualizacion(false, false), 1200);
          }
        } else {
          throw new Error("Clave incorrecta");
        }
      } catch (error) {
        lockError.hidden = false;
        if (btn) {
          btn.style.width = "100%";
          btn.innerHTML = requiereCrearClave ? "Encriptar y Comenzar &rarr;" : "Desbloquear &rarr;";
          btn.disabled = false;
        }
        passwordInput.focus();
        passwordInput.select();
      }
    });
    setTimeout(() => passwordInput.focus(), 100);
  }
});