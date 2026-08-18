"use client"

import { useStore } from "@/lib/store"
import { useEffect, useState } from "react"
import { translations } from "@/lib/translations"
import { Trophy, Plus, ArrowUpRight } from "lucide-react"
import { TaskInput } from "./task-input"

export function DashboardHero() {
    const user = useStore(state => state.user)
    const tasks = useStore(state => state.tasks)
    const language = useStore(state => state.language)
    const [mounted, setMounted] = useState(false)
    const t = (translations[language]?.dashboard || translations['en'].dashboard) as any
    const common = (translations[language]?.common || translations['en'].common) as any

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    const today = new Date().toISOString().split('T')[0]
    const todaysTasks = tasks.filter(t => {
        if (t.recurrence === 'None') return !t.completed || (t.completed && (t.completedDates?.includes(today) ?? false))
        return true
    })

    const completedCount = todaysTasks.filter(t => {
        if (t.recurrence !== 'None') return t.completedDates?.includes(today) ?? false
        return t.completed
    }).length

    const totalCount = todaysTasks.length || 1
    const percentage = Math.round((completedCount / totalCount) * 100)

    // Top 4 tasks for preview (integrated in hero)
    const taskPreview = todaysTasks.slice(0, 4)

    const formattedDate = language === 'es'
        ? `${common.days.thursdayFull}, 19 de Feb`
        : `Thursday, Feb 19`
    const greeting = language === 'es' ? t.goodMorning : 'Good Morning'

    return (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-black/[0.03] to-transparent dark:from-white/[0.08] dark:to-white/[0.02] border border-black/5 dark:border-white/10 p-8 sm:p-10 mb-8 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 group">
            <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-primary/10 blur-[100px] rounded-full -mr-20 -mt-20 opacity-50 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 flex flex-col gap-8">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2">{t.today}</h1>
                        <p className="text-muted-foreground text-sm font-medium">
                            {formattedDate} • <span className="text-foreground/80">{greeting}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-6 bg-black/20 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-xl font-bold text-green-400">+{Math.round(user.focusTimeMinutes / 60)}h</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-1">{t.velocity}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col text-right">
                            <span className="text-xl font-bold text-orange-400 flex items-center justify-end gap-1">
                                <Trophy className="w-5 h-5" />
                                {user.streak}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-1">{t.dayStreak}</span>
                        </div>
                    </div>
                </div>

                {/* Main Integrated Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                    {/* Progress Circle (Left) */}
                    <div className="lg:col-span-3 flex justify-center lg:justify-start">
                        <div className="relative w-40 h-40 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                                <circle
                                    cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent"
                                    strokeDasharray={440}
                                    strokeDashoffset={440 - (percentage / 100) * 440}
                                    className="text-primary transition-all duration-1000 ease-out drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)]"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-black tracking-tighter">{percentage}%</span>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">{t.tasks}</span>
                            </div>
                        </div>
                    </div>

                    {/* Task Previews (Middle Grid-ish) */}
                    <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                        {taskPreview.map((task, idx) => (
                            <div key={task.id} className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all hover:translate-y-[-2px] group/task">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black opacity-20 group-hover/task:opacity-50 transition-opacity">0{idx + 1}</span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${task.completed ? 'bg-green-500' : 'bg-primary'}`} />
                                </div>
                                <p className={`text-xs font-medium line-clamp-2 ${task.completed ? 'text-muted-foreground line-through' : ''}`}>
                                    {task.title}
                                </p>
                            </div>
                        ))}
                        {taskPreview.length < 4 && Array.from({ length: 4 - taskPreview.length }).map((_, i) => (
                            <div key={i} className="bg-white/[0.02] border border-dashed border-white/5 p-4 rounded-2xl flex items-center justify-center">
                                <Plus className="w-4 h-4 text-white/5" />
                            </div>
                        ))}
                    </div>

                    {/* Quick Add & Status (Right) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="flex flex-col gap-3">
                            <label className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest pl-1">{t.quickAdd}</label>
                            <TaskInput />
                        </div>
                        <div className="flex items-center gap-4 bg-primary/5 rounded-2xl p-4 border border-primary/10">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                <ArrowUpRight className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold">{t.dailyProgress}</p>
                                <p className="text-xs text-muted-foreground">{t.tasksCompletedCount.replace('{completed}', completedCount.toString()).replace('{total}', totalCount.toString())}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
