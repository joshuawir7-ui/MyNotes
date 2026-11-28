import { FRAME_SAMPLER_CONFIG } from "./perf-tier.config";
import { recordFrameWindow } from "./perf-tier";

const ring = new Float32Array(FRAME_SAMPLER_CONFIG.RING_BUFFER_SIZE);
let ringLen = 0;
let ringHead = 0;

let activeSource: "scroll" | "animation" = "scroll";
let rafId = 0;
let windowStartMs = 0;
let lastFrameMs = 0;
let idleTimerId: number | null = null;
let animEndMs = 0;
let selfCostSumMs = 0;
let selfCostCount = 0;
let started = false;

function resetBuffer() {
  ringLen = 0;
  ringHead = 0;
  selfCostSumMs = 0;
  selfCostCount = 0;
}

function finalizeWindow() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (idleTimerId !== null) {
    clearTimeout(idleTimerId);
    idleTimerId = null;
  }

  const count = ringLen;
  const durationMs = performance.now() - windowStartMs;
  if (
    count >= FRAME_SAMPLER_CONFIG.MIN_WINDOW_FRAMES ||
    (count >= 12 && durationMs >= FRAME_SAMPLER_CONFIG.MIN_WINDOW_MS)
  ) {
    const copy = new Float32Array(count);
    const startIdx = ringLen < ring.length ? 0 : ringHead;
    let badCount = 0;
    for (let i = 0; i < count; i++) {
      const val = ring[(startIdx + i) % ring.length];
      copy[i] = val;
      if (val > FRAME_SAMPLER_CONFIG.BAD_FRAME_MS) badCount++;
    }
    copy.sort();
    const p95Idx = Math.min(count - 1, Math.floor(count * 0.95));
    const p95Ms = +copy[p95Idx].toFixed(1);
    const badShare = +(badCount / count).toFixed(3);
    const isBad =
      badShare >= FRAME_SAMPLER_CONFIG.BAD_FRAME_SHARE ||
      p95Ms > FRAME_SAMPLER_CONFIG.BAD_P95_MS;
    const samplerAvgCostMs =
      selfCostCount > 0 ? +(selfCostSumMs / selfCostCount).toFixed(4) : 0;

    recordFrameWindow({
      ts: Date.now(),
      source: activeSource,
      frames: count,
      durationMs: Math.round(durationMs),
      p95Ms,
      badShare,
      isBad,
      samplerAvgCostMs,
    });
  }
  resetBuffer();
}

function onFrame(now: number) {
  const t0 = performance.now();
  if (lastFrameMs > 0) {
    const dt = now - lastFrameMs;
    // Ignorar saltos de pestaña oculta (> 2000 ms)
    if (dt < 2000) {
      ring[ringHead] = dt;
      ringHead = (ringHead + 1) % ring.length;
      if (ringLen < ring.length) ringLen++;
    }
  }
  lastFrameMs = now;
  const t1 = performance.now();
  selfCostSumMs += t1 - t0;
  selfCostCount++;

  if (activeSource === "animation" && now >= animEndMs && idleTimerId === null) {
    finalizeWindow();
    return;
  }
  rafId = requestAnimationFrame(onFrame);
}

function ensureRunning(source: "scroll" | "animation") {
  activeSource = source;
  if (!rafId) {
    resetBuffer();
    windowStartMs = performance.now();
    lastFrameMs = windowStartMs;
    rafId = requestAnimationFrame(onFrame);
  }
}

function onScrollEvent() {
  ensureRunning("scroll");
  if (idleTimerId !== null) clearTimeout(idleTimerId);
  idleTimerId = window.setTimeout(() => {
    idleTimerId = null;
    if (performance.now() >= animEndMs) {
      finalizeWindow();
    }
  }, FRAME_SAMPLER_CONFIG.WINDOW_END_IDLE_MS);
}

/** Marca una ventana de animación (apertura/cierre de modal o cambio de ruta). */
export function markAnimationWindow(durationMs = 450) {
  if (typeof window === "undefined") return;
  const targetEnd = performance.now() + durationMs;
  if (targetEnd > animEndMs) animEndMs = targetEnd;
  ensureRunning("animation");
}

export function startFrameSampler(): () => void {
  if (typeof window === "undefined" || started) return () => {};
  started = true;
  window.addEventListener("scroll", onScrollEvent, { passive: true, capture: true });
  return () => {
    started = false;
    window.removeEventListener("scroll", onScrollEvent, true);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (idleTimerId !== null) {
      clearTimeout(idleTimerId);
      idleTimerId = null;
    }
  };
}
