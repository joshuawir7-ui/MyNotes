"use client"

import { useStore } from "@/lib/store"
import { useState, useMemo, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, CheckCircle2, XCircle, Trash2, AlertCircle, UserCheck, UserX, Clock3, Flame, Calendar } from "lucide-react"
import { Reveal } from "@/components/ui/reveal"
import { PageDescription } from "@/components/ui/page-description"

import { translations } from "@/lib/translations"

export default function CalendarPage() {
    const appointments = useStore(state => state.appointments)
    const tasks = useStore(state => state.tasks)
    const addAppointment = useStore(state => state.addAppointment)
    const updateAppointment = useStore(state => state.updateAppointment)
    const deleteAppointment = useStore(state => state.deleteAppointment)
    const language = useStore(state => state.language)
    const loadAllTasks = useStore(state => state.loadAllTasks)
    const unloadTasks = useStore(state => state.unloadTasks)
    const t = translations[language].pages.calendar
    const common = translations[language].common
    const [isMounted, setIsMounted] = useState(false)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [newApptTitle, setNewApptTitle] = useState("")
    const [newApptNotes, setNewApptNotes] = useState("")
    const [selectedColor, setSelectedColor] = useState("#7f0df2") // Default to primary

    useEffect(() => {
        loadAllTasks()
        setIsMounted(true)
        setSelectedDate(new Date().toISOString().split('T')[0])
        return () => {
            unloadTasks()
        }
    }, [loadAllTasks, unloadTasks])

    const eventColors = [
        { name: 'Purple', value: '#7f0df2', bg: 'bg-[#7f0df2]/20', text: 'text-[#7f0df2]', border: 'border-[#7f0df2]/30' },
        { name: 'Pink', value: '#ec4899', bg: 'bg-[#ec4899]/20', text: 'text-[#ec4899]', border: 'border-[#ec4899]/30' },
        { name: 'Green', value: '#22c55e', bg: 'bg-[#22c55e]/20', text: 'text-[#22c55e]', border: 'border-[#22c55e]/30' },
        { name: 'Red', value: '#ef4444', bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]', border: 'border-[#ef4444]/30' },
        { name: 'Yellow', value: '#eab308', bg: 'bg-[#eab308]/20', text: 'text-[#eab308]', border: 'border-[#eab308]/30' },
        { name: 'Orange', value: '#f97316', bg: 'bg-[#f97316]/20', text: 'text-[#f97316]', border: 'border-[#f97316]/30' },
        { name: 'Blue', value: '#3b82f6', bg: 'bg-[#3b82f6]/20', text: 'text-[#3b82f6]', border: 'border-[#3b82f6]/30' },
    ]

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()

    // Sunday start (0)
    const startingDay = firstDayOfMonth

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const appointmentsByDate = useMemo(() => {
        const map: Record<string, any[]> = {}
        appointments.forEach(apt => {
            if (!map[apt.date]) map[apt.date] = []
            map[apt.date].push({
                id: apt.id,
                title: apt.title,
                type: 'appointment' as const,
                status: apt.status,
                color: apt.color,
                notes: apt.notes,
                time: apt.time
            })
        })
        return map
    }, [appointments])

    const relevantCalendarTasks = useMemo(() => {
        return tasks.filter(t => !t.isHabit || t.projectId === 'someday')
    }, [tasks])

    const calendarItemsByDate = useMemo(() => {
        const map: Record<string, any[]> = {}
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const daysInM = new Date(year, month + 1, 0).getDate()

        for (let d = 1; d <= daysInM; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            map[dateStr] = []
            const dayAppts = appointmentsByDate[dateStr]
            if (dayAppts) {
                map[dateStr].push(...dayAppts)
            }
        }

        relevantCalendarTasks.forEach(task => {
            if (!task.isHabit) {
                if (task.dueDate && map[task.dueDate]) {
                    const isCompleted = task.completed
                    map[task.dueDate].push({
                        id: task.id,
                        title: task.title,
                        type: 'task' as const,
                        status: isCompleted ? ('completed' as const) : ('pending' as const),
                        color: '#3b82f6'
                    })
                }
            } else {
                const completedSet = new Set(task.completedDates || [])
                const activeDaysSet = task.activeDays ? new Set(task.activeDays) : null

                for (let d = 1; d <= daysInM; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    if (task.dueDate && dateStr < task.dueDate) {
                        continue
                    }

                    const dateObj = new Date(year, month, d)
                    const dayOfWeek = dateObj.getDay()

                    let isActive = false;
                    if (task.recurrence === 'Daily' || task.recurrence === 'Weekly') {
                        isActive = !activeDaysSet || activeDaysSet.has(dayOfWeek)
                    } else if (task.recurrence === 'Monthly') {
                        isActive = !activeDaysSet || activeDaysSet.has(d)
                    }

                    if (isActive) {
                        const isCompleted = completedSet.has(dateStr)
                        map[dateStr].push({
                            id: task.id,
                            title: task.title,
                            type: 'habit' as const,
                            status: isCompleted ? ('completed' as const) : ('pending' as const),
                            color: '#7f0df2'
                        })
                    }
                }
            }
        })

        return map
    }, [currentDate, appointmentsByDate, relevantCalendarTasks])

    const getCalendarItemsForDate = useCallback((dateString: string) => {
        if (calendarItemsByDate[dateString]) {
            return calendarItemsByDate[dateString];
        }

        const dayAppointments = appointmentsByDate[dateString] || [];

        const dateObj = new Date(dateString + 'T12:00:00');
        const dayOfWeek = dateObj.getDay();

        const dayTasks = relevantCalendarTasks.filter(task => {
            if (!task.isHabit) {
                return task.dueDate === dateString;
            }
            if (task.dueDate && dateString < task.dueDate) {
                return false;
            }
            if (task.recurrence === 'Daily' || task.recurrence === 'Weekly') {
                return !task.activeDays || task.activeDays.includes(dayOfWeek);
            }
            if (task.recurrence === 'Monthly') {
                const dayOfMonth = dateObj.getDate();
                return !task.activeDays || task.activeDays.includes(dayOfMonth);
            }
            return false;
        }).map(task => {
            const isCompleted = task.isHabit
                ? (task.completedDates?.includes(dateString) ?? false)
                : task.completed;
            return {
                id: task.id,
                title: task.title,
                type: task.isHabit ? ('habit' as const) : ('task' as const),
                status: isCompleted ? ('completed' as const) : ('pending' as const),
                color: task.isHabit ? '#7f0df2' : '#3b82f6'
            };
        });

        return [...dayAppointments, ...dayTasks];
    }, [calendarItemsByDate, appointmentsByDate, relevantCalendarTasks])

    const handleAddAppointment = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedDate || !newApptTitle) return

        addAppointment({
            title: newApptTitle,
            date: selectedDate,
            time: "12:00",
            notes: newApptNotes,
            status: 'pending',
            color: selectedColor
        })
        setNewApptTitle("")
        setNewApptNotes("")
        setSelectedColor("#7f0df2")
        setShowAddModal(false)
    }

    const renderCalendarDays = () => {
        const days = []
        for (let i = 0; i < startingDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 bg-transparent border-b border-r border-white/5" />)
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const isToday = dateString === new Date().toISOString().split('T')[0]
            const isSelected = selectedDate === dateString

            const dayItems = getCalendarItemsForDate(dateString)

            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
            const dayOfWeek = dateObj.getDay(); // 0 = Sun, ..., 6 = Sat

            // Calculate leftSpan (consecutive empty cells to the left in the same week)
            let leftSpan = 0;
            const maxLeft = dayOfWeek;
            for (let offset = 1; offset <= maxLeft; offset++) {
                const prevDay = d - offset;
                if (prevDay < 1) break;
                const prevDateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
                if (getCalendarItemsForDate(prevDateString).length === 0) {
                    leftSpan++;
                } else {
                    break;
                }
            }

            // Calculate rightSpan (consecutive empty cells to the right in the same week)
            let rightSpan = 0;
            const maxRight = 6 - dayOfWeek;
            for (let offset = 1; offset <= maxRight; offset++) {
                const nextDay = d + offset;
                if (nextDay > daysInMonth) break;
                const nextDateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
                if (getCalendarItemsForDate(nextDateString).length === 0) {
                    rightSpan++;
                } else {
                    break;
                }
            }

            let L = 0;
            let R = 0;
            let alignClass = "self-stretch";
            let justifyClass = "justify-center";
            let textClass = "text-center";

            if (leftSpan > 0 && rightSpan > 0) {
                // Free on both sides: expand symmetrically
                const symmetricSpan = Math.min(leftSpan, rightSpan);
                L = symmetricSpan;
                R = symmetricSpan;
                alignClass = "self-center";
                justifyClass = "justify-center";
                textClass = "text-center";
            } else if (leftSpan > 0) {
                // Right side has neighbor event, span left
                L = leftSpan;
                R = 0;
                alignClass = "self-end";
                justifyClass = "justify-end";
                textClass = "text-right";
            } else if (rightSpan > 0) {
                // Left side has neighbor event, span right
                L = 0;
                R = rightSpan;
                alignClass = "self-start";
                justifyClass = "justify-start";
                textClass = "text-left";
            }

            const totalSpan = L + 1 + R;
            const spanStyle = {
                width: totalSpan > 1 ? "max-content" : "100%",
                maxWidth: totalSpan > 1 ? `calc(${totalSpan * 100}% + ${(totalSpan - 1) * 16}px - 12px)` : "100%",
                marginLeft: alignClass === "self-end"
                    ? `calc(-${L * 100}% - ${L * 16}px + 6px)`
                    : (alignClass === "self-start" ? "6px" : undefined),
                zIndex: totalSpan > 1 ? 20 : 10,
            };

            days.push(
                <div
                    key={d}
                    onClick={() => setSelectedDate(dateString)}
                    className={`min-h-[100px] p-2 border-b border-r border-white/5 relative group cursor-pointer transition-all hover:bg-white/[0.03]
                ${isSelected ? 'bg-primary/[0.07] ring-1 ring-inset ring-primary/20' : ''}
                ${isToday ? 'bg-white/[0.02]' : ''}
            `}
                >
                    <div className={`text-xs font-bold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full transition-colors
                ${isToday ? 'bg-primary text-black shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]' : 'text-muted-foreground group-hover:text-foreground'}
            `}>
                        {d}
                    </div>

                    <div className="absolute top-10 left-2 right-2 z-10 flex flex-col space-y-1 overflow-visible">
                        {dayItems.slice(0, 3).map(item => {
                            if (item.type === 'appointment') {
                                const config = eventColors.find(c => c.value === item.color) || eventColors[0]
                                return (
                                    <div
                                        key={item.id}
                                        style={spanStyle}
                                        className={`text-[9px] font-bold px-1.5 py-1 rounded border whitespace-normal break-words leading-tight flex items-start gap-1 shrink-0 ${alignClass} ${justifyClass}
                                        ${item.status === 'completed' || item.status === 'attendance' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                                                item.status === 'failed' || item.status === 'absence' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                                    item.status === 'tardiness' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                                                        `${config.bg} ${config.text} ${config.border}`}
                                     `}
                                    >
                                        {(item.status === 'completed' || item.status === 'attendance') && <CheckCircle2 className="w-2.5 h-2.5 shrink-0 mt-0.5" />}
                                        {(item.status === 'failed' || item.status === 'absence') && <XCircle className="w-2.5 h-2.5 shrink-0 mt-0.5" />}
                                        {item.status === 'tardiness' && <Clock3 className="w-2.5 h-2.5 shrink-0 mt-0.5" />}
                                        <span className={textClass}>{item.title}</span>
                                    </div>
                                )
                            } else {
                                const isComp = item.status === 'completed'
                                const isHabit = item.type === 'habit'
                                return (
                                    <div
                                        key={item.id}
                                        style={spanStyle}
                                        className={`text-[9px] font-bold px-1.5 py-1 rounded border whitespace-normal break-words leading-tight flex items-start gap-1 shrink-0 ${alignClass} ${justifyClass}
                                        ${isComp
                                                ? 'bg-green-500/20 text-green-300 border-green-500/30 line-through opacity-70'
                                                : isHabit
                                                    ? 'bg-[#7f0df2]/20 text-[#c084fc] border-[#7f0df2]/30'
                                                    : 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/30'
                                            }`}
                                    >
                                        {isComp && <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-green-400 mt-0.5" />}
                                        {!isComp && isHabit && <Flame className="w-2.5 h-2.5 shrink-0 text-orange-400 fill-orange-400 mt-0.5" />}
                                        <span className={textClass}>{item.title}</span>
                                    </div>
                                )
                            }
                        })}
                        {dayItems.length > 3 && (
                            <div className="text-[8px] text-muted-foreground pl-1 font-bold">
                                +{dayItems.length - 3} {language === 'es' ? 'más' : 'more'}
                            </div>
                        )}
                    </div>

                    {isSelected && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedDate(dateString); setShowAddModal(true) }}
                            className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-black flex items-center justify-center transition-all shadow-lg active:scale-95 z-30"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )
        }
        return days
    }


    return (
        <div className="min-h-screen bg-background text-foreground p-6 transition-colors duration-300 relative selection:bg-primary/30 flex flex-col items-center">
            {/* Ambient Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] dark:bg-purple-900/20" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] dark:bg-blue-900/20" />
            </div>

            <div className="relative z-10 w-full max-w-5xl">
                <Reveal margin="0px" duration={0.4}>
                    <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 text-center md:text-left">
                        <div className="flex flex-col items-center md:items-start">
                            <h1 className="text-3xl font-black tracking-tighter sm:text-4xl font-dancing-mobile">{t.title}</h1>
                            <div className="hidden md:block">
                                <PageDescription animate={false} size="lg" dancing="all">{t.description}</PageDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-1.5 border border-white/10 shadow-lg">
                            <button onClick={prevMonth} className="p-2.5 hover:bg-white/10 rounded-xl transition-all hover:scale-105 active:scale-95"><ChevronLeft className="w-5 h-5" /></button>
                            <span className="w-40 text-center font-bold text-sm tracking-tight">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                            <button onClick={nextMonth} className="p-2.5 hover:bg-white/10 rounded-xl transition-all hover:scale-105 active:scale-95"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                    </header>
                </Reveal>

                {/* Grid */}
                <Reveal delay={0.1} margin="0px" duration={0.4}>
                    <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                        {/* Week Headers */}
                        <div className="grid grid-cols-7 bg-white/[0.03] border-b border-white/5">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="py-4 text-center text-[10px] font-black uppercase text-muted-foreground/50 tracking-[0.2em]">
                                    {common.days[day.toLowerCase() as keyof typeof common.days]}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 bg-transparent border-l border-t border-white/5">
                            {renderCalendarDays()}
                        </div>
                    </div>
                </Reveal>

                {/* Selected Date Details */}
                {selectedDate && (
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                        <div className="glass-panel p-8 rounded-[2rem] border border-white/10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] rounded-full pointer-events-none" />

                            <div className="flex justify-between items-start mb-6">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-black font-black text-lg shadow-lg shadow-primary/30">
                                            {selectedDate.split('-')[2]}
                                        </div>
                                        <button
                                            onClick={() => setShowAddModal(true)}
                                            className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-sm active:scale-90 transition-transform"
                                        >
                                            <Plus className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-3">
                                        {t.events}
                                    </h2>
                                </div>
                                <div className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{selectedDate}</div>
                            </div>

                            <div className="space-y-4">
                                {(() => {
                                    const selectedDateItems = getCalendarItemsForDate(selectedDate)
                                    if (selectedDateItems.length === 0) {
                                        return (
                                            <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl opacity-40">
                                                <AlertCircle className="w-8 h-8 mb-2" />
                                                <p className="text-xs font-bold uppercase tracking-widest">{t.noEvents}</p>
                                            </div>
                                        )
                                    }
                                    return selectedDateItems.map(item => {
                                        if (item.type === 'appointment') {
                                            const apt = appointments.find(a => a.id === item.id)
                                            if (!apt) return null
                                            const config = eventColors.find(c => c.value === apt.color) || eventColors[0]
                                            return (
                                                <div key={apt.id} className="group/item flex flex-col gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/20 transition-all hover:bg-white/[0.05]">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-1.5 h-10 rounded-full shrink-0 ${apt.status === 'completed' || apt.status === 'attendance' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' :
                                                            apt.status === 'failed' || apt.status === 'absence' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' :
                                                                apt.status === 'tardiness' ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' :
                                                                    'shadow-[0_0_10px_rgba(0,0,0,0.2)]'
                                                            }`}
                                                            style={{ backgroundColor: (apt.status === 'pending') ? apt.color || '#7f0df2' : undefined }}
                                                        />

                                                        <div className="flex-1 min-w-0">
                                                            <div className={`font-bold text-sm leading-snug break-words ${apt.status === 'completed' || apt.status === 'attendance' ? 'text-muted-foreground line-through opacity-60' : ''}`}
                                                                style={{ color: (apt.status === 'pending') ? apt.color : undefined }}
                                                            >
                                                                {apt.title}
                                                            </div>
                                                            {apt.notes && (
                                                                <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed font-medium break-words">
                                                                    {apt.notes}
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 mt-2 tracking-wide uppercase opacity-50">
                                                                <Clock className="w-3 h-3 text-primary" /> {apt.time || 'All Day'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5 flex-wrap">
                                                        <button
                                                            onClick={() => updateAppointment(apt.id, { status: apt.status === 'attendance' ? 'pending' : 'attendance' })}
                                                            className={`p-2 rounded-xl transition-all scale-90 hover:scale-100 ${apt.status === 'attendance' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'hover:bg-green-500/20 text-green-500'}`}
                                                            title={t.attendance}
                                                        >
                                                            <UserCheck className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => updateAppointment(apt.id, { status: apt.status === 'absence' ? 'pending' : 'absence' })}
                                                            className={`p-2 rounded-xl transition-all scale-90 hover:scale-100 ${apt.status === 'absence' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'hover:bg-red-500/20 text-red-500'}`}
                                                            title={t.absence}
                                                        >
                                                            <UserX className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => updateAppointment(apt.id, { status: apt.status === 'tardiness' ? 'pending' : 'tardiness' })}
                                                            className={`p-2 rounded-xl transition-all scale-90 hover:scale-100 ${apt.status === 'tardiness' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'hover:bg-yellow-500/20 text-yellow-500'}`}
                                                            title={t.tardiness}
                                                        >
                                                            <Clock3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => updateAppointment(apt.id, { status: apt.status === 'completed' ? 'pending' : 'completed' })}
                                                            className={`p-2 rounded-xl transition-all scale-90 hover:scale-100 ${apt.status === 'completed' ? 'bg-zinc-500 text-white shadow-lg shadow-zinc-500/20' : 'hover:bg-zinc-500/20 text-zinc-500'}`}
                                                            title="Complete"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteAppointment(apt.id)}
                                                            className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-all scale-90 hover:scale-100 ml-1"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        } else {
                                            const isComp = item.status === 'completed'
                                            const isHabit = item.type === 'habit'
                                            return (
                                                <div key={item.id} className="group/item flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/20 transition-all hover:bg-white/[0.05]">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1.5 h-8 rounded-full shrink-0 ${isHabit ? 'bg-[#7f0df2]' : 'bg-[#3b82f6]'}`} />
                                                        <div>
                                                            <div className={`font-bold text-sm leading-snug ${isComp ? 'text-muted-foreground line-through opacity-60' : 'text-foreground'}`}>
                                                                {item.title}
                                                            </div>
                                                            <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50 mt-1 flex items-center gap-1.5">
                                                                {isHabit ? (
                                                                    <>
                                                                        <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />
                                                                        {language === 'es' ? 'Hábito' : 'Habit'}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Calendar className="w-3 h-3 text-blue-400" />
                                                                        {language === 'es' ? 'Tarea' : 'Task'}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isComp ? (
                                                            <span className="text-xs bg-green-500/10 text-green-500 border border-green-500/20 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                {language === 'es' ? 'Completado' : 'Completed'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 px-2.5 py-1 rounded-xl font-bold">
                                                                {language === 'es' ? 'Pendiente' : 'Pending'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        }
                                    })
                                })()}
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="w-full h-14 rounded-2xl border-2 border-dashed border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    <Plus className="w-4 h-4" /> {common.add} {t.events}
                                </button>
                            </div>
                        </div>

                        <div className="glass-panel p-8 rounded-[2rem] border border-white/10 flex flex-col">
                            <h2 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-green-400" />
                                </div>
                                Quick Notes
                            </h2>
                            <textarea
                                className="w-full flex-1 bg-white/5 border border-white/5 rounded-3xl p-6 outline-none focus:ring-1 focus:ring-primary/20 transition-all resize-none text-sm placeholder:text-muted-foreground/30 font-medium leading-relaxed shadow-inner"
                                placeholder="Jot down quick details, locations, or reminders for this specific date..."
                            />
                            <div className="mt-4 text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] text-right">Auto-saving...</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Redesigned Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-white/40 dark:bg-black/80 backdrop-blur-xl animate-in fade-in duration-500"
                        onClick={() => setShowAddModal(false)}
                    />
                    <div className="w-full max-w-md md:max-w-2xl relative glass-panel rounded-[2.5rem] border border-zinc-200 dark:border-white/10 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="w-16 h-16 rounded-[2rem] bg-zinc-500/10 flex items-center justify-center mb-4">
                                <AlertCircle className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
                            </div>
                            <h3 className="text-2xl font-black tracking-tighter">New Event</h3>
                            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em] mt-2">Selected: {selectedDate}</p>
                        </div>

                        <form onSubmit={handleAddAppointment} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                {/* Columna Izquierda */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest ml-4">Event Title</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="What's happening?"
                                            value={newApptTitle}
                                            onChange={(e) => setNewApptTitle(e.target.value)}
                                            className="w-full h-14 bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl px-6 outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all text-sm font-bold placeholder:text-zinc-400 dark:placeholder:text-muted-foreground/30 shadow-inner"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest ml-4">Description (Optional)</label>
                                        <textarea
                                            placeholder="Add a small description or note..."
                                            value={newApptNotes}
                                            onChange={(e) => setNewApptNotes(e.target.value)}
                                            className="w-full h-24 bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all text-sm font-medium placeholder:text-zinc-400 dark:placeholder:text-muted-foreground/30 shadow-inner resize-none leading-relaxed"
                                        />
                                    </div>
                                </div>

                                {/* Columna Derecha */}
                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest ml-4">Event Color</label>
                                        <div className="flex flex-wrap gap-3 justify-center">
                                            {eventColors.map(color => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setSelectedColor(color.value)}
                                                    className={`w-9 h-9 rounded-full transition-all flex items-center justify-center border-2 
                                                        ${selectedColor === color.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}
                                                    `}
                                                    style={{ backgroundColor: color.value }}
                                                >
                                                    {selectedColor === color.value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-zinc-200 dark:border-white/10 mt-6 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 h-12 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 h-12 bg-primary text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-md shadow-zinc-950/10 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center whitespace-nowrap"
                                >
                                    Secure Event
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    )
}
