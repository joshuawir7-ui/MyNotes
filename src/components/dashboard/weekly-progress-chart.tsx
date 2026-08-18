"use client"

import { Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, ComposedChart } from "recharts"
import { useStore, getLocalDateString } from "@/lib/store"
import { translations } from "@/lib/translations"
import { useMemo, useState, useEffect } from "react"
import { X } from "lucide-react"
import { FocusTimer } from "./focus-timer"
import { motion, AnimatePresence } from "framer-motion"

let noteShownInSession = false;

function AnimatedClock({ isActive, speedScale = 1 }: { isActive: boolean, speedScale?: number }) {
    return (
        <div className="relative w-5 h-5 border-2 border-current rounded-full flex items-center justify-center">
            <div className="absolute w-0.5 h-0.5 bg-current rounded-full" />
            <motion.div
                className="absolute top-[15%] left-1/2 w-[1.5px] h-[35%] bg-current rounded-full"
                style={{ originY: '100%', x: "-50%" }}
                animate={isActive ? { rotate: 360 } : { rotate: 0 }}
                transition={isActive ? {
                    duration: 4 / speedScale,
                    repeat: Infinity,
                    ease: "linear"
                } : { duration: 0.5 }}
            />
        </div>
    )
}

const CustomTooltip = ({ active, payload, language, viewMode }: any) => {
    if (active && payload && payload.length) {
        const t = (translations[language as keyof typeof translations]?.dashboard?.charts || translations['en'].dashboard.charts) as any;

        const uniquePayload = payload.reduce((acc: any[], current: any) => {
            const x = acc.find(item => item.dataKey === current.dataKey);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, []);

        return (
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-black/5 dark:border-white/10 p-3 rounded-xl shadow-xl min-w-[140px] z-50">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold mb-2">
                    {viewMode === 'yearly'
                        ? payload[0].payload.day
                        : viewMode === 'monthly'
                            ? (language === 'es' ? `Día ${payload[0].payload.day}` : `Day ${payload[0].payload.day}`)
                            : payload[0].payload.day
                    }
                </p>
                <div className="space-y-2">
                    {uniquePayload.map((entry: any, index: number) => {
                        const isProgress = entry.dataKey === 'progress';
                        if (isProgress && entry.value === null) return null;

                        const label = isProgress
                            ? t.progress
                            : viewMode === 'weekly'
                                ? t.lastWeek
                                : viewMode === 'monthly'
                                    ? t.lastMonth
                                    : t.lastYear;

                        const color = isProgress ? '#ec4899' : '#71717a';

                        return (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: color }}
                                    />
                                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
                                </div>
                                <p className="text-sm font-bold text-black dark:text-white">{entry.value}%</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

export function WeeklyProgressChart() {
    const language = useStore(state => state.language)
    const dailySnapshots = useStore(state => state.dailySnapshots)
    const timerIsActive = useStore(state => state.timer?.isActive)
    const tasks = useStore(state => state.tasks)
    const t = (translations[language as keyof typeof translations]?.dashboard?.charts || translations['en'].dashboard.charts) as any
    const common = (translations[language as keyof typeof translations]?.common || translations['en'].common) as any
    const [showTimer, setShowTimer] = useState(false)
    const [showNote, setShowNote] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'yearly'>('weekly')

    useEffect(() => {
        setIsMounted(true)
        if (showTimer && !noteShownInSession) {
            setShowNote(true)
            noteShownInSession = true
            const timeout = setTimeout(() => setShowNote(false), 20000)
            return () => clearTimeout(timeout)
        } else if (!showTimer) {
            setShowNote(false)
        }
    }, [showTimer])

    const chartData = useMemo(() => {
        if (!isMounted) return []

        const today = new Date()

        // Pre-process tasks to construct Set caches for fast lookups
        // Pre-process tasks to construct Set caches and group them for fast O(1) date-based lookups
        const recurringTasks: any[] = []
        const oneOffTasksByDueDate: Record<string, any[]> = {}
        const oneOffTasksByCompletionDate: Record<string, any[]> = {}

        tasks.forEach((t: any) => {
            const completedDatesSet = new Set(t.completedDates || [])
            const completionDatesSet = new Set(
                t.completionTimes?.map((time: string) => time.substring(0, 10)) || []
            )
            const activeDaysSet = t.activeDays ? new Set(t.activeDays) : null

            const optimizedTask = {
                recurrence: t.recurrence,
                completed: t.completed,
                dueDate: t.dueDate,
                completedDatesSet,
                completionDatesSet,
                activeDaysSet
            }

            if (t.recurrence !== 'None') {
                recurringTasks.push(optimizedTask)
            } else {
                if (t.dueDate) {
                    if (!oneOffTasksByDueDate[t.dueDate]) {
                        oneOffTasksByDueDate[t.dueDate] = []
                    }
                    oneOffTasksByDueDate[t.dueDate].push(optimizedTask)
                }
                
                t.completionTimes?.forEach((time: string) => {
                    const dateStr = time.substring(0, 10)
                    if (!oneOffTasksByCompletionDate[dateStr]) {
                        oneOffTasksByCompletionDate[dateStr] = []
                    }
                    oneOffTasksByCompletionDate[dateStr].push(optimizedTask)
                })
            }
        })

        // Helper to calculate daily progress counts dynamically using precompiled date indexes
        const getDailyTaskCounts = (dateStr: string, dayOfWeek: number) => {
            let completed = 0;
            let total = 0;

            // 1. Process recurring tasks (habits) - always evaluated for every day
            recurringTasks.forEach((t) => {
                total++;
                const isCompleted = t.completedDatesSet.has(dateStr);
                const isInactive = t.recurrence !== 'Once' && t.activeDaysSet && !t.activeDaysSet.has(dayOfWeek);
                if (isCompleted || isInactive) {
                    completed++;
                }
            });

            // 2. Process one-off tasks due on this date
            const dueTasks = oneOffTasksByDueDate[dateStr] || [];
            dueTasks.forEach((t) => {
                total++;
                const completedOnDate = t.completed && t.completionDatesSet.has(dateStr);
                if (completedOnDate || t.completed) {
                    completed++;
                }
            });

            // 3. Process one-off tasks completed on this date but NOT due on this date (to avoid double counting)
            const completedTasks = oneOffTasksByCompletionDate[dateStr] || [];
            completedTasks.forEach((t) => {
                if (t.dueDate === dateStr) return;
                total++;
                completed++;
            });

            return { completed, total };
        };

        const calculateDailyProgress = (dateStr: string, dayOfWeek: number) => {
            const { completed, total } = getDailyTaskCounts(dateStr, dayOfWeek);
            return total > 0 ? (completed / total) * 100 : 0;
        };

        if (viewMode === 'weekly') {
            const currentDay = today.getDay()
            const adjustedDay = currentDay === 0 ? 6 : currentDay - 1

            const startOfWeek = new Date(today)
            startOfWeek.setDate(today.getDate() - adjustedDay)
            startOfWeek.setHours(0, 0, 0, 0)

            const days = [
                common.days.mon,
                common.days.tue,
                common.days.wed,
                common.days.thu,
                common.days.fri,
                common.days.sat,
                common.days.sun
            ]

            return days.map((dayLabel, index) => {
                const date = new Date(startOfWeek)
                date.setDate(startOfWeek.getDate() + index)
                const dateStr = getLocalDateString(date)
                const dayOfWeek = date.getDay()

                const progress = calculateDailyProgress(dateStr, dayOfWeek)

                const lastWeekDate = new Date(date)
                lastWeekDate.setDate(date.getDate() - 7)
                const lastWeekDateStr = getLocalDateString(lastWeekDate)
                const lastWeekDayOfWeek = lastWeekDate.getDay()
                const lastWeekProgress = calculateDailyProgress(lastWeekDateStr, lastWeekDayOfWeek)

                return {
                    day: dayLabel,
                    progress: index <= adjustedDay ? Math.round(progress) : null,
                    comparison: Math.round(lastWeekProgress),
                    isToday: index === adjustedDay
                }
            })
        } else if (viewMode === 'monthly') {
            const currentYear = today.getFullYear()
            const currentMonth = today.getMonth()

            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
            const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1

            const monthlyData = []
            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(currentYear, currentMonth, i)
                const dateStr = getLocalDateString(date)
                const dayOfWeek = date.getDay()

                const progress = calculateDailyProgress(dateStr, dayOfWeek)

                const prevDate = new Date(prevMonthYear, prevMonth, i)
                const prevDateStr = getLocalDateString(prevDate)
                const prevDayOfWeek = prevDate.getDay()
                const prevProgress = calculateDailyProgress(prevDateStr, prevDayOfWeek)

                const isFuture = date > today

                monthlyData.push({
                    day: `${i}`,
                    progress: isFuture ? null : Math.round(progress),
                    comparison: Math.round(prevProgress),
                    isToday: i === today.getDate()
                })
            }
            return monthlyData
        } else {
            // yearly
            const currentYear = today.getFullYear()
            const currentMonthIndex = today.getMonth()

            const monthNamesEs = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
            const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            const monthNames = (language === 'es' || (language as string) === 'es-419') ? monthNamesEs : monthNamesEn

            const yearlyData = []
            for (let m = 0; m < 12; m++) {
                const daysInM = new Date(currentYear, m + 1, 0).getDate()

                let completedSum = 0
                let totalSum = 0

                for (let d = 1; d <= daysInM; d++) {
                    const dateStr = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    const dateObj = new Date(currentYear, m, d);
                    const dayOfWeek = dateObj.getDay();

                    const counts = getDailyTaskCounts(dateStr, dayOfWeek);
                    completedSum += counts.completed;
                    totalSum += counts.total;
                }

                const progress = totalSum > 0 ? (completedSum / totalSum) * 100 : 0
                const isFuture = m > currentMonthIndex

                let prevCompletedSum = 0
                let prevTotalSum = 0
                const prevYear = currentYear - 1
                const daysInPrevM = new Date(prevYear, m + 1, 0).getDate()
                for (let d = 1; d <= daysInPrevM; d++) {
                    const dateStr = `${prevYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    const dateObj = new Date(prevYear, m, d);
                    const dayOfWeek = dateObj.getDay();

                    const counts = getDailyTaskCounts(dateStr, dayOfWeek);
                    prevCompletedSum += counts.completed;
                    prevTotalSum += counts.total;
                }
                const prevProgress = prevTotalSum > 0 ? (prevCompletedSum / prevTotalSum) * 100 : 0

                yearlyData.push({
                    day: monthNames[m],
                    progress: isFuture ? null : Math.round(progress),
                    comparison: Math.round(prevProgress),
                    isToday: m === currentMonthIndex
                })
            }
            return yearlyData
        }
    }, [tasks, common.days, isMounted, viewMode, language])

    const averageProgress = useMemo(() => {
        const currentData = chartData.filter(d => d.progress !== null)
        if (currentData.length === 0) return 0
        const sum = currentData.reduce((acc, curr) => acc + (curr.progress || 0), 0)
        return Math.round(sum / currentData.length)
    }, [chartData])

    const bestDay = useMemo(() => {
        const currentData = chartData.filter(d => d.progress !== null)
        if (currentData.length === 0) return { day: '-', val: 0 }
        const best = currentData.reduce((prev, curr) => ((curr.progress || 0) > (prev.progress || 0) ? curr : prev), currentData[0])
        return { day: best.day, val: best.progress }
    }, [chartData])

    if (!isMounted) return <div className="glass-panel p-3 md:p-4 rounded-2xl w-full h-[200px] md:h-[250px] animate-pulse" />

    return (
        <div className="glass-panel p-3 md:p-4 rounded-2xl w-full relative overflow-visible">
            <AnimatePresence>
                {showNote && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute bottom-0 left-[50%] right-4 z-[100] px-6 py-2 rounded-xl flex items-center justify-between border border-primary/30 shadow-md bg-white dark:bg-slate-900"
                    >
                        <p className="text-sm leading-snug text-foreground font-semibold tracking-tight text-left pr-6">
                            "Mide tus tareas con un tiempo de ejecución, cumple con tus tareas y no te excedas"
                        </p>
                        <button
                            onClick={() => setShowNote(false)}
                            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                        >
                            <X className="w-4 h-4 text-foreground/60" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h2 className="text-lg md:text-xl font-bold">
                    {viewMode === 'weekly' ? t.weeklyCommitment : viewMode === 'monthly' ? t.monthlyCommitment : t.yearlyCommitment}
                </h2>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="bg-white/5 p-1 rounded-xl flex gap-1 text-[11px] font-bold">
                        <button
                            onClick={() => setViewMode('weekly')}
                            className={`px-3 py-1 rounded-lg transition-all ${viewMode === 'weekly' ? 'bg-white/10 text-foreground shadow-sm font-black' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t.weeklyView}
                        </button>
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={`px-3 py-1 rounded-lg transition-all ${viewMode === 'monthly' ? 'bg-white/10 text-foreground shadow-sm font-black' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t.monthlyView}
                        </button>
                        <button
                            onClick={() => setViewMode('yearly')}
                            className={`px-3 py-1 rounded-lg transition-all ${viewMode === 'yearly' ? 'bg-white/10 text-foreground shadow-sm font-black' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t.yearlyView}
                        </button>
                    </div>

                    <button
                        onClick={() => setShowTimer(!showTimer)}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        className={`p-2 rounded-full transition-all relative overflow-hidden flex-shrink-0 ${showTimer ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20' : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'}`}
                        title="Focus Timer"
                    >
                        <motion.div
                            animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
                            transition={{ duration: 0.4, ease: "easeInOut" }}
                        >
                            <AnimatedClock
                                isActive={timerIsActive}
                                speedScale={showTimer ? 1.5 : 0.5}
                            />
                        </motion.div>
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 h-[120px] md:h-[200px] items-stretch">
                <motion.div
                    animate={{ width: showTimer ? "50%" : "100%" }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                    className="h-full min-w-0 w-full"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                            <defs>
                                <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#8b5cf6" />
                                    <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                                <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                </linearGradient>
                                <filter id="glowWeekly" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="2" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis
                                dataKey="day"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                                tick={(props) => {
                                    const { x, y, payload } = props;
                                    const item = chartData.find(d => d.day === payload.value);
                                    const isToday = item?.isToday;

                                    if (viewMode === 'monthly') {
                                        const dayNum = parseInt(payload.value, 10);
                                        const shouldShowText = dayNum === 1 || dayNum % 5 === 0 || isToday;
                                        if (!shouldShowText) {
                                            if (isToday) {
                                                return (
                                                    <g transform={`translate(${x},${y})`}>
                                                        <circle cx={0} cy={25} r={2} fill="#ec4899" />
                                                    </g>
                                                );
                                            }
                                            return null;
                                        }
                                    }

                                    return (
                                        <g transform={`translate(${x},${y})`}>
                                            <text
                                                x={0}
                                                y={0}
                                                dy={16}
                                                textAnchor="middle"
                                                fill={isToday ? "#ec4899" : "#888888"}
                                                fontWeight={isToday ? "bold" : "normal"}
                                                className="text-[10px]"
                                            >
                                                {payload.value}
                                            </text>
                                            {isToday && (
                                                <circle cx={0} cy={25} r={2} fill="#ec4899" />
                                            )}
                                        </g>
                                    );
                                }}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}%`}
                                domain={[0, 100]}
                            />
                            <Tooltip
                                content={<CustomTooltip language={language} viewMode={viewMode} />}
                                cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                            />

                            <Area
                                type="monotone"
                                dataKey="progress"
                                stroke="none"
                                fill="url(#areaColor)"
                                animationDuration={2000}
                            />

                            <Line
                                type="monotone"
                                dataKey="comparison"
                                stroke="#71717a"
                                strokeWidth={2}
                                strokeOpacity={0.4}
                                dot={false}
                                activeDot={false}
                                strokeDasharray="6 6"
                            />

                            <Line
                                type="monotone"
                                dataKey="progress"
                                stroke="url(#lineColor)"
                                strokeWidth={showTimer ? 3 : 4}
                                dot={false}
                                activeDot={{ r: 6, fill: '#fff', stroke: '#ec4899', strokeWidth: 2 }}
                                animationDuration={1800}
                                filter="url(#glowWeekly)"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </motion.div>

                <AnimatePresence>
                    {showTimer && (
                        <motion.div
                            initial={{ width: 0, opacity: 0, filter: 'blur(10px)' }}
                            animate={{ width: "50%", opacity: 1, filter: 'blur(0px)' }}
                            exit={{ width: 0, opacity: 0, filter: 'blur(10px)' }}
                            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                            className="h-full overflow-hidden"
                        >
                            <FocusTimer onClose={() => setShowTimer(false)} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {!showTimer && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mt-2 hidden md:flex justify-between items-center text-sm text-muted-foreground px-4"
                    >
                        <div>
                            <span className="block text-xs font-semibold uppercase tracking-wider mb-1">
                                {viewMode === 'weekly' ? t.weeklyAverage : viewMode === 'monthly' ? t.monthlyAverage : t.yearlyAverage}
                            </span>
                            <span className="text-2xl font-bold text-foreground">{averageProgress}%</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-xs font-semibold uppercase tracking-wider mb-1">
                                {viewMode === 'yearly' ? t.bestMonth : t.bestDay}
                            </span>
                            <span className="text-2xl font-bold text-foreground">
                                {bestDay.day === '-' ? '-' : bestDay.day} ({bestDay.val}%)
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
