import { useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import {
  CPU_FACTOR_CAP_LOW,
  CPU_FACTOR_CAP_MEDIUM,
  CPU_PROBE_ARITH_OPS,
  CPU_PROBE_REPS,
  CPU_PROBE_SORT_LEN,
  FRAME_SAMPLER_CONFIG,
  HIGH_GPU_PATTERNS,
  MAX_DECISION_LOG,
  PERF_APP_VERSION,
  PERF_LEGACY_STORAGE_KEY,
  PERF_MIRROR_KEY,
  PERF_PREFS_KEY,
  PROBE_RETEST_MS,
  REFERENCE_CPU_MS,
  STATIC_TIER_RULES,
  THERMAL_STATUS_LIGHT,
  THERMAL_STATUS_SEVERE,
} from "./perf-tier.config";

export type Tier = "high" | "medium" | "low";
export type TierMode = "auto" | "high" | "medium" | "low";

export interface EffectOverrides {
  glassBlur: "auto" | "on" | "off";
  shadows: "auto" | "full" | "simple";
  motion: "auto" | "full" | "reduced" | "minimal";
  decorativeBg: "auto" | "on" | "off";
}

export const DEFAULT_EFFECT_OVERRIDES: EffectOverrides = {
  glassBlur: "auto",
  shadows: "auto",
  motion: "auto",
  decorativeBg: "auto",
};

export interface DeviceProfile {
  sdkInt: number;
  model: string;
  manufacturer: string;
  hardware: string;
  socModel: string;
  socManufacturer: string;
  totalMemBytes: number;
  isLowRamDevice: boolean;
  availableProcessors: number;
  densityDpi: number;
  refreshRate: number;
  isPowerSaveMode: boolean;
  thermalStatus: number;
  isDesktopWeb?: boolean;
}

export interface WindowSample {
  ts: number;
  source: "scroll" | "animation";
  frames: number;
  durationMs: number;
  p95Ms: number;
  badShare: number;
  isBad: boolean;
  samplerAvgCostMs: number;
}

export interface PersistedPerfTierData {
  mode: TierMode;
  overrides: EffectOverrides;
  lastAutoTier: Tier;
  reason: string;
  decidedAt: number;
  appVersion: string;
  probe: { ms: number; at: number } | null;
}

export interface EffectiveVisualAttributes {
  tier: Tier;
  fxBlur: "on" | "off";
  fxShadow: "full" | "simple";
  fxMotion: "full" | "reduced" | "minimal";
  fxBg: "on" | "off";
}

export interface PerfTierState {
  mode: TierMode;
  effectiveTier: Tier;
  lastAutoTier: Tier;
  sessionOverrideTier: Tier | null;
  overrides: EffectOverrides;
  reason: string;
  staticEstimate: { tier: Tier; reasons: string[] } | null;
  gpuRenderer: string;
  unknownGpu: string | null;
  profile: DeviceProfile | null;
  probeMs: number | null;
  cpuFactor: number | null;
  windows: WindowSample[];
  powerSaveActive: boolean;
  thermalStatus: number;
  thermalCapped: boolean;
  prefersReducedMotion: boolean;
  autoDowngradedThisSession: boolean;
  lastDowngradeAt: number;
  decisionLog: string[];
  initialized: boolean;
}

interface DeviceProfilePluginInterface {
  getProfile(): Promise<DeviceProfile>;
  addListener(
    eventName: "powerSaveChanged" | "thermalStatusChanged",
    cb: (data: any) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const DeviceProfileNative =
  typeof window !== "undefined" && Capacitor.isNativePlatform()
    ? registerPlugin<DeviceProfilePluginInterface>("DeviceProfile")
    : null;

const TIER_RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 };
function minTier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}
function stepDownTier(t: Tier, steps = 1): Tier {
  if (steps >= 2) return "low";
  if (t === "high") return "medium";
  return "low";
}

function isHighGpu(gpu: string): boolean {
  if (!gpu || gpu === "unknown") return false;
  return HIGH_GPU_PATTERNS.some((re) => re.test(gpu));
}

/**
 * Función pura de estimación estática basada exclusivamente en perfil y GPU.
 */
export function estimateTier(
  profile: Partial<DeviceProfile> | null | undefined,
  gpu: string
): { tier: Tier; reasons: string[] } {
  const reasons: string[] = [];
  if (!profile) {
    return { tier: "medium", reasons: ["Sin perfil de dispositivo; usando nivel medio inicial"] };
  }

  if (profile.isDesktopWeb) {
    reasons.push("Navegador de escritorio detectado");
    return { tier: "high", reasons };
  }

  const totalGb = (profile.totalMemBytes || 0) / (1024 * 1024 * 1024);
  const sdkInt = profile.sdkInt || 0;

  if (profile.isLowRamDevice) {
    reasons.push("Android reporta isLowRamDevice=true");
    return { tier: "low", reasons };
  }
  if (totalGb > 0 && totalGb < STATIC_TIER_RULES.LOW_RAM_MAX_GB) {
    reasons.push(`RAM total baja (${totalGb.toFixed(1)} GB < ${STATIC_TIER_RULES.LOW_RAM_MAX_GB} GB)`);
    return { tier: "low", reasons };
  }
  if (sdkInt > 0 && sdkInt < STATIC_TIER_RULES.LOW_MIN_SDK_INT) {
    reasons.push(`Android antiguo (SDK ${sdkInt} < ${STATIC_TIER_RULES.LOW_MIN_SDK_INT})`);
    return { tier: "low", reasons };
  }

  const highGpu = isHighGpu(gpu);
  if (
    totalGb >= STATIC_TIER_RULES.HIGH_RAM_MIN_GB &&
    sdkInt >= STATIC_TIER_RULES.HIGH_MIN_SDK_INT &&
    highGpu
  ) {
    reasons.push(`RAM ${totalGb.toFixed(1)} GB, SDK ${sdkInt} y GPU moderna (${gpu})`);
    return { tier: "high", reasons };
  }

  if (totalGb > 0) reasons.push(`RAM ${totalGb.toFixed(1)} GB`);
  if (sdkInt > 0) reasons.push(`SDK ${sdkInt}`);
  reasons.push(highGpu ? `GPU ${gpu}` : `GPU no clasificada como gama alta (${gpu || "unknown"})`);
  return { tier: "medium", reasons };
}

/**
 * Evaluación pura de una secuencia de ventanas para el motor de decisión (también usada en tests).
 */
export function evaluateWindowDowngrade(params: {
  mode: TierMode;
  currentAutoTier: Tier;
  windows: WindowSample[];
  autoDowngradedThisSession: boolean;
  lastDowngradeAt: number;
  now: number;
}): {
  nextTier: Tier;
  downgraded: boolean;
  steps: 0 | 1 | 2;
  reason: string | null;
} {
  if (params.mode !== "auto") {
    return { nextTier: params.currentAutoTier, downgraded: false, steps: 0, reason: null };
  }
  if (params.currentAutoTier === "low") {
    return { nextTier: "low", downgraded: false, steps: 0, reason: null };
  }
  if (params.autoDowngradedThisSession) {
    return { nextTier: params.currentAutoTier, downgraded: false, steps: 0, reason: null };
  }
  const cooldownMs = FRAME_SAMPLER_CONFIG.COOLDOWN_MIN * 60_000;
  if (params.lastDowngradeAt > 0 && params.now - params.lastDowngradeAt < cooldownMs) {
    return { nextTier: params.currentAutoTier, downgraded: false, steps: 0, reason: null };
  }

  const recent = params.windows.slice(-FRAME_SAMPLER_CONFIG.WINDOW_HISTORY_SIZE);
  const badWindows = recent.filter((w) => w.isBad);
  if (badWindows.length < FRAME_SAMPLER_CONFIG.BAD_WINDOWS_TRIGGER) {
    return { nextTier: params.currentAutoTier, downgraded: false, steps: 0, reason: null };
  }

  const avgBadP95 =
    badWindows.reduce((acc, w) => acc + w.p95Ms, 0) / Math.max(1, badWindows.length);
  const steps: 1 | 2 = avgBadP95 > FRAME_SAMPLER_CONFIG.SEVERE_P95_MS ? 2 : 1;
  const nextTier = stepDownTier(params.currentAutoTier, steps);
  if (nextTier === params.currentAutoTier) {
    return { nextTier, downgraded: false, steps: 0, reason: null };
  }

  return {
    nextTier,
    downgraded: true,
    steps,
    reason: `Tu teléfono tarda ${Math.round(avgBadP95)} ms por fotograma al desplazarte`,
  };
}

/**
 * Calcula los atributos DOM efectivos a partir del estado del nivel, límites del sistema y overrides manuales.
 */
export function resolveEffectiveAttributes(state: PerfTierState): EffectiveVisualAttributes {
  let tier: Tier =
    state.sessionOverrideTier ??
    (state.mode === "auto" ? state.lastAutoTier : state.mode);

  if (!state.sessionOverrideTier) {
    if (state.powerSaveActive) {
      tier = minTier(tier, "medium");
    }
    if (state.thermalCapped) {
      tier = stepDownTier(tier, 1);
    }
  }

  // Overrides del apartado Avanzado solo aplican en modo manual
  const useOverrides = state.mode !== "auto";
  const ov = state.overrides;

  let fxBlur: "on" | "off" = tier === "low" ? "off" : "on";
  if (useOverrides && ov.glassBlur !== "auto") {
    fxBlur = ov.glassBlur;
  }

  let fxShadow: "full" | "simple" = tier === "high" ? "full" : "simple";
  if (useOverrides && ov.shadows !== "auto") {
    fxShadow = ov.shadows;
  }

  let fxMotion: "full" | "reduced" | "minimal" =
    tier === "high" ? "full" : tier === "medium" ? "reduced" : "minimal";
  if (useOverrides && ov.motion !== "auto") {
    fxMotion = ov.motion;
  }
  if (state.prefersReducedMotion) {
    fxMotion = "minimal";
  }

  let fxBg: "on" | "off" = tier === "low" ? "off" : "on";
  if (useOverrides && ov.decorativeBg !== "auto") {
    fxBg = ov.decorativeBg;
  }

  return { tier, fxBlur, fxShadow, fxMotion, fxBg };
}

// ── Almacén externo reactivo (useSyncExternalStore) ──────────────────────────
const listeners = new Set<() => void>();
let autoDowngradeToastHandler: ((msg: string) => void) | null = null;
let systemListenersRegistered = false;
let probeScheduled = false;

let state: PerfTierState = {
  mode: "auto",
  effectiveTier: "medium",
  lastAutoTier: "medium",
  sessionOverrideTier: null,
  overrides: { ...DEFAULT_EFFECT_OVERRIDES },
  reason: "Cargando perfil del dispositivo...",
  staticEstimate: null,
  gpuRenderer: "unknown",
  unknownGpu: null,
  profile: null,
  probeMs: null,
  cpuFactor: null,
  windows: [],
  powerSaveActive: false,
  thermalStatus: 0,
  thermalCapped: false,
  prefersReducedMotion: false,
  autoDowngradedThisSession: false,
  lastDowngradeAt: 0,
  decisionLog: [],
  initialized: false,
};

function pushLog(entry: string) {
  const stamp = new Date().toLocaleTimeString();
  state.decisionLog = [`${stamp} ${entry}`, ...state.decisionLog].slice(0, MAX_DECISION_LOG);
}

function applyAttributesToDom(attrs: EffectiveVisualAttributes) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-tier", attrs.tier);
  root.setAttribute("data-fx-blur", attrs.fxBlur);
  root.setAttribute("data-fx-shadow", attrs.fxShadow);
  root.setAttribute("data-fx-motion", attrs.fxMotion);
  root.setAttribute("data-fx-bg", attrs.fxBg);
}

