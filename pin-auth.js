// pin-auth.js — Gate de acceso por PIN, compartido por dashboard/finanzas/gastos/notas.
// No contiene el PIN ni su hash: eso vive en Secret Manager, del lado del Cloud Function.
// Seguro de subir a un repo público de GitHub.

import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// TODO: reemplazar por la URL real después de `firebase deploy --only functions`.
// Se ve así: https://REGION-PROJECTID.cloudfunctions.net/solicitarAcceso
const CLOUD_FN_URL = 'https://solicitaracceso-cvu64e6glq-uc.a.run.app';

/**
 * Bloquea la carga de datos hasta validar el PIN contra el Cloud Function.
 * Devuelve el objeto `auth` una vez autenticado. Si el usuario cancela o
 * agota los intentos, reemplaza el body y nunca resuelve la promesa
 * (la página se queda bloqueada intencionalmente).
 */
export function autenticar(app) {
  const auth = getAuth(app);
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) { resolve(auth); return; }

      let intentos = 0;
      const MAX_INTENTOS = 3;

      while (intentos < MAX_INTENTOS) {
        const pin = prompt('PIN de acceso:');
        if (pin === null) {
          bloquear('Acceso cancelado.');
          return;
        }

        try {
          const resp = await fetch(CLOUD_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
          });

          if (resp.ok) {
            const { token } = await resp.json();
            await signInWithCustomToken(auth, token);
            resolve(auth);
            return;
          }
        } catch (e) {
          // Error de red o del servidor: cuenta como intento fallido, no expone detalles.
        }

        intentos++;
        if (intentos < MAX_INTENTOS) {
          alert(`PIN incorrecto (${MAX_INTENTOS - intentos} intento(s) restante(s))`);
        }
      }

      bloquear('Demasiados intentos fallidos. Recarga la página para volver a intentar.');
    });
  });
}

function bloquear(mensaje) {
  document.body.innerHTML = `<p style="padding:2rem;font-family:sans-serif;color:#888">${mensaje}</p>`;
}
