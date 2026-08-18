"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useStore } from "@/lib/store"
import { Check, AlertCircle, Info, AlertTriangle } from "lucide-react"

export function GlassToast() {
    const toast = useStore(state => state.toast)
    const clearToast = useStore(state => state.clearToast)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (toast) {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
            timerRef.current = setTimeout(() => {
                clearToast()
            }, 2500) // 2.5 seconds duration as requested
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
        }
    }, [toast, clearToast])

    const iconMap = {
        success: <Check className="w-4 h-4 text-emerald-400" />,
        error: <AlertCircle className="w-4 h-4 text-rose-400" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        info: <Info className="w-4 h-4 text-sky-400" />
    }

    if (!mounted) return null

    return createPortal(
        <AnimatePresence>
            {toast && (
                <div className="fixed top-24 left-0 right-0 z-[300000] flex justify-center pointer-events-none px-4">
                    <motion.div
                        initial={{ opacity: 0, y: -40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.15 } }}
                        transition={{ type: "spring", damping: 22, stiffness: 350 }}
                        className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full bg-white/15 dark:bg-black/25 border border-white/20 dark:border-white/10 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.15)] shadow-purple-500/5 backdrop-blur-[25px] max-w-sm sm:max-w-md select-none relative overflow-hidden"
                        style={{
                            WebkitBackdropFilter: "blur(25px)",
                            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.25)"
                        }}
                    >
                        {/* Organic reflection highlight */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none" />
                        
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 dark:bg-white/5 border border-white/15 shrink-0">
                            {iconMap[toast.type] || iconMap.info}
                        </div>
                        <span className="text-sm font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 pr-1">
                            {toast.message}
                        </span>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
