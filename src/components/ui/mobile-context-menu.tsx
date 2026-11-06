"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Trash2, Edit2, Pin } from "lucide-react"
import { GlassSurface } from "@/components/ui/glass-surface"
import { useStore } from "@/lib/store"

interface MobileContextMenuProps {
    onEdit?: () => void
    onDelete: () => void
    onTogglePin?: () => void
    isPinned?: boolean
    children: React.ReactNode
    title?: string
}

export function MobileContextMenu({ onEdit, onDelete, onTogglePin, isPinned, children, title }: MobileContextMenuProps) {
    const appColor = useStore(state => state.appColor ?? 'purple')
    const [isOpen, setIsOpen] = useState(false)
    const longPressTimer = useRef<NodeJS.Timeout | null>(null)
    const [isLongPressing, setIsLongPressing] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current)
            }
        }
    }, [])

    useEffect(() => {
        if (isOpen && typeof window !== 'undefined') {
            try {
                window.getSelection()?.removeAllRanges()
            } catch (e) {
                console.error("Failed to clear text selection", e)
            }
        }
    }, [isOpen])

    const touchStartPos = useRef<{ x: number, y: number } | null>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length > 0) {
            touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }
        if (longPressTimer.current) clearTimeout(longPressTimer.current)
        longPressTimer.current = setTimeout(() => {
            setIsOpen(true)
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                    navigator.vibrate(50)
                } catch (e) { }
            }
        }, 550)
    }

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
        touchStartPos.current = null
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (longPressTimer.current && touchStartPos.current && e.touches.length > 0) {
            const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x)
            const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y)
            if (dx > 10 || dy > 10) {
                clearTimeout(longPressTimer.current)
                longPressTimer.current = null
            }
        }
    }

    return (
        <div
            className="relative w-full h-full"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => {
                e.preventDefault()
                setIsOpen(true)
            }}
        >
            {children}

            {mounted && isOpen && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="glass-scrim--light z-[999]"
                            />
                            <GlassSurface
                                as={motion.div}
                                variant="sheet-action"
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto rounded-t-3xl z-[1000] text-foreground"
                                style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}
                            >
                                <div className="p-6 pb-10">
                                    <div className="w-12 h-1.5 bg-black/15 dark:bg-white/15 rounded-full mx-auto mb-6" />

                                    {title && (
                                        <h3 className="text-lg font-bold mb-6 text-center px-4">{title}</h3>
                                    )}

                                    <div className="flex flex-col gap-3">
                                        {onEdit && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onEdit()
                                                    setIsOpen(false)
                                                }}
                                                className="flex items-center gap-4 p-4 rounded-2xl glass-card hover:bg-white/80 dark:hover:bg-white/10 transition-colors text-left w-full pl-5"
                                            >
                                                <div className="w-6 flex items-center justify-center shrink-0">
                                                    <Edit2 className={`w-5 h-5 ${
                                                        appColor === 'black'
                                                            ? 'text-zinc-900 dark:text-zinc-100'
                                                            : 'text-purple-600 dark:text-purple-400'
                                                    }`} />
                                                </div>
                                                <span className="font-semibold text-lg">Editar</span>
                                            </button>
                                        )}

                                        {onTogglePin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onTogglePin()
                                                    setIsOpen(false)
                                                }}
                                                className="flex items-center gap-4 p-4 rounded-2xl glass-card hover:bg-white/80 dark:hover:bg-white/10 transition-colors text-left w-full pl-5"
                                            >
                                                <div className="w-6 flex items-center justify-center shrink-0">
                                                    <Pin className={`w-5 h-5 ${isPinned ? 'fill-current' : ''} ${
                                                        appColor === 'black'
                                                            ? 'text-zinc-900 dark:text-zinc-100'
                                                            : 'text-zinc-700 dark:text-zinc-300'
                                                    }`} />
                                                </div>
                                                <span className="font-semibold text-lg">{isPinned ? 'Desfijar' : 'Fijar'}</span>
                                            </button>
                                        )}

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete()
                                                setIsOpen(false)
                                            }}
                                            className="flex items-center gap-4 p-4 rounded-2xl glass-card hover:bg-white/80 dark:hover:bg-white/10 transition-colors text-left w-full pl-5"
                                        >
                                            <div className="w-6 flex items-center justify-center shrink-0">
                                                <Trash2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                                            </div>
                                            <span className="font-semibold text-lg text-red-500 dark:text-red-400">Eliminar</span>
                                        </button>

                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="mt-2 flex items-center justify-center gap-2 p-4 rounded-2xl glass-card font-bold w-full transition-colors hover:bg-white/80 dark:hover:bg-white/10"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </GlassSurface>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}
