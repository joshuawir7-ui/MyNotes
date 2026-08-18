"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react"

interface NotificationDialogProps {
    isOpen: boolean
    onClose: () => void
    title: string
    message: string
    type?: "success" | "error" | "warning" | "info"
    confirmLabel?: string
}

export function NotificationDialog({
    isOpen,
    onClose,
    title,
    message,
    type = "info",
    confirmLabel = "OK"
}: NotificationDialogProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose()
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [isOpen, onClose])
    const iconConfig = {
        success: {
            icon: CheckCircle2,
            bgColor: "bg-green-500/10 dark:bg-green-500/20",
            textColor: "text-green-500 dark:text-green-400",
            glowColor: "shadow-green-500/20"
        },
        error: {
            icon: AlertCircle,
            bgColor: "bg-red-500/10 dark:bg-red-500/20",
            textColor: "text-red-500 dark:text-red-400",
            glowColor: "shadow-red-500/20"
        },
        warning: {
            icon: AlertTriangle,
            bgColor: "bg-yellow-500/10 dark:bg-yellow-500/20",
            textColor: "text-yellow-500 dark:text-yellow-400",
            glowColor: "shadow-yellow-500/20"
        },
        info: {
            icon: Info,
            bgColor: "bg-primary/10 dark:bg-primary/20",
            textColor: "text-primary dark:text-purple-400",
            glowColor: "shadow-primary/20"
        }
    }[type]

    const Icon = iconConfig.icon

    if (!mounted) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Dialog Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="glass-panel w-full max-w-sm p-6 rounded-[32px] border border-black/5 dark:border-white/10 shadow-2xl relative z-10 bg-white/95 dark:bg-[#0a0a0a]/95 overflow-hidden"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all active:scale-90"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col items-center text-center mt-2">
                            {/* Animated Icon Container */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${iconConfig.bgColor} ${iconConfig.textColor} ${iconConfig.glowColor}`}
                            >
                                <Icon className="w-7 h-7" />
                            </motion.div>

                            <h2 className="text-xl font-bold mb-2 tracking-tight text-foreground">{title}</h2>
                            <p className="text-muted-foreground text-sm mb-6 leading-relaxed px-2 select-text">
                                {message}
                            </p>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onClose}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm transition-all shadow-lg hover:bg-primary/95 active:scale-95 shadow-primary/20"
                            >
                                {confirmLabel}
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
