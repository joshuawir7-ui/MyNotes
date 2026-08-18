"use client"
import { getLocalImageSrc } from "@/lib/image-utils"

import { Goal, GoalObjective, useStore } from "@/lib/store"
import { motion } from "framer-motion"
import { Trash2, Camera, Target, Plus, Check, X, FileText, Pin, RotateCcw } from "lucide-react"
import { useState, useEffect } from "react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { translations } from "@/lib/translations"
import { DatePicker } from "@/components/ui/date-picker"

export function GoalCard({ goal }: { goal: Goal }) {
    const updateGoal = useStore(state => state.updateGoal)
    const deleteGoal = useStore(state => state.deleteGoal)
    const addGoalPhoto = useStore(state => state.addGoalPhoto)
    const language = useStore(state => state.language)
    const showToast = useStore(state => state.showToast)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
    const t = (translations[language]?.pages?.goals || translations['en'].pages.goals) as any
    const common = (translations[language]?.common || translations['en'].common) as any

    const [localProgress, setLocalProgress] = useState(goal.progress)

    useEffect(() => {
        setLocalProgress(goal.progress)
    }, [goal.progress])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const { saveBase64ImageToFile } = await import('@/lib/image-utils');
                const uri = await saveBase64ImageToFile(base64);
                addGoalPhoto(goal.id, uri || base64)
                showToast(language === 'es' ? "Foto de inspiración agregada" : "Inspiration photo added", "success")
            }
            reader.readAsDataURL(file)
        }
    }

    const handleProgressUpdate = () => {
        updateGoal(goal.id, { progress: localProgress })
        showToast(language === 'es' ? "Progreso de la meta actualizado" : "Goal progress updated", "success")
    }

    const [newObjective, setNewObjective] = useState("")
    const [newObjectivePhoto, setNewObjectivePhoto] = useState<string | null>(null)
    const [activeOverlayImage, setActiveOverlayImage] = useState<string | null>(null)
    // Budget and progress states
    const [amountToAdd, setAmountToAdd] = useState("")
    const [isReportsOpen, setIsReportsOpen] = useState(false)
    const [reportDate, setReportDate] = useState("")
    const [reportNote, setReportNote] = useState("")

    const handleCardObjectiveFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const { saveBase64ImageToFile } = await import('@/lib/image-utils');
                const uri = await saveBase64ImageToFile(base64);
                setNewObjectivePhoto(uri || base64)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleToggleObjective = (objId: string) => {
        if (!goal.objectives) return
        const updatedObjectives = goal.objectives.map(obj =>
            obj.id === objId ? { ...obj, completed: !obj.completed } : obj
        )
        const total = updatedObjectives.length
        const completed = updatedObjectives.filter(o => o.completed).length
        const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0

        const toggledObj = goal.objectives.find(o => o.id === objId)
        if (toggledObj) {
            const formattedDate = new Date().toISOString().split('T')[0]
            const autoReport = {
                id: Math.random().toString(36).substring(7),
                date: formattedDate,
                note: language === 'es'
                    ? `${toggledObj.completed ? "Paso desmarcado" : "Paso completado"}: "${toggledObj.title}"`
                    : `${toggledObj.completed ? "Step unchecked" : "Step completed"}: "${toggledObj.title}"`
            }
            updateGoal(goal.id, {
                objectives: updatedObjectives,
                progress: newProgress,
                reports: [...(goal.reports || []), autoReport]
            })
        } else {
            updateGoal(goal.id, { objectives: updatedObjectives, progress: newProgress })
        }
    }

    const handleAddObjectiveCard = () => {
        if (!newObjective.trim()) return
        const updatedObjectives = [
            ...(goal.objectives || []),
            { id: Math.random().toString(36).substring(7), title: newObjective.trim(), completed: false, image: newObjectivePhoto || undefined }
        ]
        const total = updatedObjectives.length
        const completed = updatedObjectives.filter(o => o.completed).length
        const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0

        const formattedDate = new Date().toISOString().split('T')[0]
        const autoReport = {
            id: Math.random().toString(36).substring(7),
            date: formattedDate,
            note: language === 'es'
                ? `Paso agregado: "${newObjective.trim()}"`
                : `Step added: "${newObjective.trim()}"`
        }

        updateGoal(goal.id, {
            objectives: updatedObjectives,
            progress: newProgress,
            reports: [...(goal.reports || []), autoReport]
        })
        setNewObjective("")
        setNewObjectivePhoto(null)
    }

    const handleDeleteObjectiveCard = (objId: string) => {
        if (!goal.objectives) return
        const deletedObj = goal.objectives.find(obj => obj.id === objId)
        const updatedObjectives = goal.objectives.filter(obj => obj.id !== objId)
        const total = updatedObjectives.length
        const completed = updatedObjectives.filter(o => o.completed).length
        const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0

        if (deletedObj) {
            const formattedDate = new Date().toISOString().split('T')[0]
            const autoReport = {
                id: Math.random().toString(36).substring(7),
                date: formattedDate,
                note: language === 'es'
                    ? `Paso eliminado: "${deletedObj.title}"`
                    : `Step deleted: "${deletedObj.title}"`
            }
            updateGoal(goal.id, {
                objectives: updatedObjectives,
                progress: newProgress,
                reports: [...(goal.reports || []), autoReport]
            })
        } else {
            updateGoal(goal.id, { objectives: updatedObjectives, progress: newProgress })
        }
    }

    const handleUpdateMoney = (operation: 'add' | 'subtract') => {
        let cleanInput = amountToAdd.replace(',', '.')
        cleanInput = cleanInput.replace(/[^0-9.]/g, '')
        const val = Math.round(parseFloat(cleanInput) * 100) / 100
        if (isNaN(val) || val <= 0) return
        
        const current = Math.round((goal.currentValue || 0) * 100) / 100
        const target = goal.targetValue || 1
        const change = operation === 'add' ? val : -val
        const nextValue = Math.round(Math.max(0, current + change) * 100) / 100
        const nextProgress = Math.min(100, Math.round((nextValue / target) * 100))

        const formattedDate = new Date().toISOString().split('T')[0]
        const autoReport = {
            id: Math.random().toString(36).substring(7),
            date: formattedDate,
            note: language === 'es'
                ? `${operation === 'add' ? "Ahorro añadido" : "Ahorro retirado"}: ${operation === 'add' ? '+' : '-'}$${val} (Total: $${nextValue} / $${target})`
                : `${operation === 'add' ? "Savings added" : "Savings removed"}: ${operation === 'add' ? '+' : '-'}$${val} (Total: $${nextValue} / $${target})`
        }

        const isGeneral = goal.type !== 'checklist'
        const nextProgressVal = isGeneral ? nextProgress : goal.progress

        updateGoal(goal.id, {
            currentValue: nextValue,
            progress: nextProgressVal,
            reports: [...(goal.reports || []), autoReport]
        })
        setAmountToAdd("")
        showToast(
            language === 'es'
                ? (operation === 'add' ? "Ahorro registrado con éxito" : "Retiro registrado con éxito")
                : (operation === 'add' ? "Savings recorded successfully" : "Withdrawal recorded successfully"),
            "success"
        )
    }

    const handleResetBudget = () => {
        const formattedDate = new Date().toISOString().split('T')[0]
        const autoReport = {
            id: Math.random().toString(36).substring(7),
            date: formattedDate,
            note: language === 'es'
                ? `Presupuesto reiniciado a $0`
                : `Budget reset to $0`
        }
        updateGoal(goal.id, {
            currentValue: 0,
            progress: goal.type !== 'checklist' ? 0 : goal.progress,
            reports: [...(goal.reports || []), autoReport]
        })
        showToast(
            language === 'es'
                ? "Presupuesto reiniciado con éxito"
                : "Budget reset successfully",
            "success"
        )
    }

    const handleDeleteReport = (reportId: string) => {
        if (!goal.reports) return
        const updatedReports = goal.reports.filter(r => r.id !== reportId)
        updateGoal(goal.id, { reports: updatedReports })
        showToast(language === 'es' ? "Reporte eliminado" : "Progress report deleted", "info")
    }

    const handleAddReport = (e: React.FormEvent) => {
        e.preventDefault()
        if (!reportNote.trim()) return

        const formattedDate = reportDate || new Date().toISOString().split('T')[0]
        const newReport = {
            id: Math.random().toString(36).substring(7),
            date: formattedDate,
            note: reportNote.trim()
        }

        const updatedReports = [
            ...(goal.reports || []),
            newReport
        ]

        updateGoal(goal.id, { reports: updatedReports })
        setReportNote("")
        setIsReportsOpen(false)
        showToast(language === 'es' ? "Reporte guardado en la bitácora" : "Progress report saved", "success")
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-primary/30 transition-all duration-300"
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-primary" />
                        <h3 className="text-xl font-bold text-foreground">{goal.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm">{goal.description}</p>
                    <p className="text-[10px] text-primary uppercase font-black tracking-widest mt-2">
                        {t.targetDateLabel}: {goal.targetDate}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                            const nextPinned = !goal.pinned
                            updateGoal(goal.id, { pinned: nextPinned })
                            showToast(
                                language === 'es'
                                    ? (nextPinned ? "Meta fijada en Hoy" : "Meta desfijada")
                                    : (nextPinned ? "Goal pinned to Today" : "Goal unpinned"),
                                "success"
                            )
                        }}
                        className={`p-2 rounded-full transition-all ${goal.pinned
                                ? "text-primary bg-primary/10 hover:bg-primary/20"
                                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                            }`}
                        title={
                            language === 'es'
                                ? (goal.pinned ? "Desfijar meta" : "Fijar meta en Hoy")
                                : (goal.pinned ? "Unpin goal" : "Pin goal to Today")
                        }
                    >
                        <Pin className={`w-4 h-4 ${goal.pinned ? "fill-primary" : ""}`} />
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.9, rotate: -3 }}
                        onClick={() => setIsDeleting(true)}
                        className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all"
                        title={language === 'es' ? "Eliminar meta" : "Delete goal"}
                    >
                        <Trash2 className="w-4 h-4" />
                    </motion.button>
                </div>
            </div>

            <ConfirmationDialog
                isOpen={isDeleting}
                onClose={() => setIsDeleting(false)}
                onConfirm={() => {
                    deleteGoal(goal.id)
                    showToast(language === 'es' ? "Meta eliminada" : "Goal deleted", "info")
                }}
                title={common.confirmDelete || "¿Eliminar esta meta?"}
                message={language === 'es' ? "Esta acción es irreversible." : "This action is irreversible."}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Progress Tracking */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-medium">Progreso</span>
                        <span className="text-primary font-bold">{localProgress}%</span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${localProgress}%` }}
                            className="h-full bg-gradient-to-r from-primary to-purple-500 neon-glow"
                        />
                    </div>





                    {/* Manual slider (only when not checklist and no budget) */}
                    {goal.type !== 'checklist' && (goal.targetValue === undefined || goal.targetValue === 0) && (
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={localProgress}
                            onChange={(e) => setLocalProgress(parseInt(e.target.value))}
                            onMouseUp={handleProgressUpdate}
                            onTouchEnd={handleProgressUpdate}
                            className="w-full accent-primary bg-white/5 h-2 rounded-full cursor-pointer mt-4"
                        />
                    )}
                </div>

                {/* Photos Section */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-medium">{t.inspirationPhotosLabel}</span>
                        <label className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 cursor-pointer transition-all">
                            <Camera className="w-4 h-4" />
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2">
                        {goal.photos.map((photo, i) => (
                            <div key={i} className="relative group w-full max-w-sm rounded-xl overflow-hidden">
                                <img src={getLocalImageSrc(photo)} alt="" className="w-full h-auto max-h-64 object-contain transition-transform group-hover:scale-[1.02]" />
                            </div>
                        ))}
                        {goal.photos.length === 0 && (
                            <div className="w-full h-32 rounded-xl border-2 border-dashed border-black/10 dark:border-white/5 flex flex-col items-center justify-center text-muted-foreground text-xs">
                                <Plus className="w-4 h-4 mb-1 opacity-20" />
                                <span>{t.inspirationPhotosLabel}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Budget section */}
            {goal.targetValue !== undefined && goal.targetValue > 0 && (
                <div className="space-y-2 mt-6 bg-transparent py-2.5 text-left w-full">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                            {language === 'es' ? "Presupuesto" : "Budget"}
                        </span>
                        <span className="text-base font-bold text-foreground font-mono whitespace-nowrap flex items-center gap-1.5">
                            <span>$ {Number(goal.currentValue || 0).toFixed(2).replace(/\.00$/, '')} / {goal.targetValue}</span>
                            <button
                                type="button"
                                onClick={() => setIsResetConfirmOpen(true)}
                                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-muted-foreground hover:text-primary transition-all active:scale-95 flex items-center justify-center"
                                title={language === 'es' ? "Reiniciar presupuesto" : "Reset budget"}
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        </span>
                    </div>

                    {/* Add savings input */}
                    <div className="flex flex-col items-center gap-1.5 mt-1 max-w-xs mx-auto w-full">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-center">
                            {language === 'es' ? "Monto" : "Amount"}
                        </span>
                        <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            value={amountToAdd}
                            onChange={(e) => setAmountToAdd(e.target.value)}
                            placeholder="0.00 $"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleUpdateMoney('add')
                                }
                            }}
                            className="w-full bg-black/[0.02] dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-xl px-3 py-1.5 text-xs text-center focus:outline-none focus:border-primary/50 transition-colors font-medium"
                        />
                        <div className="flex gap-2 w-full mt-0.5">
                            <button
                                type="button"
                                onClick={() => handleUpdateMoney('add')}
                                className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 font-bold text-xs rounded-xl transition-all active:scale-[0.98] text-center"
                            >
                                {language === 'es' ? "Añadir" : "Add"}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleUpdateMoney('subtract')}
                                className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 font-bold text-xs rounded-xl transition-all active:scale-[0.98] text-center"
                            >
                                {language === 'es' ? "Restar" : "Subtract"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checklist section */}
            {goal.type === 'checklist' && (
                <div className="space-y-3 mt-6 text-left w-full">
                    {goal.objectives && goal.objectives.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {goal.objectives.map((obj) => (
                                <div
                                    key={obj.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 select-none
                                        ${obj.completed
                                            ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                                            : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10"
                                        }
                                    `}
                                >
                                    <button
                                        onClick={() => handleToggleObjective(obj.id)}
                                        className="flex items-center gap-2.5 flex-1 cursor-pointer text-left"
                                    >
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-all duration-200
                                            ${obj.completed
                                                ? "bg-primary border-primary text-white"
                                                : "border-muted-foreground/40 bg-transparent"
                                            }
                                        `}>
                                            {obj.completed && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                                        </div>

                                        {/* Objective Photo Thumbnail */}
                                        {obj.image && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveOverlayImage(obj.image || null);
                                                }}
                                                className="w-8 h-8 rounded overflow-hidden border border-white/10 shrink-0 cursor-zoom-in hover:scale-105 transition-all"
                                            >
                                                <img src={getLocalImageSrc(obj.image)} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        )}

                                        <span className={`text-sm leading-normal transition-all duration-200 font-medium break-words max-w-[70%]
                                            ${obj.completed
                                                ? "line-through text-muted-foreground opacity-60"
                                                : "text-foreground opacity-90"
                                            }
                                        `}>
                                            {obj.title}
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => handleDeleteObjectiveCard(obj.id)}
                                        className="text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded-lg transition-all shrink-0"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground/60 italic text-left">
                            {language === 'es' ? "No hay objetivos creados." : "No objectives created."}
                        </p>
                    )}

                    {/* Preview of attached photo for card objective */}
                    {newObjectivePhoto && (
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-black/5 dark:border-white/10 flex-shrink-0 mt-2">
                            <img src={getLocalImageSrc(newObjectivePhoto)} alt="" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => setNewObjectivePhoto(null)}
                                className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        </div>
                    )}

                    {/* Mini Input to add objective directly on the card */}
                    <div className="flex flex-col gap-2 mt-2 max-w-xs mx-auto w-full">
                        <input
                            type="text"
                            value={newObjective}
                            onChange={(e) => setNewObjective(e.target.value)}
                            placeholder={t.addStepPlaceholder || "Agrega un paso..."}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddObjectiveCard()
                                }
                            }}
                            className="w-full bg-white/5 border border-black/20 dark:border-white/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary/50 transition-colors text-center font-medium"
                        />
                        <div className="flex gap-2 w-full">
                            {/* Card inline objective photo upload button */}
                            <label className="flex-1 flex justify-center items-center py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 cursor-pointer transition-all shrink-0">
                                <Camera className="w-4 h-4" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleCardObjectiveFileChange} />
                            </label>

                            <button
                                type="button"
                                onClick={handleAddObjectiveCard}
                                className="flex-1 py-2 bg-primary/20 text-primary font-bold text-xs rounded-xl hover:bg-primary/30 transition-all active:scale-[0.98] text-center"
                            >
                                {language === 'es' ? "Añadir" : "Add"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Reports Timeline Section */}
            <div className="mt-8 border-t border-black/5 dark:border-white/10 pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">{t.progressReportsLabel || "Bitácora de Avances"}</h4>
                    </div>

                    <button
                        onClick={() => setIsReportsOpen(!isReportsOpen)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-all"
                        title={language === 'es' ? "Añadir Avance / Reporte" : "Add Progress Report"}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <FileText className="w-4 h-4" />
                    </button>
                </div>

                {/* New Report Panel */}
                {isReportsOpen && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        onSubmit={handleAddReport}
                        className="space-y-4 mb-6 bg-black/[0.02] dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5"
                    >
                        <DatePicker
                            label={t.reportDateLabel || "Fecha del Reporte"}
                            value={reportDate || new Date().toISOString().split('T')[0]}
                            onChange={setReportDate}
                        />

                        <div className="space-y-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground/60 text-left">
                                {language === 'es' ? "Detalles del Avance" : "Progress Details"}
                            </label>
                            <textarea
                                required
                                value={reportNote}
                                onChange={(e) => setReportNote(e.target.value)}
                                placeholder={t.reportNotePlaceholder || "Ej: Hoy completé la primera sección..."}
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-2 bg-primary text-white font-bold text-xs rounded-xl hover:opacity-90 transition-all shadow-md shadow-primary/20"
                        >
                            {t.saveReportBtn || "Guardar Reporte"}
                        </button>
                    </motion.form>
                )}

                {/* Timeline display */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {goal.reports && goal.reports.length > 0 ? (
                        [...goal.reports]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((rep) => {
                                const repDate = new Date(rep.date + 'T00:00:00');
                                const formattedDate = repDate.toLocaleDateString(
                                    language === 'es' ? 'es-ES' : 'en-US',
                                    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
                                );

                                return (
                                    <div
                                        key={rep.id}
                                        className="relative flex flex-col bg-black/[0.01] dark:bg-white/[0.02] p-4 rounded-xl border border-black/5 dark:border-white/5 hover:border-primary/10 transition-colors text-left gap-3 group"
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="inline-block text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                                {formattedDate}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteReport(rep.id)}
                                                className="text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded-lg transition-all shrink-0"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <p className="text-sm opacity-90 break-words whitespace-pre-wrap flex-1">{rep.note}</p>
                                    </div>
                                );
                            })
                    ) : (
                        <div className="col-span-full">
                            <p className="text-xs text-muted-foreground/60 italic py-2 text-left">
                                {t.noReportsYet || "Aún no hay reportes de avance registrados."}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Full screen Image Lightbox Overlay */}
            {activeOverlayImage && (
                <div
                    onClick={() => setActiveOverlayImage(null)}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
                >
                    <button
                        onClick={() => setActiveOverlayImage(null)}
                        className="absolute top-6 right-6 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <div
                        className="relative max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={getLocalImageSrc(activeOverlayImage)}
                            alt="Preview"
                            className="w-full h-auto max-h-[85vh] object-contain"
                        />
                    </div>
                </div>
            )}

            {/* Confirmation Dialog for budget reset */}
            <ConfirmationDialog
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={handleResetBudget}
                title={language === 'es' ? "¿Reiniciar presupuesto?" : "Reset budget?"}
                message={language === 'es' ? "Esto restablecerá tu saldo actual a $0.00. Los reportes de avance no se decolarán ni eliminarán." : "This will reset your current balance to $0.00. Progress reports will not be deleted."}
                confirmLabel={language === 'es' ? "Reiniciar" : "Reset"}
                cancelLabel={language === 'es' ? "Cancelar" : "Cancel"}
                variant="danger"
            />
        </motion.div>
    )
}

