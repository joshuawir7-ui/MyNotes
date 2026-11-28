# Detección de Gama Baja y Niveles de Rendimiento (Propuesta — Sin Activar)

> **Estado:** Documento de diseño para aprobación. **No está activado** en esta fase de medición.

---

## 1. Diagnóstico del detector actual

Actualmente MyNotes decide el modo ligero (`useGlassLite` y hooks similares) únicamente por heurísticas de especificaciones reportadas por el navegador:

- `src/components/ui/glass-surface.tsx`: `(navigator.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 4`
- `src/hooks/use-deferred-blur.ts`: `hardwareConcurrency <= 4 || deviceMemory <= 2`
- `src/components/layout/app-sidebar.tsx`: `deviceMemory <= 2 || hardwareConcurrency <= 4`
- `src/components/ui/reveal.tsx`: `(navigator.hardwareConcurrency || 4) <= 4`

### Por qué falla en el Samsung Galaxy A13
El Galaxy A13 (Exynos 850 / Helio G80) reporta **`hardwareConcurrency = 8`** y **3–4 GB de RAM** (o `deviceMemory` omitido → fallback `8`), por lo que **nunca cumple `<= 4` ni `<= 2`** y recibe exactamente los mismos efectos pesados (4 capas de `backdrop-filter` + `mask-image`, blurs de 18–28 px, sombras multicapa y animaciones spring) que un POCO X6 Pro.

---

## 2. Propuesta de detector basado en MEDICIÓN (sin activar)

### Fase A — Microbenchmark inicial (~80–100 ms, 1 vez tras arranque)
Se ejecuta en `requestIdleCallback` tras el primer render, **una sola vez por versión/dispositivo** (cacheado localmente en `localStorage`, fuera del store sincronizable):
- Sub-bucle aritmético determinista (~4M ops, objetivo `< 25 ms` en gama alta, `> 65 ms` en gama baja).
- Serialización/parseo rápido (~250 KB JSON).
- Clasificación inicial provisional: `high`, `mid` o `low`.

### Fase B — Muestreo pasivo de frame-time durante los primeros scrolls
Durante las primeras 2–3 sesiones de scroll real del usuario (sin polling continuo; solo mientras el contenedor se desplaza):
- Mide `p95` de duración de frame (`dt` entre `requestAnimationFrame` consecutivos).
- **Histéresis para evitar oscilaciones:**
  - **Degradar** (`high → mid` o `mid → low`): requiere **2 ventanas consecutivas** de scroll con `p95 > 33 ms` (o >3 frames `> 50 ms`).
  - **Promover** (`low → mid` o `mid → high`): requiere **3 ventanas consecutivas** con `p95 < 19 ms` y `0` frames `> 33 ms`.

### Elección manual (Local del dispositivo)
En Ajustes: selector **Auto (recomendado) / Alto / Medio / Bajo**, persistido solo localmente.

---

## 3. Matriz de niveles y efectos por nivel

| Característica | **Alto** | **Medio** | **Bajo** | **Auto** |
|---|---|---|---|---|
| **Barra inferior (`.nav-shell`)** | 4 capas `backdrop-filter` + `mask-image` | 2 capas (`bl2`, `bl4` con `blur <= 10px`) | Fondo sólido/translúcido sin `backdrop-filter` ni `mask-image` | Según medición |
| **Modales y hojas (`GlassSurface`)** | `backdrop-filter: blur(24px)` diferido | `blur(10px)` diferido | Sin `backdrop-filter` (`bg-white/95` / `bg-zinc-900/95`) | Según medición |
| **Sombras (`box-shadow`)** | Multicapa completa | 1 capa suave | 1 capa ligera o borde `1px` | Según medición |
| **Animaciones de entrada (`Reveal` / Framer)** | Springs completos + blur | Transición rápida `transform/opacity` (120 ms, sin blur) | Instantáneo o `opacity` simple (80 ms) | Según medición |
| **Animaciones infinitas en reposo** | Activas | Pausadas fuera de foco | Desactivadas (`float`, `pulse` decorativos) | Según medición |
| **Virtualización / diferido** | Estándar | `DeferredSection` agresivo | Render mínimo + sin filtros en tarjetas | Según medición |
