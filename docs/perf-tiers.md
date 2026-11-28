# Niveles de Rendimiento y Detección Automática (Implementado)

> **Estado:** Implementado en rama `feat/perf-tiers`. Todos los umbrales de `src/lib/perf-tier.config.ts` son **valores iniciales conservadores** pendientes de calibración real con el HUD del **POCO X6 Pro** y **Samsung Galaxy A13**.

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


---

## 4. Implementación Real y Verificación (Rama `feat/perf-tiers`)

### Arquitectura
- **Fuente única de verdad:** `src/lib/perf-tier.ts` + `src/lib/perf-tier.config.ts` (fuera de Zustand, Drive sync y backup).
- **Atributos en `<html>`:** `data-tier="high|medium|low"`, `data-fx-blur`, `data-fx-shadow`, `data-fx-motion`, `data-fx-bg` aplicados antes de hidratación por el script en `<head>` de `src/app/layout.tsx` desde el espejo de `localStorage` (`mynotes_perf_tier_mirror_v1`), reconciliado luego con `@capacitor/preferences` (`mynotes_perf_tier_v1`).
- **Perfil nativo Android:** `DeviceProfilePlugin.java` registrado en `MainActivity.java` (RAM total, `isLowRamDevice`, `SDK_INT`, `socModel`, `densityDpi`, `refreshRate`, `isPowerSaveMode`, `thermalStatus` y listeners nativos).
- **Muestreo pasivo:** `src/lib/frame-sampler.ts` (`Float32Array` circular sin asignaciones por frame) + prueba corta de CPU en `requestIdleCallback` (`REFERENCE_CPU_MS = 35` inicial).

### Resultados verificados en PC (Playwright + Chromium headless, `verify-tiers-visual.mjs`)

| Métrica | `high` (Alto) | `medium` (Medio) | `low` (Bajo) |
|---|---|---|---|
| **Pre-hidratación `<html data-tier>`** | `high` | `medium` | `low` |
| **Capas `backdrop-filter` en `.nav-glass`** | **4** | **2** | **1** (`blur(12px)`, sin máscara) |
| **Total elementos con `backdrop-filter` (Hoy)** | 5 | 3 | 2 |
| **Scroll 6x CPU PC (FPS / p95)** | 55.7 FPS / 16.9 ms | 37.6 FPS / 33.4 ms | 44.1 FPS / 16.8 ms |

> **Nota importante:** La auditoría de Playwright en PC limita CPU (6x), pero **no** reproduce el coste real de GPU móvil (compositor de `backdrop-filter` y máscaras en Mali-G52 del Galaxy A13). La calibración final requiere capturar el informe del HUD en POCO X6 Pro y Galaxy A13.
