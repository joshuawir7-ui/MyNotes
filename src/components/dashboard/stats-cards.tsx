"use client"

import { useStore } from "@/lib/store"
import { useEffect, useState } from "react"
import { translations } from "@/lib/translations"
import { Flame, CheckCircle2, Timer, X, Trophy, Zap, Check, ArrowRight, Play } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { FocusTimer } from "./focus-timer"

export function StatsCards() {
    const user = useStore(state => state.user)
    const tasks = useStore(state => state.tasks)
    const toggleTask = useStore(state => state.toggleTask)
    const language = useStore(state => state.language)
    const [mounted, setMounted] = useState(false)
    const [activeModal, setActiveModal] = useState<'completed' | 'focus' | 'streak' | null>(null)

    const t = translations[language].dashboard.stats
    const tDashboard = translations[language].dashboard

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    const completedTasks = tasks.filter(t => t.completed)
    const completedCount = completedTasks.length

    const stats = [
        {
            id: 'completed' as const,
            label: t.completed,
            value: completedCount.toString(),
            icon: CheckCircle2,
            color: "text-green-400",
            bg: "from-green-500/20 to-emerald-500/20",
            hoverBorder: "hover:border-green-500/50"
        },
        {
            id: 'focus' as const,
            label: t.focusTime,
            value: `${Math.floor(user.focusTimeMinutes / 60)}h ${user.focusTimeMinutes % 60}m`,
            icon: Timer,
            color: "text-blue-400",
            bg: "from-blue-500/20 to-cyan-500/20",
            hoverBorder: "hover:border-blue-500/50"
        },
        {
            id: 'streak' as const,
            label: t.streak,
            value: `${user.streak} ${t.days}`,
            icon: Flame,
            color: "text-orange-400",
            bg: "from-orange-500/20 to-red-500/20",
            hoverBorder: "hover:border-orange-500/50"
        },
    ]

    return (
        <>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {stats.map((stat) => (
                    <button
                        key={stat.id}
                        type="button"
                        onClick={() => setActiveModal(stat.id)}
                        className={`glass-panel rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-3 hover:scale-105 transition-all duration-300 cursor-pointer group relative overflow-hidden text-center w-full active:scale-95 ${stat.hoverBorder}`}
                    >
                        {/* Subtle gradient background */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${stat.bg} opacity-20 group-hover:opacity-35 transition-opacity`} />

                        <div className={`p-2.5 sm:p-3 rounded-full bg-background/90 dark:bg-zinc-800/90 border border-black/5 dark:border-white/5 shadow-sm relative z-10 group-hover:shadow-[0_0_15px_rgba(127,13,242,0.3)] transition-all group-hover:scale-110`}>
                            <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                        </div>
                        <div className="text-xl sm:text-2xl font-bold tracking-tight relative z-10">{stat.value}</div>
                        <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider relative z-10 truncate max-w-full px-1">
                            {stat.label}
                        </div>
                    </button>
                ))}
            </div>

            {/* Modal Overlays for all 3 stats */}
            <AnimatePresence>
                {activeModal === 'completed' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setActiveModal(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col relative"
                        >
                            <div className="flex justify-between items-center pb-4 border-b border-black/5 dark:border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-green-500/10 text-green-500">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-foreground">
                                            {language === 'es' ? "Tareas Completadas" : "Completed Tasks"}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {completedCount} {language === 'es' ? "tareas listas" : "tasks done"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="overflow-y-auto py-4 space-y-2 flex-1 pr-1 custom-scrollbar">
                                {completedTasks.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground text-sm">
                                        {language === 'es' ? "No tienes tareas completadas aún." : "No completed tasks yet."}
                                    </div>
                                ) : (
                                    completedTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className="flex items-center justify-between p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-green-500/30 transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                                <button
                                                    onClick={() => toggleTask(task.id)}
                                                    className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 hover:scale-110 transition-all"
                                                    title={language === 'es' ? "Desmarcar" : "Uncheck"}
                                                >
                                                    <Check className="w-4 h-4 stroke-[3]" />
                                                </button>
                                                <span className="text-sm font-medium line-through text-muted-foreground truncate">
                                                    {task.title}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-green-500/10 text-green-500 shrink-0">
                                                +{task.energyLevel === 'High' ? 50 : task.energyLevel === 'Medium' ? 30 : 10} XP
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {activeModal === 'focus' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setActiveModal(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-zinc-950 border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl w-full max-w-sm relative"
                        >
                            <FocusTimer onClose={() => setActiveModal(null)} />
                        </motion.div>
                    </motion.div>
                )}

                {activeModal === 'streak' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setActiveModal(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl w-full max-w-sm relative flex flex-col items-center text-center gap-4"
                        >
                            <button
                                onClick={() => setActiveModal(null)}
                                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="w-16 h-16 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center mt-2 shadow-inner">
                                <Flame className="w-9 h-9 fill-current" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-black text-foreground">
                                    {user.streak} {language === 'es' ? "Días de Racha" : "Day Streak"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 px-4 leading-relaxed">
                                    {language === 'es'
                                        ? "¡Mantén tu racha activa completando al menos una tarea diaria!"
                                        : "Keep your streak active by completing at least one daily task!"}
                                </p>
                            </div>

                            <div className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-4 flex justify-around items-center">
                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase">{language === 'es' ? "Nivel" : "Level"}</span>
                                    <span className="text-xl font-bold text-foreground mt-0.5">{user.level}</span>
                                </div>
                                <div className="h-8 w-px bg-black/10 dark:bg-white/10" />
                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase">XP Total</span>
                                    <span className="text-xl font-bold text-purple-500 mt-0.5">{user.xp} XP</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
