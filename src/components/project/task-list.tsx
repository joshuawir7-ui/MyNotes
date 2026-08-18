"use client"

import { useStore, Task, EnergyLevel } from "@/lib/store"
import { CheckCircle2, Circle, Calendar, Battery, BatteryMedium, BatteryLow } from "lucide-react"

interface TaskListProps {
    projectId: string
}

export function TaskList({ projectId }: TaskListProps) {
    const tasks = useStore(state => state.tasks)
    const toggleTask = useStore(state => state.toggleTask)
    const language = useStore(state => state.language)
    const showToast = useStore(state => state.showToast)
    const projectTasks = tasks.filter(t => t.projectId === projectId)

    const getEnergyIcon = (level: EnergyLevel) => {
        switch (level) {
            case 'High': return <Battery className="w-4 h-4 text-red-500" />
            case 'Medium': return <BatteryMedium className="w-4 h-4 text-yellow-500" />
            case 'Low': return <BatteryLow className="w-4 h-4 text-green-500" />
        }
    }

    return (
        <div className="space-y-3">
            {projectTasks.map(task => (
                <div
                    key={task.id}
                    onClick={() => {
                        toggleTask(task.id)
                        const isComp = !task.completed
                        showToast(language === 'es' ? (isComp ? "Tarea completada" : "Tarea pendiente") : (isComp ? "Task completed" : "Task pending"), isComp ? "success" : "info")
                    }}
                    className={`group p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between
            ${task.completed
                ? 'bg-white/95 dark:bg-zinc-900/95 opacity-60 border-black/5 dark:border-white/5'
                : 'bg-white/95 dark:bg-zinc-900/90 hover:bg-white/100 dark:hover:bg-zinc-800/90 border-black/5 dark:border-white/5 shadow-sm'}
            md:backdrop-blur-sm md:shadow-none md:border-white/5
            ${task.completed
                ? 'md:bg-white/5 md:dark:bg-white/5'
                : 'md:bg-white/10 md:dark:bg-black/30 md:hover:bg-white/15 md:dark:hover:bg-white/10'}`}
                >
                    <div className="flex items-center gap-4">
                        <button className={`transition-colors text-muted-foreground group-hover:text-primary ${task.completed ? 'text-green-500' : ''}`}>
                            {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        </button>
                        <div className="flex flex-col">
                            <span className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                            {task.dueDate && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Calendar className="w-3 h-3" />
                                    {task.dueDate}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded border
                ${task.energyLevel === 'High' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                            task.energyLevel === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                'bg-green-500/10 border-green-500/20 text-green-500'}`}>
                        {getEnergyIcon(task.energyLevel)}
                        {task.energyLevel}
                    </div>
                </div>
            ))}

            {projectTasks.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                    No tasks yet. Add one to get started!
                </div>
            )}
        </div>
    )
}
