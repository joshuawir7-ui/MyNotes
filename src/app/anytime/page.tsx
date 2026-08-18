"use client"

import { Reveal } from "@/components/ui/reveal"
import { useStore, getLocalDateString, Task } from "@/lib/store"
import { translations } from "@/lib/translations"
import { PageDescription } from "@/components/ui/page-description"
import { Check, Layers, Trophy, Star, PartyPopper, ChevronDown, Flame, X, Pin, RotateCw, History, AlertTriangle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { phrases } from "@/lib/phrases"
import { MobileContextMenu } from "@/components/ui/mobile-context-menu"

import { useState, useEffect, useMemo } from "react"

export default function AnytimePage() {
    const language = useStore(state => state.language)
    const tasks = useStore(state => state.tasks)
    const toggleTask = useStore(state => state.toggleTask)
    const resetHabitStats = useStore(state => state.resetHabitStats)
    const setHabitEnabled = useStore(state => state.setHabitEnabled)
    const taskGroups = useStore(state => state.taskGroups)
    const toggleTaskInGroup = useStore(state => state.toggleTaskInGroup)
    const celebration = useStore(state => state.celebration)
    const clearCelebration = useStore(state => state.clearCelebration)
    const toggleTaskGroupPin = useStore(state => state.toggleTaskGroupPin)
    const deleteTaskFromGroup = useStore(state => state.deleteTaskFromGroup)
    const loadAllTasks = useStore(state => state.loadAllTasks)
    const unloadTasks = useStore(state => state.unloadTasks)
    const showToast = useStore(state => state.showToast)
    const t = translations[language].pages.anytime
    const [isMounted, setIsMounted] = useState(false)
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

    useEffect(() => {
        const saved = localStorage.getItem('collapsed_task_groups');
        if (saved) {
            try {
                setCollapsedGroups(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse collapsed groups", e);
            }
        }
    }, [])

    const toggleGroupCollapse = (groupId: string) => {
        setCollapsedGroups(prev => {
            const next = {
                ...prev,
                [groupId]: !prev[groupId]
            };
            localStorage.setItem('collapsed_task_groups', JSON.stringify(next));
            return next;
        });
    }


    const habits = tasks.filter(t => t.isHabit && t.recurrence !== 'Once' && t.recurrence !== 'None')

    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const completedOnceHabits = useStore(state => state.completedOnceHabits)

    const habitHistory = useMemo(() => {
        const now = new Date()
        const todayStr = getLocalDateString(now)
        const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const yesterdayStr = getLocalDateString(yesterdayDate)

        // 1. Gather check dates for the last 7 days and precompile labels
        const checkDates = new Set<string>()
        const dateLabels: Record<string, string> = {}
        const itemsByDate: Record<string, { habitTitle: string, time: string, timestamp: number }[]> = {}

        for (let i = 0; i < 7; i++) {
            const d = new Date()
            d.setDate(now.getDate() - i)
            const dateStr = getLocalDateString(d)
            checkDates.add(dateStr)
            itemsByDate[dateStr] = []

            if (dateStr === todayStr) {
                dateLabels[dateStr] = language === 'es' ? 'Hoy' : 'Today'
            } else if (dateStr === yesterdayStr) {
                dateLabels[dateStr] = language === 'es' ? 'Ayer' : 'Yesterday'
            } else {
                const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' }
                let label = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', options)
                label = label.charAt(0).toUpperCase() + label.slice(1)
                dateLabels[dateStr] = label
            }
        }

        // 2. Scan tasks and their completions in ONE pass
        tasks.forEach((task) => {
            if (task.isHabit && task.completionTimes) {
                task.completionTimes.forEach((ct) => {
                    if (typeof ct === 'string' && ct.length >= 10) {
                        const ctDateStr = ct.substring(0, 10)

                        if (checkDates.has(ctDateStr)) {
                            let timeStr = "00:00"
                            if (ct.length >= 16) {
                                timeStr = ct.substring(11, 16)
                            }

                            let ts = 0
                            try {
                                ts = Date.parse(ct)
                            } catch (e) { }

                            itemsByDate[ctDateStr].push({
                                habitTitle: task.title,
                                time: timeStr,
                                timestamp: ts
                            })
                        }
                    }
                })
            }
        })

        // Also add completed Once habits
        if (Array.isArray(completedOnceHabits)) {
            completedOnceHabits.forEach((coh) => {
                if (coh.completedAt && typeof coh.completedAt === 'string' && coh.completedAt.length >= 10) {
                    const ctDateStr = coh.completedAt.substring(0, 10)
                    if (checkDates.has(ctDateStr)) {
                        let timeStr = "00:00"
                        if (coh.completedAt.length >= 16) {
                            timeStr = coh.completedAt.substring(11, 16)
                        }
                        let ts = 0
                        try {
                            ts = Date.parse(coh.completedAt)
                        } catch (e) { }

                        itemsByDate[ctDateStr].push({
                            habitTitle: coh.title,
                            time: timeStr,
                            timestamp: ts
                        })
                    }
                }
            })
        }

        // 3. Assemble and sort the history list in chronological order of last 7 days (today first)
        const history: { dateStr: string, label: string, items: { habitTitle: string, time: string, timestamp: number }[] }[] = []

        for (let i = 0; i < 7; i++) {
            const d = new Date()
            d.setDate(now.getDate() - i)
            const dateStr = getLocalDateString(d)
            const items = itemsByDate[dateStr]

            if (items.length > 0) {
                items.sort((a, b) => b.timestamp - a.timestamp)
                history.push({
                    dateStr,
                    label: dateLabels[dateStr],
                    items
                })
            }
        }

        return history
    }, [tasks, language, completedOnceHabits])

    const favoriteHabit = useMemo<Task | null>(() => {
        const activeHabits = habits.filter(h => h.enabled !== false)
        if (activeHabits.length === 0) return null

        let maxCompletions = -1
        let favorite: Task | null = null
        activeHabits.forEach(h => {
            const count = h.completedDates?.length || 0
            if (count > maxCompletions) {
                maxCompletions = count
                favorite = h
            }
        })
        return maxCompletions > 0 ? favorite : null
    }, [habits])

    const hardestHabit = useMemo<Task | null>(() => {
        const activeHabits = habits.filter(h => h.enabled !== false)
        if (activeHabits.length === 0) return null

        let maxMissed = 0
        let hardest: Task | null = null
        activeHabits.forEach(h => {
            const missedCount = h.missed || 0
            if (missedCount > maxMissed) {
                maxMissed = missedCount
                hardest = h
            }
        })

        if (hardest) return hardest

        const uncompleted = activeHabits.filter(h => (h.completedDates?.length || 0) === 0)
        if (uncompleted.length > 0) {
            return uncompleted[0]
        }

        return null
    }, [habits])

    useEffect(() => {
        loadAllTasks()
        setIsMounted(true)
        return () => {
            unloadTasks()
        }
    }, [loadAllTasks, unloadTasks])

    return (
        <div className="min-h-screen bg-background text-foreground p-8 transition-colors duration-300 relative selection:bg-primary/30 flex flex-col">
            {/* Celebration Modal */}
            <AnimatePresence>
                {celebration && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={clearCelebration}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />

                        {/* Particles */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{
                                        top: "50%",
                                        left: "50%",
                                        scale: 0,
                                        rotate: 0,
                                        opacity: 1
                                    }}
                                    animate={{
                                        top: `${Math.random() * 100}%`,
                                        left: `${Math.random() * 100}%`,
                                        scale: Math.random() * 2 + 0.5,
                                        rotate: Math.random() * 360,
                                        opacity: 0
                                    }}
                                    transition={{
                                        duration: 2,
                                        ease: "easeOut",
                                        delay: Math.random() * 0.2
                                    }}
                                    className="absolute w-4 h-4 rounded-full bg-primary/40 blur-sm"
                                />
                            ))}
                        </div>

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 20, stiffness: 300 }}
                            className="relative w-full max-w-sm p-8 rounded-[2rem] border border-white/10 bg-background/80 backdrop-blur-2xl text-center space-y-6 shadow-2xl"
                        >
                            <div className="pt-2 space-y-3">
                                <h2 className="text-2xl font-medium tracking-tight text-foreground">
                                    {language === 'es' ? "Grupo de tareas completado" : "Task group completed"}
                                </h2>
                                <div className="py-2 px-4 bg-white/5 rounded-xl border border-white/10 inline-block">
                                    <span className="text-lg font-bold text-foreground">"{celebration.title}"</span>
                                </div>
                                <p className="text-sm text-muted-foreground italic pt-4">
                                    "{(phrases as any)[language]?.[Math.floor(Math.random() * ((phrases as any)[language]?.length || phrases.en.length))]?.text || phrases.en[0].text}"
                                </p>
                            </div>

                            <button
                                onClick={clearCelebration}
                                className="w-full py-3 bg-white/10 hover:bg-white/20 text-foreground rounded-xl font-medium transition-all"
                            >
                                {language === 'es' ? "Cerrar" : "Close"}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* History Modal */}
            <AnimatePresence>
                {showHistoryModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowHistoryModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, filter: "blur(20px)", y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, filter: "blur(0px)", y: 0, scale: 1 }}
                            exit={{ opacity: 0, filter: "blur(20px)", y: 20, scale: 0.9 }}
                            className="relative w-full max-w-lg glass-panel p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-background shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[80vh] z-10"
                        >
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors hover:bg-white/5 rounded-full"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <h3 className="text-2xl font-black mb-1 flex items-center gap-2">
                                <History className="w-6 h-6 text-primary" />
                                {language === 'es' ? 'Historial de Hábitos' : 'Habits History'}
                            </h3>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-6">
                                {language === 'es' ? 'Últimos 7 días' : 'Last 7 days'}
                            </p>

                            <div className="flex-1 overflow-y-auto pr-1 space-y-6 custom-scrollbar">
                                {habitHistory.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl opacity-40">
                                        <History className="w-8 h-8 mb-2" />
                                        <p className="text-xs font-bold uppercase tracking-widest">
                                            {language === 'es' ? 'No hay hábitos completados' : 'No completed habits'}
                                        </p>
                                    </div>
                                ) : (
                                    habitHistory.map((dayGroup) => (
                                        <div key={dayGroup.dateStr} className="space-y-2">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-primary">
                                                {dayGroup.label}
                                            </h4>
                                            <div className="space-y-1.5">
                                                {dayGroup.items.map((item, index) => (
                                                    <div
                                                        key={`${dayGroup.dateStr}-${index}`}
                                                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5"
                                                    >
                                                        <span className="font-semibold text-sm text-foreground">
                                                            {item.habitTitle}
                                                        </span>
                                                        <span className="text-xs font-bold text-muted-foreground/60 bg-white/5 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            <Check className="w-3.5 h-3.5 text-green-500" />
                                                            {item.time}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-bold rounded-2xl mt-6 transition-all"
                            >
                                {language === 'es' ? 'Cerrar' : 'Close'}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Ambient Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] dark:bg-purple-900/20" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] dark:bg-blue-900/20" />
            </div>

            <div className="relative z-10 w-full max-w-5xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-white/5 pb-6">
                    <Reveal margin="0px" duration={0.4}>
                        <h1 className="text-3xl font-bold mb-2">{t.title}</h1>
                        <p className="text-muted-foreground">{t.description}</p>
                    </Reveal>                    <Reveal delay={0.1} duration={0.4} width="fit-content" className="w-full md:w-auto">
                        <div className="grid grid-cols-3 gap-2 w-full max-w-lg md:flex md:flex-row md:gap-3 md:w-auto">
                            {/* Card 1: Historial */}
                            <button
                                onClick={() => setShowHistoryModal(true)}
                                className="flex flex-col items-center justify-center p-3 w-full md:w-28 h-24 bg-white/5 hover:bg-white/10 dark:bg-black/20 dark:hover:bg-black/30 border border-white/10 hover:border-primary/30 rounded-2xl transition-all duration-300 group shadow-lg cursor-pointer"
                                title={language === 'es' ? 'Ver historial de hábitos' : 'View habits history'}
                            >
                                <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
                                    <History className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-2">
                                    {language === 'es' ? 'Historial' : 'History'}
                                </span>
                            </button>

                            {/* Card 2: Favorito */}
                            <div
                                className="flex flex-col items-center justify-center p-3 w-full md:w-36 h-24 bg-white/5 dark:bg-black/20 border border-white/10 rounded-2xl shadow-lg relative group overflow-hidden"
                            >
                                <div className="absolute top-1.5 right-1.5 text-yellow-500 animate-pulse">
                                    <Star className="w-3.5 h-3.5 fill-yellow-500" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-yellow-500 mb-1">
                                    {language === 'es' ? 'Favorito' : 'Favorite'}
                                </span>
                                <span className="font-bold text-xs text-foreground text-center line-clamp-1 px-1 w-full" title={favoriteHabit ? favoriteHabit.title : ''}>
                                    {favoriteHabit ? favoriteHabit.title : (language === 'es' ? 'Ninguno' : 'None')}
                                </span>
                                <span className="text-[9px] text-muted-foreground mt-1 font-medium">
                                    {favoriteHabit
                                        ? `${favoriteHabit.completedDates?.length || 0} ${language === 'es' ? 'completados' : 'completed'}`
                                        : (language === 'es' ? 'Sin datos' : 'No data')}
                                </span>
                            </div>

                            {/* Card 3: Más Cuesta */}
                            <div
                                className="flex flex-col items-center justify-center p-3 w-full md:w-36 h-24 bg-white/5 dark:bg-black/20 border border-white/10 rounded-2xl shadow-lg relative group overflow-hidden"
                            >
                                <div className="absolute top-1.5 right-1.5 text-red-500">
                                    <AlertTriangle className="w-3.5 h-3.5 fill-red-500/10" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-red-400 mb-1">
                                    {language === 'es' ? 'Más cuesta' : 'Hardest'}
                                </span>
                                <span className="font-bold text-xs text-foreground text-center line-clamp-1 px-1 w-full" title={hardestHabit ? hardestHabit.title : ''}>
                                    {hardestHabit ? hardestHabit.title : (language === 'es' ? 'Ninguno' : 'None')}
                                </span>
                                <span className="text-[9px] text-muted-foreground mt-1 font-medium">
                                    {hardestHabit
                                        ? `${hardestHabit.missed || 0} ${language === 'es' ? 'perdidos' : 'missed'}`
                                        : (language === 'es' ? 'Sin datos' : 'No data')}
                                </span>
                            </div>
                        </div>
                    </Reveal>
                </div>

                <Reveal delay={0.2}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {!isMounted ? (
                            <>
                                <div className="animate-pulse p-6 rounded-2xl bg-white/5 border border-white/10 h-44" />
                                <div className="animate-pulse p-6 rounded-2xl bg-white/5 border border-white/10 h-44" />
                            </>
                        ) : habits.length === 0 ? (
                            <div className="col-span-full text-center p-12 bg-white/5 dark:bg-black/20 rounded-2xl border border-white/10">
                                <p className="text-muted-foreground">{t.noTasks}</p>
                            </div>
                        ) : (
                            habits.map((habit, index) => (
                                <div
                                    key={habit.id}
                                    style={{ animation: `fade-in-up-fast 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.05}s both` }}
                                    className={`p-6 rounded-2xl border transition-all duration-300 ${habit.enabled === false ? 'opacity-50 grayscale bg-white/5 border-white/5' : 'bg-white/10 dark:bg-black/30 border-white/10 hover:border-primary/50'}`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-semibold text-lg">{habit.title}</h3>
                                        <button
                                            onClick={() => {
                                                const nextVal = habit.enabled === false;
                                                setHabitEnabled(habit.id, nextVal);
                                                showToast(language === 'es' ? (nextVal ? "Hábito habilitado" : "Hábito deshabilitado") : (nextVal ? "Habit enabled" : "Habit disabled"), "info");
                                            }}
                                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                                        >
                                            {habit.enabled === false ? 'Habilitar' : 'Deshabilitar'}
                                        </button>
                                    </div>

                                    <div className="flex gap-4 mb-6">
                                        <div className="flex-1 p-3 bg-primary/10 rounded-xl flex flex-col items-center justify-center">
                                            <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Racha</p>
                                            <p className="text-2xl font-bold flex items-center gap-1">
                                                {habit.streak || 0}
                                                <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                                            </p>
                                        </div>
                                        <div className="flex-1 p-3 bg-red-500/10 rounded-xl flex flex-col items-center justify-center">
                                            <p className="text-[10px] uppercase tracking-wider text-red-500 font-bold">Perdidos</p>
                                            <p className="text-2xl font-bold flex items-center gap-1">
                                                {habit.missed || 0}
                                                <X className="w-5 h-5 text-red-500" />
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            disabled={!habit.enabled}
                                            onClick={() => {
                                                toggleTask(habit.id);
                                                const isComp = !habit.completed;
                                                showToast(language === 'es' ? (isComp ? "Hábito completado" : "Hábito pendiente") : (isComp ? "Habit completed" : "Habit pending"), isComp ? "success" : "info");
                                            }}
                                            className={`flex-1 py-2 rounded-xl font-medium transition-all ${habit.completed ? 'bg-green-500/20 text-green-500' : 'bg-primary text-primary-foreground'}`}
                                        >
                                            {habit.completed ? 'Completado hoy' : 'Marcar hoy'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                resetHabitStats(habit.id);
                                                showToast(language === 'es' ? "Estadísticas reiniciadas" : "Stats reset", "success");
                                            }}
                                            className="p-2 aspect-square rounded-xl bg-white/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors flex items-center justify-center"
                                            title="Reiniciar estadísticas"
                                        >
                                            <RotateCw className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Reveal>

                {/* Task Groups Section */}
                {(taskGroups || []).length > 0 && (
                    <Reveal delay={0.3}>
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <Layers className="w-6 h-6 text-indigo-500" />
                                {language === 'es' ? "Grupos de Tareas" : "Task Groups"}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {!isMounted ? (
                                    <>
                                        <div className="animate-pulse p-8 rounded-3xl border border-white/10 bg-white/5 h-48" />
                                        <div className="animate-pulse p-8 rounded-3xl border border-white/10 bg-white/5 h-48" />
                                    </>
                                ) : (
                                    (taskGroups || []).map((group, index) => {
                                        const completed = group.tasks.filter(t => t.completed).length;
                                        const total = group.tasks.length;
                                        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
                                        const isCollapsed = collapsedGroups[group.id] || false;

                                        return (
                                            <div
                                                key={group.id}
                                                style={{ animation: `fade-in-up-fast 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.05}s both` }}
                                                className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-500"
                                            >
                                                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: group.color }} />

                                                <div
                                                    className="flex justify-between items-start mb-6 cursor-pointer select-none"
                                                    onClick={() => toggleGroupCollapse(group.id)}
                                                >
                                                    <div className="flex-1 min-w-0 mr-4">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                            <h3 className="text-xl font-bold flex items-center gap-2 truncate">
                                                                {group.title}
                                                                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                            </h3>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleTaskGroupPin(group.id);
                                                                    const nextPin = !group.isPinned;
                                                                    showToast(language === 'es' ? (nextPin ? "Grupo fijado" : "Grupo desfijado") : (nextPin ? "Group pinned" : "Group unpinned"), "success");
                                                                }}
                                                                className={`p-1.5 rounded-lg transition-all shrink-0 ${group.isPinned ? 'text-indigo-400 bg-indigo-500/10 scale-105' : 'text-muted-foreground/60 hover:text-indigo-400 hover:bg-white/5 hover:scale-105 active:scale-95'}`}
                                                                title={group.isPinned ? "Desfijar grupo" : "Fijar grupo"}
                                                            >
                                                                <Pin className={`w-4 h-4 transition-all ${group.isPinned ? 'fill-indigo-400 rotate-45' : 'rotate-0'}`} />
                                                            </button>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {language === 'es' ? `${completed} de ${total} tareas completadas` : `${completed} of ${total} tasks completed`}
                                                        </p>
                                                    </div>
                                                    <div className="relative w-16 h-16 shrink-0">
                                                        <svg className="w-full h-full transform -rotate-90">
                                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                                                            <circle
                                                                cx="32" cy="32" r="28"
                                                                stroke={group.color}
                                                                strokeWidth="4"
                                                                fill="transparent"
                                                                strokeDasharray={175.9}
                                                                strokeDashoffset={175.9 - (progress / 100) * 175.9}
                                                                className="transition-all duration-1000 ease-out"
                                                            />
                                                        </svg>
                                                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black">
                                                            {progress}%
                                                        </div>
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {!isCollapsed && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="space-y-3 overflow-hidden pt-2"
                                                        >
                                                            {group.tasks.map(task => (
                                                                <MobileContextMenu
                                                                    key={task.id}
                                                                    title={task.title}
                                                                    onDelete={() => {
                                                                        deleteTaskFromGroup(group.id, task.id);
                                                                        showToast(language === 'es' ? "Tarea eliminada" : "Task deleted", "info");
                                                                    }}
                                                                >
                                                                    <div
                                                                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group/item w-full"
                                                                        onClick={() => {
                                                                            toggleTaskInGroup(group.id, task.id);
                                                                            const nextComp = !task.completed;
                                                                            showToast(language === 'es' ? (nextComp ? "Tarea completada" : "Tarea pendiente") : (nextComp ? "Task completed" : "Task pending"), nextComp ? "success" : "info");
                                                                        }}
                                                                    >
                                                                        <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center shadow-lg transition-all ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/5 border-white/20 group-hover/item:border-indigo-500 group-hover/item:scale-110'}`}>
                                                                            {task.completed && <Check className="w-4 h-4" />}
                                                                        </div>
                                                                        <span className={`text-lg font-bold tracking-tight transition-all ${task.completed ? 'text-muted-foreground line-through opacity-50' : 'text-foreground'}`}>
                                                                            {task.title}
                                                                        </span>
                                                                    </div>
                                                                </MobileContextMenu>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </Reveal>
                )}
            </div>
        </div>
    )
}
