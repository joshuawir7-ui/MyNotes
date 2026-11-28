"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { Settings, Bell, X, Download, Upload, Zap, Cloud, LogOut, RefreshCw, Loader2, Sparkles, Type, Plus, Trash2, FolderPlus, Gauge, Code, ExternalLink, Smartphone, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, CircleHelp, Layers, Crosshair } from "lucide-react"
import { useStore, readAllNotesFromDisk, readAllTasksFromDisk, markCloudSyncDirty, readAutoBackup2DaysFromDisk, applyBackupDataToStore, AUTO_BACKUP_2DAYS_FILENAME } from "@/lib/store"
import { translations } from "@/lib/translations"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { LanguageToggle } from "@/components/ui/language-toggle"
import { Capacitor } from "@capacitor/core"
import { LocalNotifications } from "@capacitor/local-notifications"
import { NotificationDialog } from "@/components/ui/notification-dialog"
import { PriorityReminderSettings } from "@/components/ui/priority-reminder-settings"
import dynamic from "next/dynamic"
const PerfDebugModal = dynamic(() => import("@/components/ui/perf-debug-modal").then(m => m.PerfDebugModal), { ssr: false })
import { GlassSurface } from "@/components/ui/glass-surface"
import { useRouter } from "next/navigation"
import { timerEngine } from '@/lib/timer-engine'
import { useDeferredBlur } from "@/hooks/use-deferred-blur"
import { lt, pick } from "@/lib/i18n-inline"
import {
    initTextZoom,
    setTextZoomPreference,
    getTextZoomSnapshot,
    TEXT_ZOOM_STEPS,
    TextZoomMode,
    TextZoomState,
} from "@/lib/text-zoom"
import {
    usePerfTier,
    setPerfTierMode,
    setEffectOverrides,
    resolveEffectiveAttributes,
    runCpuShortProbe,
    DEFAULT_EFFECT_OVERRIDES,
    Tier,
    TierMode,
    EffectOverrides,
} from "@/lib/perf-tier"
import { CPU_FACTOR_CAP_LOW, CPU_FACTOR_CAP_MEDIUM } from "@/lib/perf-tier.config"
import { login as loginWebGoogle, logout as logoutWebGoogle, isWebReauthRequired } from "@/lib/web-auth"

