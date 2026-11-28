import { Capacitor, registerPlugin } from "@capacitor/core"

export interface NativeSafeInsetsMetrics {
    sdkInt: number
    deviceModel?: string
    webViewVersion?: string
    density: number
    navMode: "3-button" | "2-button" | "gesture" | "unknown"
    windowHeightPx: number
    windowHeightDp: number
    webViewTopPx: number
    webViewHeightPx: number
    webViewBottomPx: number
    navBarBottomPx: number
    navBarBottomDp: number
    imeBottomPx: number
    imeBottomDp: number
    imeVisible: boolean
    navTopPx: number
    overlapPx: number
    overlapDp: number
    effectiveBottomDp: number
    overrideZero: boolean
}

interface SafeInsetsPluginInterface {
    getMetrics(): Promise<NativeSafeInsetsMetrics>
    syncNow(): Promise<NativeSafeInsetsMetrics>
    setOverrideZero(options: { enabled: boolean }): Promise<NativeSafeInsetsMetrics>
}

const SafeInsetsNative = Capacitor.isNativePlatform()
    ? registerPlugin<SafeInsetsPluginInterface>("SafeInsets")
    : null

export async function syncSafeInsets(): Promise<NativeSafeInsetsMetrics | null> {
    if (!SafeInsetsNative) return null
    try {
        return await SafeInsetsNative.syncNow()
    } catch {
        return null
    }
}

export async function getNativeSafeInsetsMetrics(): Promise<NativeSafeInsetsMetrics | null> {
    if (!SafeInsetsNative) return null
    try {
        return await SafeInsetsNative.getMetrics()
    } catch {
        return null
    }
}

export async function setNativeSafeInsetsOverrideZero(
    enabled: boolean
): Promise<NativeSafeInsetsMetrics | null> {
    if (!SafeInsetsNative) return null
    try {
        return await SafeInsetsNative.setOverrideZero({ enabled })
    } catch {
        return null
    }
}
