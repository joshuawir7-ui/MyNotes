import { useStore, getLocalDateString } from "@/lib/store"
import { translations } from "@/lib/translations"
import { CheckCircle2, Circle, Repeat, Battery, BatteryMedium, BatteryLow, Calendar, Edit2, Trash2 } from "lucide-react"
import { useState, useEffect, useRef, useMemo } from "react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

export function EnhancedTaskList() {
    const tasks = useStore(state => state.tasks)
    const toggleTask = useStore(state => state.toggleTask)
    const deleteTask = useStore(state => state.deleteTask)
    const updateTask = useStore(state => state.updateTask)
    const language = useStore(state => state.language)
    const showToast = useStore(state => state.showToast)
    const t = translations[language].common

    const takenShortcutKeys = useMemo(() => {
        return new Set(tasks.map(t => t.shortcutKey).filter((k): k is number => typeof k === 'number'))
    }, [tasks])

    const [isMounted, setIsMounted] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState("")
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
    const editInputRef = useRef<HTMLInputElement>(null)
    const today = isMounted ? getLocalDateString() : ''
    const todayDate = new Date()
    const currentDay = todayDate.getDay()

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus()
        }
    }, [editingId])

    // Weekly tracker helper
    const weekDays = [t.days.mon, t.days.tue, t.days.wed, t.days.thu, t.days.fri, t.days.sat, t.days.sun]

    const getEnergyIcon = (level: string) => {
        switch (level) {
            case 'High': return <Battery className="w-4 h-4 text-red-500" />
            case 'Medium': return <BatteryMedium className="w-4 h-4 text-yellow-500" />
            case 'Low': return <BatteryLow className="w-4 h-4 text-green-500" />
        }
    }

    const getEnergyLabel = (level: string) => {
        switch (level) {
            case 'High': return t.energyLevels.high
            case 'Medium': return t.energyLevels.medium
            case 'Low': return t.energyLevels.low
            default: return level
        }
    }

    const getRecurrenceLabel = (recurrence: string) => {
        switch (recurrence) {
            case 'Daily': return t.recurrence.daily
            case 'Weekly': return t.recurrence.weekly
            case 'Monthly': return t.recurrence.monthly
            default: return recurrence
        }
    }

    // Calculate isCompleted for visualization
    const isTaskCompleted = (task: any) => {
        if (task.recurrence !== 'None') {
            const isCompleted = task.completedDates?.includes(today) ?? false
            const isActive = task.recurrence === 'Once' || !task.activeDays || task.activeDays.includes(currentDay)
            return isCompleted || !isActive
        }
        return task.completed
    }

    const todaysTasks = useMemo(() => {
        if (!isMounted) return []
        return tasks.filter(task => {
            if (task.dueDate && task.dueDate > today) {
                return false
            }
            if (task.recurrence === 'None') {
                return !task.completed || (task.completed && (task.completedDates?.includes(today) ?? false))
            }
            const isActive = task.recurrence === 'Once' || !task.activeDays || task.activeDays.includes(currentDay)
            return isActive
        })
    }, [tasks, today, isMounted, currentDay])

    return (
        <div className="grid grid-cols-1 gap-3">
            {!isMounted ? (
                <div className="p-2.5 rounded-[1rem] border border-white/5 bg-white/[0.03] animate-pulse h-16" />
            ) : todaysTasks.map(task => {
                const completed = isTaskCompleted(task)
                const isTodayActive = task.recurrence === 'None' || task.recurrence === 'Once' || !task.activeDays || task.activeDays.includes(currentDay)

                return (
                    <div
                        key={task.id}
                        className={`group p-2.5 rounded-[1rem] border border-white/5 transition-all flex flex-col gap-1.5 render-optimized
                    ${completed ? 'bg-white/[0.03] opacity-50' : 'bg-white/[0.08] hover:bg-white/[0.12] hover:border-white/10 hover:translate-y-[-1px] shadow-sm'}`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <button
                                    disabled={!isTodayActive}
                                    className={`transition-all duration-300 text-muted-foreground group-hover:text-primary ${completed ? 'text-green-500 scale-105' : 'hover:scale-110'} ${!isTodayActive ? 'cursor-not-allowed opacity-50' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isTodayActive) {
                                            toggleTask(task.id);
                                            const isComp = !completed;
                                            showToast(language === 'es' ? (isComp ? "Tarea completada" : "Tarea pendiente") : (isComp ? "Task completed" : "Task pending"), isComp ? "success" : "info");
                                        }
                                    }}
                                >
                                    {completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                </button>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        {editingId === task.id ? (
                                            <div className="flex flex-col gap-1 w-full mr-2">
                                                <input
                                                    ref={editInputRef}
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => {
                                                        if (editValue.trim() && editValue !== task.title) {
                                                            updateTask(task.id, { title: editValue })
                                                            showToast(language === 'es' ? "Tarea actualizada" : "Task updated", "success")
                                                        }
                                                        setEditingId(null)
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            if (editValue.trim() && editValue !== task.title) {
                                                                updateTask(task.id, { title: editValue })
                                                                showToast(language === 'es' ? "Tarea actualizada" : "Task updated", "success")
                                                            }
                                                            setEditingId(null)
                                                        }
                                                        if (e.key === 'Escape') setEditingId(null)
                                                    }}
                                                    className="bg-background border border-primary/40 rounded px-2 py-0.5 outline-none focus:border-primary text-[13px] font-bold w-full"
                                                />
                                            </div>
                                        ) : (
                                            <span
                                                className={`text-[13px] font-bold truncate leading-tight transition-all ${completed ? 'line-through text-muted-foreground' : 'group-hover:text-primary'}`}
                                                onDoubleClick={() => {
                                                    setEditingId(task.id)
                                                    setEditValue(task.title)
                                                }}
                                            >
                                                {task.title}
                                            </span>
                                        )}
                                        {!editingId && (
                                            <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingId(task.id);
                                                        setEditValue(task.title);
                                                    }}
                                                    className="p-1 rounded-md hover:bg-primary/20 text-primary transition-colors h-6 w-6 flex items-center justify-center"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTaskToDelete(task.id);
                                                    }}
                                                    className="p-1 rounded-md hover:bg-red-500/20 text-red-500 transition-colors h-6 w-6 flex items-center justify-center"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        {(() => {
                                            const autoIdx = todaysTasks.findIndex(t => t.id === task.id)
                                            const explicitKey = task.shortcutKey
                                            let displayKey: number | null = explicitKey || null

                                            if (!explicitKey && autoIdx >= 0 && autoIdx < 9) {
                                                const autoKey = autoIdx + 1
                                                const isTaken = takenShortcutKeys.has(autoKey)
                                                if (!isTaken) {
                                                    displayKey = autoKey
                                                }
                                            }

                                            if (displayKey) {
                                                return (
                                                    <span
                                                        className={`text-[8px] font-black px-1 py-0.5 rounded border leading-none transition-colors
                                                            ${explicitKey
                                                                ? 'bg-primary text-primary-foreground border-primary'
                                                                : 'bg-primary/20 text-primary border-primary/20'}
                                                        `}
                                                    >
                                                        {displayKey}
                                                    </span>
                                                )
                                            }
                                            return null
                                        })()}
                                    </div>
                                    {task.recurrence !== 'None' && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex items-center gap-1 text-[8px] text-blue-400 font-black uppercase tracking-widest leading-none opacity-80">
                                                <Repeat className="w-2.5 h-2.5" />
                                                {getRecurrenceLabel(task.recurrence)}
                                            </div>
                                            {!isTodayActive && (
                                                <span className="text-[7px] bg-zinc-500/20 text-zinc-400 px-1 py-0.5 rounded uppercase font-black tracking-wider">
                                                    {language === 'es' ? 'Inactivo hoy' : 'Inactive today'}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap uppercase tracking-tighter ml-2
                            ${task.energyLevel === 'High' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                    task.energyLevel === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                        'bg-green-500/10 border-green-500/20 text-green-500'}`}>
                                {getEnergyLabel(task.energyLevel)}
                            </div>

                        </div>

                        {/* Weekly Tracker for Recurring Tasks (Micro Dots) */}
                        {task.recurrence !== 'None' && (
                            <div className="flex items-center justify-between px-1 border-t border-white/5 pt-1.5 mt-1">
                                {weekDays.map((day, i) => {
                                    const checkDayOfWeek = i === 6 ? 0 : i + 1; // 0=Mon -> 1, 6=Sun -> 0
                                    const isActive = task.recurrence === 'Once' || !task.activeDays || task.activeDays.includes(checkDayOfWeek);
                                    
                                    // Calculate date for this day of current week
                                    const todayObj = new Date()
                                    const currentDay = todayObj.getDay()
                                    const adjustedDay = currentDay === 0 ? 6 : currentDay - 1
                                    const startOfWeek = new Date(todayObj)
                                    startOfWeek.setDate(todayObj.getDate() - adjustedDay)
                                    const checkDate = new Date(startOfWeek)
                                    checkDate.setDate(startOfWeek.getDate() + i)
                                    const dateStr = getLocalDateString(checkDate)
                                    
                                    const isCompleted = task.completedDates?.includes(dateStr) ?? false;
                                    const isToday = i === adjustedDay;
                                    const isFuture = i > adjustedDay;

                                    let dotClass = "";
                                    let textClass = "";

                                    if (!isActive) {
                                        dotClass = "bg-zinc-700/20 dark:bg-zinc-800/30 border-transparent opacity-30 cursor-not-allowed";
                                        textClass = "text-zinc-500 dark:text-zinc-600 opacity-40";
                                    } else if (isCompleted) {
                                        dotClass = "bg-primary border-primary scale-110 shadow-[0_0_8px_rgba(127,13,242,0.5)]";
                                        textClass = "text-primary font-black";
                                    } else if (isToday) {
                                        dotClass = "bg-transparent border-2 border-primary/60 scale-105 animate-pulse";
                                        textClass = "text-primary/80 font-bold";
                                    } else if (isFuture) {
                                        dotClass = "bg-white/[0.03] dark:bg-white/[0.01] border border-white/5";
                                        textClass = "text-muted-foreground/40";
                                    } else {
                                        // Past, active, but not completed (missed)
                                        dotClass = "bg-red-500/10 dark:bg-red-950/20 border border-red-500/30";
                                        textClass = "text-red-400/60";
                                    }

                                    return (
                                        <div key={i} className="flex flex-col items-center gap-0.5" title={!isActive ? "Día Inactivo" : isCompleted ? "Completado" : "Pendiente"}>
                                            <span className={`text-[6px] font-black uppercase leading-none transition-colors ${textClass}`}>
                                                {day.charAt(0)}
                                            </span>
                                            <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center transition-all ${dotClass}`}>
                                                {isCompleted && (
                                                    <svg className="w-1.5 h-1.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )
            })}

            <ConfirmationDialog
                isOpen={!!taskToDelete}
                onClose={() => setTaskToDelete(null)}
                onConfirm={() => {
                    if (taskToDelete) {
                        deleteTask(taskToDelete)
                        showToast(language === 'es' ? "Tarea eliminada" : "Task deleted", "info")
                    }
                    setTaskToDelete(null)
                }}
                title={language === 'es' ? '¿Eliminar esta tarea?' : 'Delete this task?'}
                message={language === 'es' ? 'Esta acción no se puede deshacer.' : 'This action cannot be undone.'}
            />
        </div>
    )
}
