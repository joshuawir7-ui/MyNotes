"use client"

import { useStore, getLocalDateString } from "@/lib/store"
import { useEffect, useState, useMemo } from "react"
import { useShallow } from 'zustand/react/shallow'
import { translations } from "@/lib/translations"
import { Trophy } from "lucide-react"

export function DailyFocusWidget() {
    // Atomic selector: only reads focusTimeMinutes and streak from user, not the whole object
    const { focusTimeMinutes, streak } = useStore(
        useShallow((state) => ({
            focusTimeMinutes: state.user.focusTimeMinutes,
            streak: state.user.streak,
        }))
    )
    const tasks = useStore(state => state.tasks)
    const language = useStore(state => state.language)
    const appColor = useStore(state => state.appColor ?? 'purple')
    const t = translations[language].dashboard

    const today = getLocalDateString()
    const radius = 50
    const circumference = 2 * Math.PI * radius

    const { completedCount, totalCount, percentage, strokeDashoffset } = useMemo(() => {
        const todayDate = new Date()
        const currentDay = todayDate.getDay()

        const todays = tasks.filter(t => {
            if (t.recurrence === 'None') return !t.completed || (t.completed && (t.completedDates?.includes(today) ?? false))
            return true
        })

        const completed = todays.filter(t => {
            if (t.recurrence !== 'None') {
                const isCompleted = t.completedDates?.includes(today) ?? false
                const isActive = t.recurrence === 'Once' || !t.activeDays || t.activeDays.includes(currentDay)
                return isCompleted || !isActive
            }
            return t.completed
        }).length

        const total = todays.length || 1
        const pct = Math.round((completed / total) * 100)
        const offset = circumference - (pct / 100) * circumference

        return {
            completedCount: completed,
            totalCount: total,
            percentage: pct,
            strokeDashoffset: offset
        }
    }, [tasks, today, circumference])

    return (
        <div className={`glass-panel p-4 sm:p-5 rounded-2xl flex items-center gap-4 sm:gap-6 relative overflow-hidden group w-full min-h-[140px] ${appColor === 'black' ? 'shadow-[0_2px_15px_rgba(0,0,0,0.08)]' : ''}`}>
            <div className={`absolute inset-0 ${appColor === 'black' ? 'bg-black/[0.02] dark:bg-white/[0.02]' : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-50'}`} />

            {/* Circular Progress */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 flex items-center justify-center shrink-0">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                    <defs>
                        <linearGradient id="darkProgressGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#D4D4D8" />
                            <stop offset="50%" stopColor="#6E6E77" />
                            <stop offset="100%" stopColor="#000000" />
                        </linearGradient>
                    </defs>
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke={appColor === 'black' ? "#ECEEEF" : "currentColor"}
                        strokeWidth="8"
                        fill="transparent"
                        className={appColor === 'black' ? "" : "text-secondary/30"}
                    />
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke={appColor === 'black' ? "url(#darkProgressGradient)" : "currentColor"}
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className={appColor === 'black' ? "transition-all duration-1000 ease-out" : "text-primary transition-all duration-1000 ease-out neon-glow"}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className={`text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight ${appColor === 'black' ? 'text-black dark:text-white font-black' : ''}`}>{percentage}%</span>
                    <span className="text-[9px] sm:text-[10px] lg:text-xs text-muted-foreground font-bold uppercase tracking-wider">{t.focus}</span>
                </div>
            </div>

            <div className="flex-1 min-w-0 relative z-10">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-0.5 truncate">{t.dailyFocus}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm mb-3 truncate">
                    {t.tasksCompleted.replace('{completed}', completedCount.toString()).replace('{total}', totalCount.toString())}
                </p>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-sm sm:text-base lg:text-lg font-bold text-green-400">+{Math.round(focusTimeMinutes / 60)}h</span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-semibold">{t.velocity}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm sm:text-base lg:text-lg font-bold text-orange-400 flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            {streak}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-semibold">{t.dayStreak}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
