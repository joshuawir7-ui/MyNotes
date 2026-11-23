"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useStore, WidgetSync } from "@/lib/store"
import { useEffect, useState } from "react"
import { LocalNotifications } from "@capacitor/local-notifications"
import { Capacitor } from "@capacitor/core"
import {
    getPhilosophicalQuoteForDate,
    getRandomPhilosophicalQuote,
    shouldSendPhilosophicalQuoteToday,
    type PhilosophicalQuote
} from "@/lib/philosophical-quotes"

export function HabitNotificationToast() {
    const tasks = useStore(state => state.tasks)
    const language = useStore(state => state.language)
    const notificationsEnabled = useStore(state => state.notificationsEnabled)
    const setNotificationsEnabled = useStore(state => state.setNotificationsEnabled)
    const notificationPromptStatus = useStore(state => state.notificationPromptStatus)
    const handleNotificationPromptResponse = useStore(state => state.handleNotificationPromptResponse)
    const inAppNotificationDates = useStore(state => state.inAppNotificationDates)
    const addInAppNotificationDate = useStore(state => state.addInAppNotificationDate)
    const philosophicalQuotesEnabled = useStore(state => state.philosophicalQuotesEnabled)

    const [shouldShow, setShouldShow] = useState(false)
    const [toggleActive, setToggleActive] = useState(false)
    const [activeQuote, setActiveQuote] = useState<PhilosophicalQuote | null>(null)

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

        let dismissTimer: ReturnType<typeof setTimeout> | null = null;
        // Delay show a bit after app open so it feels organic
        const showTimer = setTimeout(() => {
            setToggleActive(false)
            setShouldShow(true)
            addInAppNotificationDate()

            dismissTimer = setTimeout(() => {
                setShouldShow(false)
            }, 12000)
        }, 3000)

        return () => {
            clearTimeout(showTimer)
            if (dismissTimer) clearTimeout(dismissTimer)
        }
    }, [notificationsEnabled, notificationPromptStatus, inAppNotificationDates, tasks, addInAppNotificationDate])

    // Allow Settings (or tests) to manually trigger this notification prompt card
    useEffect(() => {
        const handleManualPrompt = () => {
            setToggleActive(notificationPromptStatus === 'accepted')
            setShouldShow(true)
        }
        window.addEventListener('mynotes:show-notification-prompt', handleManualPrompt)
        return () => window.removeEventListener('mynotes:show-notification-prompt', handleManualPrompt)
    }, [notificationPromptStatus])

    // Show occasional-day philosophical discipline quote in-app (Dancing Script)
    useEffect(() => {
        if (!notificationsEnabled || !philosophicalQuotesEnabled) return;

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const storageKey = `mynotes_last_quote_shown_date`;

        if (shouldSendPhilosophicalQuoteToday(now)) {
            const lastShown = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
            if (lastShown !== todayStr) {
                const quoteTimer = setTimeout(() => {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(storageKey, todayStr);
                    }
                    setActiveQuote(getPhilosophicalQuoteForDate(now));
                }, 4500);
                return () => clearTimeout(quoteTimer);
            }
        }
    }, [notificationsEnabled, philosophicalQuotesEnabled])

    // Listen for manual philosophical quote preview from Settings
    useEffect(() => {
        const handleManualQuote = () => {
            setActiveQuote(getRandomPhilosophicalQuote());
        };
        window.addEventListener('mynotes:show-philosophical-quote', handleManualQuote);
        return () => window.removeEventListener('mynotes:show-philosophical-quote', handleManualQuote);
    }, []);

    // Auto-dismiss philosophical quote banner after 12s
    useEffect(() => {
        if (!activeQuote) return;
        const t = setTimeout(() => setActiveQuote(null), 12000);
        return () => clearTimeout(t);
    }, [activeQuote]);

    const handleClick = async () => {
        setToggleActive(true)
        setTimeout(() => setShouldShow(false), 260)

        try {
            if (Capacitor.isNativePlatform()) {
                const perm = await LocalNotifications.requestPermissions();
                const nativeRes = await WidgetSync.requestNotificationPermission() as { granted?: boolean } | void;
                const granted = perm.display === 'granted' || (nativeRes && nativeRes.granted === true);

                if (granted) {
                    setNotificationsEnabled(true);
                    handleNotificationPromptResponse('accepted');
                } else {
                    // System denied or permanently blocked -> open Android app notification settings
                    await WidgetSync.openAppSettings();
                }
            } else {
                await WidgetSync.requestNotificationPermission();
                if ("Notification" in window) {
                    if (Notification.permission === 'default') {
                        const result = await Notification.requestPermission();
                        if (result === 'granted') {
                            setNotificationsEnabled(true);
                            handleNotificationPromptResponse('accepted');
                        }
                    } else if (Notification.permission === 'granted') {
                        setNotificationsEnabled(true);
                        handleNotificationPromptResponse('accepted');
                    } else if (Notification.permission === 'denied') {
                        await WidgetSync.openAppSettings();
                    }
                }
            }
        } catch (err) {
            console.error("No se pudo pedir permiso o abrir la configuración:", err)
        }
    }

    const isEs = language === 'es' || (language as string) === 'es-419';

    return (
        <>
            <AnimatePresence>
                {shouldShow && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        drag="x"
                        dragConstraints={{ left: -100, right: 100 }}
                        onDragEnd={(_, info) => {
                            if (Math.abs(info.offset.x) > 50) {
                                setShouldShow(false)
                            }
                        }}
                        className="fixed top-safe mt-16 left-4 right-4 z-[70] mx-auto max-w-md cursor-pointer select-none"
                        style={{ top: 'env(safe-area-inset-top)' }}
                    >
                        <div
                            onClick={handleClick}
                            className="bg-white dark:bg-[#161618] px-6 py-5 rounded-[28px] shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.55)] border border-black/10 dark:border-white/15 flex items-center justify-between gap-4"
                        >
                            {/* Left content */}
                            <div className="flex flex-col flex-1 text-left min-w-0">
                                <h3 className="font-dancing-n text-[28px] leading-none text-black dark:text-white tracking-wide">
                                    {isEs ? "notificaciones" : "notifications"}
                                </h3>
                                <div className="h-[1px] w-full bg-black/80 dark:bg-white/60 mt-1.5 mb-2.5" />
                                <p className="text-black/85 dark:text-white/85 text-[13px] leading-snug font-normal">
                                    {isEs
                                        ? "¿Le gustaría recibir recordatorios de eventos y hábitos?, incluso completar hábitos sin abrir la app"
                                        : "Would you like to receive reminders for events and habits?, even complete habits without opening the app"}
                                </p>
                                <p className="text-black dark:text-white text-[13px] font-bold mt-1.5">
                                    {isEs ? "Active las notificaciones de Mynotes" : "Enable Mynotes notifications"}
                                </p>
                            </div>

                            {/* Right pill toggle switch + light-mode-only bottom shadow */}
                            <div className="flex flex-col items-center justify-center flex-shrink-0 pl-1">
                                <div
                                    className={`relative w-[60px] h-[34px] rounded-full p-1 transition-colors duration-200 flex items-center bg-black dark:bg-white`}
                                >
                                    <motion.div
                                        animate={{ x: toggleActive ? 26 : 26 }}
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        className="w-[26px] h-[26px] rounded-full bg-white dark:bg-black"
                                    />
                                </div>
                                {/* Subtle shadow ONLY in light mode, hidden in dark mode */}
                                <div className="w-11 h-2 mt-2 rounded-full bg-black/20 blur-[4px] dark:hidden pointer-events-none" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Philosophical discipline quote in-app toast (Dancing Script) */}
            <AnimatePresence>
                {activeQuote && !shouldShow && (
                    <motion.div
                        initial={{ opacity: 0, y: -40, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        drag="x"
                        dragConstraints={{ left: -100, right: 100 }}
                        onDragEnd={(_, info) => {
                            if (Math.abs(info.offset.x) > 50) setActiveQuote(null)
                        }}
                        onClick={() => setActiveQuote(null)}
                        className="fixed left-4 right-4 z-[65] mx-auto max-w-md mt-16 cursor-pointer select-none"
                        style={{ top: 'env(safe-area-inset-top)' }}
                    >
                        <div className="bg-white dark:bg-[#161618] px-6 py-5 rounded-[28px] shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.55)] border border-black/10 dark:border-white/15">
                            <p className="font-dancing-n text-[22px] leading-snug text-black dark:text-white text-center">
                                &ldquo;{isEs ? activeQuote.es : activeQuote.en}&rdquo;
                            </p>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-black/50 dark:text-white/50 text-center mt-2">
                                — {activeQuote.author}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
