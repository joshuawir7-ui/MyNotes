"use client"

import { useStore } from "@/lib/store"
import { motion, useDragControls } from "framer-motion"
import { Play, Pause, Maximize2, X, GripHorizontal } from "lucide-react"
import { useRef, useEffect, useState } from "react"

export function FloatingTimer() {
    const [mounted, setMounted] = useState(false)
    const timer = useStore(state => state.timer)
    const setTimer = useStore(state => state.setTimer)
    const containerRef = useRef<HTMLDivElement>(null)
    const dragControls = useDragControls()
    const [isResizing, setIsResizing] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !timer || !timer.isFloating) return null

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const handleStartPause = () => {
        if (timer.isActive) {
            setTimer({ isActive: false, targetTimestamp: undefined })
        } else {
            setTimer({ isActive: true })
        }
    }

    const handleRestore = () => {
        setTimer({ isFloating: false })
    }

    // Default values if missing from persisted state
    const size = {
        width: timer?.size?.width ?? 180,
        height: timer?.size?.height ?? 180
    }
    const position = {
        x: timer?.position?.x ?? 0,
        y: timer?.position?.y ?? 0
    }
    const timeLeft = timer?.timeLeft ?? (25 * 60)

    // Resize logic
    const onResizeStart = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)

        const startX = e.clientX
        const startY = e.clientY
        const startWidth = size.width
        const startHeight = size.height

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(140, startWidth + (moveEvent.clientX - startX))
            const newHeight = Math.max(140, startHeight + (moveEvent.clientY - startY))
            setTimer({ size: { width: newWidth, height: newHeight } })
        }

        const onMouseUp = () => {
            setIsResizing(false)
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
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
                width: size.width,
                height: size.height,
                x: position.x,
                y: position.y
            }}
            onDragEnd={(_, info) => {
                setTimer({ position: { x: info.point.x, y: info.point.y } })
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
                        title="Restore"
                    >
                        <Maximize2 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => setTimer({ isFloating: false, isActive: false })}
                        className="p-1 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all"
                        title="Close"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Timer Display */}
            <div className="flex flex-col items-center justify-center flex-1 pt-4">
                <div className="text-3xl font-bold font-mono tracking-tighter text-foreground tabular-nums">
                    {formatTime(timeLeft)}
                </div>

                <button
                    onClick={handleStartPause}
                    className={`mt-4 p-3 rounded-full transition-all ${timer.isActive ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
                >
                    {timer.isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
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