function writeMirror(attrs: EffectiveVisualAttributes, persisted: PersistedPerfTierData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PERF_MIRROR_KEY,
      JSON.stringify({
        tier: attrs.tier,
        fxBlur: attrs.fxBlur,
        fxShadow: attrs.fxShadow,
        fxMotion: attrs.fxMotion,
        fxBg: attrs.fxBg,
        mode: persisted.mode,
        overrides: persisted.overrides,
      })
    );
  } catch {
    // ignore
  }
}

async function persistData(data: PersistedPerfTierData) {
  const attrs = resolveEffectiveAttributes(state);
  writeMirror(attrs, data);
  try {
    await Preferences.set({ key: PERF_PREFS_KEY, value: JSON.stringify(data) });
  } catch {
    // ignore on restricted web contexts
  }
}

function buildPersistedPayload(): PersistedPerfTierData {
  return {
    mode: state.mode,
    overrides: state.overrides,
    lastAutoTier: state.lastAutoTier,
    reason: state.reason,
    decidedAt: Date.now(),
    appVersion: PERF_APP_VERSION,
    probe: state.probeMs !== null ? { ms: state.probeMs, at: Date.now() } : null,
  };
}

function emit() {
  const attrs = resolveEffectiveAttributes(state);
  state = { ...state, effectiveTier: attrs.tier };
  applyAttributesToDom(attrs);
  for (const l of listeners) l();
}

