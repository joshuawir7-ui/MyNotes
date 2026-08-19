"use client"

import dynamic from "next/dynamic"
const AppSidebar = dynamic(() => import("@/components/layout/app-sidebar").then(mod => mod.AppSidebar), { ssr: false })
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { translations } from "@/lib/translations"
import { useStore, WidgetSync, syncWidgetData } from "@/lib/store"
import { useEffect } from "react"
import { useTheme } from "next-themes"
import { FloatingTimer } from "@/components/dashboard/floating-timer"
import { HabitNotificationToast } from "@/components/ui/habit-notification-toast"
import { CelebrationModal } from "@/components/ui/celebration-modal"
import { GlassToast } from "@/components/ui/glass-toast"
import { CloudPrompt } from "@/components/ui/cloud-prompt"
import { SyncConflictDialog } from "@/components/ui/sync-conflict-dialog"
import { MIUIOnboardingDialog } from "@/components/ui/miui-onboarding"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useRef } from "react"
import { X, Sparkles } from "lucide-react"
import { App as CapacitorApp } from "@capacitor/app"
import { useRouter } from "next/navigation"
import { NotificationManager } from "@/lib/notifications"
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform();

const TourArrow = ({ targetId, startRef }: { targetId: string, startRef: React.RefObject<HTMLDivElement | null> }) => {
    const [path, setPath] = useState<string>("");

    useEffect(() => {
        const updatePath = () => {
            let activeTargetId = targetId;
            if (targetId.startsWith("nav-item-tasks")) {
                activeTargetId = window.innerWidth < 768 ? "nav-item-tasks" : "nav-item-tasks-desktop";
            }
            const targetEl = document.getElementById(activeTargetId);
            const startEl = startRef.current;
            if (!targetEl || !startEl) return;

            const targetRect = targetEl.getBoundingClientRect();
            const startRect = startEl.getBoundingClientRect();

            let x1 = startRect.left + startRect.width / 2;
            let y1 = startRect.bottom;

            let x2 = targetRect.left + targetRect.width / 2;
            let y2 = targetRect.top;

            if (targetRect.left < startRect.left) {
                // Target is to the left of the start element
                x1 = startRect.left;
                y1 = startRect.top + startRect.height / 2;
                x2 = targetRect.right + 12; // offset a bit into the element
                y2 = targetRect.top + targetRect.height / 2;
            } else if (targetRect.left > startRect.right) {
                // Target is to the right of the start element
                x1 = startRect.right;
                y1 = startRect.top + startRect.height / 2;
                x2 = targetRect.left - 12;
                y2 = targetRect.top + targetRect.height / 2;
            }

            const dx = x2 - x1;
            const dy = y2 - y1;
            let d;

            if (Math.abs(dx) > Math.abs(dy)) {
                const controlX = x1 + dx * 0.5;
                d = `M ${x1} ${y1} C ${controlX} ${y1}, ${controlX} ${y2}, ${x2} ${y2}`;
            } else {
                const controlY = y1 + dy * 0.5;
                d = `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;
            }
            setPath(d);
        };

        updatePath();
        window.addEventListener('resize', updatePath);
        window.addEventListener('scroll', updatePath);
        
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                updatePath()
            }
        }, 250);

        return () => {
            window.removeEventListener('resize', updatePath);
            window.removeEventListener('scroll', updatePath);
            clearInterval(interval);
        };
    }, [targetId, startRef]);

    if (!path) return null;

    return (
        <svg className="fixed inset-0 pointer-events-none z-[10000] w-full h-full">
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="10"
                    refX="6"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                >
                    <path d="M0,0 L0,6 L9,3 Z" fill="#8b5cf6" />
                </marker>
            </defs>
            <path
                d={path}
                stroke="#8b5cf6"
                strokeWidth="3"
                strokeDasharray="6 6"
                fill="none"
                markerEnd="url(#arrowhead)"
                className="animate-[dash_2s_linear_infinite]"
            />
            <style>{`
                @keyframes dash {
                    to {
                        stroke-dashoffset: -20;
                    }
                }
            `}</style>
        </svg>
    );
};

export default function Layout({ children }: { children: React.ReactNode }) {
    const timerIsActive = useStore(state => state.timer?.isActive)
    const timerTargetTimestamp = useStore(state => state.timer?.targetTimestamp)
    const setTimer = useStore(state => state.setTimer)
    const language = useStore(state => state.language)
    const { theme, resolvedTheme } = useTheme()

    useEffect(() => {
        if (isNative) {
            syncWidgetData(undefined, undefined, undefined, undefined, true).catch(console.error);
        }
    }, [theme, resolvedTheme]);
    
    // Tour state & actions
    const tourStep = useStore(state => state.tourStep)
    const tourCompleted = useStore(state => state.tourCompleted)
    const isTourManuallyStarted = useStore(state => state.isTourManuallyStarted)
    const startTour = useStore(state => state.startTour)
    const startTourManually = useStore(state => state.startTourManually)
    const nextTourStep = useStore(state => state.nextTourStep)
    const endTour = useStore(state => state.endTour)
    const appOpenCount = useStore(state => state.appOpenCount)
    const isHydrated = useStore(state => state.isHydrated)
    
    const welcomeModalRef = useRef<HTMLDivElement>(null)
    const [logoType, setLogoType] = useState<'text' | 'image'>('text')
    const router = useRouter()

    const [showQuote, setShowQuote] = useState(true)
    const [randomQuote, setRandomQuote] = useState<{ quote: string; author: string }>({ quote: "", author: "" })
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])
    const quoteTimerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (tourStep === 0) {
            setShowQuote(true);
            const bestQuotes = [
                { quote: "Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un hábito.", author: "Aristóteles" },
                { quote: "No es que tengamos poco tiempo, sino que perdemos mucho.", author: "Séneca" },
                { quote: "El hombre que mueve montañas comienza apartando piedrecitas.", author: "Confucio" },
                { quote: "El secreto de avanzar es empezar.", author: "Mark Twain" },
                { quote: "La disciplina es el puente entre las metas y los logros.", author: "Jim Rohn" },
                { quote: "Cree que puedes y estarás a mitad del camino.", author: "Theodore Roosevelt" },
                { quote: "La motivación nos impulsa a comenzar, el hábito nos permite continuar.", author: "Jim Ryun" },
                { quote: "Aquel que conquista a otros es fuerte; aquel que se conquista a sí mismo es poderoso.", author: "Lao Tsé" },
                { quote: "Nuestra mayor gloria no está en no caer nunca, sino en levantarnos cada vez que caemos.", author: "Confucio" },
                { quote: "No limites tus desafíos, desafía tus límites.", author: "Anónimo" },
                { quote: "La voluntad es el único músculo que se hace más fuerte con la fatiga.", author: "Anónimo" },
                { quote: "La primera y mejor victoria es conquistarse a uno mismo.", author: "Platón" }
            ];
            const selected = bestQuotes[Math.floor(Math.random() * bestQuotes.length)];
            setRandomQuote(selected);

            if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
            quoteTimerRef.current = setTimeout(() => {
                setShowQuote(false);
            }, 7000);
        }
        return () => {
            if (quoteTimerRef.current) {
                clearTimeout(quoteTimerRef.current);
            }
        };
    }, [tourStep]);

    const handleQuoteSkip = () => {
        if (quoteTimerRef.current) {
            clearTimeout(quoteTimerRef.current);
            quoteTimerRef.current = null;
        }
        setShowQuote(false);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                setLogoType(prev => prev === 'text' ? 'image' : 'text')
            }
        }, 8000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        let interval: NodeJS.Timeout

        const updateTimer = () => {
            const currentTimer = useStore.getState().timer
            const isActive = currentTimer?.isActive
            const targetTimestamp = currentTimer?.targetTimestamp
            const timeLeft = currentTimer?.timeLeft

            if (isActive && targetTimestamp) {
                const now = Date.now()
                const remaining = Math.max(0, Math.ceil((targetTimestamp - now) / 1000))

                if (remaining === 0) {
                    setTimer({ isActive: false, targetTimestamp: undefined, timeLeft: 0 })
                    playAlarm()
                } else if (remaining !== timeLeft) {
                    if (document.visibilityState === 'visible') {
                        setTimer({ timeLeft: remaining })
                    }
                }
            }
        }

        const playAlarm = () => {
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("MyNotes", {
                    body: language === 'es' ? "¡El tiempo de enfoque ha terminado!" : "Focus time is over!",
                    icon: "/favicon.ico"
                })
            }

            try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
                const oscillator = audioCtx.createOscillator()
                const gainNode = audioCtx.createGain()

                oscillator.connect(gainNode)
                gainNode.connect(audioCtx.destination)

                oscillator.type = 'sine'
                oscillator.frequency.setValueAtTime(440, audioCtx.currentTime)
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)

                oscillator.start()
                oscillator.stop(audioCtx.currentTime + 0.5)
            } catch (e) {
                console.error("Audio fails", e)
                alert(language === 'es' ? "⏰ ¡Tiempo agotado! Tu sesión de enfoque ha terminado." : "⏰ Time's up! Your focus session has ended.")
            }
        }

        if (timerIsActive) {
            updateTimer() // Initial check
            interval = setInterval(updateTimer, 1000)
        }

        // Sync instantly when tab becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateTimer()
                useStore.getState().pullOfflineCompletedTasks()
                useStore.getState().pullOfflineNotes()
                useStore.getState().pullOfflineAppointments()
                useStore.getState().checkHabitStreaks()
                useStore.getState().syncHabitsNotification()

                // Auto-sync with Google Drive
                const state = useStore.getState();
                if (state.googleUser && !state.googleSessionExpired) {
                    import('../../lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        let stateListener: any;
        if (CapacitorApp && typeof CapacitorApp.addListener === 'function') {
            CapacitorApp.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    handleVisibilityChange();
                } else {
                    const state = useStore.getState();
                    if (state.googleUser && !state.googleSessionExpired) {
                        console.log("[Background] Instantly syncing with Google Drive on exit...");
                        import('../../lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
                    }
                }
            }).then((l: any) => stateListener = l).catch(console.error);
        }

        // Web periodic sync (every 30 seconds)
        let webSyncInterval: NodeJS.Timeout | undefined;
        if (!Capacitor.isNativePlatform()) {
            webSyncInterval = setInterval(async () => {
                if (document.visibilityState !== 'visible') return;
                const state = useStore.getState();
                if (state.googleUser && !state.googleSessionExpired && !state.isSyncingCloud) {
                    console.log("[Web Sync] Triggering periodic auto-sync...");
                    import('../../lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
                }
            }, 30000);
        }

        return () => {
            clearInterval(interval)
            if (webSyncInterval) {
                clearInterval(webSyncInterval);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            if (stateListener && stateListener.remove) {
                stateListener.remove();
            }
        }
    }, [timerIsActive, timerTargetTimestamp, language, setTimer])

    // Request notification permission and register SW on mount
    useEffect(() => {
        let unsubHydrate: (() => void) | undefined;
        const store = useStore.getState();

        // Immediate: increment open count
        store.incrementAppOpenCount();

        const runIdle = (fn: () => void, timeoutMs: number): (() => void) => {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                const handle = window.requestIdleCallback(fn, { timeout: timeoutMs });
                return () => window.cancelIdleCallback(handle);
            } else {
                const handle = setTimeout(fn, timeoutMs);
                return () => clearTimeout(handle);
            }
        };

        let cancelStage1: (() => void) | undefined;
        let cancelStage2: (() => void) | undefined;
        let cancelStage3: (() => void) | undefined;

        const triggerStartupSync = async () => {
            // Stage 3 (6000ms): Run heavier operations: local filesystem backup and autoSyncGoogleDrive
            cancelStage3 = runIdle(async () => {
                console.log("[Startup] Running Stage 3: Local backup and Google Drive sync");
                // On native (Android), first save locally, then sync cloud
                if (isNative) {
                    try {
                        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
                        const state = useStore.getState();
                        const dataToExport = {
                            notes: state.notes,
                            tasks: state.tasks,
                            goals: state.goals,
                            appointments: state.appointments,
                            projects: state.projects,
                            taskGroups: state.taskGroups,
                            dailySnapshots: state.dailySnapshots,
                            user: state.user
                        };
                        const jsonStr = JSON.stringify(dataToExport);
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        const seconds = String(now.getSeconds()).padStart(2, '0');
                        const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
                        const fileName = `mynotes_auto_backup_${timestamp}.json`;
                        await Filesystem.writeFile({
                            path: fileName,
                            data: jsonStr,
                            directory: Directory.Documents,
                            encoding: Encoding.UTF8
                        });
                        console.log(`[Startup] Local backup saved: ${fileName}`);

                        // Rotate auto-backups, keep only 4 most recent
                        const dirResult = await Filesystem.readdir({ path: '', directory: Directory.Documents });
                        const autoBackupFiles = dirResult.files
                            .map(f => typeof f === 'string' ? f : f.name)
                            .filter(name => name.startsWith('mynotes_auto_backup_') && name.endsWith('.json'))
                            .sort();
                        if (autoBackupFiles.length > 4) {
                            const toDelete = autoBackupFiles.slice(0, autoBackupFiles.length - 4);
                            for (const file of toDelete) {
                                try { await Filesystem.deleteFile({ path: file, directory: Directory.Documents }); } catch (e) { }
                            }
                        }
                    } catch (err) {
                        console.error("[Startup] Local backup failed:", err);
                    }
                }

                // After local save completes (or on web), trigger cloud sync
                const currentStore = useStore.getState();
                if (currentStore.googleUser && !currentStore.googleSessionExpired) {
                    console.log("Startup auto-sync triggered after hydration");
                    import('../../lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
                }
            }, 6000);
        };

        const runStage1And2 = () => {
            // Stage 1 (1000ms): Light local logic (streaks, notifications, reminders)
            cancelStage1 = runIdle(() => {
                console.log("[Startup] Running Stage 1: Habit streaks and reminders");
                const currentStore = useStore.getState();
                currentStore.migrateBase64Images().catch(console.error);
                currentStore.checkHabitStreaks();
                currentStore.syncHabitsNotification();
                currentStore.startTaskGroupReminder();
            }, 1000);

            // Stage 2 (3000ms): Pull widget data (Capacitor plugin calls)
            cancelStage2 = runIdle(async () => {
                console.log("[Startup] Running Stage 2: Pulling offline widget data");
                const currentStore = useStore.getState();
                try {
                    await currentStore.pullOfflineCompletedTasks();
                    await currentStore.pullOfflineNotes();
                    await currentStore.pullOfflineAppointments();
                } catch (err) {
                    console.error("[Startup] Stage 2 pulling failed:", err);
                }
            }, 3000);
        };

        if (useStore.persist.hasHydrated()) {
            runStage1And2();
            triggerStartupSync();
        } else {
            unsubHydrate = useStore.persist.onFinishHydration(() => {
                runStage1And2();
                triggerStartupSync();
                if (unsubHydrate) {
                    unsubHydrate();
                    unsubHydrate = undefined;
                }
            });
        }

        if ("Notification" in window && Notification.permission === "default") {
            // Let the explicit custom UI prompt handle this later if possible
            // Notification.requestPermission()
        }
        
        NotificationManager.initialize();

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered: ', registration);
                }).catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
            });
        }

        // Listen for widget notes deep links
        const handleWidgetNoteOpen = (e: Event) => {
            try {
                const customEvent = e as CustomEvent;
                let data = customEvent.detail;
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                if (data && data.noteId) {
                    router.push(`/notes?noteId=${data.noteId}`);
                }
            } catch (err) {
                console.error("Failed to parse widgetOpenNote event:", err);
            }
        };

        window.addEventListener('widgetOpenNote', handleWidgetNoteOpen);

        // Optional listener for capacitor app plugin deep links
        let appListener: any;
        const initDeepLinks = async () => {
            if (Capacitor.isNativePlatform()) {
                appListener = await CapacitorApp.addListener('appUrlOpen', data => {
                    const url = new URL(data.url);
                    if (url.protocol === 'mynotes:' && url.hostname === 'note') {
                        const noteId = url.pathname.replace('/', '');
                        if (noteId) {
                            router.push(`/notes?noteId=${noteId}`);
                        }
                    }
                });

                // Check if there is a pending widget deep link (app was closed)
                try {
                    const { noteId } = await WidgetSync.getPendingOpenNote();
                    if (noteId) {
                        router.push(`/notes?noteId=${noteId}`);
                    }
                } catch (err) {
                    console.error("Failed to check pending open note:", err);
                }
            }
        };

        initDeepLinks();

        let updatedListener: any;
        let appointmentsListener: any;
        let notesListener: any;
        let noteOpenListener: any;
        const setupListener = async () => {
            if (isNative) {
                try {
                    updatedListener = await (WidgetSync as any).addListener('tasksUpdated', () => {
                        console.log("Tasks updated from notification, pulling changes...");
                        useStore.getState().pullOfflineCompletedTasks();
                    });
                    appointmentsListener = await (WidgetSync as any).addListener('appointmentsUpdated', () => {
                        console.log("Appointments updated from notification, pulling changes...");
                        useStore.getState().pullOfflineAppointments();
                    });
                    notesListener = await (WidgetSync as any).addListener('notesUpdated', () => {
                        console.log("Notes updated from widget, pulling changes...");
                        useStore.getState().pullOfflineNotes(true);
                    });
                    noteOpenListener = await (WidgetSync as any).addListener('noteOpenRequested', ({ noteId }: any) => {
                        console.log("Note open requested via WidgetSync event:", noteId);
                        if (noteId) {
                            router.push(`/notes?noteId=${noteId}`);
                        }
                    });
                } catch (e) {
                    console.error("Failed to add listeners:", e);
                }
            }
        };
        setupListener();

        return () => {
            if (cancelStage1) cancelStage1();
            if (cancelStage2) cancelStage2();
            if (cancelStage3) cancelStage3();
            if (unsubHydrate) {
                unsubHydrate();
            }
            if (appListener && appListener.remove) {
                appListener.remove();
            }
            if (updatedListener && updatedListener.remove) {
                updatedListener.remove();
            }
            if (appointmentsListener && appointmentsListener.remove) {
                appointmentsListener.remove();
            }
            if (notesListener && notesListener.remove) {
                notesListener.remove();
            }
            if (noteOpenListener && noteOpenListener.remove) {
                noteOpenListener.remove();
            }
        };
    }, [])

    useEffect(() => {
        // Wait for Zustand to finish hydrating from localStorage/storage before
        // evaluating whether the user is new. Without this guard, the check runs
        // before persisted data is loaded, sees an empty store, and incorrectly
        // starts the welcome tour for existing users.
        if (!isHydrated) return;

        if (typeof window !== 'undefined') {
            const hasCompleted = localStorage.getItem('mynotes_tour_completed') === 'true';
            const state = useStore.getState();
            const hasData =
                (state.tasks?.length > 0) ||
                (state.notes?.length > 0) ||
                (state.goals?.length > 0) ||
                (state.transactions?.length > 0) ||
                (state.appointments?.length > 0);

            if (hasData) {
                if (!hasCompleted) {
                    localStorage.setItem('mynotes_tour_completed', 'true');
                }
                // Only kill the tour if it was NOT manually started by the user
                if (tourStep !== null && !isTourManuallyStarted) {
                    endTour();
                }
                return;
            }

            if (!hasCompleted && appOpenCount <= 1 && tourStep === null) {
                const timer = setTimeout(() => {
                    startTour();
                }, 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [isHydrated, appOpenCount, tourStep]);

    // Auto-save local backup to Documents folder every 5 seconds after a change on native platforms (keeping max 4 auto-backups)
    useEffect(() => {
        if (!isNative) return;

        let debounceTimeout: NodeJS.Timeout;
        let lastTimestamp = useStore.getState().lastUpdated;

        const unsubscribe = useStore.subscribe((state) => {
            if (state.lastUpdated !== lastTimestamp) {
                lastTimestamp = state.lastUpdated;
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(async () => {
                try {
                    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');

                    const dataToExport = {
                        notes: state.notes,
                        tasks: state.tasks,
                        goals: state.goals,
                        appointments: state.appointments,
                        projects: state.projects,
                        taskGroups: state.taskGroups,
                        dailySnapshots: state.dailySnapshots,
                        user: state.user
                    };
                    const jsonStr = JSON.stringify(dataToExport);

                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');
                    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
                    const fileName = `mynotes_auto_backup_${timestamp}.json`;

                    await Filesystem.writeFile({
                        path: fileName,
                        data: jsonStr,
                        directory: Directory.Documents,
                        encoding: Encoding.UTF8
                    });
                    console.log(`Local auto-backup saved to Documents/${fileName}`);

                    // Manage rotation of auto-backups to keep only the 4 most recent
                    const dirResult = await Filesystem.readdir({
                        path: '',
                        directory: Directory.Documents
                    });

                    const autoBackupFiles = dirResult.files
                        .map(f => typeof f === 'string' ? f : f.name)
                        .filter(name => name.startsWith('mynotes_auto_backup_') && name.endsWith('.json'))
                        .sort(); // Alphabetical sort aligns with chronological order (YYYYMMDD_HHmmss)

                    if (autoBackupFiles.length > 4) {
                        const filesToDelete = autoBackupFiles.slice(0, autoBackupFiles.length - 4);
                        for (const file of filesToDelete) {
                            try {
                                await Filesystem.deleteFile({
                                    path: file,
                                    directory: Directory.Documents
                                });
                                console.log(`Deleted old auto-backup: ${file}`);
                            } catch (delErr) {
                                console.error(`Error deleting old auto-backup ${file}`, delErr);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Local auto-backup failed", err);
                }
            }, 5000);
            }
        });

        return () => {
            clearTimeout(debounceTimeout);
            unsubscribe();
        };
    }, []);

    // Auto-sync to Google Drive 10 seconds after a change if logged in, or immediately when app/page closes
    useEffect(() => {
        let syncTimeout: NodeJS.Timeout;
        let lastTimestamp = useStore.getState().lastUpdated;

        const unsubscribe = useStore.subscribe((state) => {
            if (state.lastUpdated !== lastTimestamp) {
                lastTimestamp = state.lastUpdated;
                if (state.googleUser && !state.googleSessionExpired) {
                    clearTimeout(syncTimeout);
                    syncTimeout = setTimeout(() => {
                        import('../../lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
                    }, 2000);
                }
            }
        });

        // Instant sync when closing/leaving tab on web
        const handleBeforeUnload = () => {
            const state = useStore.getState();
            if (state.googleUser && !state.googleSessionExpired) {
                console.log("[BeforeUnload] Instantly syncing with Google Drive before unload...");
                import('../../lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearTimeout(syncTimeout);
            unsubscribe();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    return (
        <div className="flex flex-col min-h-screen" suppressHydrationWarning>
            {mounted && <MIUIOnboardingDialog />}
            {mounted && tourStep === null && !tourCompleted && (
                <button
                    onClick={() => {
                        router.push('/');
                        startTourManually();
                    }}
                    className="fixed top-4 right-4 z-[40] flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md shadow-sm text-xs font-black text-primary hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span>{language === 'es' ? 'Guía' : 'Guide'}</span>
                </button>
            )}

            {mounted && (
                <AnimatePresence mode="wait">
                    {tourStep === 0 && (
                        showQuote ? (
                            <motion.div
                                key="quote"
                                initial={{ opacity: 0, filter: "blur(20px)" }}
                                animate={{ opacity: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, filter: "blur(20px)" }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                                onClick={handleQuoteSkip}
                                className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-8 select-none cursor-pointer bg-white dark:bg-zinc-950 text-center"
                            >
                                <div className="max-w-xl mx-auto flex flex-col items-center gap-4">
                                    <p className="text-xl sm:text-2xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed italic font-serif">
                                        "{randomQuote.quote}"
                                    </p>
                                    {randomQuote.author && (
                                        <p className="text-sm font-bold tracking-widest text-black dark:text-white uppercase mt-2">
                                            {randomQuote.author}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-8 animate-pulse tracking-wider">
                                        {language === 'es' ? 'Toca la pantalla para omitir' : 'Tap screen to skip'}
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="welcome"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                            >
                                <motion.div
                                     initial={{ opacity: 0 }}
                                     animate={{ opacity: 1 }}
                                     exit={{ opacity: 0 }}
                                     onClick={() => endTour()}
                                     className="absolute inset-0 bg-transparent backdrop-blur-none"
                                />
                                <motion.div
                                    ref={welcomeModalRef}
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    className="relative w-full max-w-sm p-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col items-center text-center z-10"
                                >
                                    <button
                                        onClick={() => endTour()}
                                        className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="flex flex-col items-center gap-1 mb-4 select-none">
                                        <h2 className="text-3xl font-extrabold tracking-tight text-black dark:text-white font-dancing">MyNotes</h2>
                                        <div className="w-12 h-0.5 bg-primary/30 rounded-full" />
                                    </div>
                                    <p className="text-zinc-700 dark:text-zinc-300 text-sm font-semibold leading-relaxed mb-6">
                                        {language === 'es'
                                            ? "Bienvenido nuevo usuario, desarrollemos juntos tu mejor versión, primero queremos explicar cómo funciona la app"
                                            : "Welcome new user, let's develop your best version together! First, we want to explain how the app works."}
                                    </p>
                                    <button
                                        onClick={() => {
                                            router.push('/tasks');
                                            nextTourStep();
                                        }}
                                        className="w-full py-3.5 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {language === 'es' ? "Crea tu primer hábito" : "Create your first habit"}
                                    </button>
                                </motion.div>
                                <TourArrow targetId={window.innerWidth < 768 ? "nav-item-tasks" : "nav-item-tasks-desktop"} startRef={welcomeModalRef} />
                            </motion.div>
                        )
                    )}
                </AnimatePresence>
            )}

            <KeyboardShortcuts />
            <HabitNotificationToast />
            <CelebrationModal />
            <GlassToast />
            <CloudPrompt />
            <SyncConflictDialog />
            <AppSidebar />
            <FloatingTimer />
            
            <main className="flex-1 max-w-full transition-[margin] duration-300 ease-in-out bg-background text-foreground md:ml-64 pt-4 md:pt-10 pb-32 md:pb-10 overflow-x-hidden" suppressHydrationWarning>
                <div className="px-4 md:px-12 max-w-7xl mx-auto w-full" suppressHydrationWarning>
                    {children}
                </div>
            </main>
        </div>
    )
}
