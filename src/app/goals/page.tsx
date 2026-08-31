"use client"
import { getLocalImageSrc } from "@/lib/image-utils"

import { Reveal } from "@/components/ui/reveal"
import { useStore, GoalType, GoalObjective } from "@/lib/store"
import { translations } from "@/lib/translations"
import { useState, useEffect } from "react"
import { Plus, Target, X, Camera } from "lucide-react"
import { GoalCard } from "@/components/dashboard/goal-card"
import { motion, AnimatePresence } from "framer-motion"
import { PageDescription } from "@/components/ui/page-description"
import { useTheme } from "next-themes"
import { DatePicker } from "@/components/ui/date-picker"
import { CustomSelect } from "@/components/ui/custom-select"

export default function GoalsPage() {
    const language = useStore(state => state.language)
    const goals = useStore(state => state.goals)
    const addGoal = useStore(state => state.addGoal)
    const showToast = useStore(state => state.showToast)
    const t = (translations[language]?.pages?.goals || translations['en'].pages.goals) as any
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const [isCreating, setIsCreating] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [date, setDate] = useState("")
    const [tempPhotos, setTempPhotos] = useState<string[]>([])
    const [type, setType] = useState<GoalType>("general")
    const [objectives, setObjectives] = useState<Omit<GoalObjective, 'id'>[]>([])
    const [newObjectiveTitle, setNewObjectiveTitle] = useState("")
    const [tempObjectivePhoto, setTempObjectivePhoto] = useState<string | null>(null)
    const [targetBudget, setTargetBudget] = useState("")
    const [hasBudget, setHasBudget] = useState(false)

    const handleAddObjective = () => {
        if (!newObjectiveTitle.trim()) return
        setObjectives([...objectives, { title: newObjectiveTitle.trim(), completed: false, image: tempObjectivePhoto || undefined }])
        setNewObjectiveTitle("")
        setTempObjectivePhoto(null)
    }

    const handleRemoveObjective = (index: number) => {
        setObjectives(objectives.filter((_, i) => i !== index))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        const goalObjectives = type === 'checklist'
            ? objectives.map(obj => ({
                id: Math.random().toString(36).substring(7),
                title: obj.title,
                completed: obj.completed,
                image: obj.image
            }))
            : []

        const finalTargetValue = hasBudget ? parseFloat(targetBudget) : undefined
        const finalCurrentValue = hasBudget ? 0 : undefined

        addGoal({
            title,
            description,
            targetDate: date,
            photos: tempPhotos,
            type,
            objectives: goalObjectives,
            targetValue: finalTargetValue,
            currentValue: finalCurrentValue,
            unit: hasBudget ? '$' : undefined
        })

        showToast(language === 'es' ? "Meta creada correctamente" : "Goal created successfully", "success")

        // Reset form
        setTitle("")
        setDescription("")
        setDate("")
        setTempPhotos([])
        setType("general")
        setObjectives([])
        setNewObjectiveTitle("")
        setTempObjectivePhoto(null)
        setTargetBudget("")
        setHasBudget(false)
        setIsCreating(false)
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

    const handleObjectiveFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const { saveBase64ImageToFile } = await import('@/lib/image-utils');
                const uri = await saveBase64ImageToFile(base64);
                setTempObjectivePhoto(uri || base64)
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <Reveal margin="0px" duration={0.8}>
                <div className="flex flex-col md:flex-row justify-between items-center md:items-center gap-8 mb-12 text-center md:text-left">
                    <div className="flex flex-col items-center md:items-start">
                        <h1 className="text-4xl font-semibold tracking-tighter mb-2 bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent font-dancing">
                            {t.title}
                        </h1>
                        <p className="text-muted-foreground hidden md:block">{t.description}</p>
                    </div>

                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-2xl hover:scale-105 transition-all shadow-xl shadow-primary/20 neon-glow"
                    >
                        <Plus className="w-6 h-6" />
                        {t.newGoalBtn}
                    </button>
                </div>
            </Reveal>

            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            className="bg-white dark:bg-[#0a0a0a] w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-black/5 dark:border-white/10 shadow-2xl relative overflow-y-auto max-h-[90vh] custom-scrollbar"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setIsCreating(false)}
                                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-primary/20 rounded-2xl text-primary">
                                    <Target className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-bold">{t.newGoal}</h2>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t.goalName}</label>
                                    <input
                                        autoFocus
                                        required
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder={t.placeholderGeneral}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t.goalType}</label>
                                    <CustomSelect
                                        options={[
                                            { label: t.typeManual || (language === 'es' ? "Progreso Manual" : "Manual Progress"), value: "general" },
                                            { label: t.typeChecklist || (language === 'es' ? "Cumplimiento de objetivos (Mini tareas)" : "By Objectives"), value: "checklist" }
                                        ]}
                                        value={type}
                                        onChange={(val) => setType(val as GoalType)}
                                    />
                                </div>

                                <div className="flex items-center gap-3 bg-black/[0.02] dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                                    <input
                                        type="checkbox"
                                        id="hasBudget"
                                        checked={hasBudget}
                                        onChange={(e) => setHasBudget(e.target.checked)}
                                        className="w-4 h-4 rounded text-primary focus:ring-primary border-white/10 bg-white/5 cursor-pointer accent-primary"
                                    />
                                    <label htmlFor="hasBudget" className="text-sm font-medium text-foreground select-none cursor-pointer">
                                        {language === 'es' ? "¿Establecer presupuesto / meta de ahorro?" : "Set budget / savings goal?"}
                                    </label>
                                </div>

                                {hasBudget && (
                                    <div className="space-y-4 bg-black/[0.02] dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5 animate-in fade-in slide-in-from-top-1 duration-250">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                                                {language === 'es' ? "Presupuesto Objetivo ($)" : "Target Budget ($)"}
                                            </label>
                                            <input
                                                required
                                                type="number"
                                                min="1"
                                                value={targetBudget}
                                                onChange={(e) => setTargetBudget(e.target.value)}
                                                placeholder="Ej: 500"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                                            />
                                        </div>
                                    </div>
                                )}

                                {type === 'checklist' && (
                                    <div className="space-y-3 bg-black/[0.02] dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                                        <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground/60 text-left">{t.stepsToComplete || "Pasos para completar"}</label>
                                        
                                        {/* List of current temp objectives */}
                                        {objectives.length > 0 && (
                                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                                {objectives.map((obj, index) => (
                                                    <div key={index} className="flex items-center justify-between bg-black/5 dark:bg-black/20 px-3 py-2 rounded-xl border border-black/5 dark:border-white/5">
                                                        <div className="flex items-center gap-3">
                                                            {obj.image && (
                                                                <img src={getLocalImageSrc(obj.image)} alt="" className="w-8 h-8 rounded object-cover border border-white/10 shrink-0" />
                                                            )}
                                                            <span className="text-sm opacity-90 text-left">{obj.title}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveObjective(index)}
                                                            className="text-muted-foreground hover:text-red-400 p-1 rounded-full transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Preview of attached photo for the new objective */}
                                        {tempObjectivePhoto && (
                                            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-black/5 dark:border-white/10 flex-shrink-0 mb-2">
                                                <img src={getLocalImageSrc(tempObjectivePhoto)} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => setTempObjectivePhoto(null)}
                                                    className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Input to add a new objective */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newObjectiveTitle}
                                                onChange={(e) => setNewObjectiveTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddObjective();
                                                    }
                                                }}
                                                placeholder={t.addStepPlaceholder || "Agrega un paso..."}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                            />
                                            
                                            {/* Camera upload button */}
                                            <label className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 cursor-pointer transition-all shrink-0">
                                                <Camera className="w-4.5 h-4.5" />
                                                <input type="file" className="hidden" accept="image/*" onChange={handleObjectiveFileChange} />
                                            </label>

                                            <button
                                                type="button"
                                                onClick={handleAddObjective}
                                                className="px-4 py-2 bg-primary/20 text-primary font-bold text-xs rounded-xl hover:bg-primary/30 transition-all active:scale-[0.98]"
                                            >
                                                {language === 'es' ? "Añadir" : "Add"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t.descriptionLabel}</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={t.descriptionPlaceholder}
                                        rows={3}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors resize-none"
                                    />
                                </div>

                                <div>
                                    <DatePicker
                                        label={t.targetDateLabel}
                                        value={date}
                                        onChange={setDate}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-left">{t.inspirationPhotosLabel}</label>
                                        <label className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 cursor-pointer transition-all">
                                            <Camera className="w-4 h-4" />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                    {tempPhotos.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                            {tempPhotos.map((photo, i) => (
                                                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-black/5 dark:border-white/10 flex-shrink-0">
                                                    <img src={getLocalImageSrc(photo)} alt="" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTempPhotos(tempPhotos.filter((_, idx) => idx !== i))}
                                                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
                                >
                                    {t.saveGoalBtn}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-6">
                {goals.map((goal) => (
                    <Reveal key={goal.id} delay={0.1}>
                        <GoalCard goal={goal} />
                    </Reveal>
                ))}
            </div>

            {goals.length === 0 && (
                <Reveal delay={0.2}>
                    <div className="flex flex-col items-center justify-center text-center relative min-h-[400px] w-full max-w-xl mx-auto">
                        <div className="mb-8">
                            <motion.img
                                key={mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : 'light'}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                src={mounted && resolvedTheme === 'dark' ? '/goals-empty-dark.png' : '/goals-empty.png'}
                                alt="Goals"
                                className="w-64 h-auto object-contain"
                                onError={(e) => {
                                    e.currentTarget.src = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2000"
                                }}
                            />
                        </div>

                        <div className="relative z-10 px-8 w-full text-center">
                            <PageDescription
                                size="md"
                                duration={1.5}
                                direction="right"
                                className="text-black dark:text-white mb-6 font-bold leading-relaxed font-dancing text-lg md:text-xl"
                            >
                                {t.emptyStateQuote}
                            </PageDescription>

                            <div className="block">
                                <p className="text-muted-foreground/80 max-w-sm mx-auto text-[10px] uppercase font-black tracking-[0.4em]">
                                    {t.emptyStateFooter}
                                </p>
                            </div>
                        </div>
                    </div>
                </Reveal>
            )}
        </div>
    )
}