export function subscribePerfTier(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPerfTierSnapshot(): PerfTierState {
  return state;
}

export function usePerfTier(): PerfTierState {
  return useSyncExternalStore(subscribePerfTier, getPerfTierSnapshot, getPerfTierSnapshot);
}

export function registerAutoDowngradeToastHandler(fn: (msg: string) => void) {
  autoDowngradeToastHandler = fn;
}

/** Lee el renderizador WebGL una única vez usando un canvas 1×1 y libera el contexto. */
export function readWebGlRendererOnce(): string {
  if (typeof document === "undefined") return "unknown";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "unknown";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "") : "";
    const lose = gl.getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return renderer.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

/** Ejecuta la prueba corta de CPU (~3M ops + sort 5000), mejor de 3 intentos. */
export function runCpuShortProbe(): { probeMs: number; cpuFactor: number } {
  let best = Infinity;
  for (let rep = 0; rep < CPU_PROBE_REPS; rep++) {
    const t0 = performance.now();
    let acc = 123456789;
    for (let i = 0; i < CPU_PROBE_ARITH_OPS; i++) {
      acc = (acc + (i ^ 0x9e3779b9)) | 0;
      acc = Math.imul(acc, 1664525) + 1013904223;
    }
    if (acc === 42) console.debug(acc);

    const arr = new Array<number>(CPU_PROBE_SORT_LEN);
    let seed = 987654321;
    for (let i = 0; i < arr.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      arr[i] = seed;
    }
    arr.sort((a, b) => a - b);
    const dur = performance.now() - t0;
    if (dur < best) best = dur;
  }
  const probeMs = +best.toFixed(1);
  const cpuFactor = +(probeMs / REFERENCE_CPU_MS).toFixed(2);
  return { probeMs, cpuFactor };
}

function readLegacyPerformanceMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(PERF_LEGACY_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.state?.performanceMode);
  } catch {
    return false;
  }
}

