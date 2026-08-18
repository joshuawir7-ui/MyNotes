"use client"

import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface ConfirmationDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: "danger" | "primary"
}

export function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel,
    cancelLabel,
    variant = "danger"
}: ConfirmationDialogProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isOpen && typeof window !== 'undefined') {
            try {
                window.getSelection()?.removeAllRanges()
            } catch (e) {
                console.error("Failed to clear text selection in dialog", e)
            }
        }
    }, [isOpen])

    if (!mounted) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.93, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        className="bg-white/95 dark:bg-zinc-950/90 backdrop-blur-2xl w-full max-w-sm p-6 sm:p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative z-10 overflow-hidden"
                    >
                        {/* Ambient Glows */}
                        <div className={`absolute -top-12 -left-12 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-40 dark:opacity-60
                            ${variant === "danger" ? "bg-red-500" : "bg-indigo-500"}`} />
                        <div className={`absolute -bottom-12 -right-12 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-40 dark:opacity-60
                            ${variant === "danger" ? "bg-rose-500" : "bg-purple-500"}`} />

                        <button
                            onClick={onClose}
                            className="absolute top-5 right-5 p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all z-20"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col items-center text-center relative z-10 pt-2">
                            <motion.div 
                                initial={{ scale: 0.8, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", delay: 0.05, stiffness: 300, damping: 15 }}
                                className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center mb-5 border shadow-inner relative
                                    ${variant === "danger" 
                                        ? "bg-gradient-to-tr from-red-500/20 to-rose-500/10 border-red-500/20 text-red-500 shadow-red-500/10" 
                                        : "bg-gradient-to-tr from-indigo-500/20 to-purple-500/10 border-indigo-500/20 text-indigo-500 shadow-indigo-500/10"}`}
                            >
                                <AlertCircle className="w-8 h-8" />
                                {/* Pulsing Ring */}
                                <motion.div 
                                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    className={`absolute inset-0 rounded-[1.25rem] border ${variant === "danger" ? "border-red-500/30" : "border-indigo-500/30"}`}
                                />
                            </motion.div>

                            <h2 className="text-xl font-bold mb-3 tracking-tight text-foreground">{title}</h2>
                            <p className="text-muted-foreground text-sm mb-6 px-2 leading-relaxed">
                                {message}
                            </p>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-black/5 dark:bg-white/5 rounded-2xl font-bold text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all text-foreground hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {cancelLabel || "Cancelar"}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm()
                                        onClose()
                                    }}
                                    className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]
                                        ${variant === "danger"
                                            ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-red-500/20 hover:shadow-red-500/30"
                                            : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/20 hover:shadow-indigo-500/30"}`}
                                >
                                    {confirmLabel || "Confirmar"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
