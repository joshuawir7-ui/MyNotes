import { useStore, RecurrenceType, EnergyLevel } from "@/lib/store"
import { useState } from "react"
import { Plus, Repeat, Battery, Calendar } from "lucide-react"
import { translations } from "@/lib/translations"
import { CustomSelect } from "@/components/ui/custom-select"

export function TaskInput() {
    const addTask = useStore(state => state.addTask)
    const language = useStore(state => state.language)
    const t = translations[language].common
    const [title, setTitle] = useState("")

    const [recurrence, setRecurrence] = useState<RecurrenceType>("None")
    const [energy, setEnergy] = useState<EnergyLevel>("Medium")
    const [isExpanded, setIsExpanded] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        addTask({
            title,
            energyLevel: energy,
            recurrence,
            projectId: 'p1', // Default project for now
            photos: [],
            completionTimes: []
        })


        setTitle("")
        setRecurrence("None")
        setEnergy("Medium")
        setIsExpanded(false)
    }

    return (
        <form onSubmit={handleSubmit} className={`glass-panel rounded-xl transition-all duration-300 ${isExpanded ? 'p-4' : 'p-2'}`}>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 hover:bg-primary/30 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
                <input
                    type="text"
                    placeholder={t.placeholder}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onFocus={() => setIsExpanded(true)}
                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                />
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-2">
                        <CustomSelect
                            options={[
                                { label: t.noRepeat, value: 'None' },
                                { label: t.recurrence.daily, value: 'Daily' },
                                { label: t.recurrence.weekly, value: 'Weekly' },
                                { label: t.recurrence.monthly, value: 'Monthly' },
                            ]}
                            value={recurrence}
                            onChange={(val) => setRecurrence(val as RecurrenceType)}
                            placeholder={t.noRepeat}
                            className="w-36"
                        />

                        <CustomSelect
                            options={[
                                { label: t.energyLevels.high, value: 'High' },
                                { label: t.energyLevels.medium, value: 'Medium' },
                                { label: t.energyLevels.low, value: 'Low' },
                            ]}
                            value={energy}
                            onChange={(val) => setEnergy(val as EnergyLevel)}
                            placeholder={t.energyLevels.medium}
                            className="w-36"
                        />
                    </div>

                    <button
                        type="submit"
                        className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    >
                        {t.addTask}
                    </button>

                </div>
            )}
        </form>
    )
}