function detectDesktopWebProfile(): DeviceProfile {
  const nav = (typeof navigator !== "undefined" ? navigator : {}) as any;
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || "");
  return {
    sdkInt: 0,
    model: isMobileUa ? "Mobile Web" : "Desktop Web",
    manufacturer: "",
    hardware: "",
    socModel: "",
    socManufacturer: "",
    totalMemBytes: typeof nav.deviceMemory === "number" ? nav.deviceMemory * 1024 * 1024 * 1024 : 0,
    isLowRamDevice: false,
    availableProcessors: nav.hardwareConcurrency || 4,
    densityDpi: Math.round((window.devicePixelRatio || 1) * 160),
    refreshRate: 60,
    isPowerSaveMode: false,
    thermalStatus: 0,
    isDesktopWeb: !isMobileUa,
  };
}

export async function initPerfTier(): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Reduced motion media query
  const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const updateReducedMotion = () => {
    state.prefersReducedMotion = Boolean(mql?.matches);
    emit();
  };
  if (mql) {
    state.prefersReducedMotion = mql.matches;
    mql.addEventListener?.("change", updateReducedMotion);
  }

  // 2. Cargar Preferences (o migrar legacy performanceMode)
  let persisted: PersistedPerfTierData | null = null;
  try {
    const { value } = await Preferences.get({ key: PERF_PREFS_KEY });
    if (value) persisted = JSON.parse(value);
  } catch {
    // ignore
  }

  if (!persisted) {
    const legacyPerf = readLegacyPerformanceMode();
    persisted = {
      mode: legacyPerf ? "low" : "auto",
      overrides: { ...DEFAULT_EFFECT_OVERRIDES },
      lastAutoTier: legacyPerf ? "low" : "medium",
      reason: legacyPerf
        ? "Migrado desde Modo Rendimiento anterior"
        : "Primer arranque: estimando perfil...",
      decidedAt: Date.now(),
      appVersion: PERF_APP_VERSION,
      probe: null,
    };
    pushLog(legacyPerf ? "Migración legacy performanceMode -> manual Bajo" : "Primer arranque -> Automático");
  }

  state.mode = persisted.mode || "auto";
  state.overrides = { ...DEFAULT_EFFECT_OVERRIDES, ...(persisted.overrides || {}) };
  state.lastAutoTier = persisted.lastAutoTier || "medium";
  state.reason = persisted.reason || "Estimado por el dispositivo";
  state.probeMs = persisted.probe?.ms ?? null;
  state.cpuFactor = state.probeMs !== null ? +(state.probeMs / REFERENCE_CPU_MS).toFixed(2) : null;

  // 3. Leer GPU + Perfil nativo (o web)
  const gpu = readWebGlRendererOnce();
  state.gpuRenderer = gpu;
  state.unknownGpu = gpu === "unknown" || !isHighGpu(gpu) ? gpu : null;

  let profile: DeviceProfile;
  if (DeviceProfileNative) {
    try {
      profile = await DeviceProfileNative.getProfile();
    } catch {
      profile = detectDesktopWebProfile();
    }
  } else {
    profile = detectDesktopWebProfile();
  }
  state.profile = profile;
  state.powerSaveActive = Boolean(profile.isPowerSaveMode);
  state.thermalStatus = profile.thermalStatus || 0;
  state.thermalCapped = state.thermalStatus >= THERMAL_STATUS_SEVERE;

  const est = estimateTier(profile, gpu);
  state.staticEstimate = est;

  const needsRecalc =
    !persisted.probe ||
    persisted.appVersion !== PERF_APP_VERSION ||
    Date.now() - (persisted.probe?.at || 0) > PROBE_RETEST_MS;

  if (state.mode === "auto" && (needsRecalc || !persisted.decidedAt)) {
    state.lastAutoTier = est.tier;
    state.reason = est.reasons[0] || "Estimado por memoria y GPU";
    pushLog(`Estática -> ${est.tier} (${est.reasons.join("; ")})`);
  }

  state.initialized = true;
  emit();
  await persistData(buildPersistedPayload());

  // 4. Listeners nativos de ahorro de energía y estado térmico
  if (DeviceProfileNative && !systemListenersRegistered) {
    systemListenersRegistered = true;
    DeviceProfileNative.addListener("powerSaveChanged", (d) => {
      state.powerSaveActive = Boolean(d?.isPowerSaveMode);
      pushLog(`Ahorro de energía -> ${state.powerSaveActive ? "ON (tope medium)" : "OFF"}`);
      emit();
    }).catch(() => {});

    DeviceProfileNative.addListener("thermalStatusChanged", (d) => {
      const status = Number(d?.thermalStatus ?? 0);
      state.thermalStatus = status;
      if (status >= THERMAL_STATUS_SEVERE && !state.thermalCapped) {
        state.thermalCapped = true;
        pushLog(`Térmico severo (${status}) -> baja temporal`);
        emit();
      } else if (status <= THERMAL_STATUS_LIGHT && state.thermalCapped) {
        state.thermalCapped = false;
        pushLog(`Térmico normalizado (${status}) -> restaura nivel`);
        emit();
      }
    }).catch(() => {});
  }

  // 5. Programar prueba corta de CPU en reposo (solo si hace falta recalibrar)
  if (needsRecalc && !probeScheduled && state.mode === "auto") {
    scheduleIdleCpuProbe();
  }
}