function VisualEffectsSettingsSection({ language }: { language: string }) {
    const perf = usePerfTier()
    const attrs = resolveEffectiveAttributes(perf)
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const [confirmHighOpen, setConfirmHighOpen] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{
        fps: number
        p95: number
        cpuFactor: number
        probeMs: number
        recommended: Tier
    } | null>(null)

    const tierLabel = (tier: Tier) =>
        tier === "high"
            ? pick(language, { es: "Alto", en: "High", zh: "高" })
            : tier === "medium"
                ? pick(language, { es: "Medio", en: "Medium", zh: "中" })
                : pick(language, { es: "Bajo", en: "Low", zh: "低" })

    const handleSelectMode = (nextMode: TierMode) => {
        if (nextMode === "high" && perf.staticEstimate?.tier === "low" && perf.mode !== "high") {
            setConfirmHighOpen(true)
            return
        }
        setConfirmHighOpen(false)
        void setPerfTierMode(nextMode)
    }

    const handleRunPerfTest = async () => {
        if (testing) return
        setTesting(true)
        setTestResult(null)
        try {
            const { probeMs, cpuFactor } = runCpuShortProbe()
            const scrollEl =
                document.querySelector<HTMLElement>("[data-settings-scroll]") ||
                document.scrollingElement as HTMLElement | null

            const deltas: number[] = []
            let last = performance.now()
            const start = last
            let dir = 1
            const prevTop = scrollEl ? scrollEl.scrollTop : 0

            await new Promise<void>((resolve) => {
                const tick = (now: number) => {
                    deltas.push(now - last)
                    last = now
                    if (scrollEl) {
                        const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)
                        if (maxScroll > 10) {
                            scrollEl.scrollTop += dir * 6
                            if (scrollEl.scrollTop >= maxScroll - 2) dir = -1
                            else if (scrollEl.scrollTop <= 2) dir = 1
                        }
                    }
                    if (now - start >= 4000) {
                        resolve()
                        return
                    }
                    requestAnimationFrame(tick)
                }
                requestAnimationFrame(tick)
            })

            if (scrollEl) scrollEl.scrollTop = prevTop

            const sorted = deltas.slice(1).sort((a, b) => a - b)
            const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 16.7
            const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 16.7
            const fps = avg > 0 ? 1000 / avg : 60

            let recommended: Tier = "high"
            if (cpuFactor >= CPU_FACTOR_CAP_LOW || p95 >= 33) recommended = "low"
            else if (cpuFactor >= CPU_FACTOR_CAP_MEDIUM || p95 >= 22) recommended = "medium"

            setTestResult({ fps, p95, cpuFactor, probeMs, recommended })
        } finally {
            setTesting(false)
        }
    }

    const hasCustomOverrides =
        perf.overrides.glassBlur !== "auto" ||
        perf.overrides.shadows !== "auto" ||
        perf.overrides.motion !== "auto" ||
        perf.overrides.decorativeBg !== "auto"

    return (
        <div className="p-4 glass-card rounded-2xl space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="text-foreground shrink-0">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm">
                            {pick(language, { es: "Efectos visuales", en: "Visual effects", zh: "视觉效果" })}
                        </span>
                        <span className="text-xs text-muted-foreground leading-snug">
                            {pick(language, {
                                es: `Actual: ${tierLabel(perf.effectiveTier)} — ${perf.reason}`,
                                en: `Current: ${tierLabel(perf.effectiveTier)} — ${perf.reason}`,
                                zh: `当前：${tierLabel(perf.effectiveTier)} — ${perf.reason}`,
                            })}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
                {([
                    { id: "auto", label: pick(language, { es: "Auto", en: "Auto", zh: "自动" }) },
                    { id: "high", label: tierLabel("high") },
                    { id: "medium", label: tierLabel("medium") },
                    { id: "low", label: tierLabel("low") },
                ] as { id: TierMode; label: string }[]).map((opt) => {
                    const active = perf.mode === opt.id
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectMode(opt.id)}
                            className={`px-2 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                                active
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                            }`}
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>

            {confirmHighOpen && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs space-y-2">
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                        {pick(language, {
                            es: "Este dispositivo parece limitado para el nivel Alto y podría tener tirones. ¿Seguro que quieres activarlo?",
                            en: "This device looks limited for High effects and may stutter. Continue anyway?",
                            zh: "此设备启用高效果可能会卡顿，确定要继续吗？",
                        })}
                    </p>
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => setConfirmHighOpen(false)}
                            className="px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/10 font-medium cursor-pointer"
                        >
                            {pick(language, { es: "Cancelar", en: "Cancel", zh: "取消" })}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setConfirmHighOpen(false)
                                void setPerfTierMode("high", "elección manual (confirmada)")
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-semibold cursor-pointer"
                        >
                            {pick(language, { es: "Usar Alto", en: "Use High", zh: "使用高" })}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                    type="button"
                    onClick={handleRunPerfTest}
                    disabled={testing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 disabled:opacity-60 cursor-pointer"
                >
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
                    <span>
                        {testing
                            ? pick(language, { es: "No toques la pantalla...", en: "Do not touch screen...", zh: "请勿触碰屏幕..." })
                            : pick(language, { es: "Probar rendimiento", en: "Test performance", zh: "测试性能" })}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                    <span>{pick(language, { es: "Avanzado", en: "Advanced", zh: "高级" })}</span>
                    {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
            </div>

            {testResult && (
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-xs flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                        <div className="font-semibold">
                            {pick(language, {
                                es: `Recomendado: ${tierLabel(testResult.recommended)}`,
                                en: `Recommended: ${tierLabel(testResult.recommended)}`,
                                zh: `推荐：${tierLabel(testResult.recommended)}`,
                            })}
                        </div>
                        <div className="text-muted-foreground">
                            {`${testResult.fps.toFixed(0)} FPS · p95 ${testResult.p95.toFixed(1)}ms · CPU ${testResult.cpuFactor.toFixed(2)}x`}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void setPerfTierMode(testResult.recommended, "prueba manual")}
                        className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-semibold shrink-0 cursor-pointer"
                    >
                        {pick(language, { es: "Aplicar", en: "Apply", zh: "应用" })}
                    </button>
                </div>
            )}

            {advancedOpen && (
                <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                            {pick(language, {
                                es: `Efectivo: blur=${attrs.fxBlur}, sombras=${attrs.fxShadow}, anim=${attrs.fxMotion}, bg=${attrs.fxBg}`,
                                en: `Effective: blur=${attrs.fxBlur}, shadows=${attrs.fxShadow}, motion=${attrs.fxMotion}, bg=${attrs.fxBg}`,
                                zh: `当前：blur=${attrs.fxBlur}, shadows=${attrs.fxShadow}, motion=${attrs.fxMotion}, bg=${attrs.fxBg}`,
                            })}
                        </span>
                        {hasCustomOverrides && (
                            <button
                                type="button"
                                onClick={() => void setEffectOverrides(DEFAULT_EFFECT_OVERRIDES)}
                                className="text-primary font-semibold cursor-pointer"
                            >
                                {pick(language, { es: "Restablecer", en: "Reset", zh: "重置" })}
                            </button>
                        )}
                    </div>

                    {([
                        {
                            key: "glassBlur" as const,
                            label: pick(language, { es: "Desenfoque vidrio", en: "Glass blur", zh: "玻璃模糊" }),
                            options: ["auto", "on", "off"],
                        },
                        {
                            key: "shadows" as const,
                            label: pick(language, { es: "Sombras", en: "Shadows", zh: "阴影" }),
                            options: ["auto", "full", "simple"],
                        },
                        {
                            key: "motion" as const,
                            label: pick(language, { es: "Animaciones", en: "Animations", zh: "动画" }),
                            options: ["auto", "full", "reduced", "minimal"],
                        },
                        {
                            key: "decorativeBg" as const,
                            label: pick(language, { es: "Fondos decorativos", en: "Decorative bg", zh: "装饰背景" }),
                            options: ["auto", "on", "off"],
                        },
                    ] as const).map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-2">
                            <span className="font-medium">{row.label}</span>
                            <div className="flex gap-1">
                                {row.options.map((opt) => {
                                    const active = perf.overrides[row.key] === opt
                                    return (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => void setEffectOverrides({ [row.key]: opt } as Partial<EffectOverrides>)}
                                            className={`px-2 py-1 rounded-lg capitalize cursor-pointer ${
                                                active
                                                    ? "bg-primary text-primary-foreground font-semibold"
                                                    : "bg-black/5 dark:bg-white/5"
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function SettingsCloudSyncControls({
    googleUser,
    localSyncing,
    localRestoring,
    isRecovering,
    recoveryMessage,
    handleCloudSync,
    handleCloudRestore,
    handleRecoverImages,
    language,
    t,
}: {
    googleUser: any
    localSyncing: boolean
    localRestoring: boolean
    isRecovering: boolean
    recoveryMessage: string | null
    handleCloudSync: () => void
    handleCloudRestore: () => void
    handleRecoverImages: () => void
    language: string
    t: any
}) {
    const isSyncingCloud = useStore(state => state.isSyncingCloud)
    const restoreProgress = useStore(state => state.restoreProgress)
    const cloudRestoreProgress = useStore(state => state.cloudRestoreProgress)
    const syncError = useStore(state => state.syncError)

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <motion.button
                    onClick={handleCloudSync}
                    disabled={isSyncingCloud || localSyncing || localRestoring}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black disabled:opacity-50 rounded-xl font-bold transition-all text-xs shadow-lg shadow-black/20 dark:shadow-white/10"
                >
                    <motion.div
                        animate={localSyncing ? { rotate: 360 } : { rotate: 0 }}
                        transition={localSyncing ? { duration: 1, ease: "linear", repeat: Infinity } : undefined}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </motion.div>
                    {t.syncNow || "Sync now"}
                </motion.button>
                <motion.button
                    onClick={handleCloudRestore}
                    disabled={isSyncingCloud || localSyncing || localRestoring || !!cloudRestoreProgress}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-foreground rounded-xl font-bold transition-all text-xs"
                >
                    <motion.div
                        animate={localRestoring || !!cloudRestoreProgress ? { rotate: 360 } : undefined}
                        transition={localRestoring || !!cloudRestoreProgress ? { duration: 1, ease: "linear", repeat: Infinity } : undefined}
                    >
                        {localRestoring || cloudRestoreProgress ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Cloud className="w-3.5 h-3.5" />
                        )}
                    </motion.div>
                    {cloudRestoreProgress && cloudRestoreProgress.total > 0
                        ? `Videos: ${cloudRestoreProgress.done}/${cloudRestoreProgress.total}`
                        : (restoreProgress || t.restoreFromCloud || "Restore")
                    }
                </motion.button>
            </div>

            {syncError && (
                <p className="text-[10px] text-red-500 text-center leading-tight px-1">{syncError}</p>
            )}

            {/* Recover images from Drive revision history */}
            <motion.button
                onClick={handleRecoverImages}
                disabled={isRecovering || isSyncingCloud || !googleUser}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 p-3 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-amber-600 dark:text-amber-400 rounded-xl font-bold transition-all text-xs mt-1"
            >
                {isRecovering ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                )}
                {pick(language, {
                    es: isRecovering ? 'Buscando en historial...' : 'Recuperar imágenes de Drive',
                    en: isRecovering ? 'Scanning history...' : 'Recover images from Drive',
                    zh: isRecovering ? '正在扫描历史记录...' : '从云端硬盘恢复图片'
                })}
            </motion.button>
            {recoveryMessage && (
                <p className="text-[10px] text-muted-foreground text-center mt-1 leading-tight px-1">
                    {recoveryMessage}
                </p>
            )}
        </div>
    )
}

export function SettingsDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const [isPerfDebugOpen, setIsPerfDebugOpen] = useState(false)
    const [versionClickCount, setVersionClickCount] = useState(0)
    const [bubbleSettings, setBubbleSettings] = useState<{ mode: 'always' | 'outside' | 'never'; hasPermission: boolean; isSupported: boolean }>({
        mode: 'outside',
        hasPermission: false,
        isSupported: false
    })
    const [showXiaomiGuide, setShowXiaomiGuide] = useState(false)

    useEffect(() => {
        if (isOpen) {
            timerEngine.getBubbleSettings().then(setBubbleSettings).catch(console.error)
        }
    }, [isOpen])

    const handleSetBubbleMode = async (mode: 'always' | 'outside' | 'never') => {
        await timerEngine.setBubbleMode(mode)
        const updated = await timerEngine.getBubbleSettings()
        setBubbleSettings(updated)
    }

    const handleRequestOverlay = async () => {
        await timerEngine.requestOverlayPermission()
        setTimeout(async () => {
            const updated = await timerEngine.getBubbleSettings()
            setBubbleSettings(updated)
        }, 1500)
    }
    const handleVersionClick = () => {
        setVersionClickCount(prev => {
            const next = prev + 1;
            if (next === 5 && !developerMode && setDeveloperMode) {
                setDeveloperMode(true);
                showToast(
                    lt(language, "Modo desarrollador activado (HUD visible)", "Developer mode enabled (HUD visible)"),
                    "success"
                );
            }
            if (next >= 7) {
                setIsPerfDebugOpen(true);
                return 0;
            }
            return next;
        });
    };
    const [mounted, setMounted] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const fontInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const language = useStore(state => state.language)
    const setLanguage = useStore(state => state.setLanguage)
    const appColor = useStore(state => state.appColor ?? 'black')
    const setAppColor = useStore(state => state.setAppColor)
    const noteFontFamily = useStore(state => state.noteFontFamily ?? 'default')
    const customFonts = useStore(state => state.customFonts || [])
    const setNoteFontFamily = useStore(state => state.setNoteFontFamily)
    const addCustomFont = useStore(state => state.addCustomFont)
    const removeCustomFont = useStore(state => state.removeCustomFont)
    const notificationsEnabled = useStore(state => state.notificationsEnabled)
    const setNotificationsEnabled = useStore(state => state.setNotificationsEnabled)
    const philosophicalQuotesEnabled = useStore(state => state.philosophicalQuotesEnabled ?? true)
    const setPhilosophicalQuotesEnabled = useStore(state => state.setPhilosophicalQuotesEnabled)
    const [osNotifPermission, setOsNotifPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
    const [textZoomState, setTextZoomState] = useState<TextZoomState>(() => getTextZoomSnapshot())

    const handleTextZoomModeChange = async (mode: TextZoomMode, customPercent?: number) => {
        const next = await setTextZoomPreference(mode, customPercent)
        setTextZoomState(next)
    }

    const refreshOsNotifPermission = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                const res = await LocalNotifications.checkPermissions()
                setOsNotifPermission((res.display as any) || 'prompt')
            } else if (typeof window !== 'undefined' && 'Notification' in window) {
                setOsNotifPermission(Notification.permission === 'default' ? 'prompt' : Notification.permission)
            }
        } catch {
            setOsNotifPermission('unknown')
        }
    }

    useEffect(() => {
        if (isOpen) {
            refreshOsNotifPermission()
            initTextZoom().then(setTextZoomState).catch(() => {})
        }
    }, [isOpen])
    const focusEffectEnabled = useStore(state => state.focusEffectEnabled)
    const setFocusEffectEnabled = useStore(state => state.setFocusEffectEnabled)
    const performanceMode = useStore(state => state.performanceMode ?? false)
    const setPerformanceMode = useStore(state => state.setPerformanceMode)
    const developerMode = useStore(state => state.developerMode ?? false)
    const setDeveloperMode = useStore(state => state.setDeveloperMode)
    const googleUser = useStore(state => state.googleUser)
    const setGoogleUser = useStore(state => state.setGoogleUser)
    const googleSessionExpired = useStore(state => state.googleSessionExpired)
    const lastCloudSync = useStore(state => state.lastCloudSync)
    const syncWithGoogleDrive = useStore(state => state.syncWithGoogleDrive)
    const syncCycle = useStore(state => state.syncCycle)
    const restoreFromGoogleDrive = useStore(state => state.restoreFromGoogleDrive)
    const showToast = useStore(state => state.showToast)
    const startTourManually = useStore(state => state.startTourManually)
    const t = translations[language] as any

    const [notifState, setNotifState] = useState<{
        isOpen: boolean
        title: string
        message: string
        type: "success" | "error" | "warning" | "info"
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info"
    })

    const [localSyncing, setLocalSyncing] = useState(false)
    const [localRestoring, setLocalRestoring] = useState(false)
    const [isRecovering, setIsRecovering] = useState(false)
    const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
    const [isSmartImportModalOpen, setIsSmartImportModalOpen] = useState(false)
    const smartImportBlur = useDeferredBlur(isSmartImportModalOpen)

    // Micro-animation triggers
    const [bellAnimate, setBellAnimate] = useState(false)
    const [zapAnimate, setZapAnimate] = useState(false)
    const [exportAnimate, setExportAnimate] = useState(false)
    const [importAnimate, setImportAnimate] = useState(false)
    const [smartImportAnimate, setSmartImportAnimate] = useState(false)
    const [downloadBackupAnimate, setDownloadBackupAnimate] = useState(false)

    // Framer Motion icon micro-animations
    const bellVariants: Variants = {
        normal: { rotate: 0, scale: 1 },
        hover: { 
            rotate: [0, -15, 15, -12, 12, -8, 8, -4, 4, 0],
            scale: 1.15,
            transition: { duration: 0.65, ease: "easeInOut" } 
        },
        active: {
            scale: [1, 1.25, 0.9, 1.1, 1],
            rotate: [0, -25, 25, -15, 15, 0],
            transition: { duration: 0.6, ease: "easeInOut" }
        },
        inactive: {
            scale: [1, 0.85, 1],
            rotate: [0, 10, -10, 0],
            transition: { duration: 0.4, ease: "easeInOut" }
        }
    }

    const zapVariants: Variants = {
        normal: { scale: 1, rotate: 0, y: 0 },
        hover: { 
            scale: 1.25,
            rotate: [0, -15, 20, -15, 10, -5, 0],
            y: -3,
            transition: { duration: 0.55, ease: "easeInOut" } 
        },
        active: {
            scale: [1, 1.35, 0.85, 1.15, 1],
            rotate: [0, 20, -20, 0],
            transition: { duration: 0.55, ease: "easeInOut" }
        },
        inactive: {
            scale: [1, 0.85, 1],
            rotate: [0, -10, 10, 0],
            transition: { duration: 0.4, ease: "easeInOut" }
        }
    }

    const exportVariants: Variants = {
        normal: { y: 0, scaleY: 1 },
        hover: { 
            y: [0, 3, -1, 1, 0],
            scaleY: [1, 0.9, 1.05, 0.98, 1],
            transition: { duration: 0.5 } 
        },
        tap: { scale: 0.9, y: 3 }
    }

    const importVariants: Variants = {
        normal: { y: 0, scaleY: 1 },
        hover: { 
            y: [0, -3, 1, -1, 0],
            scaleY: [1, 0.9, 1.05, 0.98, 1],
            transition: { duration: 0.5 } 
        },
        tap: { scale: 0.9, y: -3 }
    }

    const smartImportVariants: Variants = {
        normal: { rotate: 0, scale: 1 },
        hover: { 
            rotate: 180, 
            scale: 1.15,
            transition: { type: "spring", stiffness: 200, damping: 12 }
        },
        tap: { rotate: -90, scale: 0.85 }
    }

    const downloadBackupVariants: Variants = {
        normal: { y: 0, scaleY: 1 },
        hover: { 
            y: [0, 2, -1, 1, 0],
            scaleY: [1, 0.95, 1.02, 0.99, 1],
            transition: { duration: 0.4 } 
        },
        tap: { scale: 0.95, y: 2 }
    }

    const showNotif = (title: string, message: string, type: "success" | "error" | "warning" | "info") => {
        setNotifState({
            isOpen: true,
            title,
            message,
            type
        })
    }

    useEffect(() => {
        if (isOpen) {
            useStore.setState({ isSyncingCloud: false });
        }
    }, [isOpen])

    // Listen for the event fired by CloudPrompt when the user taps "Sign in" / "Reconnect"
    useEffect(() => {
        const handleOpenCloud = () => {
            setIsOpen(true);
            // Short delay so the dialog renders before we call the sign-in flow
            setTimeout(() => {
                handleGoogleLogin();
            }, 400);
        };
        window.addEventListener("mynotes:open-settings-cloud", handleOpenCloud);
        return () => window.removeEventListener("mynotes:open-settings-cloud", handleOpenCloud);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setMounted(true)
        // Force reset syncing state on mount to prevent stuck greyed-out buttons
        useStore.setState({ isSyncingCloud: false });

        // Only initialize capacitor-google-auth on native platforms
        // On web we use Google Identity Services (GSI) directly
        if (Capacitor.isNativePlatform()) {
            import('@codetrix-studio/capacitor-google-auth').then(({ GoogleAuth }) => {
                if (typeof window !== 'undefined') {
                    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '309899943436-gp6o1oaqpij5qq6sal77f6dr15lh61fp.apps.googleusercontent.com';
                    GoogleAuth.initialize({
                        clientId,
                        scopes: [
                            'https://www.googleapis.com/auth/userinfo.profile',
                            'https://www.googleapis.com/auth/userinfo.email',
                            'https://www.googleapis.com/auth/drive.file'
                        ],
                        grantOfflineAccess: true
                    });
                }
            });
        }
    }, [])

    // ──────────────────────────────────────────────────────
    // WEB LOGIN: redirección a /api/google/start (código + PKCE + cookie httpOnly en servidor, sin popup)
    // ──────────────────────────────────────────────────────
    const handleGoogleLoginWeb = async (): Promise<void> => {
        const reconnect = Boolean(googleSessionExpired || isWebReauthRequired() || !googleUser);
        loginWebGoogle({ reconnect });
    };

    // ──────────────────────────────────────────────────────
    // MOBILE LOGIN: uses capacitor-google-auth (native SDK)
    // ──────────────────────────────────────────────────────
    const handleGoogleLoginNative = async () => {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        // Sign out first to always show the account chooser
        await GoogleAuth.signOut().catch(() => { });
        console.log("Calling GoogleAuth.signIn (native)");
        const result = await GoogleAuth.signIn();
        if (result) {
            const accessToken = ((result as any).authentication?.accessToken || (result as any).accessToken) || undefined;
            setGoogleUser({
                name: (result as any).name || (result as any).displayName || '',
                email: result.email || '',
                imageUrl: result.imageUrl || '',
                accessToken,
                isDemo: false
            });
            if (result.serverAuthCode) {
                try {
                    const { registerPlugin } = await import('@capacitor/core');
                    const CloudAuth = registerPlugin('CloudAuth');
                    await (CloudAuth as any).exchangeAndSaveTokens({ authCode: result.serverAuthCode });
                    console.log("Tokens exchanged and saved securely via native plugin.");
                } catch (err) {
                    console.error("Failed to exchange serverAuthCode natively", err);
                }
            }
            showNotif(
                lt(language, "Sesión Iniciada", "Logged In"),
                pick(language, {
                    es: `Bienvenido, ${(result as any).name || (result as any).displayName}`,
                    en: `Welcome, ${(result as any).name || (result as any).displayName}`,
                    zh: `欢迎，${(result as any).name || (result as any).displayName}`
                }),
                "success"
            );
            setTimeout(() => {
                import('@/lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
            }, 500);
        }
    };

    // ──────────────────────────────────────────────────────
    // ENTRY POINT: routes to the correct login flow
    // ──────────────────────────────────────────────────────
    const handleGoogleLogin = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                await handleGoogleLoginNative();
            } else {
                await handleGoogleLoginWeb();
            }
        } catch (err: any) {
            console.error("Google login failed", err);
            showNotif(
                lt(language, "Error de Login", "Login Error"),
                lt(language, "No se pudo iniciar sesión con Google.", "Could not sign in with Google."),
                "error"
            );
        }
    };

    const handleDemoLogin = () => {
        setGoogleUser({
            name: "Alex Dev (Demo)",
            email: "alex.dev@demo.com",
            imageUrl: "https://lh3.googleusercontent.com/a/default-user=s96-c",
            accessToken: "demo-token",
            isDemo: true
        });
        showNotif(
            lt(language, "Sesión Demo", "Demo Session"),
            lt(language, "Iniciaste sesión con un perfil de prueba.", "Logged in with a test profile."),
            "success"
        );
        setTimeout(() => {
            import('@/lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
        }, 500);
    };

    const handleGoogleLogout = async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
                await GoogleAuth.signOut().catch(() => { });
            } catch (e) { }
        } else {
            await logoutWebGoogle().catch(() => { });
        }

        // Clear only the Google account from state (data stays in local storage)
        setGoogleUser(null);
        showNotif(
            lt(language, "Sesión Cerrada", "Logged Out"),
            lt(language, "Sesión de Google cerrada. Tus datos se conservan localmente.", "Google session closed. Your data is kept locally."),
            "info"
        );
    };

    const handleCloudSync = async () => {
        setLocalSyncing(true);
        try {
            const success = await syncWithGoogleDrive();
            if (success) {
                showToast(lt(language, "Sincronización completada ✓", "Sync completed ✓"), "success");
            } else {
                const errorMsg = useStore.getState().syncError;
                if (!errorMsg) {
                    showToast(lt(language, "Sincronización completada ✓", "Sync completed ✓"), "success");
                    return;
                }
                showNotif(
                    lt(language, "Error", "Error"),
                    pick(language, {
                        es: `Error al sincronizar con Google Drive: ${errorMsg}`,
                        en: `Error syncing with Google Drive: ${errorMsg}`,
                        zh: `与 Google 云端硬盘同步失败: ${errorMsg}`
                    }),
                    "error"
                );
            }
        } catch (err) {
            console.error("handleCloudSync error", err);
        } finally {
            setLocalSyncing(false);
        }
    };

    const handleCloudRestore = async () => {
        setLocalRestoring(true);
        try {
            const success = await restoreFromGoogleDrive();
            if (success) {
                showToast(lt(language, "Elementos de la nube restaurados con éxito ✓", "Cloud elements restored successfully ✓"), "success");
            } else {
                const errorMsg = useStore.getState().syncError;
                if (!errorMsg) {
                    showToast(lt(language, "Restauración completada ✓", "Restore completed ✓"), "info");
                    return;
                }
                showNotif(
                    lt(language, "Error", "Error"),
                    pick(language, {
                        es: `No se encontró respaldo o hubo un error al restaurar: ${errorMsg}`,
                        en: `No backup found or error restoring: ${errorMsg}`,
                        zh: `未找到备份或恢复出错: ${errorMsg}`
                    }),
                    "error"
                );
            }
        } catch (err) {
            console.error("handleCloudRestore error", err);
        } finally {
            setLocalRestoring(false);
        }
    };

    const handleRecoverImages = async () => {
        setIsRecovering(true);
        setRecoveryMessage(null);
        try {
            const { recoverImagesFromDriveRevisions } = await import('@/lib/store');
            const result = await recoverImagesFromDriveRevisions();
            setRecoveryMessage(result.message);
            if (result.recovered > 0) {
                showToast(
                    pick(language, {
                        es: `${result.recovered} imagen(es) recuperadas`,
                        en: `${result.recovered} image(s) recovered`,
                        zh: `已恢复 ${result.recovered} 张图片`
                    }),
                    'success'
                );
            } else {
                showNotif(
                    lt(language, 'Recuperación de imágenes', 'Image Recovery'),
                    result.message,
                    result.recovered === 0 && result.failed === 0 ? 'info' : 'warning'
                );
            }
        } catch (err) {
            console.error('handleRecoverImages error', err);
            setRecoveryMessage(String(err));
        } finally {
            setIsRecovering(false);
        }
    };

    const handleFontFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext || '')) {
            showNotif(
                lt(language, 'Archivo de fuente inválido', 'Invalid font file'),
                lt(language, 'Por favor selecciona un archivo .ttf, .otf, .woff o .woff2', 'Please select a .ttf, .otf, .woff, or .woff2 file'),
                'error'
            );
            return;
        }

        const fontName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim() || "Fuente Personalizada";
        const reader = new FileReader();

        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
                const newFont = {
                    id: `font_${Date.now()}`,
                    name: fontName,
                    dataUrl: dataUrl,
                    format: ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ext as string
                };
                addCustomFont(newFont);
                setNoteFontFamily(newFont.name);
                showToast(
                    pick(language, {
                        es: `Fuente "${fontName}" añadida`,
                        en: `Font "${fontName}" added`,
                        zh: `已添加字体 "${fontName}"`
                    }),
                    'success'
                );
            }
        };

        reader.readAsDataURL(file);
        if (e.target) e.target.value = '';
    };


    const handleExport = async () => {
        const state = useStore.getState();
        const fullNotes = await readAllNotesFromDisk(state.notes);
        const fullTasks = await readAllTasksFromDisk(state.tasks);
        const dataToExport = {
            notes: fullNotes,
            tasks: fullTasks,
            goals: state.goals,
            appointments: state.appointments,
            projects: state.projects,
            taskGroups: state.taskGroups,
            dailySnapshots: state.dailySnapshots,
            completedOnceHabits: state.completedOnceHabits || [],
            transactions: state.transactions || [],
            expenseNotes: state.expenseNotes || [],
            savingsGoal: state.savingsGoal || 0,
            user: state.user
        };
        const jsonStr = JSON.stringify(dataToExport, null, 2);
        const fileName = `mynotes_backup_${new Date().toISOString().split('T')[0]}.json`;

        if (Capacitor.isNativePlatform()) {
            try {
                const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
                const { Share } = await import('@capacitor/share');

                const fileResult = await Filesystem.writeFile({
                    path: fileName,
                    data: jsonStr,
                    directory: Directory.Cache,
                    encoding: Encoding.UTF8
                });

                await Share.share({
                    title: lt(language, "Exportar copia de seguridad", "Export backup"),
                    url: fileResult.uri,
                    dialogTitle: lt(language, "Compartir o guardar copia de seguridad", "Share or save backup")
                });
                return;
            } catch (e) {
                console.error("Capacitor export failed", e);
                showNotif(
                    lt(language, "Error", "Error"),
                    lt(language, "Error al exportar localmente.", "Error exporting locally."),
                    "error"
                );
            }
        }

        // Web fallback
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSaveToDocuments = async () => {
        const state = useStore.getState();
        const fullNotes = await readAllNotesFromDisk(state.notes);
        const fullTasks = await readAllTasksFromDisk(state.tasks);
        const dataToExport = {
            notes: fullNotes,
            tasks: fullTasks,
            goals: state.goals,
            appointments: state.appointments,
            projects: state.projects,
            taskGroups: state.taskGroups,
            dailySnapshots: state.dailySnapshots,
            completedOnceHabits: state.completedOnceHabits || [],
            transactions: state.transactions || [],
            expenseNotes: state.expenseNotes || [],
            savingsGoal: state.savingsGoal || 0,
            user: state.user
        };
        const jsonStr = JSON.stringify(dataToExport, null, 2);
        const fileName = `mynotes_backup_${new Date().toISOString().split('T')[0]}.json`;

        if (Capacitor.isNativePlatform()) {
            try {
                const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
                
                try {
                    await Filesystem.mkdir({
                        path: 'MyNotesData',
                        directory: Directory.Documents,
                        recursive: true
                    });
                } catch (e) {
                    // Ignore if directory already exists
                }

                await Filesystem.writeFile({
                    path: `MyNotesData/${fileName}`,
                    data: jsonStr,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });

                showNotif(
                    lt(language, "Respaldo Guardado", "Backup Saved"),
                    pick(language, {
                        es: `Copia de seguridad manual guardada directamente en Documentos/MyNotesData/${fileName}`,
                        en: `Manual backup saved directly to Documents/MyNotesData/${fileName}`,
                        zh: `手动备份已直接保存至 Documents/MyNotesData/${fileName}`
                    }),
                    "success"
                );
                return;
            } catch (e) {
                console.error("Capacitor save to Documents failed", e);
                showNotif(
                    lt(language, "Error", "Error"),
                    lt(language, "Error al descargar en la carpeta Documentos.", "Error downloading to Documents folder."),
                    "error"
                );
            }
        } else {
            // Web fallback
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotif(
                lt(language, "Descarga Iniciada", "Download Started"),
                lt(language, "Copia de seguridad manual descargada correctamente.", "Manual backup downloaded successfully."),
                "success"
            );
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data && typeof data === 'object') {
                    await applyBackupDataToStore(data);
                    setIsSmartImportModalOpen(false);
                    showToast(
                        lt(language, "Datos locales cargados", "Local data loaded"),
                        "success"
                    );

                    // Auto-sync after import if Google account is connected
                    const updatedStore = useStore.getState();
                    if (updatedStore.googleUser && !updatedStore.googleSessionExpired) {
                        updatedStore.syncWithGoogleDrive().catch(console.error);
                    }
                }
            } catch (err) {
                console.error("Failed to parse import data", err);
                showNotif(
                    lt(language, "Error", "Error"),
                    lt(language, "Error al importar datos", "Error importing data"),
                    "error"
                );
            }
        };
        reader.readAsText(file);
        // Reset file input value so onChange will fire even for the same file
        e.target.value = "";
    };

    const handleSmartImport = () => {
        setIsSmartImportModalOpen(true);
    };

    const handleAutoBackupRestore = async () => {
        setIsSmartImportModalOpen(false);
        try {
            const data = await readAutoBackup2DaysFromDisk();
            if (!data || typeof data !== 'object') {
                showNotif(
                    lt(language, "Sin Copia Automática", "No Automatic Backup"),
                    pick(language, {
                        es: `No se encontró el archivo ${AUTO_BACKUP_2DAYS_FILENAME.replace('.json', '')}. La aplicación lo creará automáticamente cada 2 días.`,
                        en: `Automatic backup (${AUTO_BACKUP_2DAYS_FILENAME.replace('.json', '')}) not found yet. The app creates it automatically every 2 days.`,
                        zh: `尚未找到自动备份文件（${AUTO_BACKUP_2DAYS_FILENAME.replace('.json', '')}）。应用会每 2 天自动创建一次。`
                    }),
                    "warning"
                );
                return;
            }

            await applyBackupDataToStore(data);
            showToast(
                lt(language, "Copia local automática restaurada ✓", "Automatic local backup restored ✓"),
                "success"
            );

            const updatedStore = useStore.getState();
            if (updatedStore.googleUser && !updatedStore.googleSessionExpired) {
                updatedStore.syncWithGoogleDrive().catch(console.error);
            }
        } catch (err) {
            console.error("Auto backup restore failed", err);
            showNotif(
                lt(language, "Error", "Error"),
                lt(language, "Error al restaurar la copia automática.", "Error restoring automatic backup."),
                "error"
            );
        }
    };

    const handleManualBackupRestore = async () => {
        setIsSmartImportModalOpen(false);
        if (!Capacitor.isNativePlatform()) {
            // On Web/PC, open file selector for manual backup file
            fileInputRef.current?.click();
            return;
        }

        try {
            const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');

            // Read files in root Documents
            let rootFiles: any[] = [];
            try {
                const readdirResult = await Filesystem.readdir({
                    path: '',
                    directory: Directory.Documents
                });
                rootFiles = readdirResult.files.map(f => {
                    const name = typeof f === 'string' ? f : f.name;
                    return { name, path: name };
                });
            } catch (e) {
                console.log("Could not read root Documents directory", e);
            }

            // Read files in Documents/MyNotesData
            let subfolderFiles: any[] = [];
            try {
                const readdirResultSub = await Filesystem.readdir({
                    path: 'MyNotesData',
                    directory: Directory.Documents
                });
                subfolderFiles = readdirResultSub.files.map(f => {
                    const name = typeof f === 'string' ? f : f.name;
                    return { name, path: `MyNotesData/${name}` };
                });
            } catch (e) {
                console.log("Could not read MyNotesData subdirectory", e);
            }

            const combinedFiles = [...rootFiles, ...subfolderFiles];
            // Exclude MyNotesBackup2days so manual restore only picks manual backups
            const jsonFiles = combinedFiles.filter(file =>
                file.name &&
                file.name.endsWith('.json') &&
                !file.name.toLowerCase().includes('mynotesbackup2days') &&
                (file.name.startsWith('mynotes_') || file.name.includes('backup'))
            );

            if (jsonFiles.length === 0) {
                showNotif(
                    lt(language, "Sin Copias Manuales", "No Manual Backups Found"),
                    lt(language, "No se encontraron copias de seguridad manuales (.json) en Documentos o MyNotesData. Usa 'Descargar datos de respaldo' para crear una.", "No manual backup files (.json) found in Documents or MyNotesData."),
                    "warning"
                );
                return;
            }

            // Sort descending by name (since they contain the ISO date, e.g. mynotes_backup_2026-05-28.json)
            jsonFiles.sort((a, b) => b.name.localeCompare(a.name));

            const targetFile = jsonFiles[0];

            const fileResult = await Filesystem.readFile({
                path: targetFile.path,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });

            const data = JSON.parse(fileResult.data as string);
            if (data && typeof data === 'object') {
                await applyBackupDataToStore(data);
                showToast(
                    lt(language, "Copia manual restaurada ✓", "Manual backup restored ✓"),
                    "success"
                );

                const updatedStore = useStore.getState();
                if (updatedStore.googleUser && !updatedStore.googleSessionExpired) {
                    updatedStore.syncWithGoogleDrive().catch(console.error);
                }
            } else {
                throw new Error("Invalid format");
            }
        } catch (err) {
            console.error("Manual smart import failed", err);
            showNotif(
                lt(language, "Error", "Error"),
                lt(language, "Error al restaurar copia manual. Asegúrate de tener copias descargadas en Documentos/MyNotesData.", "Manual restore failed. Make sure you have backup files in Documents/MyNotesData."),
                "error"
            );
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center justify-center p-2 rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-all duration-300"
                title={mounted ? (t.settings || "Settings") : "Settings"}
            >
                <Settings className="w-5 h-5" />
            </button>

            {mounted && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                                onClick={() => setIsOpen(false)}
                                className="glass-scrim"
                            />

                            <GlassSurface
                                as={motion.div}
                                variant="sheet"
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                                transition={{ type: "spring", damping: 26, stiffness: 360, mass: 0.7 }}
                                className="relative w-full max-w-sm md:max-w-4xl rounded-[2rem]"
                                style={{ contain: 'layout paint' }}
                            >
                                <div
                                    data-settings-scroll
                                    className="p-6 md:p-8 overflow-y-auto max-h-[90vh] no-scrollbar overscroll-contain space-y-5"
                                    style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch' }}
                                >
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="mb-2 flex justify-center w-full">
                                    <Settings 
                                        className="w-8 h-8 text-black dark:text-white animate-spin" 
                                        style={{ animationDuration: '10s' }}
                                    />
                                </div>

                                {/* 1. Arriba: Cuenta y Sincronización + Gestión de Datos */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                    {/* Cuenta y Sincronización (Google Cloud Sync) */}
                                    <div className="flex flex-col gap-2 p-4 glass-card rounded-2xl">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                                {t.cloudSync || "Cloud Sync"}
                                            </p>
                                            <Cloud className="w-4 h-4 text-black dark:text-white" />
                                        </div>

                                        {!googleUser ? (
                                            <div className="flex flex-col gap-2 w-full mt-1">
                                                <motion.button
                                                    onClick={handleGoogleLogin}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className="w-full flex items-center justify-center gap-3 p-3 bg-white dark:bg-zinc-800 hover:bg-black/5 dark:hover:bg-white/5 text-foreground rounded-xl border border-black/10 dark:border-white/10 font-bold transition-all text-sm shadow-sm cursor-pointer"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                        <path
                                                            fill="#4285F4"
                                                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.69c-.29 1.5-.1.14-.9 3.03l2.84 2.2c1.66-1.53 2.61-3.79 2.61-6.06z"
                                                        />
                                                        <path
                                                            fill="#34A853"
                                                            d="M12 24c3.24 0 5.97-1.08 7.96-2.93l-3.84-2.98c-1.07.72-2.44 1.15-4.12 1.15-3.17 0-5.85-2.14-6.81-5.03L2.25 16.4C4.23 20.33 8.3 22.92 12 24z"
                                                        />
                                                        <path
                                                            fill="#FBBC05"
                                                            d="M5.19 14.21c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L2.25 7.55c-.78 1.55-1.22 3.29-1.22 5.09s.44 3.54 1.22 5.09l3.94-3.52z"
                                                        />
                                                        <path
                                                            fill="#EA4335"
                                                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.96 1.19 15.24 0 12 0 8.3 0 4.23 2.59 2.25 6.52l3.94 3.52c.96-2.89 3.64-5.03 6.81-5.03z"
                                                        />
                                                    </svg>
                                                    {t.googleLogin || "Sign in with Google"}
                                                </motion.button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-3 w-full mt-1">
                                                <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <img
                                                            src={googleUser.imageUrl}
                                                            alt="Profile"
                                                            referrerPolicy="no-referrer"
                                                            className="w-9 h-9 rounded-full shrink-0"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-xs truncate leading-tight">{googleUser.name}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">{googleUser.email}</p>
                                                        </div>
                                                    </div>
                                                    <motion.button
                                                        onClick={handleGoogleLogout}
                                                        whileHover={{ scale: 1.1, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                                                        whileTap={{ scale: 0.9 }}
                                                        className="p-2 text-zinc-500 hover:text-red-500 rounded-lg transition-all shrink-0 cursor-pointer"
                                                        title={t.googleLogout || "Sign out"}
                                                    >
                                                        <LogOut className="w-4 h-4" />
                                                    </motion.button>
                                                </div>
                                                {googleSessionExpired ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                                            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                                                {lt(language, "Reconecta tu cuenta", "Reconnect your account")}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                                                {lt(language, "Tu acceso a Google caducó o fue revocado. Reconecta tu cuenta para reanudar la sincronización.", "Your Google access expired or was revoked. Reconnect your account to resume cloud sync.")}
                                                            </p>
                                                        </div>
                                                        <motion.button
                                                            onClick={handleGoogleLogin}
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            className="w-full flex items-center justify-center gap-2 p-3 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black rounded-xl font-bold transition-all text-xs shadow-lg shadow-black/20 dark:shadow-white/10 cursor-pointer"
                                                        >
                                                            <RefreshCw className="w-3.5 h-3.5" />
                                                            {lt(language, "Re-conectar cuenta", "Re-connect account")}
                                                        </motion.button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <SettingsCloudSyncControls
                                                            googleUser={googleUser}
                                                            localSyncing={localSyncing}
                                                            localRestoring={localRestoring}
                                                            isRecovering={isRecovering}
                                                            recoveryMessage={recoveryMessage}
                                                            handleCloudSync={handleCloudSync}
                                                            handleCloudRestore={handleCloudRestore}
                                                            handleRecoverImages={handleRecoverImages}
                                                            language={language}
                                                            t={t}
                                                        />

                                                        {lastCloudSync && (
                                                            <p className="text-[10px] text-muted-foreground text-center mt-1">
                                                                {(t.lastSync || "Last backup: {date}").replace('{date}', lastCloudSync)}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Gestión de Datos */}
                                    <div className="flex flex-col gap-2 p-4 glass-card rounded-2xl">
                                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                                            {lt(language, "Gestión de Datos", "Data Management")}
                                        </p>
                                        <div className="flex flex-col gap-2 w-full">
                                            <div className="flex gap-3 w-full">
                                                <motion.button
                                                    onClick={() => {
                                                        setExportAnimate(true);
                                                        setTimeout(() => setExportAnimate(false), 500);
                                                        handleExport();
                                                    }}
                                                    whileHover="hover"
                                                    whileTap="tap"
                                                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-black/10 hover:bg-black/20 text-black dark:bg-white/10 dark:hover:bg-white/20 dark:text-white rounded-xl font-bold transition-all text-sm cursor-pointer"
                                                >
                                                    <motion.div
                                                        variants={exportVariants}
                                                        animate={exportAnimate ? { y: [0, 8, -4, 2, 0], scaleY: [1, 0.75, 1.15, 0.9, 1] } : "normal"}
                                                        transition={exportAnimate ? { type: "spring", stiffness: 350, damping: 8 } : undefined}
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </motion.div>
                                                    {lt(language, "Exportar", "Export")}
                                                </motion.button>
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    accept=".json" 
                                                    className="hidden" 
                                                    onChange={handleImport} 
                                                />
                                                <motion.button 
                                                    onClick={() => {
                                                        setImportAnimate(true);
                                                        setTimeout(() => setImportAnimate(false), 500);
                                                        fileInputRef.current?.click();
                                                    }}
                                                    whileHover="hover"
                                                    whileTap="tap"
                                                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl font-bold transition-all text-sm cursor-pointer"
                                                >
                                                    <motion.div
                                                        variants={importVariants}
                                                        animate={importAnimate ? { y: [0, -8, 4, -2, 0], scaleY: [1, 0.75, 1.15, 0.9, 1] } : "normal"}
                                                        transition={importAnimate ? { type: "spring", stiffness: 350, damping: 8 } : undefined}
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                    </motion.div>
                                                    {lt(language, "Importar", "Import")}
                                                </motion.button>
                                            </div>
                                            <motion.button
                                                onClick={() => {
                                                    setDownloadBackupAnimate(true);
                                                    setTimeout(() => setDownloadBackupAnimate(false), 500);
                                                    handleSaveToDocuments();
                                                }}
                                                whileHover="hover"
                                                whileTap="tap"
                                                className="w-full flex items-center justify-center gap-2 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold transition-all text-sm cursor-pointer"
                                            >
                                                <motion.div
                                                    variants={downloadBackupVariants}
                                                    animate={downloadBackupAnimate ? { y: [0, 8, -4, 2, 0], scaleY: [1, 0.75, 1.15, 0.9, 1] } : "normal"}
                                                    transition={downloadBackupAnimate ? { type: "spring", stiffness: 350, damping: 8 } : undefined}
                                                >
                                                    <Download className="w-4 h-4 text-emerald-500" />
                                                </motion.div>
                                                {lt(language, "Descargar datos de respaldo", "Download Backup Data")}
                                            </motion.button>
                                            <motion.button
                                                onClick={() => {
                                                    setSmartImportAnimate(true);
                                                    setTimeout(() => setSmartImportAnimate(false), 600);
                                                    handleSmartImport();
                                                }}
                                                whileHover="hover"
                                                whileTap="tap"
                                                className="w-full flex items-center justify-center gap-2 p-3 bg-black/10 hover:bg-black/20 text-black dark:bg-white/10 dark:hover:bg-white/20 dark:text-white rounded-xl font-bold transition-all text-sm cursor-pointer"
                                            >
                                                <motion.div
                                                    variants={smartImportVariants}
                                                    animate={smartImportAnimate ? { rotate: [0, 360], scale: [1, 1.4, 0.85, 1.15, 1] } : "normal"}
                                                    transition={smartImportAnimate ? { type: "spring", stiffness: 250, damping: 10 } : undefined}
                                                >
                                                    <Zap className="w-4 h-4 text-black dark:text-white" />
                                                </motion.div>
                                                {lt(language, "Importe Inteligente", "Smart Import")}
                                            </motion.button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground/70 text-center mt-1 leading-tight">
                                            {lt(language, "Exporta tus notas, hábitos y metas para tener un respaldo y recupéralos importando el archivo generado de forma manual o inteligente.", "Export your notes, habits and goals for a backup and restore them by importing the generated file manually or smartly.")}
                                        </p>
                                    </div>
                                </div>

                                {/* 2. Tema, Idioma y Colores de la App lado a lado */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 glass-card rounded-2xl items-center">
                                    <div className="flex flex-col justify-center items-center gap-2 border-r border-black/10 dark:border-white/10 pr-3">
                                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t.theme || "Theme"}</p>
                                        <div className="scale-125">
                                            <ModeToggle />
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-center items-center gap-2 md:border-r md:border-black/10 dark:md:border-white/10 md:pr-3">
                                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t.language || "Language"}</p>
                                        <div className="scale-110">
                                            <LanguageToggle />
                                        </div>
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex flex-col gap-2 pt-3 border-t border-black/10 dark:border-white/10 md:pt-0 md:border-t-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                                {lt(language, "Colores de la App", "App Colors")}
                                            </p>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                {appColor === 'black' 
                                                    ? (lt(language, "Negro", "Black"))
                                                    : (lt(language, "Morado", "Purple"))}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setAppColor('purple')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl border transition-all duration-300 font-bold text-xs cursor-pointer ${
                                                    appColor === 'purple'
                                                        ? "bg-purple-600/10 border-purple-600 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-600/30"
                                                        : "bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                                                }`}
                                            >
                                                <span className="w-3.5 h-3.5 rounded-full bg-[#7f0df2] border border-white/20 shadow-sm shrink-0" />
                                                <span>{lt(language, "Morado", "Purple")}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAppColor('black')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl border transition-all duration-300 font-bold text-xs cursor-pointer ${
                                                    (appColor === 'black' || !appColor)
                                                        ? "bg-black/15 dark:bg-white/15 border-black dark:border-white text-black dark:text-white shadow-sm ring-1 ring-black/20 dark:ring-white/20"
                                                        : "bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                                                }`}
                                            >
                                                <span className="w-3.5 h-3.5 rounded-full bg-black dark:bg-white border border-white/20 shadow-sm shrink-0" />
                                                <span>{lt(language, "Negro", "Black")}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Preferencias y Apariencia */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                    {/* Columna Izquierda: Notificaciones, Frases, Burbuja */}
                                    <div className="space-y-4">
                                        <motion.div 
                                            onClick={() => {
                                                setNotificationsEnabled(!notificationsEnabled);
                                            }}
                                            whileHover="hover"
                                            whileTap="tap"
                                            className="flex items-center justify-between p-4 glass-card rounded-2xl cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-3">
                                                <motion.div 
                                                    variants={bellVariants}
                                                    animate={notificationsEnabled ? "active" : "inactive"}
                                                    whileHover="hover"
                                                    className={`shrink-0 transition-colors duration-300 ${
                                                        notificationsEnabled 
                                                            ? "text-black dark:text-white" 
                                                            : "text-zinc-500 dark:text-zinc-400"
                                                    }`}
                                                >
                                                    <Bell className="w-5 h-5" />
                                                </motion.div>
                                                <div>
                                                    <h3 className="font-semibold text-sm">{t.notifications || "Notifications"}</h3>
                                                    <p className="text-xs text-muted-foreground">{t.notificationsDesc || "Reminders and habits"}</p>
                                                </div>
                                            </div>

                                            <button
                                                tabIndex={-1}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 pointer-events-none ${notificationsEnabled ? 'bg-black dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full ${notificationsEnabled ? 'bg-white dark:bg-zinc-900 translate-x-6' : 'bg-white translate-x-1'} transition-transform duration-300`} />
                                            </button>
                                        </motion.div>

                                        {/* Estado y aviso de notificaciones: se despliega al activar Notificaciones o Modo Desarrollador */}
                                        {(notificationsEnabled || developerMode) && (
                                            <div className="p-4 glass-card rounded-2xl flex flex-col gap-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`shrink-0 ${osNotifPermission === 'granted' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                            {osNotifPermission === 'granted' ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-semibold text-xs truncate">
                                                                {lt(language, 'Estado y aviso de notificaciones', 'Notification status & prompt')}
                                                            </h4>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {lt(language, 'Permiso del sistema: ', 'System permission: ')}
                                                                <span className={`font-semibold ${osNotifPermission === 'granted' ? 'text-emerald-500' : osNotifPermission === 'denied' ? 'text-rose-500' : 'text-amber-500'}`}>
                                                                    {osNotifPermission === 'granted'
                                                                        ? (lt(language, 'Permitidas', 'Granted'))
                                                                        : osNotifPermission === 'denied'
                                                                            ? (lt(language, 'Denegadas', 'Denied'))
                                                                            : (lt(language, 'Pendiente', 'Pending'))}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsOpen(false);
                                                            setTimeout(() => {
                                                                window.dispatchEvent(new CustomEvent('mynotes:show-notification-prompt'));
                                                            }, 180);
                                                        }}
                                                        className="flex-1 py-2 px-3 rounded-xl bg-black text-white dark:bg-white dark:text-black text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                                                    >
                                                        {lt(language, 'Activar / Probar aviso', 'Show notification prompt')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={refreshOsNotifPermission}
                                                        className="py-2 px-3 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-medium hover:bg-black/10 dark:hover:bg-white/15 active:scale-[0.98] transition-all cursor-pointer"
                                                    >
                                                        {lt(language, 'Verificar', 'Verify')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Priority task reminder time slots */}
                                        <PriorityReminderSettings />

                                        {/* Frases filosóficas de disciplina */}
                                        <div
                                            onClick={() => setPhilosophicalQuotesEnabled(!philosophicalQuotesEnabled)}
                                            className="flex items-center justify-between p-4 glass-card rounded-2xl cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 pr-2">
                                                <div className={`shrink-0 transition-colors duration-300 ${
                                                    philosophicalQuotesEnabled
                                                        ? "text-black dark:text-white"
                                                        : "text-zinc-500 dark:text-zinc-400"
                                                }`}>
                                                    <Sparkles className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-sm truncate">
                                                            {lt(language, 'Frases de disciplina', 'Discipline quotes')}
                                                        </h3>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.dispatchEvent(new CustomEvent('mynotes:show-philosophical-quote'));
                                                            }}
                                                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/15 hover:opacity-80 cursor-pointer"
                                                        >
                                                            {lt(language, 'Ver frase', 'Preview')}
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {lt(language, 'Frases filosóficas ocasionales (solo ciertos días)', 'Occasional philosophical quotes (only certain days)')}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                tabIndex={-1}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 pointer-events-none flex-shrink-0 ${philosophicalQuotesEnabled ? 'bg-black dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full ${philosophicalQuotesEnabled ? 'bg-white dark:bg-zinc-900 translate-x-6' : 'bg-white translate-x-1'} transition-transform duration-300`} />
                                            </button>
                                        </div>

                                        {/* Floating Timer Bubble Overlay (Fase 1C) */}
                                        <div className="flex flex-col gap-3 p-4 glass-card rounded-2xl border border-black/5 dark:border-white/10">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="shrink-0 text-primary">
                                                        <ExternalLink className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">
                                                            {lt(language, "Temporizador Flotante (Burbuja)", "Floating Timer Bubble")}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {lt(language, "Muestra la cuenta atrás fuera de la app mientras usas el móvil", "Show countdown outside app across other applications")}
                                                        </p>
                                                    </div>
                                                </div>

                                                {bubbleSettings.hasPermission ? (
                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full shrink-0">
                                                        <ShieldCheck className="w-3.5 h-3.5" />
                                                        {lt(language, "Activo", "Active")}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full shrink-0">
                                                        <ShieldAlert className="w-3.5 h-3.5" />
                                                        {lt(language, "Sin permiso", "Needs permission")}
                                                    </span>
                                                )}
                                            </div>

                                            {!bubbleSettings.hasPermission && (
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                                                    <span className="text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                                                        {lt(language, "Para mostrar la burbuja sobre otras apps, concede el permiso de 'Aparecer encima'.", "Grant 'Display over other apps' to allow floating bubble countdown.")}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={handleRequestOverlay}
                                                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 active:scale-95 transition-all shrink-0 cursor-pointer shadow-sm"
                                                    >
                                                        {lt(language, "Conceder permiso", "Grant permission")}
                                                    </button>
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-1.5 mt-1">
                                                <span className="text-xs font-semibold text-muted-foreground">
                                                    {lt(language, "Modo de visualización:", "Display Mode:")}
                                                </span>
                                                <div className="grid grid-cols-3 gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSetBubbleMode('outside')}
                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                                                            bubbleSettings.mode === 'outside'
                                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                                : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                    >
                                                        {lt(language, "Solo fuera", "Outside only")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSetBubbleMode('always')}
                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                                                            bubbleSettings.mode === 'always'
                                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                                : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                    >
                                                        {lt(language, "Siempre", "Always")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSetBubbleMode('never')}
                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                                                            bubbleSettings.mode === 'never'
                                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                                : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                    >
                                                        {lt(language, "Nunca", "Never")}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="border-t border-black/5 dark:border-white/10 pt-2.5 mt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowXiaomiGuide(!showXiaomiGuide)}
                                                    className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
                                                >
                                                    <span className="flex items-center gap-1.5">
                                                        <Smartphone className="w-3.5 h-3.5 text-primary" />
                                                        {lt(language, "¿Tienes Xiaomi, Redmi o POCO (HyperOS / MIUI)?", "Using Xiaomi, Redmi or POCO (HyperOS)?")}
                                                    </span>
                                                    {showXiaomiGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>

                                                <AnimatePresence>
                                                    {showXiaomiGuide && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden text-[11px] text-muted-foreground mt-2 flex flex-col gap-2 bg-black/5 dark:bg-white/5 p-3 rounded-xl"
                                                        >
                                                            <p className="leading-relaxed">
                                                                {lt(language, "En MIUI/HyperOS, debes habilitar además el permiso especial 'Mostrar ventanas emergentes en segundo plano':", "In MIUI/HyperOS, please make sure to allow 'Display pop-up windows while running in the background':")}
                                                            </p>
                                                            <ol className="list-decimal list-inside space-y-1 font-medium text-foreground">
                                                                <li>{lt(language, "Ajustes de la App > Otros permisos > Ventanas emergentes en segundo plano.", "App Settings > Other Permissions > Pop-up windows.")}</li>
                                                                <li>{lt(language, "Batería > Ahorro de batería > Sin restricciones.", "Battery > Battery saver > No restrictions.")}</li>
                                                            </ol>
                                                            <div className="flex gap-2 mt-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => timerEngine.openAppSettings()}
                                                                    className="px-2.5 py-1.5 rounded-lg bg-black/10 dark:bg-white/15 text-foreground font-bold hover:bg-black/20 text-[11px] transition-all cursor-pointer"
                                                                >
                                                                    {lt(language, "Abrir Ajustes de MyNotes", "Open App Settings")}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => timerEngine.openBatteryOptimizationSettings()}
                                                                    className="px-2.5 py-1.5 rounded-lg bg-black/10 dark:bg-white/15 text-foreground font-bold hover:bg-black/20 text-[11px] transition-all cursor-pointer"
                                                                >
                                                                    {lt(language, "Ajustes de Batería", "Battery Settings")}
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Columna Derecha: Efectos, Enfoque, Tamaño de texto y Fuentes */}
                                    <div className="space-y-4">
                                        <VisualEffectsSettingsSection language={language} />

                                        <motion.div 
                                            onClick={() => {
                                                setFocusEffectEnabled(!focusEffectEnabled);
                                            }}
                                            whileHover="hover"
                                            whileTap="tap"
                                            className="flex items-center justify-between p-4 glass-card rounded-2xl cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-3">
                                                <motion.div 
                                                    variants={zapVariants}
                                                    animate={focusEffectEnabled ? "active" : "inactive"}
                                                    whileHover="hover"
                                                    className={`shrink-0 transition-colors duration-300 ${
                                                        focusEffectEnabled 
                                                            ? "text-foreground" 
                                                            : "text-zinc-500 dark:text-zinc-400"
                                                    }`}
                                                >
                                                    <Crosshair className="w-5 h-5" />
                                                </motion.div>
                                                <div>
                                                    <p className="font-bold text-sm">{lt(language, "Efecto de Enfoque", "Focus Effect")}</p>
                                                    <p className="text-xs text-muted-foreground">{lt(language, "Efecto visual al completar tareas", "Visual effect on completing tasks")}</p>
                                                </div>
                                            </div>

                                            <button
                                                tabIndex={-1}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 pointer-events-none ${focusEffectEnabled ? 'bg-black dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full ${focusEffectEnabled ? 'bg-white dark:bg-zinc-900 translate-x-6' : 'bg-white translate-x-1'} transition-transform duration-300`} />
                                            </button>
                                        </motion.div>

                                        {/* Tamaño de texto (Local del dispositivo) */}
                                        <div className="flex flex-col gap-3 p-4 glass-card rounded-2xl">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Type className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                                                        {pick(language, {
                                                            es: "Tamaño de texto",
                                                            en: "Text Size",
                                                            zh: "文字大小",
                                                        })}
                                                    </p>
                                                </div>
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-600/10 text-purple-600 dark:text-purple-400 shrink-0">
                                                    {textZoomState.appliedZoom}%
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                {[
                                                    {
                                                        id: "standard" as TextZoomMode,
                                                        title: pick(language, {
                                                            es: "Estándar (recomendado)",
                                                            en: "Standard (recommended)",
                                                            zh: "标准（推荐）",
                                                        }),
                                                        desc: "100%",
                                                    },
                                                    {
                                                        id: "system" as TextZoomMode,
                                                        title: pick(language, {
                                                            es: "Seguir el sistema",
                                                            en: "Follow system",
                                                            zh: "跟随系统",
                                                        }),
                                                        desc: textZoomState.systemFontScale !== null
                                                            ? `${Math.round(textZoomState.systemFontScale * 100)}% (máx. ${Math.round(textZoomState.maxSystemScale * 100)}%)`
                                                            : pick(language, {
                                                                es: `Tope ${Math.round(textZoomState.maxSystemScale * 100)}% (solo Android)`,
                                                                en: `Cap ${Math.round(textZoomState.maxSystemScale * 100)}% (Android only)`,
                                                                zh: `上限 ${Math.round(textZoomState.maxSystemScale * 100)}%（仅 Android）`,
                                                            }),
                                                    },
                                                    {
                                                        id: "custom" as TextZoomMode,
                                                        title: pick(language, {
                                                            es: "Personalizado",
                                                            en: "Custom",
                                                            zh: "自定义",
                                                        }),
                                                        desc: `${textZoomState.customPercent}%`,
                                                    },
                                                ].map((opt) => {
                                                    const active = textZoomState.mode === opt.id
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() => handleTextZoomModeChange(opt.id)}
                                                            className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                                                active
                                                                    ? "bg-purple-600/10 border-purple-600 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-600/30"
                                                                    : "bg-black/5 dark:bg-white/5 border-transparent text-foreground/80 hover:bg-black/10 dark:hover:bg-white/10"
                                                            }`}
                                                        >
                                                            <span className="text-xs font-semibold leading-tight">{opt.title}</span>
                                                            <span className="text-[11px] font-bold opacity-80 shrink-0">{opt.desc}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {textZoomState.mode === "custom" && (
                                                <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                                                    {TEXT_ZOOM_STEPS.map((step) => {
                                                        const active = textZoomState.customPercent === step
                                                        return (
                                                            <button
                                                                key={step}
                                                                type="button"
                                                                onClick={() => handleTextZoomModeChange("custom", step)}
                                                                className={`min-h-[44px] rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                                                                    active
                                                                        ? "bg-black text-white dark:bg-white dark:text-black border-transparent shadow-sm"
                                                                        : "bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                                                                }`}
                                                            >
                                                                {step}%
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}

                                            <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 p-3 flex flex-col gap-1">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {pick(language, { es: "Vista previa", en: "Preview", zh: "预览" })}
                                                </span>
                                                <p
                                                    className="font-bold text-foreground leading-snug"
                                                    style={{ fontSize: `${Math.round(14 * textZoomState.appliedZoom / 100)}px` }}
                                                >
                                                    {pick(language, {
                                                        es: "Título de nota de ejemplo",
                                                        en: "Sample note title",
                                                        zh: "示例笔记标题",
                                                    })}
                                                </p>
                                                <p
                                                    className="text-muted-foreground leading-snug"
                                                    style={{ fontSize: `${Math.round(12 * textZoomState.appliedZoom / 100)}px` }}
                                                >
                                                    {pick(language, {
                                                        es: "Así se verá el texto en tus listas, notas y tarjetas.",
                                                        en: "This is how text will look in your lists, notes, and cards.",
                                                        zh: "列表、笔记和卡片中的文字将按此大小显示。",
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Fuentes de letras en Notas */}
                                        <div className="flex flex-col gap-3 p-4 glass-card rounded-2xl">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Type className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                                        {lt(language, "Fuentes de letras en Notas", "Note Font Family")}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    {noteFontFamily === 'default'
                                                        ? (lt(language, "Sistema", "System"))
                                                        : noteFontFamily}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setNoteFontFamily('default')}
                                                    className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col gap-1 items-start transition-all cursor-pointer ${
                                                        noteFontFamily === 'default'
                                                            ? "bg-purple-600/10 border-purple-600 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-600/30"
                                                            : "bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                                                    }`}
                                                >
                                                    <span className="font-sans text-sm font-bold">Aa</span>
                                                    <span>{lt(language, "Sistema", "System")}</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setNoteFontFamily('serif')}
                                                    className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col gap-1 items-start transition-all cursor-pointer ${
                                                        noteFontFamily === 'serif'
                                                            ? "bg-purple-600/10 border-purple-600 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-600/30"
                                                            : "bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                                                    }`}
                                                >
                                                    <span className="font-serif text-sm font-bold">Aa</span>
                                                    <span>Serif</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setNoteFontFamily('monospace')}
                                                    className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col gap-1 items-start transition-all cursor-pointer ${
                                                        noteFontFamily === 'monospace'
                                                            ? "bg-purple-600/10 border-purple-600 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-600/30"
                                                            : "bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                                                    }`}
                                                >
                                                    <span className="font-mono text-sm font-bold">Aa</span>
                                                    <span>{lt(language, "Mononavegador", "Monospace")}</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setNoteFontFamily('cursive')}
                                                    className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col gap-1 items-start transition-all cursor-pointer ${
                                                        noteFontFamily === 'cursive'
                                                            ? "bg-purple-600/10 border-purple-600 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-600/30"
                                                            : "bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                                                    }`}
                                                >
                                                    <span className="font-serif italic text-sm font-bold">Aa</span>
                                                    <span>{lt(language, "Cursiva", "Cursive")}</span>
                                                </button>
                                            </div>

                                            {customFonts.length > 0 && (
                                                <div className="flex flex-col gap-1.5 mt-1">
                                                    <p className="text-[11px] text-muted-foreground font-semibold">
                                                        {lt(language, "Fuentes personalizadas:", "Custom fonts:")}
                                                    </p>
                                                    <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
                                                        {customFonts.map((font) => (
                                                            <div
                                                                key={font.id}
                                                                className={`flex items-center justify-between p-2 rounded-xl border text-xs font-medium transition-all ${
                                                                    noteFontFamily === font.name
                                                                        ? "bg-purple-600/10 border-purple-600 text-purple-600 dark:text-purple-400"
                                                                        : "bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground"
                                                                }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setNoteFontFamily(font.name)}
                                                                    className="flex-1 text-left truncate cursor-pointer font-medium"
                                                                    style={{ fontFamily: font.name }}
                                                                >
                                                                    {font.name}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        removeCustomFont(font.name);
                                                                        if (noteFontFamily === font.name) {
                                                                            setNoteFontFamily('default');
                                                                        }
                                                                    }}
                                                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-lg transition-all ml-2"
                                                                    title={lt(language, "Eliminar fuente", "Remove font")}
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <input
                                                type="file"
                                                ref={fontInputRef}
                                                accept=".ttf,.otf,.woff,.woff2"
                                                className="hidden"
                                                onChange={handleFontFileUpload}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fontInputRef.current?.click()}
                                                className="w-full flex items-center justify-center gap-2 p-2.5 bg-transparent border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-black dark:text-white rounded-xl font-bold transition-all text-xs cursor-pointer mt-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>{lt(language, "Añadir fuente desde almacenamiento", "Add font from storage")}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Modo Desarrollador (despliega funciones de prueba, guía y estado de notificaciones) */}
                                <div className="space-y-3">
                                    <motion.div 
                                        onClick={() => {
                                            if (setDeveloperMode) setDeveloperMode(!developerMode);
                                        }}
                                        whileHover="hover"
                                        whileTap="tap"
                                        className="flex items-center justify-between p-4 glass-card rounded-2xl cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
                                    >
                                        <div className="flex items-center gap-3">
                                            <motion.div 
                                                animate={developerMode ? "active" : "inactive"}
                                                whileHover="hover"
                                                className={`shrink-0 transition-colors duration-300 ${
                                                    developerMode 
                                                        ? "text-purple-500 dark:text-purple-400" 
                                                        : "text-zinc-500 dark:text-zinc-400"
                                                }`}
                                            >
                                                <Code className="w-5 h-5" />
                                            </motion.div>
                                            <div>
                                                <p className="font-bold text-sm">{lt(language, "Modo Desarrollador", "Developer Mode")}</p>
                                                <p className="text-xs text-muted-foreground">{lt(language, "Muestra herramientas de prueba y diagnóstico", "Show testing & diagnostic tools")}</p>
                                            </div>
                                        </div>

                                        <button
                                            tabIndex={-1}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 pointer-events-none ${
                                                developerMode ? 'bg-black dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
                                            }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full ${
                                                developerMode ? 'bg-white dark:bg-zinc-900 translate-x-6' : 'bg-white translate-x-1'
                                            } transition-transform duration-300`} />
                                        </button>
                                    </motion.div>

                                    {developerMode && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Test Mensaje Bienvenida Notas */}
                                            <motion.div 
                                                onClick={() => {
                                                    window.dispatchEvent(new Event('openWelcomeNotesModal'));
                                                    setIsOpen(false);
                                                }}
                                                whileHover="hover"
                                                whileTap="tap"
                                                className="flex items-center justify-between p-4 glass-card rounded-2xl cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="shrink-0 text-blue-500 dark:text-blue-400">
                                                        <Zap className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">Test Mensaje Bienvenida Notas</p>
                                                        <p className="text-xs text-muted-foreground">Probar modal de MyNotes</p>
                                                    </div>
                                                </div>
                                            </motion.div>

                                            {/* Guía de bienvenida */}
                                            <div className="flex flex-col gap-2 p-4 glass-card rounded-2xl">
                                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                                                    {lt(language, "Guía de bienvenida", "Welcome Guide")}
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        router.push('/');
                                                        startTourManually();
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 p-3 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black rounded-xl font-bold transition-all text-sm hover:scale-[1.02] active:scale-95 shadow-lg shadow-black/20 dark:shadow-white/10 cursor-pointer"
                                                >
                                                    <CircleHelp className="w-4 h-4 text-white dark:text-black animate-pulse" />
                                                    {lt(language, "Iniciar guía interactiva", "Start interactive guide")}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Versión y activador oculto de Modo Desarrollador */}
                                <div className="pt-3 border-t border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleVersionClick}
                                        className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors select-none py-1 px-3 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Gauge className="w-3.5 h-3.5 opacity-60 text-primary" />
                                        <span>MyNotes v1.0.0 {versionClickCount > 0 ? `(${7 - versionClickCount})` : ''}</span>
                                    </button>
                                    {developerMode && (
                                        <span className="text-[10px] font-mono text-muted-foreground/80 select-text text-center">
                                            {process.env.NEXT_PUBLIC_BUILD_ID || "dev-local"}
                                        </span>
                                    )}
                                </div>
                                </div>
                            </GlassSurface>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {mounted && createPortal(
                <AnimatePresence>
                    {isSmartImportModalOpen && (
                        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsSmartImportModalOpen(false)}
                                className={`fixed inset-0 bg-black/50 ${smartImportBlur ? "backdrop-blur-sm" : ""}`}
                            />
                            <motion.div
                                initial={{ scale: 0.92, opacity: 0, y: 12 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.92, opacity: 0, y: 12 }}
                                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                                className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-[2.2rem] p-7 shadow-2xl flex flex-col items-center text-center"
                            >
                                <button
                                    type="button"
                                    onClick={() => setIsSmartImportModalOpen(false)}
                                    className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                    title={lt(language, "Cerrar", "Close")}
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <h3
                                    className="text-2xl md:text-[26px] font-serif italic text-zinc-900 dark:text-white mb-6 select-none"
                                    style={{ fontFamily: 'var(--font-dancing-script), Georgia, serif' }}
                                >
                                    {lt(language, "Importe inteligente", "Smart Import")}
                                </h3>

                                <div className="w-full flex flex-col gap-3.5">
                                    <button
                                        type="button"
                                        onClick={handleAutoBackupRestore}
                                        className="w-full py-3.5 px-4 rounded-xl bg-[#009e49] hover:bg-[#00873e] active:scale-[0.98] text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                                    >
                                        {lt(language, "Restauración de copia automática", "Restore automatic backup")}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleManualBackupRestore}
                                        className="w-full py-3.5 px-4 rounded-xl bg-[#a8a8a8] hover:bg-[#969696] dark:bg-zinc-700 dark:hover:bg-zinc-600 active:scale-[0.98] text-black dark:text-white font-extrabold text-sm shadow-sm transition-all cursor-pointer"
                                    >
                                        {lt(language, "Restauración de copia manual", "Restore manual backup")}
                                    </button>
                                </div>

                                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-6 font-medium">
                                    {lt(language, "La copia automática se hace cada 2 días en local", "Automatic backup is created every 2 days locally")}
                                </p>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            <NotificationDialog
                isOpen={notifState.isOpen}
                onClose={() => setNotifState(prev => ({ ...prev, isOpen: false }))}
                title={notifState.title}
                message={notifState.message}
                type={notifState.type}
                confirmLabel={lt(language, "Aceptar", "OK")}
            />

            <PerfDebugModal
                isOpen={isPerfDebugOpen}
                onClose={() => setIsPerfDebugOpen(false)}
            />
        </>
    )
}
