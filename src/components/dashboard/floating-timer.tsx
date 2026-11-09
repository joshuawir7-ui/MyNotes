"use client"

import { motion, useDragControls } from "framer-motion"
import { Play, Pause, Maximize2, X, GripHorizontal } from "lucide-react"
import { useRef, useEffect, useState } from "react"
import { timerEngine, useTimerStore } from "@/lib/timer-engine"
import { useTimerRemaining } from "@/hooks/use-timer-remaining"
import { isPipActive, closePictureInPicture } from "@/lib/pip-timer"

export function FloatingTimer() {
    const [mounted, setMounted] = useState(false)
    const isFloating = useTimerStore(s => s.isFloating)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !isFloating || isPipActive()) return null

    return <FloatingTimerContent />
}

function FloatingTimerContent() {
    const position = useTimerStore(s => s.position)
    const storeSize = useTimerStore(s => s.size)
    const { formatted, isActive } = useTimerRemaining()

    const containerRef = useRef<HTMLDivElement>(null)
    const dragControls = useDragControls()
    const [isResizing, setIsResizing] = useState(false)
    const [localSize, setLocalSize] = useState(storeSize)

    useEffect(() => {
        setLocalSize(storeSize)
    }, [storeSize])

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

    const handleRestore = () => {
        closePictureInPicture()
        timerEngine.setUIPreferences({ isFloating: false })
    }

    const handleClose = () => {
        closePictureInPicture()
        timerEngine.pause()
        timerEngine.setUIPreferences({ isFloating: false })
    }

    // Resize logic: only updates local component state during move, persists ONCE on mouseUp
    const onResizeStart = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)

        const startX = e.clientX
        const startY = e.clientY
        const startWidth = localSize.width
        const startHeight = localSize.height
        let currentWidth = startWidth
        let currentHeight = startHeight

        const onMouseMove = (moveEvent: MouseEvent) => {
            currentWidth = Math.max(140, startWidth + (moveEvent.clientX - startX))
            currentHeight = Math.max(140, startHeight + (moveEvent.clientY - startY))
            setLocalSize({ width: currentWidth, height: currentHeight })
        }

        const onMouseUp = () => {
            setIsResizing(false)
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
            // Persist once on end of resize
            timerEngine.setUIPreferences({ size: { width: currentWidth, height: currentHeight } })
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
    }

    return (
        <motion.div
            ref={containerRef}
            drag
            dragControls={dragControls}
            dragMomentum={false}
            dragListener={false}
            initial={false}
            style={{
                width: localSize.width,
                height: localSize.height,
                x: position.x,
                y: position.y
            }}
            onDragEnd={(_, info) => {
                // Persist once on drag end, never per frame
                timerEngine.setUIPreferences({ position: { x: info.point.x, y: info.point.y } })
            }}
            className="fixed z-[9999] glass-panel rounded-2xl shadow-2xl flex flex-col items-center justify-center border-primary/20 overflow-hidden"
        >
            {/* Drag Handle Top Bar */}
            <div
                className="w-full h-8 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors absolute top-0 left-0 right-0 group"
                onPointerDown={(e) => dragControls.start(e)}
            >
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleRestore}
                        className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                        title="Restaurar"
                    >
                        <Maximize2 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all"
                        title="Cerrar"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Timer Display */}
            <div className="flex flex-col items-center justify-center flex-1 pt-4 select-none">
                <div className="text-3xl font-bold font-mono tracking-tighter text-foreground tabular-nums">
                    {formatted}
                </div>

                <button
                    onClick={handleStartPause}
                    className={`mt-4 p-3 rounded-full transition-all shadow-sm active:scale-95 ${
                        isActive
                            ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
                            : 'bg-primary/20 text-primary hover:bg-primary/30'
                    }`}
                >
                    {isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
            </div>

            {/* Resize Handle (Bottom Right) */}
            <div
                onMouseDown={onResizeStart}
                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 group"
            >
                <div className="w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary transition-colors border border-white/10" />
            </div>
        </motion.div>
    )
}
