"use client"

import { useState } from "react"
import { Play, Pause, RotateCcw, X, Settings2, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useStore } from "@/lib/store"

interface FocusTimerProps {
    onClose: () => void
}

export function FocusTimer({ onClose }: FocusTimerProps) {
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
        const mins = parseInt(customValue)
        if (!isNaN(mins) && mins > 0) {
            setTimer({ isActive: false, timeLeft: mins * 60, targetTimestamp: undefined })
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
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="flex flex-col h-full items-center justify-start relative bg-white/5 rounded-xl border border-white/10 p-3 pt-1 overflow-y-auto custom-scrollbar"
        >
            <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-foreground z-10"
            >
                <X className="w-4 h-4" />
            </button>

            <button
                onClick={() => setTimer({ isFloating: true })}
                className="absolute top-2 right-10 p-1 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-primary z-10"
                title="Minimize to Floating Window"
            >
                <ExternalLink className="w-4 h-4" />
            </button>

            <div className="w-full text-center mt-0">
                <motion.div
                    variants={itemVariants}
                    className="text-4xl font-bold font-mono tracking-tighter text-foreground mb-3"
                >
                    {formatTime(timer.timeLeft)}
                </motion.div>

                <motion.div
                    variants={itemVariants}
                    className="flex justify-center gap-3 mb-3"
                >
                    <button
                        onClick={handleStartPause}
                        className={`p-2.5 rounded-full transition-all ${timer.isActive ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
                    >
                        {timer.isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>
                    <button
                        onClick={handleReset}
                        className="p-2.5 rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
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
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-medium hover:bg-white/10 transition-colors"
                        >
                            {mins}m
                        </button>
                    ))}
                    <button
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className={`p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ${showCustomInput ? 'text-primary' : 'text-muted-foreground'}`}
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
    )
}
