"use client"

/**
 * Retirado: la web ya no carga https://accounts.google.com/gsi/client ni usa popups GIS.
 * El inicio de sesión web usa redirección OAuth (/api/google/start) con cookie httpOnly en servidor.
 */
export function GoogleGsiLoader() {
    return null
}