function scheduleIdleCpuProbe() {
  if (typeof window === "undefined" || probeScheduled) return;
  probeScheduled = true;

  let cancelled = false;
  let idleId: number | null = null;
  let timerId: number | null = null;

  const cleanup = () => {
    document.removeEventListener("visibilitychange", onCancel);
    window.removeEventListener("pointerdown", onCancel);
    window.removeEventListener("keydown", onCancel);
  };

  const onCancel = () => {
    cancelled = true;
    if (idleId !== null && "cancelIdleCallback" in window) {
      (window as any).cancelIdleCallback(idleId);
    }
    if (timerId !== null) clearTimeout(timerId);
    cleanup();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) onCancel();
  }, { once: true });
  window.addEventListener("pointerdown", onCancel, { once: true, passive: true });
  window.addEventListener("keydown", onCancel, { once: true, passive: true });

  const run = () => {
    cleanup();
    if (cancelled || document.hidden) return;
    const { probeMs, cpuFactor } = runCpuShortProbe();
    state.probeMs = probeMs;
    state.cpuFactor = cpuFactor;

    let cpuCap: Tier = "high";
    if (cpuFactor >= CPU_FACTOR_CAP_LOW) cpuCap = "low";
    else if (cpuFactor >= CPU_FACTOR_CAP_MEDIUM) cpuCap = "medium";

    if (state.mode === "auto" && state.staticEstimate) {
      const combined = minTier(state.staticEstimate.tier, cpuCap);
      if (TIER_RANK[combined] < TIER_RANK[state.lastAutoTier]) {
        state.lastAutoTier = combined;
        state.reason = `CPU ${probeMs} ms (factor ${cpuFactor}x)`;
      }
      pushLog(`Probe CPU ${probeMs}ms (factor ${cpuFactor}x, cap=${cpuCap}) -> ${state.lastAutoTier}`);
    }
    emit();
    persistData(buildPersistedPayload()).catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    idleId = (window as any).requestIdleCallback(run, { timeout: 5000 });
  } else {
    timerId = (globalThis as unknown as Window).setTimeout(run, 1200);
  }
}

