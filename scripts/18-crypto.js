/**
 * ============================================================
 *  MOTOR CRIPTOGRÁFICO DE SALDO
 * ------------------------------------------------------------
 *  Utiliza Web Crypto API nativa para cifrar y descifrar el 
 *  estado de la aplicación usando AES-GCM 256-bit.
 * ============================================================
 */

const SaldoCrypto = {
  
  // 1. Convierte la contraseña del usuario en una Llave Criptográfica Fuerte
  _derivarLlave: async function(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  },

  // 2. Transforma el objeto de Saldo en un texto cifrado e ilegible
  cifrarEstado: async function(estadoJSON, password) {
    try {
      const enc = new TextEncoder();
      // Creamos "ruido" aleatorio para que dos cifrados iguales nunca den el mismo resultado
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
      
      const key = await this._derivarLlave(password, salt);
      const encodedData = enc.encode(JSON.stringify(estadoJSON));

      const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, key, encodedData
      );

      // Empaquetamos todo junto (Salt + IV + Texto Cifrado) en Base64 para poder guardarlo
      const encryptedBytes = new Uint8Array(encryptedContent);
      const paquete = new Uint8Array(salt.length + iv.length + encryptedBytes.length);
      paquete.set(salt, 0);
      paquete.set(iv, salt.length);
      paquete.set(encryptedBytes, salt.length + iv.length);

      return btoa(String.fromCharCode.apply(null, paquete)); // Retorna string en Base64
    } catch (e) {
      console.error("Error al cifrar:", e);
      return null;
    }
  },

  // 3. Intenta abrir el candado y devolver el JSON original
  descifrarEstado: async function(paqueteBase64, password) {
    try {
      // Desempaquetamos el Base64
      const binaryString = atob(paqueteBase64);
      const paquete = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        paquete[i] = binaryString.charCodeAt(i);
      }

      // Separamos las partes (16 bytes de Salt, 12 bytes de IV, el resto es el mensaje)
      const salt = paquete.slice(0, 16);
      const iv = paquete.slice(16, 28);
      const encryptedBytes = paquete.slice(28);

      const key = await this._derivarLlave(password, salt);

      const decryptedContent = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv }, key, encryptedBytes
      );

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decryptedContent));
    } catch (e) {
      // Si la contraseña es incorrecta, la API criptográfica arrojará un error aquí
      return null; 
    }
  }
};