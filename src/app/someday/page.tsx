"use client"

import { useStore } from "@/lib/store"
import { useState, useEffect } from "react"
import { Calendar, Plus, Rocket, Layers, Repeat } from "lucide-react"
import { Reveal } from "@/components/ui/reveal"
import { PageDescription } from "@/components/ui/page-description"
import { CustomSelect } from "@/components/ui/custom-select"
import { DatePicker } from "@/components/ui/date-picker"

import { translations } from "@/lib/translations"

export default function SomedayPage() {
    const tasks = useStore(state => state.tasks)
    const projects = useStore(state => state.projects)
    const addTask = useStore(state => state.addTask)
    const addProject = useStore(state => state.addProject)
    const language = useStore(state => state.language)
    const showToast = useStore(state => state.showToast)
    const loadAllTasks = useStore(state => state.loadAllTasks)
    const unloadTasks = useStore(state => state.unloadTasks)
    const t = translations[language].pages.someday
    const common = translations[language].common
    const [activeTab, setActiveTab] = useState<'task' | 'project'>('task')
    const [title, setTitle] = useState("")
    const [date, setDate] = useState("")
    const [recurrence, setRecurrence] = useState<'None' | 'Daily' | 'Weekly' | 'Monthly'>('None')
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        loadAllTasks()
        setIsMounted(true)
        return () => {
            unloadTasks()
        }
    }, [loadAllTasks, unloadTasks])

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !date) return

        if (activeTab === 'task') {
            const isHabit = recurrence !== 'None'
            addTask({
                title,
                dueDate: date,
                energyLevel: 'Medium',
                projectId: 'someday', // Virtual project bucket
                recurrence: recurrence,
                isHabit: isHabit,
                photos: [],
                completionTimes: [],
                activeDays: isHabit ? [1, 2, 3, 4, 5, 6, 0] : undefined
            })
            showToast(language === 'es' ? "Tarea programada" : "Task scheduled", "success")
        } else {
            addProject({
                title,
                color: '#64748b', // Slate for 'future'
                status: 'Someday',
                startDate: date
            })
            showToast(language === 'es' ? "Proyecto planificado" : "Project planned", "success")
        }
        // Reset
        setTitle("")
        setDate("")
        setRecurrence("None")
    }

    // Filter Futures
    const today = new Date().toISOString().split('T')[0]

    const futureTasks = tasks.filter(t => t.dueDate && t.dueDate > today)
    const somedayProjects = projects.filter(p => p.status === 'Someday' || (p.startDate && p.startDate > today))

    return (
        <div className="min-h-screen bg-background text-foreground p-6 transition-colors duration-300 relative selection:bg-primary/30 flex flex-col items-center">
            {/* Ambient Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] dark:bg-purple-900/20" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] dark:bg-blue-900/20" />
            </div>

            <div className="relative z-10 w-full max-w-5xl container mx-auto flex flex-col gap-8">
                <Reveal margin="0px" duration={0.4}>
                    <header className="flex flex-col items-center text-center md:items-start md:text-left">
                        <h1 className="text-3xl font-black tracking-tighter mb-2 font-dancing-mobile">{t.title}</h1>
                        <p className="text-muted-foreground hidden md:block">{t.description}</p>
                    </header>
                </Reveal>

                {/* Creator Section */}
                <Reveal delay={0.1} margin="0px" duration={0.4} className="relative z-20">
                    <section className="glass-panel p-6 rounded-2xl border border-primary/10">
                        <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
                            <button
                                onClick={() => setActiveTab('task')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'task' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                            >
                                <Rocket className="w-5 h-5" /> {t.scheduleTask}
                            </button>
                            <button
                                onClick={() => setActiveTab('project')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'project' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                            >
                                <Layers className="w-5 h-5" /> {t.planProject}
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="flex flex-col lg:flex-row gap-4 items-end">
                            <div className="flex-1 w-full space-y-2">
                                <label className="text-sm font-medium ml-1">{language === 'es' ? 'Título' : 'Title'}</label>
                                <input
                                    type="text"
                                    placeholder={activeTab === 'task' ? (language === 'es' ? "ej: Aprender español" : "e.g., Learn Spanish") : (language === 'es' ? "ej: Renovación de cocina" : "e.g., Kitchen Renovations")}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-primary/50 text-foreground placeholder-muted-foreground"
                                />
                            </div>
                            {activeTab === 'task' && (
                                <div className="w-full lg:w-48 space-y-2">
                                    <label className="text-sm font-medium ml-1">{language === 'es' ? 'Frecuencia' : 'Recurrence'}</label>
                                    <CustomSelect
                                        options={[
                                            { label: language === 'es' ? 'Una sola vez' : 'One-time', value: 'None' },
                                            { label: language === 'es' ? 'Diario' : 'Daily', value: 'Daily' },
                                            { label: language === 'es' ? 'Semanal' : 'Weekly', value: 'Weekly' },
                                            { label: language === 'es' ? 'Mensual' : 'Monthly', value: 'Monthly' }
                                        ]}
                                        value={recurrence}
                                        onChange={(val) => setRecurrence(val as any)}
                                        className="w-full"
                                    />
                                </div>
                            )}
                            <div className="w-full lg:w-48 space-y-2">
                                <label className="text-sm font-medium ml-1">{t.startDate}</label>
                                <DatePicker
                                    value={date}
                                    onChange={(newVal) => setDate(newVal)}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full lg:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <Plus className="w-5 h-5" /> {t.scheduleIt}
                            </button>
                        </form>
                    </section>
                </Reveal>

                <Reveal delay={0.2} margin="0px" duration={0.4} className="relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Future Projects */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Layers className="w-5 h-5 text-purple-400" /> {t.futureProjects}
                            </h2>
                            {!isMounted ? (
                                <div className="space-y-2">
                                    <div className="animate-pulse h-16 bg-white/5 rounded-xl border border-white/10" />
                                    <div className="animate-pulse h-16 bg-white/5 rounded-xl border border-white/10" />
                                </div>
                            ) : (
                                <>
                                    {somedayProjects.length === 0 && <p className="text-muted-foreground italic text-sm">{t.noProjects}</p>}
                                    {somedayProjects.map((p, index) => (
                                        <div
                                            key={p.id}
                                            style={{ animation: `fade-in-up-fast 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.05}s both` }}
                                            className="glass-panel p-4 rounded-xl flex items-center justify-between group"
                                        >
                                            <div>
                                                <h3 className="font-bold text-lg">{p.title}</h3>
                                                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                                    <Calendar className="w-3 h-3" /> Starts: {p.startDate || 'Someday'}
                                                </p>
                                            </div>
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Future Tasks */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Rocket className="w-5 h-5 text-blue-400" /> {t.scheduledTasks}
                            </h2>
                            {!isMounted ? (
                                <div className="space-y-2">
                                    <div className="animate-pulse h-16 bg-white/5 rounded-xl border border-white/10" />
                                    <div className="animate-pulse h-16 bg-white/5 rounded-xl border border-white/10" />
                                </div>
                            ) : (
                                <>
                                    {futureTasks.length === 0 && <p className="text-muted-foreground italic text-sm">{t.noTasks}</p>}
                                    {futureTasks.map((t, index) => (
                                        <div
                                            key={t.id}
                                            style={{ animation: `fade-in-up-fast 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.05}s both` }}
                                            className="glass-panel p-4 rounded-xl flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="font-medium flex items-center gap-2 flex-wrap">
                                                    <span>{t.title}</span>
                                                    {t.isHabit && t.recurrence !== 'None' && (
                                                        <span className="text-[10px] bg-primary/25 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            <Repeat className="w-2.5 h-2.5" />
                                                            {language === 'es'
                                                                ? (t.recurrence === 'Daily' ? 'Diario' : t.recurrence === 'Weekly' ? 'Semanal' : t.recurrence === 'Monthly' ? 'Mensual' : t.recurrence)
                                                                : t.recurrence
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                                    <Calendar className="w-3 h-3" /> {t.isHabit
                                                        ? (language === 'es' ? 'Comienza' : 'Starts')
                                                        : (language === 'es' ? 'Vence' : 'Due')
                                                    }: {t.dueDate}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </Reveal>
            </div>
        </div>
    )
}
