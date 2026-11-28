# Sesión de Google persistente en MyNotes Web — Guía de configuración

Esta guía explica los pasos manuales que debes realizar una sola vez en **Google Cloud Console** y en **Vercel** para que la sesión de Google en MyNotes Web dure meses (como en Android), sin ventanas emergentes (popups) ni cierres de sesión cada hora.

> **Importante:** **NO crees un nuevo Client ID de OAuth.** MyNotes usa el permiso `drive.file`, que asocia los archivos de respaldo al Client ID que los creó. Si cambiaras de Client ID, la web dejaría de ver el respaldo ya subido por tus dispositivos. Reutiliza el mismo cliente OAuth 2.0 de tipo *Aplicación web* que ya usa el proyecto.

---

## 1. Poner la pantalla de consentimiento OAuth en «En producción»

Si el proyecto de Google Cloud está en modo *Prueba (Testing)*, **Google hace caducar automáticamente todos los `refresh_token` a los 7 días** sin excepción.

1. Abre [Google Cloud Console — OAuth Consent Screen / Audience](https://console.cloud.google.com/apis/credentials/consent) en el proyecto de MyNotes.
2. En **Estado de publicación** (*Publishing status*), pulsa **Publicar aplicación** (*Publish App*) para pasar a **En producción** (*In production*).
3. Como la app pide el permiso sensible `drive.file`, Google puede mostrar un aviso de verificación para usuarios externos; para tu propia cuenta (o cuentas de uso personal) puedes continuar o mantener la publicación activa para que los `refresh_token` no expiren a los 7 días.
4. Verifica que en **Permisos (Scopes)** estén incluidos únicamente:
   - `https://www.googleapis.com/auth/drive.file`
   - `openid`
   - `email`
   - `profile`

---

## 2. Añadir los URI de redirección autorizados en el cliente OAuth Web

1. Ve a [Google Cloud Console — Credenciales](https://console.cloud.google.com/apis/credentials).
2. Haz clic sobre tu cliente actual en **ID de clientes OAuth 2.0** (tipo **Aplicación web**).
3. En **Orígenes de JavaScript autorizados**, conserva tu dominio de Vercel y `http://localhost:3000`.
4. En **URI de redirección autorizados** (*Authorized redirect URIs*), añade exactamente:
   - Producción (sustituye por tu dominio real en Vercel, sin barra final):
     ```text
     https://TU-DOMINIO.vercel.app/api/google/callback
     ```
   - Desarrollo local:
     ```text
     http://localhost:3000/api/google/callback
     ```
5. Pulsa **Guardar** y copia el **ID de cliente** y el **Secreto del cliente** (*Client secret*) para el siguiente paso (no los pegues nunca en el código ni en archivos con prefijo `NEXT_PUBLIC_`).

---

## 3. Crear las variables de entorno en Vercel

1. En tu proyecto de Vercel, abre **Settings → Environment Variables**.
2. Crea las siguientes **4 variables** para *Production* (y *Preview* / *Development* si las usas; si usas URLs de preview añade su origen a `ALLOWED_ORIGINS` y a Google Cloud):

| Nombre | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | El mismo ID de cliente OAuth Web actual (`...apps.googleusercontent.com`). |
| `GOOGLE_CLIENT_SECRET` | El secreto del cliente OAuth Web copiado de Google Cloud Console. |
| `SESSION_SECRET` | Cadena aleatoria de **al menos 32 caracteres** usada para cifrar las cookies (`AES-256-GCM`). Puedes generarla en tu terminal con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` o `openssl rand -base64 48`. |
| `ALLOWED_ORIGINS` | Lista separada por comas (sin espacios ni barra final) con los orígenes exactos permitidos, por ejemplo: `https://TU-DOMINIO.vercel.app,http://localhost:3000` |

> **Seguridad:** Ninguna de estas cuatro variables lleva `NEXT_PUBLIC_`. Nunca llegan al navegador; si falta cualquiera de ellas, los endpoints `/api/google/*` responden `500` sin exponer detalles.

Para probar en local, copia `.env.example` a `.env.local` (que está ignorado por git), rellena los 4 valores y arranca con `npm run dev:web`.

---

## 4. Redesplegar en Vercel y reconectar una vez por navegador

1. Tras guardar las variables de entorno en Vercel, haz un **Redeploy** del último despliegue en **Deployments → Redeploy** (Vercel define `VERCEL=1` automáticamente, por lo que `next.config.ts` compila la versión web con los endpoints `/api/google/*` en el mismo origen, mientras que `npm run build` local mantiene `output: "export"` intacto para el APK de Android).
2. En cada navegador donde uses MyNotes Web (PC, móvil o Edge en Xbox/TV):
   - Si tenías una sesión antigua, seguirá funcionando hasta que venza su hora actual y entonces mostrará **«Reconecta tu cuenta»** una sola vez (sin borrar tus notas ni datos locales).
   - Abre **Ajustes → Nube** y pulsa **Iniciar sesión con Google** (o **Re-conectar cuenta**).
   - El navegador navegará a Google en la misma pestaña (sin popups), concederá el acceso y volverá a MyNotes con la sesión guardada en una cookie `HttpOnly + Secure + SameSite=Lax` cifrada de 180 días renovables.

---

## 5. Cómo cerrar sesión, revocar acceso o solucionar problemas

- **Cerrar sesión desde MyNotes:** En **Ajustes → Nube**, pulsa el botón de cerrar sesión. Esto revoca el token en Google (`oauth2.googleapis.com/revoke`), borra la cookie `HttpOnly` del servidor y desconecta las demás pestañas abiertas, conservando tus notas locales.
- **Revocar acceso desde tu cuenta de Google:** Entra en [myaccount.google.com/permissions](https://myaccount.google.com/permissions), selecciona **MyNotes** y pulsa **Quitar acceso**. La próxima vez que MyNotes intente renovar el token recibirá `invalid_grant`, borrará la cookie y mostrará **«Reconecta tu cuenta»** sin perder ningún dato local.
- **Problemas habituales:**
  - *Error `redirect_uri_mismatch` en Google:* Comprueba que `https://TU-DOMINIO.vercel.app/api/google/callback` esté escrito exactamente igual en Google Cloud Console y que `https://TU-DOMINIO.vercel.app` figure en `ALLOWED_ORIGINS`.
  - *Error `origin_not_allowed` (400) o `server_error` (500):* Verifica que las 4 variables estén definidas en Vercel para el entorno activo, que `SESSION_SECRET` tenga ≥ 32 caracteres y que hayas hecho *Redeploy* tras guardarlas.
  - *La sesión vuelve a pedir reconexión cada 7 días:* Significa que la pantalla de consentimiento OAuth sigue en modo *Testing* en Google Cloud Console (ver paso 1).
  - *Sin conexión a internet temporal:* Los fallos de red o respuestas `503` **no** cierran tu sesión; MyNotes reintentará automáticamente al recuperar la conexión.
