"use client"

import { useState } from "react"
import { Play, Pause, RotateCcw, X, SlidersHorizontal, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { timerEngine, useTimerStore } from "@/lib/timer-engine"
import { useTimerRemaining } from "@/hooks/use-timer-remaining"

interface FocusTimerProps {
    onClose?: () => void
    showCloseButton?: boolean
}

export function FocusTimer({ onClose, showCloseButton = true }: FocusTimerProps) {
    const { formatted, isActive, preset: currentPreset } = useTimerRemaining()
    const isFloating = useTimerStore(s => s.isFloating)
    const [customValue, setCustomValue] = useState("")
    const [showCustomInput, setShowCustomInput] = useState(false)

    const presets = [5, 15, 30]

    const handleStartPause = () => {
        if (isActive) {
            timerEngine.pause()
        } else {
            const state = timerEngine.getState()
            if (state.status === 'paused') {
                timerEngine.resume()
            } else {
                timerEngine.start()
            }
        }
    }

    const handleReset = () => {
        timerEngine.reset()
    }

    const setPreset = (mins: number) => {
        timerEngine.start(mins * 60 * 1000, mins)
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
    )
}
