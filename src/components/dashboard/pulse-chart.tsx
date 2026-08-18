"use client"

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { useState, useEffect, useMemo } from "react"
import { useStore } from "@/lib/store"
import { translations } from "@/lib/translations"

const CustomTooltip = ({ active, payload }: any) => {
    const language = useStore(state => state.language);
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/70 dark:bg-zinc-900/80 backdrop-blur-md border border-black/5 dark:border-white/10 p-3 rounded-xl shadow-xl ring-1 ring-black/5 dark:ring-white/5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{payload[0].payload.time}</p>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                    <p className="text-sm font-bold text-foreground">
                        {payload[0].value} <span className="text-muted-foreground font-medium text-xs">{language === 'es' ? 'tareas' : 'tasks'}</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

export function PulseChart() {
    const language = useStore(state => state.language)
    const tasks = useStore(state => state.tasks)
    const t = translations[language].dashboard.charts

    const [mounted, setMounted] = useState(false)

    // Create an array of hours to display (24 hours)
    const displayHours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])

    useEffect(() => {
        setMounted(true)
    }, [])

    const chartData = useMemo(() => {
        // Generate dynamic data from tasks completion history using local date to avoid timezone offset mismatches
        const now = new Date()
        const nowYear = now.getFullYear()
        const nowMonth = String(now.getMonth() + 1).padStart(2, '0')
        const nowDay = String(now.getDate()).padStart(2, '0')
        const todayStr = `${nowYear}-${nowMonth}-${nowDay}`

        const hoursCompletionsCount = Array(24).fill(0)
        tasks.forEach(task => {
            if (task.completionTimes) {
                task.completionTimes.forEach(time => {
                    // String startsWith is super fast and avoids parsing Date if it's not today!
                    if (time && time.startsWith(todayStr)) {
                        try {
                            const date = new Date(time)
                            const hr = date.getHours()
                            if (hr >= 0 && hr < 24) {
                                hoursCompletionsCount[hr]++
                            }
                        } catch (e) {
                            console.error("Invalid completion time format:", time, e)
                        }
                    }
                })
            }
        })

        return displayHours.map(hour => {
            const hourStr = hour === 0 ? '12am' : hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`
            return { time: hourStr, value: hoursCompletionsCount[hour] }
        })
    }, [tasks, displayHours])

    if (!mounted) {
        return <div className="w-full h-[260px] glass-panel rounded-2xl p-6 relative overflow-hidden group animate-pulse" />
    }

    // If no data yet, provide a skeleton/placeholder curve for better UX
    const hasData = chartData.some(d => d.value > 0)
    const finalData = hasData ? chartData : chartData.map(d => ({ ...d, value: 0 }))

    return (
        <div className="w-full h-[260px] glass-panel rounded-2xl p-6 relative overflow-hidden group">
            {/* Dynamic background glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-colors duration-500" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-colors duration-500" />

            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-base font-semibold text-foreground/90 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                    {t.productivityPulse}
                </h3>
                <select className="bg-transparent text-xs text-muted-foreground border-none outline-none cursor-pointer hover:text-foreground transition-colors appearance-none">
                    <option>{t.today}</option>
                    <option>{t.thisWeek}</option>
                </select>
            </div>

            <div className="h-[180px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={finalData}>
                        <defs>
                            <linearGradient id="gradientPulse" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#8b5cf6" />
                                <stop offset="50%" stopColor="#ec4899" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                        <YAxis domain={[-1, 'auto']} hide={true} />
                        <XAxis
                            dataKey="time"
                            stroke="#52525b"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            interval={3}
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ stroke: 'rgba(139, 92, 246, 0.2)', strokeWidth: 2 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="url(#gradientPulse)"
                            strokeWidth={4}
                            dot={false}
                            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: '#8b5cf6' }}
                            animationDuration={2000}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
