# Presupuestos de Rendimiento — MyNotes (Propuesta para Aprobación)

> **Estado:** Documento de referencia para aprobar antes de iniciar la fase de optimización.
> Las columnas **POCO X6 Pro** y **Galaxy A13** se completarán con las capturas/informes reales del botón **Benchmark** del HUD; la columna **PC 6x** refleja la medición en `audit/perf-report.md` (`npm run audit:perf`).

---

## Tabla de presupuestos objetivo vs. línea base

| Métrica / Escenario | POCO X6 Pro (Objetivo / Medido) | Galaxy A13 (Objetivo / Medido) | PC CPU 6x (Objetivo / **Medido**) |
|---|---|---|---|
| **Scroll en Hoy (`/`)** — Mediana FPS / p95 frame | ≥ 58 fps / ≤ 20 ms *(pendiente HUD)* | ≥ 45 fps / ≤ 28 ms *(pendiente HUD)* | ≥ 50 fps / ≤ 25 ms — **13.6 fps / 166.8 ms** |
| **Scroll en Notas (`/notes`)** — Mediana FPS / p95 frame | ≥ 58 fps / ≤ 20 ms *(pendiente HUD)* | ≥ 45 fps / ≤ 28 ms *(pendiente HUD)* | ≥ 50 fps / ≤ 25 ms — **7.8 fps / 933.3 ms** |
| **Scroll en Hábitos (`/tasks`)** — Mediana FPS / p95 frame | ≥ 58 fps / ≤ 20 ms *(pendiente HUD)* | ≥ 45 fps / ≤ 28 ms *(pendiente HUD)* | ≥ 50 fps / ≤ 25 ms — **10.5 fps / 250.0 ms** |
| **Scroll en Balance (`/balance`)** — Mediana FPS / p95 frame | ≥ 58 fps / ≤ 20 ms *(pendiente HUD)* | ≥ 45 fps / ≤ 28 ms *(pendiente HUD)* | ≥ 50 fps / ≤ 25 ms — **10.2 fps / 183.3 ms** |
| **Tareas largas en 10 s en reposo** | `0` (>50 ms) | `≤ 1` (>50 ms) | `≤ 2` (>50 ms) *(ver trazas `audit/`)* |
| **Abrir y cerrar modal (3 ciclos)** — Frames `> 50 ms` | `0` frames | `≤ 1` frame por ciclo | `≤ 1` frame/ciclo — **7 frames >50 ms** |
| **Latencia de toque** (marcar hábito / escribir en editor) | `≤ 30 ms` / `≤ 16 ms` por tecla | `≤ 60 ms` / `≤ 33 ms` por tecla | `≤ 50 ms` / `≤ 25 ms` por tecla |

---

## Notas de interpretación
1. **CPU vs. GPU:** En PC 6x se aísla el hilo principal de JavaScript (React, Zustand, serialización, layout). En el Galaxy A13 el cuello de botella combinado incluye **GPU móvil** (`backdrop-filter`, `mask-image`, `box-shadow` multicapa), por lo que debe evaluarse junto con `docs/gpu-inventory.md`.
2. **Criterio de aceptación tras optimizar:** ninguna ruta principal debe caer por debajo de **45 fps** ni superar **28 ms p95** en el Galaxy A13 al ejecutar el Benchmark del HUD.
