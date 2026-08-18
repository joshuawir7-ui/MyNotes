/* eslint-disable */
"use client"
import { getLocalImageSrc } from "@/lib/image-utils"

import { motion, AnimatePresence } from "framer-motion"
import { useStore, RecurrenceType, Task, getLocalDateString } from "@/lib/store"
import { useState, useRef, useEffect, useMemo, memo } from "react"
import { Plus, Check, Trash2, Camera, X as XIcon, Edit2, Layers, ChevronRight, ChevronDown, History, Pin, Sparkles } from "lucide-react"
import { WeeklyProgressChart } from "@/components/dashboard/weekly-progress-chart"
import { Reveal } from "@/components/ui/reveal"

import { translations } from "@/lib/translations"
import { CustomSelect } from "@/components/ui/custom-select"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { MobileContextMenu } from "@/components/ui/mobile-context-menu"
import { IconPicker, ICON_MAP } from "@/components/ui/icon-picker"
import { Trophy, Star, PartyPopper, Flame } from "lucide-react"
import { useRouter } from "next/navigation"

const TourTooltip = ({
    children,
    arrowDirection = 'up',
    className = ''
}: {
    children: React.ReactNode,
    arrowDirection?: 'up' | 'down' | 'left' | 'right',
    className?: string
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)", y: arrowDirection === 'up' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute z-[110] glass-panel p-5 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl flex flex-col gap-3 text-left w-full max-w-sm will-change-[transform,opacity,filter] ${className}`}
        >
            {children}
        </motion.div>
    );
};

