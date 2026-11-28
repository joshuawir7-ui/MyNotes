/**
 * Configuración centralizada de umbrales para el sistema de niveles de rendimiento.
 * NOTA: Todos los valores aquí definidos son VALORES INICIALES conservadores,
 * pendientes de calibración con los informes reales del HUD en POCO X6 Pro y Galaxy A13.
 */

/** Versión actual de la app para invalidar caché de estimación/probe tras actualizaciones. */
export const PERF_APP_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || "1.0.0";

/** Días antes de repetir la prueba corta de CPU y revisión silenciosa en modo Automático. */
export const PROBE_RETEST_DAYS = 14;
export const PROBE_RETEST_MS = PROBE_RETEST_DAYS * 24 * 60 * 60 * 1000;

/** Reglas de estimación estática (valores iniciales conservadores). */
export const STATIC_TIER_RULES = {
  /** RAM total por debajo de este umbral (GB) clasifica directamente como 'low'. */
  LOW_RAM_MAX_GB: 2.5,
  /** SDK_INT estrictamente menor a este valor (Android < 8.0) clasifica como 'low'. */
  LOW_MIN_SDK_INT: 26,
  /** RAM total mínima (~7 GB reales reportados en dispositivos de 8/12 GB) para optar a 'high'. */
  HIGH_RAM_MIN_GB: 6.8,
  /** SDK_INT mínimo (Android 12+) para optar a 'high' en móvil. */
  HIGH_MIN_SDK_INT: 31,
} as const;

/**
 * Familias de GPU modernas consideradas aptas para nivel 'high' (pistas, no verdades absolutas).
 * Cualquier GPU 'unknown' o fuera de esta lista nunca sube a 'high' por estimación estática.
 */
export const HIGH_GPU_PATTERNS: readonly RegExp[] = [
  // Qualcomm Adreno 640+, 7xx, 8xx
  /Adreno\s*\(TM\)\s*(?:6[4-9]\d|7\d\d|8\d\d)/i,
  // ARM Mali-G77, G78, G610, G615 (POCO X6 Pro), G710, G715, G720, G8xx, G9xx
  /Mali-G(?:77|78|610|615|710|715|720|8\d\d|9\d\d)/i,
  // ARM Immortalis
  /Immortalis/i,
  // Samsung Xclipse (AMD RDNA mobile)
  /Xclipse/i,
  // Apple Silicon / GPUs de escritorio
  /Apple\s*(?:M\d|GPU)/i,
  /(?:NVIDIA|GeForce|RTX|GTX|Radeon|AMD|Intel\(R\)\s*(?:Iris|Arc|UHD))/i,
];

/**
 * Valor inicial de referencia para la prueba corta de CPU (~100 ms en gama media/alta).
 * IMPORTANTE: Calibrar con el `probeMs` real que reporte el HUD del POCO X6 Pro.
 */
export const REFERENCE_CPU_MS = 35;

/** Factor CPU respecto a REFERENCE_CPU_MS (valores iniciales). */
export const CPU_FACTOR_CAP_MEDIUM = 2.2;
export const CPU_FACTOR_CAP_LOW = 3.8;

/** Carga determinista de la prueba corta de CPU. */
export const CPU_PROBE_ARITH_OPS = 3_000_000;
export const CPU_PROBE_SORT_LEN = 5_000;
export const CPU_PROBE_REPS = 3;

/** Muestreo de fotogramas en ventanas de interacción (valores iniciales). */
export const FRAME_SAMPLER_CONFIG = {
  /** Tamaño del búfer circular de deltas de frame (sin asignaciones por frame). */
  RING_BUFFER_SIZE: 512,
  /** Tiempo tras el último evento de scroll para cerrar la ventana (ms). */
  WINDOW_END_IDLE_MS: 150,
  /** Duración mínima de ventana válida (frames o ms). */
  MIN_WINDOW_FRAMES: 90,
  MIN_WINDOW_MS: 1500,
  /** Frame considerado lento (> 25 ms). */
  BAD_FRAME_MS: 25,
  /** p95 de ventana considerado malo (> 40 ms). */
  BAD_P95_MS: 40,
  /** p95 severo que dispara bajada de DOS niveles (> 100 ms). */
  SEVERE_P95_MS: 100,
  /** Proporción mínima de frames > BAD_FRAME_MS para marcar ventana como mala (8%). */
  BAD_FRAME_SHARE: 0.08,
  /** Ventanas malas dentro de las últimas WINDOW_HISTORY_SIZE para disparar bajada. */
  BAD_WINDOWS_TRIGGER: 3,
  WINDOW_HISTORY_SIZE: 5,
  /** Enfriamiento mínimo entre bajadas automáticas (minutos). */
  COOLDOWN_MIN: 10,
} as const;

/** Constantes de estado térmico de Android PowerManager (API 29+). */
export const THERMAL_STATUS_LIGHT = 1;
export const THERMAL_STATUS_SEVERE = 3;

/** Máximo de decisiones guardadas en el registro del HUD. */
export const MAX_DECISION_LOG = 20;

/** Claves de almacenamiento local del dispositivo (nunca entran en Zustand/Drive). */
export const PERF_PREFS_KEY = "mynotes_perf_tier_v1";
export const PERF_MIRROR_KEY = "mynotes_perf_tier_mirror_v1";
export const PERF_LEGACY_STORAGE_KEY = "notes-storage";
