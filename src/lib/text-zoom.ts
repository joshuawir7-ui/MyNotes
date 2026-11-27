import { Capacitor, registerPlugin } from "@capacitor/core"

export type TextZoomMode = "standard" | "system" | "custom"

export const TEXT_ZOOM_STEPS = [85, 100, 115, 130, 140] as const
export type TextZoomStep = (typeof TEXT_ZOOM_STEPS)[number]

export const MAX_SYSTEM_FONT_SCALE = 1.3
export const TEXT_ZOOM_STORAGE_KEY = "mynotes_text_zoom_local_v1"

export interface TextZoomState {
    mode: TextZoomMode
    customPercent: number
    appliedZoom: number
    systemFontScale: number | null
    maxSystemScale: number
    platform: "android" | "web"
}

interface TextZoomPluginInterface {
    getState(): Promise<{
        mode: TextZoomMode
        customPercent: number
        appliedZoom: number
        systemFontScale: number
        maxSystemScale: number
    }>
    setMode(options: { mode: TextZoomMode; customPercent?: number }): Promise<{
        mode: TextZoomMode
        customPercent: number
        appliedZoom: number
        systemFontScale: number
        maxSystemScale: number
    }>
}

const TextZoomNative = Capacitor.isNativePlatform()
    ? registerPlugin<TextZoomPluginInterface>("TextZoom")
    : null

let currentSnapshot: TextZoomState = {
    mode: "standard",
    customPercent: 100,
    appliedZoom: 100,
    systemFontScale: null,
    maxSystemScale: MAX_SYSTEM_FONT_SCALE,
    platform: Capacitor.isNativePlatform() ? "android" : "web",
}

function normalizeMode(raw: unknown): TextZoomMode {
    if (raw === "system" || raw === "custom") return raw
    return "standard"
}

function normalizeCustomPercent(raw: unknown): number {
    const n = typeof raw === "number" ? raw : Number(raw)
    if (!Number.isFinite(n)) return 100
    const clamped = Math.max(85, Math.min(140, Math.round(n)))
    // Snap to nearest allowed step
    let best: number = 100
    let bestDist = Infinity
    for (const step of TEXT_ZOOM_STEPS) {
        const d = Math.abs(step - clamped)
        if (d < bestDist) {
            bestDist = d
            best = step
        }
    }
    return best
}

function readLocalPref(): { mode: TextZoomMode; customPercent: number } {
    if (typeof window === "undefined") {
        return { mode: "standard", customPercent: 100 }
    }
    try {
        const raw = window.localStorage.getItem(TEXT_ZOOM_STORAGE_KEY)
        if (!raw) return { mode: "standard", customPercent: 100 }
        const parsed = JSON.parse(raw)
        return {
            mode: normalizeMode(parsed?.mode),
            customPercent: normalizeCustomPercent(parsed?.customPercent),
        }
    } catch {
        return { mode: "standard", customPercent: 100 }
    }
}

function writeLocalPref(mode: TextZoomMode, customPercent: number) {
    if (typeof window === "undefined") return
    try {
        window.localStorage.setItem(
            TEXT_ZOOM_STORAGE_KEY,
            JSON.stringify({ mode, customPercent })
        )
    } catch {
        // Ignore storage quota errors
    }
}

function applyWebCssScale(percent: number) {
    if (typeof document === "undefined") return
    // On Android native, WebSettings.setTextZoom handles scaling natively; keep CSS --text-scale at 1 to avoid double-scaling.
    const scale = Capacitor.isNativePlatform() ? 1 : percent / 100
    document.documentElement.style.setProperty("--text-scale", String(scale))
}

function computeWebAppliedZoom(mode: TextZoomMode, customPercent: number): number {
    if (mode === "custom") return normalizeCustomPercent(customPercent)
    // Web browsers do not expose Android's Configuration.fontScale; standard & system both default to 100%.
    return 100
}

export function getTextZoomSnapshot(): TextZoomState {
    return currentSnapshot
}

export async function initTextZoom(): Promise<TextZoomState> {
    const local = readLocalPref()
    if (TextZoomNative) {
        try {
            const nativeState = await TextZoomNative.getState()
            const mode = normalizeMode(nativeState.mode)
            const customPercent = normalizeCustomPercent(nativeState.customPercent)
            writeLocalPref(mode, customPercent)
            applyWebCssScale(nativeState.appliedZoom)
            currentSnapshot = {
                mode,
                customPercent,
                appliedZoom: nativeState.appliedZoom,
                systemFontScale: nativeState.systemFontScale,
                maxSystemScale: nativeState.maxSystemScale ?? MAX_SYSTEM_FONT_SCALE,
                platform: "android",
            }
            return currentSnapshot
        } catch {
            // Fallback to local pref if native bridge call fails
        }
    }

    const appliedZoom = computeWebAppliedZoom(local.mode, local.customPercent)
    applyWebCssScale(appliedZoom)
    currentSnapshot = {
        mode: local.mode,
        customPercent: local.customPercent,
        appliedZoom,
        systemFontScale: null,
        maxSystemScale: MAX_SYSTEM_FONT_SCALE,
        platform: "web",
    }
    return currentSnapshot
}

export async function setTextZoomPreference(
    mode: TextZoomMode,
    customPercent?: number
): Promise<TextZoomState> {
    const normMode = normalizeMode(mode)
    const normCustom = normalizeCustomPercent(
        customPercent !== undefined ? customPercent : currentSnapshot.customPercent
    )

    writeLocalPref(normMode, normCustom)

    if (TextZoomNative) {
        try {
            const nativeState = await TextZoomNative.setMode({
                mode: normMode,
                customPercent: normCustom,
            })
            applyWebCssScale(nativeState.appliedZoom)
            currentSnapshot = {
                mode: normalizeMode(nativeState.mode),
                customPercent: normalizeCustomPercent(nativeState.customPercent),
                appliedZoom: nativeState.appliedZoom,
                systemFontScale: nativeState.systemFontScale,
                maxSystemScale: nativeState.maxSystemScale ?? MAX_SYSTEM_FONT_SCALE,
                platform: "android",
            }
            return currentSnapshot
        } catch {
            // Fallback below
        }
    }

    const appliedZoom = computeWebAppliedZoom(normMode, normCustom)
    applyWebCssScale(appliedZoom)
    currentSnapshot = {
        mode: normMode,
        customPercent: normCustom,
        appliedZoom,
        systemFontScale: null,
        maxSystemScale: MAX_SYSTEM_FONT_SCALE,
        platform: "web",
    }
    return currentSnapshot
}
