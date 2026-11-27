# Estándar de Diseño Adaptable — MyNotes

Este documento define el contrato obligatorio de diseño adaptable para cualquier pantalla, modal, tarjeta o componente nuevo en **MyNotes**.

---

## 1. Escalado de texto (Web/PC vs Android)

- **Android nativo:** `TextZoomPlugin` aplica `WebSettings.setTextZoom(int)` de forma nativa antes de mostrar la interfaz (`MainActivity.onCreate` y `MainActivity.onResume`). La preferencia se guarda localmente en `SharedPreferences` (`mynotes_text_zoom_prefs`) y **no** se sincroniza con Google Drive ni entra en el JSON de respaldo.
  - `"standard"` (Estándar recomendado, default): `100%`.
  - `"system"` (Seguir el sistema): toma `Configuration.fontScale` con tope `MAX_SYSTEM_FONT_SCALE = 1.3` (`130%`).
  - `"custom"` (Personalizado): pasos discretos `85%`, `100%`, `115%`, `130%`, `140%`.
- **Web/PC:** Se aplica `html { font-size: calc(100% * var(--text-scale, 1)); }`:
  - **Qué cubre:** toda tipografía, padding, margen, gap y tamaño definido en unidades relativas `rem` (todas las clases estándar de Tailwind como `text-sm`, `text-base`, `p-4`, `gap-3`).
  - **Qué NO cubre en Web/PC:** valores arbitrarios fijos en píxeles (`text-[11px]`, `h-[150px]`, `w-[268px]`) ni iconos SVG con dimensiones fijas en `px`. En Android nativo, `WebSettings.setTextZoom` escala el texto independientemente de `px` o `rem`, por lo que los contenedores deben permitir crecer verticalmente (`min-h-*` en lugar de `h-*` rígido cuando contengan texto).

---

## 2. Lista de comprobación obligatoria (Contrato)

Antes de dar por terminado cualquier cambio de interfaz o componente nuevo, debe cumplir **todos** los puntos siguientes:

- [ ] **Anchos de referencia:** Se ve limpio, legible y funcional en **320 dp**, **360 dp** y **412 dp** de ancho.
- [ ] **Escalas de texto:** Funciona sin recortes de texto ni botones rotos al **100 %** y al **130 %** (y soporta 85 %, 115 % y 140 %).
- [ ] **Navegación del sistema:** No queda tapado ni choca con la barra inferior en **navegación por gestos** ni en **navegación de 3 botones** (respetando `--safe-area-inset-bottom` / `pb-safe`).
- [ ] **Orientación:** Funciona correctamente tanto en **vertical** como en **horizontal**.
- [ ] **Cero scroll horizontal:** `document.documentElement.scrollWidth <= window.innerWidth` en todas las rutas y estados (sin desbordamiento lateral).
- [ ] **Objetivos táctiles:** Todo botón, enlace o control interactivo principal tiene un área táctil mínima de **48 × 48 px** (o `min-h-[48px] min-w-[48px]` / padding táctil equivalente).
- [ ] **Márgenes y Safe Area:** Ningún elemento esencial (títulos, botones de cerrar/guardar, barras flotantes) queda pegado a los bordes de la pantalla ni oculto bajo el *notch* o cámara frontal (`--safe-area-inset-top`).

---

## 3. Auditoría automatizada local

Ejecuta después de compilar (`npm run build`):

```bash
npm run audit:layout
```

Esto genera capturas y el informe detallado en `audit-output/report.md` y `audit-output/report.json` para 320 dp, 360 dp y 412 dp en todas las escalas (85 %–140 %).