export async function setPerfTierMode(mode: TierMode, customReason?: string) {
  state.mode = mode;
  state.sessionOverrideTier = null;
  if (mode === "auto") {
    const est = state.staticEstimate || estimateTier(state.profile, state.gpuRenderer);
    state.lastAutoTier = est.tier;
    state.reason = customReason || est.reasons[0] || "Estimado por el dispositivo";
  } else {
    state.reason = customReason || `Elegido manualmente (${mode})`;
  }
  pushLog(`Modo -> ${mode} (${state.reason})`);
  emit();
  await persistData(buildPersistedPayload());
}

export async function setEffectOverrides(partial: Partial<EffectOverrides>) {
  state.overrides = { ...state.overrides, ...partial };
  pushLog(`Overrides -> ${JSON.stringify(state.overrides)}`);
  emit();
  await persistData(buildPersistedPayload());
}

export function setSessionOverrideTier(tier: Tier | null) {
  state.sessionOverrideTier = tier;
  pushLog(`Forzar sesión -> ${tier ?? "desactivado"}`);
  emit();
}

export function recordFrameWindow(sample: WindowSample) {
  state.windows = [...state.windows, sample].slice(-FRAME_SAMPLER_CONFIG.WINDOW_HISTORY_SIZE);
  const res = evaluateWindowDowngrade({
    mode: state.mode,
    currentAutoTier: state.lastAutoTier,
    windows: state.windows,
    autoDowngradedThisSession: state.autoDowngradedThisSession,
    lastDowngradeAt: state.lastDowngradeAt,
    now: sample.ts,
  });

  if (res.downgraded && res.reason) {
    state.lastAutoTier = res.nextTier;
    state.reason = res.reason;
    state.autoDowngradedThisSession = true;
    state.lastDowngradeAt = sample.ts;
    pushLog(`Bajada automática (${res.steps} nivel) -> ${res.nextTier}: ${res.reason}`);
    emit();
    persistData(buildPersistedPayload()).catch(() => {});
    autoDowngradeToastHandler?.(
      "Ajustamos los efectos para que vaya más fluido. Puedes cambiarlo en Ajustes > Efectos visuales."
    );
  } else {
    // Actualizar snapshot para HUD sin re-renderizar app innecesariamente (solo HUD si está suscrito)
    for (const l of listeners) l();
  }
}
