"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Trash2, Edit2, Pin } from "lucide-react"

interface MobileContextMenuProps {
    onEdit?: () => void
    onDelete: () => void
    onTogglePin?: () => void
    isPinned?: boolean
    children: React.ReactNode
    title?: string
}

export function MobileContextMenu({ onEdit, onDelete, onTogglePin, isPinned, children, title }: MobileContextMenuProps) {
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

    const handleTouchStart = () => {
        setIsLongPressing(false)
        longPressTimer.current = setTimeout(() => {
            setIsLongPressing(true)
            setIsOpen(true)
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                    navigator.vibrate(50) // Haptic feedback
                } catch (e) {
                    // Ignore haptic feedback errors
                }
            }
        }, 600) // 600ms for long press
    }

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    const handleTouchMove = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
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

            {mounted && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 bg-black/60 z-[999]"
                                style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                            />
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-card/95 border-t border-white/10 rounded-t-3xl p-6 pb-10 z-[1000] shadow-2xl text-foreground"
                                style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
                            >
                                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

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
                                            className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left w-full"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                <Edit2 className="w-5 h-5" />
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
                                            className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left w-full"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-zinc-500/20 flex items-center justify-center text-zinc-400">
                                                <Pin className={`w-5 h-5 ${isPinned ? 'fill-current' : ''}`} />
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
                                        className="flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 transition-colors text-left w-full"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                                            <Trash2 className="w-5 h-5" />
                                        </div>
                                        <span className="font-semibold text-lg text-red-400">Eliminar</span>
                                    </button>

                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="mt-2 flex items-center justify-center gap-2 p-4 rounded-2xl border border-white/10 font-bold w-full transition-colors hover:bg-white/5"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}
