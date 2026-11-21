"use client"

import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useDeferredBlur } from "@/hooks/use-deferred-blur"

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
    const scrimBlur = useDeferredBlur(isOpen)

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
                        className={`absolute inset-0 bg-black/70 ${scrimBlur ? "backdrop-blur-sm" : ""}`}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.93, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        className="bg-white/95 dark:bg-zinc-950/90 backdrop-blur-2xl w-full max-w-sm p-6 sm:p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative z-10 overflow-hidden"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-5 right-5 p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all z-20"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col items-center text-center relative z-10 pt-2">
                            <motion.div
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", delay: 0.04, stiffness: 300, damping: 18 }}
                                className="mb-4 text-zinc-900 dark:text-white"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-11 h-11"
                                >
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                </svg>
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
