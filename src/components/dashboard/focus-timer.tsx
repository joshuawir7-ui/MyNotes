"use client"

import { useState, useEffect } from "react"
import { Play, Pause, RotateCcw, X, Settings2, SlidersHorizontal, ExternalLink, ShieldAlert, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { timerEngine, useTimerStore } from "@/lib/timer-engine"
import { useTimerRemaining } from "@/hooks/use-timer-remaining"
import { togglePictureInPicture, isPipActive } from "@/lib/pip-timer"
import { Capacitor } from "@capacitor/core"
import { useStore } from "@/lib/store"

interface FocusTimerProps {
    onClose?: () => void
    showCloseButton?: boolean
}

export function FocusTimer({ onClose, showCloseButton = true }: FocusTimerProps) {
    const { formatted, isActive, preset: currentPreset } = useTimerRemaining()
    const isFloating = useTimerStore(s => s.isFloating)
    const [customValue, setCustomValue] = useState("")
    const [showCustomInput, setShowCustomInput] = useState(false)
    const [showOverlayModal, setShowOverlayModal] = useState(false)
    const [isXiaomi, setIsXiaomi] = useState(false)
    const [isAndroidOrMobile, setIsAndroidOrMobile] = useState(false)
    const [isLandscape, setIsLandscape] = useState(false)
    const language = useStore(s => s.language)
    const showToast = useStore(s => s.showToast)

    const presets = [5, 15, 30]

    useEffect(() => {
        const updateDeviceState = () => {
            if (typeof window === 'undefined') return
            const isCap = Capacitor.isNativePlatform()
            const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
            setIsAndroidOrMobile(isCap || isMobileUA)
            setIsLandscape(window.innerWidth > window.innerHeight)
        }
        updateDeviceState()
        window.addEventListener('resize', updateDeviceState)
        window.addEventListener('orientationchange', updateDeviceState)

        if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
            timerEngine.isXiaomiDevice().then(setIsXiaomi).catch(() => {})
        }

        return () => {
            window.removeEventListener('resize', updateDeviceState)
            window.removeEventListener('orientationchange', updateDeviceState)
        }
    }, [])

    const handleStartPause = async () => {
        if (isActive) {
            timerEngine.pause()
        } else {
            const state = timerEngine.getState()
            if (state.status === 'paused') {
                timerEngine.resume()
            } else {
                timerEngine.start()
            }

            // On Android: verify if overlay permission is granted so floating bubble works when exiting
            if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
                const hasPerm = await timerEngine.checkOverlayPermission()
                if (!hasPerm) {
                    const hasPrompted = sessionStorage.getItem('mynotes_overlay_prompted') === 'true'
                    if (!hasPrompted) {
                        sessionStorage.setItem('mynotes_overlay_prompted', 'true')
                        const xiaomi = await timerEngine.isXiaomiDevice()
                        setIsXiaomi(xiaomi)
                        setShowOverlayModal(true)
                    }
                }
            }
        }
    }

    const handleReset = () => {
        timerEngine.reset()
    }

    const setPreset = (mins: number) => {
        timerEngine.start(mins * 60 * 1000, mins)
    }

    const handleToggleFloating = async () => {
        if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
            const hasPerm = await timerEngine.checkOverlayPermission()
            if (!hasPerm) {
                const xiaomi = await timerEngine.isXiaomiDevice()
                setIsXiaomi(xiaomi)
                setShowOverlayModal(true)
                return
            }

            await timerEngine.setBubbleMode('outside')
            await timerEngine.showBubble()
            showToast(
                language === 'es'
                    ? "Burbuja flotante activada: aparecerá en tu pantalla cuando salgas de la aplicación."
                    : "Floating bubble activated: will appear on your screen when you exit the app.",
                "success"
            )
        } else {
            await togglePictureInPicture()
        }
    }

    const handleVerifyOverlayPermission = async () => {
        const hasPerm = await timerEngine.checkOverlayPermission()
        if (hasPerm) {
            await timerEngine.setBubbleMode('outside')
            setShowOverlayModal(false)
            showToast(
                language === 'es'
                    ? "¡Permiso concedido! La burbuja flotante aparecerá al salir de la app."
                    : "Permission granted! Floating bubble will appear when you leave the app.",
                "success"
            )
        } else {
            showToast(
                language === 'es'
                    ? "Permiso aún no detectado. Asegúrate de activarlo en los Ajustes."
                    : "Permission not yet granted. Please make sure to enable it in Settings.",
                "warning"
            )
        }
    }

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const mins = parseInt(customValue, 10)
        if (!isNaN(mins) && mins > 0) {
            timerEngine.start(mins * 60 * 1000, mins)
            setShowCustomInput(false)
            setCustomValue("")
        }
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
        visible: {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            transition: {
                duration: 0.5,
                ease: [0.23, 1, 0.32, 1] as any
            }
        }
    }

    return (
        <div className="w-full h-full flex flex-col justify-center">
            {/* ============================================================== */}
            {/* DESKTOP / HORIZONTAL (LANDSCAPE) VIEW                          */}
            {/* ============================================================== */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className={`${
                    isAndroidOrMobile
                        ? (isLandscape ? 'flex' : 'hidden')
                        : 'hidden md:flex'
                } flex-col h-full w-full items-center justify-start relative bg-white/5 rounded-xl border border-white/10 p-3 pt-1 overflow-y-auto custom-scrollbar`}
            >
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-foreground z-10"
                        title="Cerrar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                <button
                    onClick={handleToggleFloating}
                    className={`absolute top-2 right-10 p-1 hover:bg-white/10 rounded-full transition-colors z-10 ${
                        isFloating ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                    }`}
                    title="Ventana flotante / Picture-in-Picture en Windows"
                >
                    <ExternalLink className="w-4 h-4" />
                </button>

                <div className="w-full text-center mt-0">
                    <motion.div
                        variants={itemVariants}
                        className="text-4xl font-bold font-mono tracking-tighter text-foreground mb-3"
                    >
                        {formatted}
                    </motion.div>

                    <motion.div
                        variants={itemVariants}
                        className="flex justify-center gap-3 mb-3"
                    >
                        <button
                            onClick={handleStartPause}
                            className={`p-2.5 rounded-full transition-all ${isActive ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
                            title={isActive ? "Pausar" : "Iniciar"}
                        >
                            {isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                        </button>
                        <button
                            onClick={handleReset}
                            className="p-2.5 rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
                            title="Reiniciar"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </motion.div>

                    <motion.div
                        variants={itemVariants}
                        className="flex justify-center gap-2 mb-2"
                    >
                        {presets.map((mins) => (
                            <button
                                key={mins}
                                onClick={() => setPreset(mins)}
                                className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-colors ${
                                    currentPreset === mins
                                        ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-foreground'
                                }`}
                            >
                                {mins}m
                            </button>
                        ))}
                        <button
                            onClick={() => setShowCustomInput(!showCustomInput)}
                            className={`p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ${showCustomInput ? 'text-primary' : 'text-muted-foreground'}`}
                            title="Personalizar minutos"
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>

                    <AnimatePresence>
                        {showCustomInput && (
                            <motion.form
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                onSubmit={handleCustomSubmit}
                                className="overflow-hidden mb-4"
                            >
                                <div className="flex gap-2 px-2">
                                    <input
                                        type="number"
                                        placeholder="Minutos"
                                        value={customValue}
                                        onChange={(e) => setCustomValue(e.target.value)}
                                        className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:border-primary/50 transition-colors"
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:opacity-90 transition-opacity"
                                    >
                                        OK
                                    </button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* ============================================================== */}
            {/* MOBILE PORTRAIT VIEW: CIRCULAR POD                             */}
            {/* ============================================================== */}
            <div className={`${
                isAndroidOrMobile
                    ? (isLandscape ? 'hidden' : 'flex')
                    : 'flex md:hidden'
            } flex-col items-center justify-center w-full relative py-1`}>
                {/* Floating mode button */}
                <button
                    type="button"
                    onClick={handleToggleFloating}
                    className={`absolute top-0 right-0 p-1.5 rounded-full transition-all active:scale-95 z-10 ${
                        isFloating
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    title={isFloating ? "Ocultar temporizador flotante" : "Activar temporizador flotante"}
                >
                    <ExternalLink className="w-4 h-4" />
                </button>

                {/* Circular Pod */}
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] flex flex-col items-center justify-center select-none transition-transform hover:scale-[1.02]">
                    <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground select-none">
                        {formatted}
                    </span>

                    <div className="flex items-center gap-2.5 mt-2">
                        <button
                            onClick={handleStartPause}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                                isActive
                                    ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
                                    : 'bg-black/10 dark:bg-white/15 text-foreground hover:bg-black/20 dark:hover:bg-white/25'
                            }`}
                            title={isActive ? "Pausar" : "Iniciar"}
                        >
                            {isActive ? (
                                <Pause className="w-4 h-4 fill-current" />
                            ) : (
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                        </button>

                        <button
                            onClick={handleReset}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors active:scale-95"
                            title="Reiniciar"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Presets and Custom Input Button */}
                <div className="flex items-center justify-center gap-4 mt-3">
                    {presets.map((mins) => (
                        <button
                            key={mins}
                            onClick={() => setPreset(mins)}
                            className={`text-[11px] font-semibold transition-colors cursor-pointer active:scale-95 ${
                                currentPreset === mins ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {mins}m
                        </button>
                    ))}
                    <button
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className={`p-1 rounded-md transition-colors active:scale-95 ${
                            showCustomInput ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title="Configurar minutos"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                </div>

                <AnimatePresence>
                    {showCustomInput && (
                        <motion.form
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            onSubmit={handleCustomSubmit}
                            className="overflow-hidden mt-3 flex items-center justify-center gap-2 w-full max-w-xs sm:max-w-sm px-2"
                        >
                            <input
                                type="number"
                                placeholder="Minutos"
                                value={customValue}
                                onChange={(e) => setCustomValue(e.target.value)}
                                className="flex-1 min-w-0 bg-zinc-200/80 dark:bg-zinc-800/80 border border-black/10 dark:border-white/10 rounded-full px-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 shadow-inner"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="px-4 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-black hover:opacity-90 active:scale-95 transition-all shadow-sm shrink-0"
                            >
                                OK
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>

            {/* ANDROID OVERLAY / FLOATING BUBBLE PERMISSION MODAL */}
            <AnimatePresence>
                {showOverlayModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowOverlayModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/15 rounded-3xl p-5 max-w-sm w-full shadow-2xl relative text-left"
                        >
                            <button
                                type="button"
                                onClick={() => setShowOverlayModal(false)}
                                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                                    <ExternalLink className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        {language === 'es' ? "Activar Reloj Flotante" : "Enable Floating Timer"}
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground">
                                        {language === 'es' ? "Burbuja flotante fuera de la app" : "Floating bubble outside app"}
                                    </p>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                {language === 'es'
                                    ? "Para que el temporizador siga visible como una burbuja flotante al salir a la pantalla de inicio o usar otras apps, Android requiere conceder el permiso de superposición."
                                    : "To keep the timer visible as a floating bubble when you switch apps or go to your home screen, Android requires the overlay permission."}
                            </p>

                            {isXiaomi && (
                                <div className="p-3 mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] leading-snug space-y-1.5">
                                    <div className="font-bold flex items-center gap-1.5">
                                        <ShieldAlert className="w-4 h-4 shrink-0" />
                                        <span>{language === 'es' ? "Dispositivo Xiaomi / HyperOS detectado" : "Xiaomi / HyperOS detected"}</span>
                                    </div>
                                    <p>
                                        {language === 'es'
                                            ? "Xiaomi requiere 2 permisos: 1) 'Mostrar sobre otras apps' y 2) 'Mostrar ventanas emergentes mientras se ejecuta en segundo plano'."
                                            : "Xiaomi requires 2 permissions: 1) 'Display over other apps' and 2) 'Display pop-up windows while running in background'."}
                                    </p>
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => timerEngine.requestOverlayPermission()}
                                    className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 active:scale-98 transition-all shadow-md text-center"
                                >
                                    {language === 'es' ? "1. Conceder 'Mostrar sobre otras apps'" : "1. Grant 'Display over other apps'"}
                                </button>

                                {isXiaomi && (
                                    <button
                                        type="button"
                                        onClick={() => timerEngine.openMiuiPermissions()}
                                        className="w-full py-2.5 px-4 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 text-xs font-bold active:scale-98 transition-all text-center"
                                    >
                                        {language === 'es' ? "2. Conceder 'Ventanas emergentes en 2° plano' (Xiaomi)" : "2. Grant 'Pop-ups in background' (Xiaomi)"}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={handleVerifyOverlayPermission}
                                    className="w-full py-2 px-4 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-foreground text-xs font-semibold active:scale-98 transition-all flex items-center justify-center gap-1.5 mt-1"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>{language === 'es' ? "Ya concedí los permisos" : "I already granted permissions"}</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
