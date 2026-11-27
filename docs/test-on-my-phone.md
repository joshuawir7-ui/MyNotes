# Guía de Prueba en tu Teléfono (POCO X6 Pro)

Esta guía te permite probar cómo se ve y responde **MyNotes** en distintos tamaños de pantalla (360 dp y 320 dp) y tamaños de texto directamente en tu **POCO X6 Pro** (HyperOS / MIUI).

> [!CAUTION]
> **NO uses `<iframe>` de la app dentro de sí misma para probar tamaños.**
> Dos instancias abiertas al mismo tiempo compartirían el mismo `localStorage` / `IndexedDB` / almacenamiento nativo y podrían sobrescribir o corromper tus notas, tareas o estado de sincronización. Usa siempre las Opciones de desarrollador del teléfono o `npm run audit:layout` en PC.

---

## 1. Antes de empezar: anota tu valor original

1. Abre **Ajustes** en tu POCO X6 Pro.
2. Entra en **Ajustes adicionales → Opciones de desarrollador** (si no aparecen, ve a *Sobre el teléfono* y toca 7 veces en *Versión de MIUI / HyperOS*).
3. Baja hasta la sección **Dibujo** y busca **Ancho más pequeño** (*Smallest width*).
4. **Anota el número original** que aparece (normalmente en el POCO X6 Pro es alrededor de `392 dp` o `411 dp`). Lo necesitarás al terminar para dejar el teléfono exactamente como estaba.

*(Si en tu versión de sistema no aparece "Ancho más pequeño", usa **Ajustes → Pantalla → Tamaño de visualización / Tamaño de pantalla**).*

---

## 2. Cómo simular 360 dp y 320 dp

1. En **Ancho más pequeño** (*Smallest width*):
   - Cambia el valor a **`360`** y pulsa Aceptar para simular un teléfono compacto estándar.
   - Cambia el valor a **`320`** y pulsa Aceptar para simular una pantalla muy estrecha (prueba de estrés).
2. Abre **MyNotes** y revisa:
   - **Hoy (`/`)**: tarjetas de Nota Fijada, Eventos, Nota Reciente, Meta y Calendario; verifica que no haya cortes ni scroll horizontal.
   - **Metas (`/goals`)**: tarjetas, subtareas, barra de progreso y menú de tres puntos.
   - **Balance (`/balance`)**: tarjetas de historial, calculadora modal (incluyendo su historial) y notas de gastos.
   - **Tareas (`/tasks`)**, **Calendario (`/calendar`)** y **Notas (`/notes`)**: barra de navegación inferior (en gestos y 3 botones) y barra superior bajo la cámara.
   - **Ajustes → Tamaño de texto**: prueba **Estándar (100 %)**, **Personalizado (85 %, 100 %, 130 %)** y **Seguir el sistema**.
3. Gira el teléfono a **horizontal** en las pantallas principales y comprueba que nada quede tapado.

---

## 3. Cómo copiar el informe del HUD de diagnóstico

1. En **MyNotes → Ajustes**, activa **Modo Desarrollador** (*Developer Mode*).
2. Aparecerá el recuadro flotante **PERF HUD** en la esquina superior izquierda (puedes arrastrarlo).
3. Verifica la línea `texto:`, donde se muestra:
   - **Modo elegido** (`standard`, `system` o `custom`)
   - **textZoom aplicado** (ej. `100%`, `130%`)
   - **fontScale del sistema** (ej. `1.15x (tope 1.3x)`)
4. Pulsa el botón **Copiar informe** en el HUD (o compártelo si el portapapeles no responde) y pégalo para reportar cualquier problema.

---

## 4. Al terminar: restaura tu teléfono

1. Vuelve a **Ajustes adicionales → Opciones de desarrollador → Ancho más pequeño**.
2. Escribe el **valor original** que anotaste en el paso 1 y pulsa Aceptar.
3. Si activaste el Modo Desarrollador solo para probar, puedes desactivarlo en **Ajustes** de MyNotes.
