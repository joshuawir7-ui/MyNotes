"use client"

import { useState } from "react"
import { Play, Pause, RotateCcw, X, SlidersHorizontal, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useStore } from "@/lib/store"

interface FocusTimerProps {
    onClose?: () => void
    showCloseButton?: boolean
}

export function FocusTimer({ onClose, showCloseButton = true }: FocusTimerProps) {
    const timer = useStore(state => state.timer)
    const setTimer = useStore(state => state.setTimer)
    const [customValue, setCustomValue] = useState("")
    const [showCustomInput, setShowCustomInput] = useState(false)

    const presets = [5, 15, 30]

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const handleStartPause = () => {
        if (timer.isActive) {
            setTimer({ isActive: false, targetTimestamp: undefined })
        } else {
            setTimer({ isActive: true }) // Store setTimer will calculate targetTimestamp
        }
    }

    const handleReset = () => {
        setTimer({ isActive: false, timeLeft: 25 * 60, targetTimestamp: undefined })
    }

    const setPreset = (mins: number) => {
        setTimer({ isActive: false, timeLeft: mins * 60, targetTimestamp: undefined })
    }

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const mins = parseInt(customValue, 10)
        if (!isNaN(mins) && mins > 0) {
            setTimer({ isActive: false, timeLeft: mins * 60, targetTimestamp: undefined })
            setShowCustomInput(false)
            setCustomValue("")
        }
    }

    return (
        <div className="flex flex-col items-center justify-center w-full relative py-1">
            {showCloseButton && onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-0 right-0 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-foreground z-10"
                    title="Cerrar"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            {/* Circular Pod */}
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] flex flex-col items-center justify-center select-none transition-transform hover:scale-[1.02]">
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground select-none">
                    {formatTime(timer.timeLeft)}
                </span>

                <div className="flex items-center gap-2.5 mt-2">
                    <button
                        onClick={handleStartPause}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                            timer.isActive
                                ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
                                : 'bg-black/10 dark:bg-white/15 text-foreground hover:bg-black/20 dark:hover:bg-white/25'
                        }`}
                        title={timer.isActive ? "Pausar" : "Iniciar"}
                    >
                        {timer.isActive ? (
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
                        className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer active:scale-95"
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
                        className="overflow-hidden mt-2 flex gap-1.5 items-center justify-center"
                    >
                        <input
                            type="number"
                            placeholder="Min"
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            className="w-16 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-0.5 text-xs text-center focus:outline-none focus:border-primary/50 text-foreground"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="px-2.5 py-0.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
                        >
                            OK
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    )
}