export default function TasksPage() {
    const tasks = useStore(state => state.tasks)
    const addTask = useStore(state => state.addTask)
    const toggleTask = useStore(state => state.toggleTask)
    const deleteTask = useStore(state => state.deleteTask)
    const updateTask = useStore(state => state.updateTask)
    const language = useStore(state => state.language)
    const tourStep = useStore(state => state.tourStep)
    const nextTourStep = useStore(state => state.nextTourStep)
    const endTour = useStore(state => state.endTour)
    const startTour = useStore(state => state.startTour)
    const tourCompleted = useStore(state => state.tourCompleted)
    const router = useRouter()
    const taskGroups = useStore(state => state.taskGroups)
    const addTaskGroup = useStore(state => state.addTaskGroup)
    const addTaskToGroup = useStore(state => state.addTaskToGroup)
    const toggleTaskInGroup = useStore(state => state.toggleTaskInGroup)
    const deleteTaskGroup = useStore(state => state.deleteTaskGroup)
    const deleteTaskFromGroup = useStore(state => state.deleteTaskFromGroup)
    const loadAllTasks = useStore(state => state.loadAllTasks)
    const unloadTasks = useStore(state => state.unloadTasks)
    const celebration = useStore(state => state.celebration)
    const clearCelebration = useStore(state => state.clearCelebration)
    const notes = useStore(state => state.notes)
    const updateNote = useStore(state => state.updateNote)
    const focusEffectEnabled = useStore(state => state.focusEffectEnabled)
    const completedOnceHabits = useStore(state => state.completedOnceHabits)
    const toggleTaskGroupPin = useStore(state => state.toggleTaskGroupPin)
    const showToast = useStore(state => state.showToast)
    const t = (translations[language]?.pages?.habits || translations['en'].pages.habits) as any
    const common = (translations[language]?.common || translations['en'].common) as any
    const [showCreator, setShowCreator] = useState(false)
    const [showGroupCreator, setShowGroupCreator] = useState(false)
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [showNoteTasks, setShowNoteTasks] = useState(false)
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
        // Restore note tasks collapsed/expanded state (default: collapsed/false)
        const savedNoteTasksState = localStorage.getItem('note_tasks_expanded');
        if (savedNoteTasksState !== null) {
            setShowNoteTasks(savedNoteTasksState === 'true');
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
    const [isDeleting, setIsDeleting] = useState<string | null>(null)

    const [editingHabit, setEditingHabit] = useState<Task | null>(null)
    const [isMounted, setIsMounted] = useState(false)

    // Focus Effect State
    const [isFocusEffectActive, setIsFocusEffectActive] = useState(false)
    const [isHighPriorityHighlighted, setIsHighPriorityHighlighted] = useState(false)
    const highPrioritySectionRef = useRef<HTMLDivElement>(null)
    const creatorScrollContainerRef = useRef<HTMLDivElement>(null)
    const activeDaysTooltipRef = useRef<HTMLDivElement>(null)

    // Group Creator State
    const [groupTitle, setGroupTitle] = useState("")
    const [groupColor, setGroupColor] = useState("#8b5cf6")
    const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({})

    const [renderLimit, setRenderLimit] = useState(4)

    useEffect(() => {
        loadAllTasks()
        setIsMounted(true)
        const timer = setTimeout(() => {
            setRenderLimit(9999)
        }, 300)
        return () => {
            clearTimeout(timer)
            unloadTasks()
        }
    }, [loadAllTasks, unloadTasks])

    // Form State
    const [title, setTitle] = useState("")
    const [icon, setIcon] = useState("Activity")
    const [recurrence, setRecurrence] = useState<RecurrenceType>("Daily")
    const [frequency, setFrequency] = useState(1)
    const [tempPhotos, setTempPhotos] = useState<string[]>([])
    const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]) // Mon-Sun
    const [energyLevel, setEnergyLevel] = useState<'High' | 'Medium' | 'Low'>('Medium')
    const [habitType, setHabitType] = useState<'good' | 'bad'>('good')
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)
    const [isFrequencySelectOpen, setIsFrequencySelectOpen] = useState(false)

    // Onboarding Guided Tour States
    const placeholderExamples = useMemo(() => {
        if (language === 'es') {
            return [
                "Leer 30m al día",
                "Entrenar",
                "Tomar agua",
                "Reflexionar",
                "Orar con Dios",
                "Saludar a la Familia"
            ]
        } else {
            return [
                "Read 30m a day",
                "Work out",
                "Drink water",
                "Reflect",
                "Pray to God",
                "Greet the family"
            ]
        }
    }, [language])

    const [placeholderIndex, setPlaceholderIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                setPlaceholderIndex((prev) => (prev + 1) % placeholderExamples.length)
            }
        }, 2000)
        return () => clearInterval(interval)
    }, [placeholderExamples])

    const [showActiveDaysTooltip, setShowActiveDaysTooltip] = useState(false)

    useEffect(() => {
        if (tourStep === 4) {
            setShowActiveDaysTooltip(false)
            const timer = setTimeout(() => {
                setShowActiveDaysTooltip(true)
            }, 800)
            return () => clearTimeout(timer)
        } else {
            setShowActiveDaysTooltip(false)
        }
    }, [tourStep])

    useEffect(() => {
        if (tourStep !== null && tourStep >= 8 && tourStep <= 10) {
            const timer = setTimeout(() => {
                if (tourStep === 10) {
                    endTour();
                } else {
                    nextTourStep();
                }
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [tourStep, nextTourStep, endTour]);

    useEffect(() => {
        if (tourStep === 5) {
            // Scroll to top of routine creator
            setTimeout(() => {
                creatorScrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        } else if (tourStep === 7) {
            // Scroll to bottom of routine creator with repeated checks to account for dynamic animation height changes
            const scrollBottom = () => {
                if (creatorScrollContainerRef.current) {
                    creatorScrollContainerRef.current.scrollTo({
                        top: 9999,
                        behavior: 'smooth'
                    });
                }
            };
            setTimeout(scrollBottom, 50);
            setTimeout(scrollBottom, 200);
            setTimeout(scrollBottom, 450);
        }
    }, [tourStep]);

    useEffect(() => {
        if (tourStep === 4 && showActiveDaysTooltip) {
            // Scroll precisely to make the second frequency tooltip visible (aligning its bottom with container bottom + 24px padding)
            const scrollToTooltip = () => {
                const container = creatorScrollContainerRef.current;
                const tooltip = activeDaysTooltipRef.current;
                if (container && tooltip) {
                    const getAbsoluteOffsetTop = (element: HTMLElement) => {
                        let top = 0;
                        let current: HTMLElement | null = element;
                        while (current) {
                            top += current.offsetTop;
                            current = current.offsetParent as HTMLElement | null;
                        }
                        return top;
                    };

                    const containerTop = getAbsoluteOffsetTop(container);
                    const tooltipTop = getAbsoluteOffsetTop(tooltip);
                    const offsetTopRelativeToContainer = tooltipTop - containerTop;

                    // The tooltip wrapper div is absolutely positioned and its height collapses to 0. 
                    // We must read the offsetHeight of its first child (the actual tooltip motion.div) or use a fallback.
                    const tooltipHeight = (tooltip.firstElementChild as HTMLElement)?.offsetHeight || tooltip.offsetHeight || 320;
                    const tooltipBottom = offsetTopRelativeToContainer + tooltipHeight;
                    const targetScrollTop = tooltipBottom - container.clientHeight + 24;

                    container.scrollTo({
                        top: Math.max(0, targetScrollTop),
                        behavior: 'smooth'
                    });
                }
            };
            setTimeout(scrollToTooltip, 50);
            setTimeout(scrollToTooltip, 200);
            setTimeout(scrollToTooltip, 450);
            setTimeout(scrollToTooltip, 800); // Additional delay to ensure animation has finished settling
        }
    }, [tourStep, showActiveDaysTooltip]);

    useEffect(() => {
        if (recurrence === 'Monthly') {
            setActiveDays([1])
        } else if (recurrence === 'Once') {
            setActiveDays([1, 2, 3, 4, 5, 6, 0])
        } else {
            setActiveDays([1, 2, 3, 4, 5, 6, 0])
        }
    }, [recurrence])

    const startEditHabit = (habit: Task) => {
        setEditingHabit(habit)
        setTitle(habit.title)
        setIcon(habit.icon || "Activity")
        setRecurrence(habit.recurrence || "Daily")
        setFrequency(habit.frequency || 1)
        setTempPhotos(habit.photos || [])
        setActiveDays(habit.activeDays || [1, 2, 3, 4, 5, 6, 0])
        setEnergyLevel(habit.energyLevel || "Medium")
        setHabitType(habit.habitType || 'good')
        setShowCreator(true)
    }

    const habits = useMemo(() => {
        const todayStr = getLocalDateString()
        return tasks.filter(t => t.isHabit && (!t.dueDate || t.dueDate <= todayStr))
    }, [tasks])

    const habitsByPriority = useMemo(() => {
        const priorityGroups = { High: [] as Task[], Medium: [] as Task[], Low: [] as Task[] }
        habits.forEach((h: Task) => {
            const level = h.energyLevel || 'Medium'
            if (level === 'High') priorityGroups.High.push(h)
            else if (level === 'Low') priorityGroups.Low.push(h)
            else priorityGroups.Medium.push(h)
        })
        return priorityGroups
    }, [habits])

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

    const handleToggleTask = (habit: Task) => {
        const today = getLocalDateString()
        const isCompleted = habit.completedDates && Array.isArray(habit.completedDates) ? habit.completedDates.includes(today) : habit.completed

        if (!isCompleted && focusEffectEnabled && (habit.energyLevel === 'Medium' || habit.energyLevel === 'Low')) {
            const isTaskCompleted = (h: Task) => h.completedDates && Array.isArray(h.completedDates) ? h.completedDates.includes(today) : h.completed

            const medLowTasks = [...habitsByPriority.Medium, ...habitsByPriority.Low]
            const totalMedLow = medLowTasks.length

            // Calculate how many med/low are completed (including this one being checked right now)
            const completedMedLow = medLowTasks.filter(isTaskCompleted).length + 1

            const threshold = Math.max(1, Math.ceil(totalMedLow / 2))

            // Calculate how many high are completed
            const completedHigh = habitsByPriority.High.filter(isTaskCompleted).length

            if (completedMedLow >= threshold && completedHigh === 0 && habitsByPriority.High.length > 0) {
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    try {
                        navigator.vibrate([100, 50, 100, 50, 100]);
                    } catch (e) {
                        // Ignore haptic feedback errors
                    }
                }

                setIsFocusEffectActive(true)
                setIsHighPriorityHighlighted(true)

                setTimeout(() => {
                    if (highPrioritySectionRef.current) {
                        highPrioritySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                }, 100)

                setTimeout(() => setIsFocusEffectActive(false), 1000)
                setTimeout(() => setIsHighPriorityHighlighted(false), 3000)
            }
        }

        toggleTask(habit.id)
        if (isCompleted) {
            showToast(language === 'es' ? "Hábito/Tarea pendiente" : "Habit/Task pending", "info")
        } else {
            if (habit.habitType === 'bad') {
                const badHabitMessagesEs = ["Bien hecho", "Mal hábito evitado", "¡Así se hace!"]
                const badHabitMessagesEn = ["Well done!", "Bad habit avoided!", "That's the way!"]
                const randomIndex = Math.floor(Math.random() * badHabitMessagesEs.length)
                const msg = language === 'es' ? badHabitMessagesEs[randomIndex] : badHabitMessagesEn[randomIndex]
                showToast(msg, "success")
            } else {
                showToast(language === 'es' ? "Hábito/Tarea completado" : "Habit/Task completed", "success")
            }
            if (tourStep === 8) {
                nextTourStep()
            }
        }
    }

    const noteTasksGroup = useMemo(() => {
        const allTasks: { noteId: string, blockId: string, taskId: string, title: string, completed: boolean, noteTitle: string }[] = [];
        notes.forEach(note => {
            note.blocks.forEach(block => {
                if (block.type === 'task-list') {
                    const items = Array.isArray(block.content?.items) ? block.content.items : (Array.isArray(block.content) ? block.content : []);
                    items.forEach((item: any) => {
                        let text = item.text || '';
                        // Basic strip HTML tags for simple task titles from rich text
                        if (typeof text === 'string') {
                            text = text.replace(/<[^>]*>?/gm, '');
                            text = text.replace(/&nbsp;/g, ' ').replace(/&nbsp/g, ' ').replace(/\u00A0/g, ' ');
                        }
                        if (text.trim() === '') text = 'Tarea sin nombre';

                        allTasks.push({
                            noteId: note.id,
                            blockId: block.id,
                            taskId: item.id,
                            title: text,
                            completed: item.checked,
                            noteTitle: note.title || t.untitled || 'Nota sin título'
                        });
                    });
                }
            });
        });
        return allTasks;
    }, [notes, t.untitled]);

    const handleCreateHabit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!title) return

        if (editingHabit) {
            updateTask(editingHabit.id, {
                title,
                icon,
                energyLevel,
                recurrence,
                frequency,
                photos: tempPhotos,
                activeDays,
                habitType
            })
            setEditingHabit(null)
            showToast(language === 'es' ? "Hábito/Tarea actualizado" : "Habit/Task updated", "success")
        } else {
            addTask({
                title,
                icon,
                energyLevel,
                projectId: 'p2', // Default to Habits project
                recurrence,
                isHabit: true,
                frequency,
                photos: tempPhotos,
                activeDays,
                habitType
            } as any)
            showToast(language === 'es' ? "Hábito/Tarea creado" : "Habit/Task created", "success")
        }
        setTitle("")
        setIcon("Activity")
        setTempPhotos([])
        setActiveDays([1, 2, 3, 4, 5, 6, 0])
        setHabitType('good')
        setShowCreator(false)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const { saveBase64ImageToFile } = await import('@/lib/image-utils');
                const uri = await saveBase64ImageToFile(base64);
                setTempPhotos([...tempPhotos, uri || base64])
            }
            reader.readAsDataURL(file)
        }
    }

    const recurrenceOptions = [
        { label: common.recurrence.daily, value: "Daily" },
        { label: common.recurrence.weekly, value: "Weekly" },
        { label: common.recurrence.monthly, value: "Monthly" },
        { label: common.recurrence.once, value: "Once" }
    ]

    // In a real app, this would be calculated from 'completedDates' for all habits combined or similar metrics.
    const getMissedDays = (task: any) => {
        return task.missed || 0
    }

    return (
        <div className="p-6 h-full container mx-auto max-w-5xl flex flex-col gap-8 pb-20 relative min-h-screen">
            {/* Ambient Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] dark:bg-purple-900/20" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] dark:bg-blue-900/20" />
            </div>

            <style>{`
                @keyframes screenShake {
                    0% { transform: translate3d(1px, 1px, 0) rotate(0deg); }
                    10% { transform: translate3d(-2px, -2px, 0) rotate(-1deg); }
                    20% { transform: translate3d(-3px, 0px, 0) rotate(1deg); }
                    30% { transform: translate3d(3px, 2px, 0) rotate(0deg); }
                    40% { transform: translate3d(1px, -1px, 0) rotate(1deg); }
                    50% { transform: translate3d(-1px, 2px, 0) rotate(-1deg); }
                    60% { transform: translate3d(-3px, 1px, 0) rotate(0deg); }
                    70% { transform: translate3d(3px, 1px, 0) rotate(-1deg); }
                    80% { transform: translate3d(-1px, -1px, 0) rotate(1deg); }
                    90% { transform: translate3d(1px, 2px, 0) rotate(0deg); }
                    100% { transform: translate3d(1px, -2px, 0) rotate(-1deg); }
                }
                .shake-effect {
                    animation: screenShake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                    backface-visibility: hidden;
                    perspective: 1000px;
                    will-change: transform;
                }
                .focus-priority-transition {
                    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), 
                                filter 0.5s cubic-bezier(0.16, 1, 0.3, 1), 
                                opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    will-change: transform, opacity;
                    transform: translate3d(0, 0, 0);
                    backface-visibility: hidden;
                }
                .gpu-accelerated {
                    transform: translate3d(0, 0, 0);
                    backface-visibility: hidden;
                    perspective: 1000px;
                }
                @keyframes pulsePurpleGreen {
                    0%, 100% {
                        background-color: #7f0df2; /* Purple */
                        box-shadow: 0 0 10px rgba(127, 13, 242, 0.5);
                    }
                    50% {
                        background-color: #22c55e; /* Green */
                        box-shadow: 0 0 20px rgba(34, 197, 94, 0.7);
                    }
                }
                .animate-pulse-purple-green {
                    animation: pulsePurpleGreen 2s infinite ease-in-out !important;
                }
                @keyframes pulseGreenPurpleBorder {
                    0%, 100% {
                        border-color: #22c55e; /* Green */
                        box-shadow: 0 0 15px rgba(34, 197, 94, 0.8);
                    }
                    50% {
                        border-color: #a855f7; /* Purple */
                        box-shadow: 0 0 15px rgba(168, 85, 247, 0.8);
                    }
                }
                .animate-pulse-green-purple-border {
                    animation: pulseGreenPurpleBorder 1.5s infinite ease-in-out !important;
                }
                .neon-glow {
                    box-shadow: 0 0 15px rgba(168, 85, 247, 0.4), inset 0 0 15px rgba(168, 85, 247, 0.2);
                }
                .neon-glow-red {
                    box-shadow: 0 0 15px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(239, 68, 68, 0.2);
                }
            `}</style>

            <div className={`relative z-10 w-full flex flex-col gap-8 gpu-accelerated ${isFocusEffectActive ? 'shake-effect' : ''}`}>
                <Reveal margin="0px" duration={0.4} className={`relative transition-all duration-300 ${tourStep === 1 ? 'z-50' : 'z-10'}`}>
                    <header className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                        <div className="flex flex-col items-center md:items-start">
                            <h1 className="text-3xl font-black tracking-tighter font-dancing-mobile">
                                {t.title}
                            </h1>
                            <p className="text-muted-foreground hidden md:block">{t.description}</p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto relative z-40">
                            <button
                                onClick={() => setShowGroupCreator(true)}
                                className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20"
                            >
                                <Layers className="w-5 h-5" /> {t.addTaskGroup}
                            </button>
                            <button
                                id="btn-new-habit"
                                onClick={() => {
                                    setEditingHabit(null)
                                    setTitle("")
                                    setIcon("Activity")
                                    setRecurrence("Daily")
                                    setFrequency(1)
                                    setTempPhotos([])
                                    setActiveDays([1, 2, 3, 4, 5, 6, 0])
                                    setEnergyLevel("Medium")
                                    setHabitType('good')
                                    setShowCreator(true)
                                    if (tourStep === 1) {
                                        nextTourStep()
                                    }
                                }}
                                className={`w-full md:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-bold hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 ${tourStep === 1 ? 'animate-pulse-green-purple-border border-2 border-dashed' : ''
                                    }`}
                            >
                                <Plus className="w-5 h-5" /> {t.newHabit}
                            </button>

                            {isMounted && tourStep === 1 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)", y: 10 }}
                                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)", y: 10 }}
                                    transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                                    className="absolute top-full right-0 mt-3 z-[100] w-full max-w-sm glass-panel p-5 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl flex flex-col gap-3 text-center will-change-[transform,opacity,filter]"
                                >
                                    <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold leading-relaxed">
                                        {language === 'es'
                                            ? "Empecemos creando un hábito o tarea diaria, puede ser algo que hagas todos los días y no quieras que se olvide, y sepas cuando ya lo has hecho"
                                            : "Let's start by creating a habit or daily task, it can be something you do every day and don't want to forget, so you know when you've done it"}
                                    </p>
                                    <p className="text-sm font-extrabold text-primary">
                                        {language === 'es' ? "Verás que te gustará" : "You will love it!"}
                                    </p>
                                    <button
                                        onClick={() => {
                                            setEditingHabit(null)
                                            setTitle("")
                                            setIcon("Activity")
                                            setRecurrence("Daily")
                                            setFrequency(1)
                                            setTempPhotos([])
                                            setActiveDays([1, 2, 3, 4, 5, 6, 0])
                                            setEnergyLevel("Medium")
                                            setHabitType('good')
                                            setShowCreator(true)
                                            nextTourStep()
                                        }}
                                        className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
                                    >
                                        {language === 'es' ? "Comenzar" : "Start"}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </header>
                </Reveal>




                {/* Task Groups Section */}




                {/* Task Groups Section */}
                <AnimatePresence>
                    {((taskGroups || []).length > 0 || noteTasksGroup.length > 0) && (
                        <Reveal delay={0.05} margin="0px" duration={0.4}>
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    {t.taskGroups}
                                    <span className="text-xs font-normal text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{(taskGroups || []).length + (noteTasksGroup.length > 0 ? 1 : 0)}</span>
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(taskGroups || []).map((group, index) => {
                                        const completed = group.tasks.filter(t => t.completed).length;
                                        const total = group.tasks.length;
                                        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
                                        const isCollapsed = collapsedGroups[group.id] || false;
                                        const isSingleLast = (taskGroups || []).length % 2 !== 0 && index === (taskGroups || []).length - 1;

                                        return (
                                            <motion.div
                                                key={group.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`glass-panel p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden ${isSingleLast ? "md:col-span-2 md:justify-self-center w-full md:max-w-[calc(50%-8px)]" : ""
                                                    }`}
                                            >
                                                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: group.color }} />

                                                <div
                                                    className="flex justify-between items-center cursor-pointer select-none"
                                                    onClick={() => toggleGroupCollapse(group.id)}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="font-bold text-lg flex items-center gap-2 truncate">
                                                                {group.title}
                                                                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                            </h3>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleTaskGroupPin(group.id);
                                                                }}
                                                                className={`p-1.5 rounded-lg transition-all shrink-0 ${group.isPinned ? 'text-indigo-400 bg-indigo-500/10 scale-105' : 'text-muted-foreground/60 hover:text-indigo-400 hover:bg-white/5 hover:scale-105 active:scale-95'}`}
                                                                title={group.isPinned ? "Desfijar grupo" : "Fijar grupo"}
                                                            >
                                                                <Pin className={`w-4 h-4 transition-all ${group.isPinned ? 'fill-indigo-400 rotate-45' : 'rotate-0'}`} />
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{t.tasksCompletedCount.replace('{completed}', completed.toString()).replace('{total}', total.toString())}</p>
                                                    </div>
                                                    <div className="relative w-12 h-12 shrink-0">
                                                        <svg className="w-full h-full transform -rotate-90">
                                                            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                                                            <motion.circle
                                                                cx="24" cy="24" r="20"
                                                                stroke={group.color}
                                                                strokeWidth="4"
                                                                fill="transparent"
                                                                strokeDasharray={125.6}
                                                                initial={{ strokeDashoffset: 125.6 }}
                                                                animate={{ strokeDashoffset: 125.6 - (progress / 100) * 125.6 }}
                                                                transition={{ duration: 1, ease: "easeOut" }}
                                                            />
                                                        </svg>
                                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
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
                                                            className="space-y-4 overflow-hidden pt-2"
                                                        >
                                                            <div className="space-y-2">
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
                                                                            className="flex items-center justify-between group/task cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-all"
                                                                            onClick={() => {
                                                                                toggleTaskInGroup(group.id, task.id);
                                                                                const nextVal = !task.completed;
                                                                                showToast(language === 'es' ? (nextVal ? "Tarea completada" : "Tarea pendiente") : (nextVal ? "Task completed" : "Task pending"), nextVal ? "success" : "info");
                                                                            }}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div
                                                                                    className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center shadow-sm ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/5 border-white/20 group-hover/task:border-indigo-500 group-hover/task:scale-110'}`}
                                                                                >
                                                                                    {task.completed && <Check className="w-3.5 h-3.5" />}
                                                                                </div>
                                                                                <span className={`text-base font-semibold tracking-tight transition-all ${task.completed ? 'text-muted-foreground line-through opacity-50' : 'text-foreground'}`}>{task.title}</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    deleteTaskFromGroup(group.id, task.id);
                                                                                    showToast(language === 'es' ? "Tarea eliminada" : "Task deleted", "info");
                                                                                }}
                                                                                className="opacity-0 group-hover/task:opacity-100 p-1 text-red-400 hover:bg-red-400/10 rounded transition-all"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </MobileContextMenu>
                                                                ))}
                                                            </div>

                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder={t.newTaskPlaceholder}
                                                                    value={newTaskTitle[group.id] || ""}
                                                                    onChange={(e) => setNewTaskTitle({ ...newTaskTitle, [group.id]: e.target.value })}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && newTaskTitle[group.id]) {
                                                                            addTaskToGroup(group.id, newTaskTitle[group.id]);
                                                                            setNewTaskTitle({ ...newTaskTitle, [group.id]: "" });
                                                                        }
                                                                    }}
                                                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500/50 transition-all"
                                                                />
                                                                <button
                                                                    onClick={() => {
                                                                        deleteTaskGroup(group.id);
                                                                        showToast(language === 'es' ? "Grupo de tareas eliminado" : "Task group deleted", "info");
                                                                    }}
                                                                    className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
                                                                    title={t.deleteGroup}
                                                                >
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Reveal>
                    )}
                </AnimatePresence>

                <Reveal delay={0.1} margin="0px" duration={0.4}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {t.myRoutines}
                                <span className="text-xs font-normal text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{habits.length} {t.active}</span>
                            </h2>
                            <div className="flex gap-2">
                                {!tourCompleted && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            router.push('/')
                                            startTour()
                                        }}
                                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 text-primary hover:text-primary transition-all active:scale-95 shadow-sm cursor-pointer"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        {language === 'es' ? 'Guía' : 'Guide'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowHistoryModal(true)}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-all active:scale-95 shadow-sm"
                                >
                                    <History className="w-3.5 h-3.5" />
                                    {language === 'es' ? 'Historial' : 'History'}
                                </button>
                            </div>
                        </div>

                        {habits.length === 0 && isMounted && <p className="text-muted-foreground italic">{t.noHabits}</p>}

                        <div className="flex flex-col gap-8">
                            {!isMounted ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="w-1.5 h-6 rounded-full bg-zinc-300 dark:bg-zinc-800" />
                                        <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded w-24" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <HabitCardSkeleton />
                                        <HabitCardSkeleton />
                                    </div>
                                </div>
                            ) : (
                                (['High', 'Medium', 'Low'] as const).map(priority => {
                                    const groupedHabits = habitsByPriority[priority]
                                    if (groupedHabits.length === 0) return null

                                    const priorityInfo = {
                                        High: { label: language === 'es' ? 'Prioridad Alta' : 'High Priority', color: 'text-red-400', icon: 'AlertCircle' },
                                        Medium: { label: language === 'es' ? 'Prioridad Media' : 'Medium Priority', color: 'text-orange-400', icon: 'Activity' },
                                        Low: { label: language === 'es' ? 'Prioridad Baja' : 'Low Priority', color: 'text-blue-400', icon: 'ArrowDown' }
                                    }[priority]

                                    return (
                                        <div
                                            key={priority}
                                            ref={priority === 'High' ? highPrioritySectionRef : null}
                                            className={`space-y-4 focus-priority-transition ${isFocusEffectActive && priority !== 'High' ? 'blur-[2px] grayscale opacity-40 scale-[0.98]' : ''}`}
                                        >
                                            <div className="flex items-center gap-2 px-1">
                                                <div className={`w-1.5 h-6 rounded-full ${priorityInfo.color.replace('text-', 'bg-')}`} />
                                                <h3 className={`text-xs font-black uppercase tracking-widest ${priorityInfo.color}`}>
                                                    {priorityInfo.label}
                                                </h3>
                                                <span className="text-[10px] text-muted-foreground/50">({groupedHabits.length})</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {groupedHabits.slice(0, renderLimit).map((habit: Task, index) => {
                                                        const today = getLocalDateString()
                                                        const isCompleted = habit.completedDates && Array.isArray(habit.completedDates) ? habit.completedDates.includes(today) : habit.completed
                                                        const missed = getMissedDays(habit)
                                                        const isSingleLast = groupedHabits.length % 2 !== 0 && index === groupedHabits.length - 1

                                                        return (
                                                            <div
                                                                key={habit.id}
                                                                style={{
                                                                    animationDelay: `${Math.min(index, 8) * 0.05}s`,
                                                                    animationFillMode: 'both'
                                                                }}
                                                                className={`${isSingleLast ? "md:col-span-2 md:justify-self-center w-full md:max-w-[calc(50%-8px)]" : "w-full"} animate-fade-in-up-fast render-optimized`}
                                                            >
                                                                <HabitCard
                                                                    habit={habit}
                                                                    isCompleted={isCompleted}
                                                                    missed={missed}
                                                                    onEditHabit={startEditHabit}
                                                                    updateTask={updateTask}
                                                                    setIsDeleting={setIsDeleting}
                                                                    handleToggleTask={handleToggleTask}
                                                                    isHighPriorityHighlighted={isHighPriorityHighlighted}
                                                                    isFocusEffectActive={isFocusEffectActive}
                                                                    priority={priority}
                                                                    t={t}
                                                                    common={common}
                                                                />
                                                            </div>
                                                        )
                                                    })}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </Reveal>

                {/* Note Tasks Virtual Group */}
                <AnimatePresence>
                    {noteTasksGroup.length > 0 && (
                        <Reveal delay={0.2} margin="0px" duration={0.4}>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden mt-4"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500" />

                                <div className="flex justify-between items-center cursor-pointer" onClick={() => {
                                    const next = !showNoteTasks;
                                    setShowNoteTasks(next);
                                    localStorage.setItem('note_tasks_expanded', String(next));
                                }}>
                                    <div>
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            {language === 'es' ? 'Tareas de Notas' : 'Note Tasks'}
                                            <ChevronDown className={`w-4 h-4 transition-transform ${showNoteTasks ? '' : '-rotate-90'}`} />
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {t.tasksCompletedCount.replace('{completed}', noteTasksGroup.filter(t => t.completed).length.toString()).replace('{total}', noteTasksGroup.length.toString())}
                                        </p>
                                    </div>
                                    <div className="relative w-12 h-12 shrink-0">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                                            <motion.circle
                                                cx="24" cy="24" r="20"
                                                stroke="#eab308"
                                                strokeWidth="4"
                                                fill="transparent"
                                                strokeDasharray={125.6}
                                                initial={{ strokeDashoffset: 125.6 }}
                                                animate={{ strokeDashoffset: 125.6 - ((noteTasksGroup.length === 0 ? 0 : Math.round((noteTasksGroup.filter(t => t.completed).length / noteTasksGroup.length) * 100)) / 100) * 125.6 }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                                            {noteTasksGroup.length === 0 ? 0 : Math.round((noteTasksGroup.filter(t => t.completed).length / noteTasksGroup.length) * 100)}%
                                        </div>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {showNoteTasks && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-2 overflow-hidden"
                                        >
                                            {noteTasksGroup.map(task => (
                                                <div key={`${task.noteId}-${task.taskId}`} className="flex items-center justify-between group/task cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-all" onClick={() => {
                                                    const note = notes.find(n => n.id === task.noteId);
                                                    if (note) {
                                                        const newBlocks = note.blocks.map(block => {
                                                            if (block.id === task.blockId) {
                                                                const items = Array.isArray(block.content?.items) ? block.content.items : (Array.isArray(block.content) ? block.content : []);
                                                                const newItems = items.map((item: any) => item.id === task.taskId ? { ...item, checked: !item.checked } : item);
                                                                return { ...block, content: Array.isArray(block.content) ? newItems : { ...block.content, items: newItems } };
                                                            }
                                                            return block;
                                                        });
                                                        updateNote(note.id, note.title, newBlocks);
                                                        showToast(language === 'es' ? "Tarea de nota actualizada" : "Note task updated", "success");
                                                    }
                                                }}>
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center shadow-sm shrink-0 ${task.completed ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white/5 border-white/20 group-hover/task:border-yellow-500 group-hover/task:scale-110'}`}
                                                        >
                                                            {task.completed && <Check className="w-3.5 h-3.5" />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm font-semibold tracking-tight transition-all line-clamp-1 ${task.completed ? 'text-muted-foreground line-through opacity-50' : 'text-foreground'}`}>{task.title}</span>
                                                            <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{task.noteTitle}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </Reveal>
                    )}
                </AnimatePresence>

                {/* Stats Chart (Bottom, Full Width, Line Chart) */}
                <Reveal delay={0.3} margin="0px" duration={0.8}>
                    <motion.div
                        initial={{ opacity: 0, y: 40, filter: "blur(15px)" }}
                        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <WeeklyProgressChart />
                    </motion.div>
                </Reveal>

                <ConfirmationDialog
                    isOpen={!!isDeleting}
                    onClose={() => setIsDeleting(null)}
                    onConfirm={() => {
                        if (isDeleting) {
                            deleteTask(isDeleting);
                            showToast(language === 'es' ? "Hábito/Tarea eliminado" : "Habit/Task deleted", "info");
                        }
                    }}
                    title={common.confirmDelete || "¿Eliminar esta rutina?"}
                    message={language === 'es' ? "Esta acción no se puede deshacer y perderás tu progreso." : "This action cannot be undone and you will lose your progress."}
                />
            </div>

            {/* Task Group Creator Modal */}
            <AnimatePresence>
                {showGroupCreator && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowGroupCreator(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, filter: "blur(20px)", y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, filter: "blur(0px)", y: 0, scale: 1 }}
                            exit={{ opacity: 0, filter: "blur(20px)", y: 20, scale: 0.9 }}
                            className="relative w-full max-w-md glass-panel p-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-card shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
                        >
                            <h3 className="text-2xl font-black mb-6">{t.newTaskGroup}</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.groupName}</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Tareas Escolares"
                                        value={groupTitle}
                                        onChange={(e) => setGroupTitle(e.target.value)}
                                        className="w-full bg-background/50 border border-white/10 rounded-xl px-5 py-3 outline-none focus:border-indigo-500 transition-all"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.groupColor}</label>
                                    <div className="flex gap-3">
                                        {["#8b5cf6", "#3b82f6", "#ef4444", "#10b981", "#f59e0b"].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setGroupColor(c)}
                                                className={`w-10 h-10 rounded-full border-2 transition-all ${groupColor === c ? 'border-white scale-110' : 'border-transparent opacity-50'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (groupTitle) {
                                            addTaskGroup(groupTitle, groupColor);
                                            showToast(language === 'es' ? "Grupo creado" : "Group created", "success");
                                            setGroupTitle("");
                                            setShowGroupCreator(false);
                                        }
                                    }}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold mt-4 shadow-lg shadow-indigo-600/20"
                                >
                                    {t.createGroup}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Creator Modal */}
            <AnimatePresence>
                {showCreator && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setShowCreator(false)
                                if (tourStep !== null) {
                                    endTour()
                                }
                            }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, filter: "blur(20px)", y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, filter: "blur(0px)", y: 0, scale: 1 }}
                            exit={{ opacity: 0, filter: "blur(20px)", y: 20, scale: 0.9 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-lg md:max-w-3xl glass-panel p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-card shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                                <div className="flex flex-col">
                                    <h3 className="text-2xl font-black tracking-tight">
                                        {editingHabit
                                            ? (language === 'es' ? 'Editar Rutina' : 'Edit Routine')
                                            : t.createRoutine}
                                    </h3>
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                                        {editingHabit
                                            ? (language === 'es' ? 'Personaliza tu rutina' : 'Customize your routine')
                                            : t.customizeHabit}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowCreator(false)
                                        setEditingHabit(null)
                                        setHabitType('good')
                                        if (tourStep !== null) {
                                            endTour()
                                        }
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-foreground"
                                >
                                    <XIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div
                                ref={creatorScrollContainerRef}
                                className={`overflow-y-auto pr-2 scrollbar-hide flex-1 transition-all duration-300 ${tourStep !== null ? 'pb-80' : 'pb-6'
                                    }`}
                            >
                                <form onSubmit={handleCreateHabit} className="flex flex-col gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                        {/* Columna Izquierda */}
                                        <div className="space-y-4">
                                            {/* Título de la rutina */}
                                            <div className="space-y-2 relative">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t.achieveWhat}</label>
                                                <input
                                                    type="text"
                                                    placeholder={title ? "" : placeholderExamples[placeholderIndex]}
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    className="w-full h-14 bg-background/50 border border-zinc-200 dark:border-white/10 rounded-xl px-5 outline-none focus:border-zinc-400 dark:focus:border-white/20 text-lg font-medium transition-all"
                                                    autoFocus
                                                />
                                                <AnimatePresence>
                                                    {isMounted && tourStep === 2 && (
                                                        <div className="absolute top-full left-0 right-0 z-[110] mt-2">
                                                            <TourTooltip arrowDirection="up">
                                                                <svg className="absolute bottom-full left-[10%] h-6 w-4 overflow-visible pointer-events-none">
                                                                    <path d="M 8 24 L 8 0" stroke="#8b5cf6" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
                                                                    <path d="M 4 6 L 8 0 L 12 6" stroke="#8b5cf6" strokeWidth="2.5" fill="none" />
                                                                </svg>
                                                                <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold leading-relaxed">
                                                                    {language === 'es' ? (
                                                                        <>
                                                                            <span className="font-bold text-black dark:text-white">Ponle el nombre tu habito;</span> ejemplo <span className="font-bold text-black dark:text-white">Estudiar 30 minutos de ingles</span> preferiblemente algo que tu ya hagas o quieras comenzar a hacer
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span className="font-bold text-black dark:text-white">Name your habit;</span> e.g., <span className="font-bold text-black dark:text-white">Study English for 30 minutes</span>, preferably something you already do or want to start doing
                                                                        </>
                                                                    )}
                                                                </p>
                                                                <div className="flex justify-end mt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (!title.trim()) {
                                                                                showToast(language === 'es' ? "Por favor, ponle un nombre a tu hábito para continuar" : "Please enter a name for your habit to continue", "warning");
                                                                                return;
                                                                            }
                                                                            nextTourStep();
                                                                        }}
                                                                        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
                                                                    >
                                                                        {language === 'es' ? "Siguiente" : "Next"}
                                                                    </button>
                                                                </div>
                                                            </TourTooltip>
                                                        </div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Habit Type (Buen Hábito / Mal Hábito) */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                                                    {language === 'es' ? 'Tipo de Hábito' : 'Habit Type'}
                                                </label>
                                                <div className="flex gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setHabitType('good')}
                                                        className={`flex-1 py-3 rounded-xl border-2 transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 ${habitType === 'good'
                                                                ? 'bg-green-500 text-white border-transparent shadow-lg shadow-green-500/30'
                                                                : 'bg-background/40 text-muted-foreground border-white/5 hover:border-green-500/30'
                                                            }`}
                                                    >
                                                        <div className={`w-2 h-2 rounded-full ${habitType === 'good' ? 'bg-white' : 'bg-green-500'}`} />
                                                        {language === 'es' ? 'Buen Hábito' : 'Good Habit'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setHabitType('bad')}
                                                        className={`flex-1 py-3 rounded-xl border-2 transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 ${habitType === 'bad'
                                                                ? 'bg-red-500 text-white border-transparent shadow-lg shadow-red-500/30'
                                                                : 'bg-background/40 text-muted-foreground border-white/5 hover:border-red-500/30'
                                                            }`}
                                                    >
                                                        <div className={`w-2 h-2 rounded-full ${habitType === 'bad' ? 'bg-white' : 'bg-red-500'}`} />
                                                        {language === 'es' ? 'Mal Hábito' : 'Bad Habit'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Icono */}
                                            <div className="space-y-2 relative">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{common.icon || "Icon"}</label>
                                                <IconPicker
                                                    value={icon}
                                                    onChange={(val) => {
                                                        setIcon(val);
                                                        if (tourStep === 3) {
                                                            nextTourStep();
                                                        }
                                                    }}
                                                    onOpenChange={setIsIconPickerOpen}
                                                />
                                                <AnimatePresence>
                                                    {isMounted && tourStep === 3 && !isIconPickerOpen && (
                                                        <div className="absolute top-full left-0 right-0 z-[110] mt-2">
                                                            <TourTooltip arrowDirection="up">
                                                                <svg className="absolute bottom-full left-[20%] h-8 w-16 overflow-visible pointer-events-none">
                                                                    <path d="M 40 32 L 40 12 L 0 12" stroke="#8b5cf6" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
                                                                    <path d="M 6 7 L 0 12 L 6 17" stroke="#8b5cf6" strokeWidth="2.5" fill="none" />
                                                                </svg>
                                                                <p className="text-zinc-800 dark:text-zinc-200 text-sm font-bold leading-relaxed">
                                                                    {language === 'es' ? "Opcional" : "Optional"}
                                                                </p>
                                                                <p className="text-zinc-700 dark:text-zinc-300 text-sm font-semibold leading-relaxed">
                                                                    {language === 'es'
                                                                        ? "Elije un icono para la identificación rápida de tu habito sin necesidad de leer"
                                                                        : "Choose an icon for quick identification of your habit without needing to read"}
                                                                </p>
                                                                <div className="flex justify-end mt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => nextTourStep()}
                                                                        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
                                                                    >
                                                                        {language === 'es' ? "Siguiente" : "Next"}
                                                                    </button>
                                                                </div>
                                                            </TourTooltip>
                                                        </div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Frecuencia / Recurrencia */}
                                            <div className="space-y-2 relative">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{common.frequency || "Frequency"}</label>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex gap-2">
                                                        <CustomSelect
                                                            options={recurrenceOptions}
                                                            value={recurrence}
                                                            onChange={(val) => {
                                                                setRecurrence(val as RecurrenceType);
                                                                if (tourStep === 4) {
                                                                    nextTourStep();
                                                                }
                                                            }}
                                                            className="flex-1"
                                                            onOpenChange={setIsFrequencySelectOpen}
                                                        />
                                                        {recurrence !== 'Daily' && recurrence !== 'Once' && (
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="7"
                                                                value={frequency}
                                                                onChange={(e) => setFrequency(Number(e.target.value))}
                                                                className="bg-background/50 border border-white/10 rounded-xl px-4 py-2 outline-none w-20 text-center text-sm font-bold"
                                                                placeholder="Vez"
                                                            />
                                                        )}
                                                    </div>
                                                    <motion.button
                                                        type="button"
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => {
                                                            const newRec = recurrence === 'Once' ? 'Daily' : 'Once';
                                                            setRecurrence(newRec);
                                                            if (tourStep === 4) {
                                                                nextTourStep();
                                                            }
                                                        }}
                                                        className={`w-full py-2.5 rounded-xl border-2 transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-sm ${recurrence === 'Once'
                                                            ? 'bg-green-500 text-white border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                                            : 'bg-white/5 text-muted-foreground border-white/5 hover:border-green-500/40 hover:bg-green-500/5'
                                                            }`}
                                                    >
                                                        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${recurrence === 'Once' ? 'bg-white scale-125 shadow-[0_0_8px_white]' : 'bg-green-500'}`} />
                                                        {common.recurrence.once}
                                                    </motion.button>
                                                </div>
                                                <AnimatePresence>
                                                    {isMounted && tourStep === 4 && !isFrequencySelectOpen && (
                                                        <div className="absolute top-full left-0 right-0 z-[110] mt-2">
                                                            <TourTooltip arrowDirection="up">
                                                                <svg className="absolute bottom-full left-[15%] h-8 w-4 overflow-visible pointer-events-none">
                                                                    <path d="M 8 32 L 8 0" stroke="#8b5cf6" strokeWidth="2.5" fill="none" />
                                                                    <path d="M 4 6 L 8 0 L 12 6" stroke="#8b5cf6" strokeWidth="2.5" fill="none" />
                                                                </svg>
                                                                <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold leading-relaxed">
                                                                    {language === 'es' ? (
                                                                        <>
                                                                            <span className="font-bold text-black dark:text-white">Diario</span> todos los días<br />
                                                                            <span className="font-bold text-black dark:text-white">Una vez</span> una sola vez luego se <span className="text-red-500 font-extrabold">elimina el habito</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span className="font-bold text-black dark:text-white">Daily</span> every day<br />
                                                                            <span className="font-bold text-black dark:text-white">Once</span> only once, then the <span className="text-red-500 font-extrabold">habit is deleted</span>
                                                                        </>
                                                                    )}
                                                                </p>
                                                            </TourTooltip>
                                                        </div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>

                                        {/* Columna Derecha */}
                                        <div className="space-y-4">
                                            {/* Importancia */}
                                            <div className="space-y-2 relative">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t.importance}</label>
                                                <div className={`flex gap-3 relative p-1 rounded-xl transition-all duration-300 ${tourStep === 5 ? 'border-2 border-dashed border-red-500 neon-glow-red z-[105]' : ''
                                                    }`}>
                                                    {[
                                                        { id: 'High', label: 'Alta', active: 'bg-red-500 text-white border-transparent shadow-lg shadow-red-500/30', inactive: 'bg-background/40 text-muted-foreground border-white/5 hover:border-red-500/30' },
                                                        { id: 'Medium', label: 'Media', active: 'bg-yellow-500 text-white border-transparent shadow-lg shadow-yellow-500/30', inactive: 'bg-background/40 text-muted-foreground border-white/5 hover:border-yellow-500/30' },
                                                        { id: 'Low', label: 'Baja', active: 'bg-green-500 text-white border-transparent shadow-lg shadow-green-500/30', inactive: 'bg-background/40 text-muted-foreground border-white/5 hover:border-green-500/30' }
                                                    ].map((p) => {
                                                        const isHighTourStep = tourStep === 6 && p.id === 'High';
                                                        return (
                                                            <div key={p.id} className={`flex-1 relative ${isHighTourStep ? 'z-[105]' : ''}`}>
                                                                <button
                                                                    type="button"
                                                                    translate="no"
                                                                    onClick={(e) => {
                                                                        if (tourStep !== null) {
                                                                            e.stopPropagation();
                                                                        }
                                                                        setEnergyLevel(p.id as any);
                                                                    }}
                                                                    className={`w-full py-3 rounded-xl border-2 transition-all font-black uppercase tracking-widest text-[10px] ${energyLevel === p.id ? p.active : p.inactive
                                                                        } ${isHighTourStep ? 'border-2 border-dashed border-red-500 neon-glow-red scale-[1.02]' : ''
                                                                        }`}
                                                                >
                                                                    {common.energyLevels[p.id.toLowerCase() as keyof typeof common.energyLevels] || p.label}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <AnimatePresence>
                                                    {isMounted && tourStep === 5 && (
                                                        <div className="absolute top-full left-0 right-0 z-[110] mt-2 w-full max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
                                                            <TourTooltip arrowDirection="up">
                                                                <svg className="absolute bottom-full left-1/2 -translate-x-1/2 h-6 w-4 overflow-visible pointer-events-none">
                                                                    <path d="M 8 24 L 8 0" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
                                                                    <path d="M 4 6 L 8 0 L 12 6" stroke="#ef4444" strokeWidth="2.5" fill="none" />
                                                                </svg>
                                                                <div className="flex flex-col gap-2">
                                                                    <h4 className="text-lg font-black text-red-600 tracking-tight text-center">
                                                                        {language === 'es' ? "Orden de prioridades" : "Priority Order"}
                                                                    </h4>
                                                                    <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold leading-relaxed text-center">
                                                                        {language === 'es'
                                                                            ? "Todos sabemos que hay tareas mas importantes que otras, asi que dependiendo lo importante que sea seleccióna entre las tres, y se van a dividir dependiendo su proridad"
                                                                            : "We all know some tasks are more important than others, so depending on how important it is, select among the three, and they will be divided based on their priority"
                                                                        }
                                                                    </p>
                                                                    <div className="flex justify-end mt-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => nextTourStep()}
                                                                            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
                                                                        >
                                                                            {language === 'es' ? "Siguiente" : "Next"}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </TourTooltip>
                                                        </div>
                                                    )}
                                                    {isMounted && tourStep === 6 && (
                                                        <div className="absolute top-full left-0 right-0 z-[110] mt-2 w-full max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
                                                            <TourTooltip arrowDirection="up">
                                                                <svg className="absolute bottom-full left-[16.6%] -translate-x-1/2 h-6 w-4 overflow-visible pointer-events-none">
                                                                    <path d="M 8 24 L 8 0" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
                                                                    <path d="M 4 6 L 8 0 L 12 6" stroke="#ef4444" strokeWidth="2.5" fill="none" />
                                                                </svg>
                                                                <div className="flex flex-col gap-2">
                                                                    <h4 className="text-lg font-black text-red-600 tracking-tight text-center">
                                                                        {language === 'es' ? "ATENCION" : "ATTENTION"}
                                                                    </h4>
                                                                    <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold leading-relaxed text-center">
                                                                        {language === 'es'
                                                                            ? "Cuando completes muchas tarea y no haces las de prioridad alta el app te advertirá para que te enfoques en lo importante. Así también enviarte notificaciones cuando ya se esté acabando el día y aun no has completado eso"
                                                                            : "When you complete many tasks and don't do the high priority ones, the app will warn you to focus on what's important. It will also send you notifications when the day is ending and you haven't completed them yet."
                                                                        }
                                                                    </p>
                                                                    <div className="flex justify-end mt-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => nextTourStep()}
                                                                            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
                                                                        >
                                                                            {language === 'es' ? "Siguiente" : "Next"}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </TourTooltip>
                                                        </div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Días Activos */}
                                            {recurrence !== 'Once' && (
                                                <div className={`space-y-3 relative p-4 rounded-2xl transition-all duration-300
                                                    ${tourStep === 4 && showActiveDaysTooltip ? 'border-2 border-dashed border-purple-500 neon-glow z-[105]' : 'border-white/5 bg-white/5'
                                                    }`}>
                                                    {recurrence === 'Monthly' ? (
                                                        <div className="grid grid-cols-7 gap-1">
                                                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                                                                const isActive = activeDays.includes(day);
                                                                return (
                                                                    <button
                                                                        key={day}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (isActive) {
                                                                                setActiveDays(activeDays.filter(d => d !== day));
                                                                            } else {
                                                                                setActiveDays([...activeDays, day]);
                                                                            }
                                                                        }}
                                                                        className={`
                                                                        w-full aspect-square flex items-center justify-center rounded-lg text-[10px] font-bold border transition-all
                                                                        ${isActive
                                                                                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]'
                                                                                : 'bg-background/40 text-muted-foreground border-white/5 hover:border-white/20'}
                                                                        ${tourStep === 4 && showActiveDaysTooltip ? 'animate-bounce-purple' : ''}
                                                                    `}
                                                                    >
                                                                        {day}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-hide py-1">
                                                            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                                                                const daysKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
                                                                const label = common.days[daysKeys[day]];
                                                                const isActive = activeDays.includes(day);

                                                                return (
                                                                    <button
                                                                        key={day}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (isActive) {
                                                                                setActiveDays(activeDays.filter(d => d !== day));
                                                                            } else {
                                                                                setActiveDays([...activeDays, day]);
                                                                            }
                                                                        }}
                                                                        className={`
                                                                        flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 border-2
                                                                        ${isActive
                                                                                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_20px_rgba(var(--primary),0.4)]'
                                                                                : 'bg-background/40 text-muted-foreground border-white/10 hover:border-white/20'}
                                                                        ${tourStep === 4 && showActiveDaysTooltip ? 'animate-bounce-purple' : ''}
                                                                    `}
                                                                    >
                                                                        <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
                                                                        <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isActive ? 'bg-white' : 'bg-white/10'}`} />
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest text-center font-bold">
                                                        {recurrence === 'Monthly' ? t.monthlyActiveDesc : t.weeklyActiveDesc}
                                                    </p>
                                                    <AnimatePresence>
                                                        {isMounted && tourStep === 4 && showActiveDaysTooltip && (
                                                            <div ref={activeDaysTooltipRef} className="absolute top-full left-0 right-0 z-[110] mt-2">
                                                                <TourTooltip arrowDirection="up">
                                                                    <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold leading-relaxed">
                                                                        {language === 'es' ? (
                                                                            <>
                                                                                <span className="font-bold text-black dark:text-white">Elige la frecuencia</span> con la que quieres hacer esa <span className="font-bold text-black dark:text-white">tarea o hábito</span>: todos los días, una vez a la semana o ciertos días de la semana (los días morados representan cuándo estará activo tu hábito).
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <span className="font-bold text-black dark:text-white">Choose the frequency</span> you want for this <span className="font-bold text-black dark:text-white">task or habit</span>: every day, once a week, or certain days of the week; the purple days are when your habit will be active
                                                                            </>
                                                                        )}
                                                                    </p>
                                                                    <div className="flex justify-end mt-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => nextTourStep()}
                                                                            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
                                                                        >
                                                                            {language === 'es' ? "Siguiente" : "Next"}
                                                                        </button>
                                                                    </div>
                                                                </TourTooltip>
                                                            </div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}

                                            {/* Fotos Inspiracionales */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t.inspirationalPhotos}</label>
                                                    <label className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 cursor-pointer transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-tighter">
                                                        <Camera className="w-4 h-4" />
                                                        {t.upload}
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                                    </label>
                                                </div>
                                                {tempPhotos.length > 0 && (
                                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                                        {tempPhotos.map((photo, i) => (
                                                            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white/10 flex-shrink-0 group">
                                                                <img src={getLocalImageSrc(photo)} alt="" className="w-full h-full object-cover" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setTempPhotos(tempPhotos.filter((_, idx) => idx !== i))}
                                                                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <XIcon className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botones de acción inferiores */}
                                    <div className="flex gap-4 pt-6 border-t border-zinc-200 dark:border-white/10 mt-4 justify-end items-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCreator(false)
                                                setEditingHabit(null)
                                                setHabitType('good')
                                                if (tourStep !== null) {
                                                    endTour()
                                                }
                                            }}
                                            className="px-6 h-12 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground animate-none"
                                        >
                                            {common.cancel || "Cancelar"}
                                        </button>
                                        <div className="relative">
                                            <div className={`relative transition-all duration-300 ${tourStep === 7 ? 'p-1 border-2 border-dashed border-green-500 rounded-2xl' : ''}`}>
                                                <button
                                                    type="submit"
                                                    onClick={(e) => {
                                                        if (tourStep === 7) {
                                                            e.preventDefault();
                                                            nextTourStep();
                                                            handleCreateHabit(e);
                                                        }
                                                    }}
                                                    className={`px-8 h-12 text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center whitespace-nowrap ${tourStep === 7
                                                            ? 'animate-pulse-purple-green scale-[1.02] border-none'
                                                            : 'bg-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]'
                                                        }`}
                                                >
                                                    {editingHabit
                                                        ? (language === 'es' ? 'Guardar Cambios' : 'Save Changes')
                                                        : t.startRoutine}
                                                </button>
                                            </div>
                                            <AnimatePresence>
                                                {isMounted && tourStep === 7 && (
                                                    <div className="absolute bottom-full right-0 mb-4 z-[120] w-48" onClick={(e) => e.stopPropagation()}>
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)", y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                                                            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                                                            className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-2 text-center items-center justify-center relative w-full will-change-[transform,opacity,filter]"
                                                        >
                                                            {/* Arrow pointing down to the green dashed area */}
                                                            <svg className="absolute top-full left-[80%] h-6 w-4 overflow-visible pointer-events-none">
                                                                <path d="M 8 0 L 8 16" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
                                                                <path d="M 4 10 L 8 16 L 12 10" stroke="#22c55e" strokeWidth="2.5" fill="none" />
                                                            </svg>

                                                            <span className="font-dancing text-3xl text-black leading-none py-1 select-none" style={{ fontFamily: 'var(--font-dancing-script), cursive' }}>
                                                                ¡Listo!
                                                            </span>
                                                        </motion.div>
                                                    </div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </form>
                            </div>
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
                            className="relative w-full max-w-lg glass-panel p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-card shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors hover:bg-white/5 rounded-full"
                            >
                                <XIcon className="w-5 h-5" />
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

            {/* Onboarding Banners for Steps 8, 9, 10 */}
            <AnimatePresence mode="wait">
                {isMounted && tourStep !== null && tourStep >= 8 && tourStep <= 10 && (
                    <motion.div
                        key={tourStep}
                        initial={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(10px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => {
                            if (tourStep === 10) {
                                endTour()
                            } else {
                                nextTourStep()
                            }
                        }}
                        className="fixed bottom-[84px] md:bottom-10 left-4 right-4 md:left-auto md:right-10 mx-auto md:mx-0 w-[92%] max-w-sm z-[100] cursor-pointer bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-white p-5 rounded-3xl shadow-[0_15px_40px_rgba(124,58,237,0.4)] border border-purple-500/20 flex flex-col gap-2 select-none will-change-[transform,opacity,filter]"
                    >
                        <p className="text-sm font-semibold leading-relaxed text-center px-2 py-1">
                            {tourStep === 8 && (
                                language === 'es'
                                    ? <>Puedes marcar tu nuevo hábito como <span className="font-extrabold text-white underline decoration-white/50">completado para que ¡lo pruebes!</span></>
                                    : <>You can mark your new habit as <span className="font-extrabold text-white underline decoration-white/50">completed to test it out!</span></>
                            )}
                            {tourStep === 9 && (
                                language === 'es'
                                    ? <>Recuerda que dependiendo de la frecuencia se reiniciará, <span className="font-extrabold text-white underline decoration-white/50">¡no olvides volver mañana!</span></>
                                    : <>Remember that depending on the frequency it will reset, <span className="font-extrabold text-white underline decoration-white/50">don't forget to return tomorrow!</span></>
                            )}
                            {tourStep === 10 && (
                                language === 'es'
                                    ? <>Te recomendamos probar las <span className="font-extrabold text-white underline decoration-white/50">Notas</span>; ¡aparecen incluso como <span className="font-extrabold text-white underline decoration-white/50">widgets!</span></>
                                    : <>We recommend you <span className="font-extrabold text-white underline decoration-white/50">try Notes</span>; they even appear as <span className="font-extrabold text-white underline decoration-white/50">widgets!</span></>
                            )}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const HabitCardSkeleton = () => (
    <div className="animate-pulse glass-panel p-4 rounded-xl flex flex-col gap-3 border border-border/10 bg-white/[0.01]">
        <div className="flex items-center justify-between w-full gap-4">
            <div className="flex items-center gap-4 flex-1">
                <div className="w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-800" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-1/4" />
                </div>
            </div>
        </div>
    </div>
)

const HabitCard = memo(({
    habit,
    isCompleted,
    missed,
    onEditHabit,
    updateTask,
    setIsDeleting,
    handleToggleTask,
    isHighPriorityHighlighted,
    isFocusEffectActive,
    priority,
    t,
    common
}: {
    habit: Task;
    isCompleted: boolean;
    missed: number;
    onEditHabit: (habit: Task) => void;
    updateTask: any;
    setIsDeleting: (id: string | null) => void;
    handleToggleTask: (h: Task) => void;
    isHighPriorityHighlighted: boolean;
    isFocusEffectActive: boolean;
    priority: "High" | "Medium" | "Low";
    t: any;
    common: any;
}) => {
    const language = useStore(state => state.language)
    const todayObj = new Date()
    const currentDay = todayObj.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const isTodayActive = habit.recurrence === 'None' || habit.recurrence === 'Once' || !habit.activeDays || habit.activeDays.includes(currentDay)
    const displayCompleted = isCompleted || !isTodayActive

    return (
        <MobileContextMenu
            title={habit.title}
            onEdit={() => {
                onEditHabit(habit)
            }}
            onDelete={() => setIsDeleting(habit.id)}
        >
            <div className="relative rounded-xl select-none animate-in fade-in zoom-in-95 duration-200">
                {isHighPriorityHighlighted && priority === 'High' && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 rounded-xl" style={{ overflow: 'visible' }}>
                        <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            rx="12"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="2.5"
                            strokeDasharray="120 400"
                            strokeLinecap="round"
                            className="animate-spin-border"
                        />
                    </svg>
                )}
                <div
                    onClick={(e) => {
                        if (!isTodayActive) return;
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('input')) return;
                        handleToggleTask(habit);
                    }}
                    className={`relative z-10 glass-panel p-4 rounded-xl flex flex-col gap-3 cursor-pointer group transition-all shadow-sm select-none ${!isTodayActive
                        ? 'border border-border/50 bg-white/[0.02] opacity-40 grayscale'
                        : displayCompleted
                            ? 'border border-green-500/20 bg-green-500/[0.02]'
                            : habit.habitType === 'bad'
                                ? 'bg-[#E50000] border-transparent text-white shadow-[0_0_20px_rgba(229,0,0,0.3)] hover:bg-[#D40000]'
                                : 'border border-border hover:border-primary/20 hover:bg-white/5'
                        }`}
                >
                    <div className="flex items-center justify-between w-full min-w-0 gap-4">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                            <button
                                disabled={!isTodayActive}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isTodayActive) {
                                        handleToggleTask(habit);
                                    }
                                }}
                                className={`relative group/check flex-shrink-0 ${!isTodayActive ? 'cursor-not-allowed' : ''}`}
                            >
                                <motion.div
                                    initial={false}
                                    whileHover={isTodayActive ? { scale: 1.1 } : {}}
                                    whileTap={isTodayActive ? { scale: 0.9 } : {}}
                                    animate={{
                                        scale: displayCompleted ? [1, 1.05, 1] : 1,
                                        backgroundColor: !isTodayActive ? "rgb(115, 115, 115)" : displayCompleted ? "rgb(34, 197, 94)" : "transparent",
                                        borderColor: !isTodayActive ? "rgb(115, 115, 115)" : displayCompleted ? "rgb(34, 197, 94)" : habit.habitType === 'bad' ? "rgb(255, 255, 255)" : "rgb(115, 115, 115)"
                                    }}
                                    transition={{
                                        duration: 0.3,
                                        ease: "easeOut"
                                    }}
                                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative z-10
                                 ${!isTodayActive
                                            ? 'text-black opacity-50 cursor-not-allowed'
                                            : displayCompleted
                                                ? 'text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                                                : habit.habitType === 'bad'
                                                    ? 'hover:border-white border-white/80 text-white'
                                                    : 'hover:border-primary'
                                        }`}
                                >
                                    <AnimatePresence mode="wait">
                                        {displayCompleted ? (
                                            <motion.div
                                                key="checked"
                                                initial={{ scale: 0, rotate: -45 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                exit={{ scale: 0, rotate: 45 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            >
                                                {habit.habitType === 'bad' ? (
                                                    <XIcon className="w-5 h-5 text-black stroke-[3.5]" />
                                                ) : (
                                                    <Check className="w-5 h-5" />
                                                )}
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="unchecked"
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.5, opacity: 0 }}
                                            >
                                                {habit.icon && ICON_MAP[habit.icon] ? (
                                                    (() => {
                                                        const Icon = ICON_MAP[habit.icon]
                                                        return <Icon className={`w-4 h-4 text-muted-foreground group-hover/check:text-primary transition-colors ${habit.habitType === 'bad' ? 'group-hover/check:text-white text-white' : ''}`} />
                                                    })()
                                                ) : null}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>

                                {/* Ripple Effect (z-0 to keep it visible on top of card background) */}
                                {displayCompleted && isTodayActive && (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0.5 }}
                                        animate={{ scale: 2.2, opacity: 0 }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                        className="absolute inset-0 bg-green-500/30 rounded-full z-0"
                                    />
                                )}
                            </button>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex items-center gap-2 w-full">
                                    <div
                                        className={`font-semibold text-base md:text-lg transition-all break-words leading-snug ${displayCompleted ? 'text-muted-foreground line-through decoration-primary/50' : ''}`}
                                        onDoubleClick={() => {
                                            onEditHabit(habit)
                                        }}
                                    >
                                        {habit.title}
                                    </div>
                                </div>
                                <div className={`text-xs flex flex-wrap items-center gap-2 mt-1 ${habit.habitType === 'bad' && !displayCompleted ? 'text-white/80' : 'text-muted-foreground'}`}>
                                    <span className="bg-white/10 px-2 py-0.5 rounded uppercase tracking-wider text-[10px]">{habit.recurrence}</span>
                                    {!isTodayActive && (
                                        <span className="text-[10px] bg-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded uppercase font-black tracking-wider">
                                            {language === 'es' ? 'Inactivo hoy' : 'Inactive today'}
                                        </span>
                                    )}
                                    {habit.streak ? <span className={`font-bold flex items-center gap-1 ${habit.habitType === 'bad' && !displayCompleted ? 'text-amber-200' : 'text-orange-400'}`}><Flame className={`w-3.5 h-3.5 ${habit.habitType === 'bad' && !displayCompleted ? 'text-amber-300 fill-amber-300' : 'text-orange-500 fill-orange-500'}`} /> {habit.streak}</span> : null}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                            {/* Missed Counter */}
                            {missed > 0 && !displayCompleted && (
                                <div className={`flex flex-col items-end ${habit.habitType === 'bad' ? 'text-white' : 'text-red-400'}`}>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${habit.habitType === 'bad' ? 'opacity-90' : 'opacity-70'}`}>
                                        {t.missed}
                                    </div>
                                    <div className="text-xl font-black leading-none">{missed}</div>
                                </div>
                            )}

                            <div className="hidden md:flex items-center gap-1">
                                <motion.button
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    whileTap={{ scale: 0.9, rotate: -3 }}
                                    onClick={() => {
                                        onEditHabit(habit)
                                    }}
                                    className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${habit.habitType === 'bad' && !displayCompleted ? 'hover:bg-white/20 text-white/80 hover:text-white' : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'}`}
                                    title="Edit Habit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    whileTap={{ scale: 0.9, rotate: -3 }}
                                    onClick={() => setIsDeleting(habit.id)}
                                    className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${habit.habitType === 'bad' && !displayCompleted ? 'hover:bg-white/20 text-white/80 hover:text-white' : 'hover:bg-red-500/10 text-muted-foreground hover:text-red-400'}`}
                                    title="Delete Habit"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </motion.button>
                            </div>

                            {/* Habit Photo Preview on the Right */}
                            {habit.photos && habit.photos.length > 0 && (
                                <div className="relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
                                    <img
                                        src={getLocalImageSrc(habit.photos[0])}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditHabit(habit);
                                        }}
                                    />
                                    {habit.photos.length > 1 && (
                                        <div className="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[9px] font-black text-white leading-none">
                                            +{habit.photos.length - 1}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </MobileContextMenu>
    )
})
HabitCard.displayName = "HabitCard"
