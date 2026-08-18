"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useStore, WidgetSync } from "@/lib/store"
import { useEffect, useState } from "react"
import { Bell } from "lucide-react"

export function HabitNotificationPrompt() {
    const tasks = useStore(state => state.tasks)
    const appOpenCount = useStore(state => state.appOpenCount)
    const notificationPromptStatus = useStore(state => state.notificationPromptStatus)
    const notificationPromptLastRejected = useStore(state => state.notificationPromptLastRejected)
    const handleNotificationPromptResponse = useStore(state => state.handleNotificationPromptResponse)
    
    const [shouldShow, setShouldShow] = useState(false)

    useEffect(() => {
        // Wait a small delay before showing to not bombard the user instantly on load
        const timer = setTimeout(() => {
            const hasHabits = tasks.some(t => t.recurrence === 'Daily')
            const isPending = notificationPromptStatus === 'pending'
            const isRejected = notificationPromptStatus === 'rejected'
            
            // Show if it's pending AND (app opened at least twice OR they have created a habit)
            const shouldShowFirstTime = isPending && (appOpenCount >= 2 || hasHabits)
            
            // Show again after a week if they rejected it previously
            const shouldShowAgain = isRejected && notificationPromptLastRejected && 
                (Date.now() - notificationPromptLastRejected > 7 * 24 * 60 * 60 * 1000)

            if (shouldShowFirstTime || shouldShowAgain) {
                setShouldShow(true)
            }
        }, 1500)

        return () => clearTimeout(timer)
    }, [tasks, appOpenCount, notificationPromptStatus, notificationPromptLastRejected])

    const handleAllow = async () => {
        setShouldShow(false)
        handleNotificationPromptResponse('accepted')

        try {
            // This invokes the native Android popup if needed
            await WidgetSync.requestNotificationPermission()

            // If we are somewhat sure they denied it via navigator, fall back to Settings.
            if ("Notification" in window && Notification.permission === 'denied') {
                await WidgetSync.openAppSettings()
            }
        } catch (err) {
            console.error("No se pudo pedir permiso o abrir configuracion:", err)
        }
    }

    const handleReject = () => {
        setShouldShow(false)
        handleNotificationPromptResponse('rejected')
    }

    return (
        <AnimatePresence>
            {shouldShow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={handleReject}
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-[32px] p-6 shadow-2xl flex flex-col items-center text-center overflow-hidden"
                    >
                        <div className="relative mb-6">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center shadow-inner">
                                <Bell className="w-7 h-7 text-[#00C853] fill-[#00C853]/10" />
                            </div>
                            <div className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-[#1C1C1E] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                                1
                            </div>
                        </div>

                        <h2 className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight mb-3">
                            ¿Le gustaría completar sus habitos sin la necesidad de abrir la aplicación?
                        </h2>
                        
                        <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-8 px-2">
                            Permítanos enviarle notificaciones interactivas para que con solo un clic, pueda completar sus habitos y recordar siempre lo que debe hacer
                        </p>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={handleReject}
                                className="flex-1 py-3.5 px-4 rounded-xl border-2 border-gray-100 dark:border-white/10 text-gray-500 dark:text-gray-300 font-bold active:scale-95 transition-all text-sm"
                            >
                                No estoy segur@
                            </button>
                            <button
                                onClick={handleAllow}
                                className="flex-1 py-3.5 px-4 rounded-xl bg-[#00C853] text-white font-bold active:scale-95 transition-all shadow-lg shadow-green-500/20 text-sm"
                            >
                                Permitir
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
