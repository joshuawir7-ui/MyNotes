"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useStore, WidgetSync } from "@/lib/store"
import { useEffect, useState } from "react"

export function HabitNotificationToast() {
    const tasks = useStore(state => state.tasks)
    const notificationsEnabled = useStore(state => state.notificationsEnabled)
    const notificationPromptStatus = useStore(state => state.notificationPromptStatus)
    const inAppNotificationDates = useStore(state => state.inAppNotificationDates)
    const addInAppNotificationDate = useStore(state => state.addInAppNotificationDate)
    
    const [shouldShow, setShouldShow] = useState(false)

    useEffect(() => {
        // Only show if global notifications are supposedly enabled in our logic 
        // but haven't been 'accepted' natively yet, ensuring they see this reminder
        if (!notificationsEnabled || notificationPromptStatus === 'accepted') {
            return;
        }

        const hasHabits = tasks.some(t => t.recurrence === 'Daily')
        if (!hasHabits) return;

        // Check if we already showed it 3 times within the last 7 days
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const recentDates = (inAppNotificationDates || []).filter(d => d > oneWeekAgo);

        if (recentDates.length >= 3) {
            return; // Reached max weekly limit
        }

        // Delay show a bit after app open so it feels organic
        const showTimer = setTimeout(() => {
            setShouldShow(true)
            addInAppNotificationDate()

            // Auto dismiss after 10 seconds
            setTimeout(() => {
                setShouldShow(false)
            }, 10000)

        }, 3000)

        return () => clearTimeout(showTimer)
    }, [notificationsEnabled, notificationPromptStatus, inAppNotificationDates, tasks, addInAppNotificationDate])

    const handleClick = async () => {
        setShouldShow(false)
        try {
            await WidgetSync.requestNotificationPermission()

            if ("Notification" in window && Notification.permission === 'denied') {
                await WidgetSync.openAppSettings()
            }
        } catch (err) {
            console.error("No se pudo pedir permiso o abrir la configuración:", err)
        }
    }

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{ opacity: 0, y: -50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    drag="x"
                    dragConstraints={{ left: -100, right: 100 }}
                    onDragEnd={(e, info) => {
                        if (Math.abs(info.offset.x) > 50) {
                            setShouldShow(false)
                        }
                    }}
                    className="fixed top-bezpiecznej_obszarze mt-20 left-4 right-4 z-[60] mx-auto max-w-md cursor-grab active:cursor-grabbing"
                    style={{ y: 'env(safe-area-inset-top)' }}
                >
                    <div 
                        onClick={handleClick}
                        className="bg-white dark:bg-[#1C1C1E] p-6 rounded-[28px] shadow-xl flex items-center justify-between border border-gray-200 dark:border-white/10"
                    >
                        <div className="flex flex-col flex-1 pr-2 text-left">
                            <h3 className="font-bold text-black dark:text-white text-xl tracking-tight mb-1.5">Activar Notificaciones</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-[13px] leading-snug font-normal">Para recibir recordatorios de tus tareas y hábitos por hacer al día, incluso frases filosóficas</p>
                        </div>
                        
                        <div className="relative flex-shrink-0 w-20 h-20 ml-2">
                            <img 
                                src="/images/bell.png" 
                                alt="Bell" 
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
