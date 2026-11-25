"use client"
import { getLocalImageSrc } from "@/lib/image-utils"
import { LocalImage } from "@/components/ui/local-image"

import { Goal, GoalObjective, useStore, computeNetBalance, computeGoalProgress } from "@/lib/store"
import { motion, AnimatePresence } from "framer-motion"
import { Trash2, Camera, Target, Plus, Check, X, FileText, Pin, RotateCcw, Pencil, ChevronDown } from "lucide-react"
import { useState, useEffect, useRef, useMemo, memo } from "react"
import { createPortal } from "react-dom"
import { useShallow } from "zustand/react/shallow"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { translations } from "@/lib/translations"
import { DatePicker } from "@/components/ui/date-picker"
import { CustomSelect } from "@/components/ui/custom-select"
import { GlassSurface } from "@/components/ui/glass-surface"
import { useDeferredBlur } from "@/hooks/use-deferred-blur"
import { lt, pick } from "@/lib/i18n-inline"

export const GoalCard = memo(function GoalCard({ goal }: { goal: Goal }) {
    const updateGoal = useStore(state => state.updateGoal)
    const deleteGoal = useStore(state => state.deleteGoal)
    const addGoalPhoto = useStore(state => state.addGoalPhoto)
    const rawTransactions = useStore(useShallow(state => state.transactions ?? []))
    const transactions = Array.isArray(rawTransactions) ? rawTransactions : []
    const language = useStore(state => state.language)
    const currency = useStore(state => state.currency) || (language === 'zh' ? '¥' : '$')
    const appColor = useStore(state => state.appColor ?? 'purple')
    const showToast = useStore(state => state.showToast)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
    const [showCongratsModal, setShowCongratsModal] = useState(false)
    const t = (translations[language]?.pages?.goals || translations['en'].pages.goals) as any
    const common = (translations[language]?.common || translations['en'].common) as any

    const syncedBalance = useMemo(() => computeNetBalance(transactions), [transactions])
    const effectiveMoney = goal.syncWithBalance ? Math.max(0, syncedBalance) : (goal.currentValue || 0)

    const [localProgress, setLocalProgress] = useState(goal.progress)

    useEffect(() => {
        setLocalProgress(goal.progress)
    }, [goal.progress])

    const effectiveProgress = useMemo(() => computeGoalProgress({
        type: goal.type,
        objectives: goal.objectives,
        targetValue: goal.targetValue,
        currentValue: effectiveMoney,
        manualProgress: localProgress,
    }), [goal.type, goal.objectives, goal.targetValue, effectiveMoney, localProgress])

    const prevProgressRef = useRef<number>(effectiveProgress)
    useEffect(() => {
        if (prevProgressRef.current < 100 && effectiveProgress >= 100) {
            setShowCongratsModal(true)
        }
        prevProgressRef.current = effectiveProgress
    }, [effectiveProgress])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const { saveBase64ImageToFile } = await import('@/lib/image-utils');
                const uri = await saveBase64ImageToFile(base64);
                addGoalPhoto(goal.id, uri || base64)
                showToast(lt(language, "Foto de inspiración agregada", "Inspiration photo added"), "success")
            }
            reader.readAsDataURL(file)
        }
    }

    const handleProgressUpdate = () => {
        updateGoal(goal.id, { progress: localProgress })
        showToast(lt(language, "Progreso de la meta actualizado", "Goal progress updated"), "success")
    }

    const [newObjective, setNewObjective] = useState("")
    const [newObjectivePhoto, setNewObjectivePhoto] = useState<string | null>(null)
    const [isAddStepOpen, setIsAddStepOpen] = useState(false)
    const photosContainerRef = useRef<HTMLDivElement | null>(null)
    const [activeOverlayImage, setActiveOverlayImage] = useState<string | null>(null)

    const triggerImageShake = () => {
        const container = photosContainerRef.current
        if (!container) return
        container.classList.remove('animate-goal-image-shake')
        void container.offsetWidth
        container.classList.add('animate-goal-image-shake')
    }
    const overlayBlur = useDeferredBlur(Boolean(activeOverlayImage))
    // Edit Goal modal states
    const [isEditingGoal, setIsEditingGoal] = useState(false)
    const [editTitle, setEditTitle] = useState(goal.title)
    const [editDescription, setEditDescription] = useState(goal.description || "")
    const [editDate, setEditDate] = useState(goal.targetDate || "")
    const [editType, setEditType] = useState<'general' | 'checklist'>(goal.type === 'checklist' ? 'checklist' : 'general')
    const [editHasBudget, setEditHasBudget] = useState(Boolean(goal.targetValue && goal.targetValue > 0))
    const [editTargetBudget, setEditTargetBudget] = useState(goal.targetValue ? String(goal.targetValue) : "")
    const [editSyncWithBalance, setEditSyncWithBalance] = useState(Boolean(goal.syncWithBalance))
    const [editPhotos, setEditPhotos] = useState<string[]>(goal.photos || [])
    // Budget and progress states
    const [amountToAdd, setAmountToAdd] = useState("")
    const [isReportsOpen, setIsReportsOpen] = useState(false)
    const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false)
    const [reportDate, setReportDate] = useState("")
    const [reportNote, setReportNote] = useState("")

    const openEditModal = () => {
        setEditTitle(goal.title)
        setEditDescription(goal.description || "")
        setEditDate(goal.targetDate || "")
        setEditType(goal.type === 'checklist' ? 'checklist' : 'general')
        setEditHasBudget(Boolean(goal.targetValue && goal.targetValue > 0))
        setEditTargetBudget(goal.targetValue ? String(goal.targetValue) : "")
        setEditSyncWithBalance(Boolean(goal.syncWithBalance))
        setEditPhotos(goal.photos || [])
        setIsEditingGoal(true)
    }

    const handleEditPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string
                const { saveBase64ImageToFile } = await import('@/lib/image-utils')
                const uri = await saveBase64ImageToFile(base64)
                setEditPhotos(prev => [...prev, uri || base64])
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSaveGoalEdit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!editTitle.trim()) return

        const parsedTarget = editHasBudget ? parseFloat(editTargetBudget) : undefined
        const validTarget = parsedTarget && !isNaN(parsedTarget) && parsedTarget > 0 ? parsedTarget : undefined
        const nextCurrentValue = validTarget ? (goal.currentValue ?? 0) : undefined
        const nextSync = validTarget ? editSyncWithBalance : false
        const nextMoney = nextSync ? Math.max(0, syncedBalance) : (nextCurrentValue || 0)

        const nextProgress = computeGoalProgress({
            type: editType,
            objectives: goal.objectives,
            targetValue: validTarget,
            currentValue: nextMoney,
            manualProgress: localProgress,
        })

        updateGoal(goal.id, {
            title: editTitle.trim(),
            description: editDescription.trim(),
            targetDate: editDate,
            type: editType,
            targetValue: validTarget,
            currentValue: nextCurrentValue,
            unit: validTarget ? currency : undefined,
            syncWithBalance: nextSync,
            photos: editPhotos,
            progress: nextProgress,
        })

        setIsEditingGoal(false)
        showToast(pick(language, {
            es: "Meta actualizada correctamente",
            en: "Goal updated successfully",
            zh: "目标已更新"
        }), "success")
    }

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
        const newProgress = computeGoalProgress({
            type: goal.type,
            objectives: updatedObjectives,
            targetValue: goal.targetValue,
            currentValue: effectiveMoney,
            manualProgress: localProgress,
        })

        const toggledObj = goal.objectives.find(o => o.id === objId)
        if (toggledObj && !toggledObj.completed) {
            triggerImageShake()
        }
        if (toggledObj) {
            const formattedDate = new Date().toISOString().split('T')[0]
            const autoReport = {
                id: Math.random().toString(36).substring(7),
                date: formattedDate,
                note: pick(language, {
                    es: `${toggledObj.completed ? "Paso desmarcado" : "Paso completado"}: "${toggledObj.title}"`,
                    en: `${toggledObj.completed ? "Step unchecked" : "Step completed"}: "${toggledObj.title}"`,
                    zh: `${toggledObj.completed ? "已取消步骤" : "已完成步骤"}: "${toggledObj.title}"`
                })
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
        const newProgress = computeGoalProgress({
            type: goal.type,
            objectives: updatedObjectives,
            targetValue: goal.targetValue,
            currentValue: effectiveMoney,
            manualProgress: localProgress,
        })

        const formattedDate = new Date().toISOString().split('T')[0]
        const autoReport = {
            id: Math.random().toString(36).substring(7),
            date: formattedDate,
            note: pick(language, {
                es: `Paso agregado: "${newObjective.trim()}"`,
                en: `Step added: "${newObjective.trim()}"`,
                zh: `已添加步骤: "${newObjective.trim()}"`
            })
        }

        updateGoal(goal.id, {
            objectives: updatedObjectives,
            progress: newProgress,
            reports: [...(goal.reports || []), autoReport]
        })
        setNewObjective("")
        setNewObjectivePhoto(null)
        setIsAddStepOpen(false)
    }

    const handleDeleteObjectiveCard = (objId: string) => {
        if (!goal.objectives) return
        const deletedObj = goal.objectives.find(obj => obj.id === objId)
        const updatedObjectives = goal.objectives.filter(obj => obj.id !== objId)
        const newProgress = computeGoalProgress({
            type: goal.type,
            objectives: updatedObjectives,
            targetValue: goal.targetValue,
            currentValue: effectiveMoney,
            manualProgress: localProgress,
        })

        if (deletedObj) {
            const formattedDate = new Date().toISOString().split('T')[0]
            const autoReport = {
                id: Math.random().toString(36).substring(7),
                date: formattedDate,
                note: pick(language, {
                    es: `Paso eliminado: "${deletedObj.title}"`,
                    en: `Step deleted: "${deletedObj.title}"`,
                    zh: `已删除步骤: "${deletedObj.title}"`
                })
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
        const nextProgressVal = computeGoalProgress({
            type: goal.type,
            objectives: goal.objectives,
            targetValue: goal.targetValue,
            currentValue: nextValue,
            manualProgress: localProgress,
        })

        const formattedDate = new Date().toISOString().split('T')[0]
        const autoReport = {
            id: Math.random().toString(36).substring(7),
            date: formattedDate,
            note: pick(language, {
                es: `${operation === 'add' ? "Ahorro añadido" : "Ahorro retirado"}: ${operation === 'add' ? '+' : '-'}${currency}${val} (Total: ${currency}${nextValue} / ${currency}${target})`,
                en: `${operation === 'add' ? "Savings added" : "Savings removed"}: ${operation === 'add' ? '+' : '-'}${currency}${val} (Total: ${currency}${nextValue} / ${currency}${target})`,
                zh: `${operation === 'add' ? "已增加储蓄" : "已取出储蓄"}: ${operation === 'add' ? '+' : '-'}${currency}${val} (总计: ${currency}${nextValue} / ${currency}${target})`
            })
        }

        updateGoal(goal.id, {
            currentValue: nextValue,
            progress: nextProgressVal,
            reports: [...(goal.reports || []), autoReport]
        })
        setAmountToAdd("")
        showToast(
            pick(language, {
                es: operation === 'add' ? "Ahorro registrado con éxito" : "Retiro registrado con éxito",
                en: operation === 'add' ? "Savings recorded successfully" : "Withdrawal recorded successfully",
                zh: operation === 'add' ? "储蓄记录成功" : "取出记录成功"
            }),
            "success"
        )
    }

    const handleResetBudget = () => {
        const formattedDate = new Date().toISOString().split('T')[0]
        const autoReport = {
            id: Math.random().toString(36).substring(7),
            date: formattedDate,
            note: pick(language, {
                es: `Presupuesto reiniciado a ${currency}0`,
                en: `Budget reset to ${currency}0`,
                zh: `预算已重置为 ${currency}0`
            })
        }
        const nextProgressVal = computeGoalProgress({
            type: goal.type,
            objectives: goal.objectives,
            targetValue: goal.targetValue,
            currentValue: 0,
            manualProgress: localProgress,
        })
        updateGoal(goal.id, {
            currentValue: 0,
            progress: nextProgressVal,
            reports: [...(goal.reports || []), autoReport]
        })
        showToast(
            lt(language, "Presupuesto reiniciado con éxito", "Budget reset successfully"),
            "success"
        )
    }

    const handleDeleteReport = (reportId: string) => {
        if (!goal.reports) return
        const updatedReports = goal.reports.filter(r => r.id !== reportId)
        updateGoal(goal.id, { reports: updatedReports })
        showToast(lt(language, "Reporte eliminado", "Progress report deleted"), "info")
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
        showToast(lt(language, "Reporte guardado en la bitácora", "Progress report saved"), "success")
    }

    return (
        <div
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 380px' }}
            className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-primary/30 transition-colors duration-200"
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
                                pick(language, {
                                    es: nextPinned ? "Meta fijada en Hoy" : "Meta desfijada",
                                    en: nextPinned ? "Goal pinned to Today" : "Goal unpinned",
                                    zh: nextPinned ? "目标已固定到今天" : "已取消固定目标"
                                }),
                                "success"
                            )
                        }}
                        className={`p-2 rounded-full transition-all ${goal.pinned
                                ? "text-primary bg-primary/10 hover:bg-primary/20"
                                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                            }`}
                        title={
                            pick(language, {
                                es: goal.pinned ? "Desfijar meta" : "Fijar meta en Hoy",
                                en: goal.pinned ? "Unpin goal" : "Pin goal to Today",
                                zh: goal.pinned ? "取消固定目标" : "固定目标到今天"
                            })
                        }
                    >
                        <Pin className={`w-4 h-4 ${goal.pinned ? "fill-primary" : ""}`} />
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={openEditModal}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all"
                        title={pick(language, { es: "Editar meta", en: "Edit goal", zh: "编辑目标" })}
                    >
                        <Pencil className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.9, rotate: -3 }}
                        onClick={() => setIsDeleting(true)}
                        className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all"
                        title={lt(language, "Eliminar meta", "Delete goal")}
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
                    showToast(lt(language, "Meta eliminada", "Goal deleted"), "info")
                }}
                title={common.confirmDelete || "¿Eliminar esta meta?"}
                message={lt(language, "Esta acción es irreversible.", "This action is irreversible.")}
            />

            {(() => {
                const hasChecklist = goal.type === 'checklist'
                const hasBudgetSection = goal.targetValue !== undefined && goal.targetValue > 0
                const landscapeRowsClass = hasChecklist
                    ? (hasBudgetSection ? "sm:landscape:grid-rows-[auto_1fr_auto]" : "sm:landscape:grid-rows-[auto_1fr]")
                    : ""

                return (
                    <div className={`grid grid-cols-1 sm:landscape:grid-cols-2 ${landscapeRowsClass} gap-x-6 gap-y-5 items-start`}>
                        {/* Progress Tracking (Top-Left in landscape, 1st in portrait) */}
                        <div className="space-y-4 sm:landscape:col-start-1 sm:landscape:row-start-1">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-medium">{pick(language, { es: 'Progreso', en: 'Progress', zh: '进度' })}</span>
                                <span className="text-primary font-bold">{effectiveProgress}%</span>
                            </div>
                            <div className="h-3 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                <div
                                    style={{ transform: `scaleX(${Math.max(0, Math.min(100, effectiveProgress)) / 100})` }}
                                    className={`h-full w-full origin-left transition-transform duration-300 ease-out ${appColor === 'black' ? 'bg-black dark:bg-white' : 'bg-gradient-to-r from-primary to-purple-500 neon-glow'}`}
                                />
                            </div>

                            {/* Manual slider (only when not checklist and no budget) */}
                            {goal.type !== 'checklist' && !hasBudgetSection && (
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

                        {/* Photos Section (Right in landscape alongside progress & objectives, 2nd in portrait) */}
                        {goal.photos.length > 0 && (
                            <div
                                ref={photosContainerRef}
                                className={`sm:landscape:col-start-2 sm:landscape:row-start-1 ${hasChecklist ? 'sm:landscape:row-span-2' : ''} flex flex-col gap-4 items-center sm:landscape:items-end justify-start`}
                            >
                                {goal.photos.map((photo, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setActiveOverlayImage(photo)}
                                        className="relative group w-full max-w-md rounded-2xl overflow-hidden cursor-zoom-in"
                                    >
                                        <LocalImage src={photo} alt="" className="w-full h-auto max-h-72 object-contain" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Budget section (Bottom-Centered in landscape, 3rd in portrait) */}
                        {hasBudgetSection && (
                            <div className={`space-y-2 bg-transparent py-1 text-left w-full sm:landscape:col-span-2 ${hasChecklist ? 'sm:landscape:row-start-3' : 'sm:landscape:row-start-2'} sm:landscape:max-w-md sm:landscape:mx-auto sm:landscape:pt-2`}>
                                <div className="flex justify-between items-center px-1 gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                                            {lt(language, "Presupuesto", "Budget")}
                                        </span>
                                        {goal.syncWithBalance && (
                                            <span className="text-[10px] font-semibold text-primary/80 mt-0.5">
                                                {lt(language, "Sincronizado con Balance", "Synced with Balance")}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-base font-bold text-foreground font-mono whitespace-nowrap flex items-center gap-1.5">
                                        <span>{currency} {Number(effectiveMoney).toFixed(2).replace(/\.00$/, '')} / {goal.targetValue}</span>
                                        {!goal.syncWithBalance && (
                                            <button
                                                type="button"
                                                onClick={() => setIsResetConfirmOpen(true)}
                                                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-muted-foreground hover:text-primary transition-all active:scale-95 flex items-center justify-center"
                                                title={lt(language, "Reiniciar presupuesto", "Reset budget")}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </span>
                                </div>

                                {/* Add / Subtract savings input (only for reserved money, hidden when synced with Balance) */}
                                {!goal.syncWithBalance && (
                                    <div className="flex flex-col items-center gap-1.5 mt-1 max-w-xs sm:landscape:max-w-md mx-auto w-full">
                                        <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-center">
                                            {lt(language, "Monto", "Amount")}
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            pattern="[0-9]*[.,]?[0-9]*"
                                            value={amountToAdd}
                                            onChange={(e) => setAmountToAdd(e.target.value)}
                                            placeholder={`0.00 ${currency}`}
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
                                                {lt(language, "Añadir", "Add")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateMoney('subtract')}
                                                className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 font-bold text-xs rounded-xl transition-all active:scale-[0.98] text-center"
                                            >
                                                {lt(language, "Restar", "Subtract")}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Checklist section (Top-Left below progress in landscape, 4th in portrait) */}
                        {hasChecklist && (
                            <div className="space-y-3 text-left w-full sm:landscape:col-start-1 sm:landscape:row-start-2">
                            {(!goal.objectives || goal.objectives.length === 0) && (
                                <p className="text-xs text-muted-foreground/60 italic text-left">
                                    {lt(language, "No hay objetivos creados.", "No objectives created.")}
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:landscape:grid-cols-2 gap-2.5">
                                {(goal.objectives || []).map((obj) => (
                                    <div
                                        key={obj.id}
                                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-colors duration-200 select-none
                                            ${obj.completed
                                                ? "bg-transparent border-transparent hover:bg-black/[0.03] dark:hover:bg-white/5"
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
                                                    <LocalImage src={obj.image} alt="" className="w-full h-full object-cover" />
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

                                {/* Collapsible + button inside the same objectives grid */}
                                {!isAddStepOpen && (
                                    <div className="flex items-center p-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsAddStepOpen(true)}
                                            className="w-8 h-8 rounded-full bg-primary/15 hover:bg-primary/25 text-primary flex items-center justify-center transition-all active:scale-95"
                                            title={t.addStepPlaceholder || pick(language, { es: "Agregar paso", en: "Add step", zh: "添加步骤" })}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Expanded step creation panel */}
                            {isAddStepOpen && (
                                <div className="flex flex-col gap-2 mt-2 max-w-xs mx-auto w-full animate-in fade-in slide-in-from-top-1 duration-200">
                                    {/* Preview of attached photo for card objective */}
                                    {newObjectivePhoto && (
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-black/5 dark:border-white/10 flex-shrink-0 mx-auto">
                                            <LocalImage src={newObjectivePhoto} alt="" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setNewObjectivePhoto(null)}
                                                className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
                                            >
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1.5 w-full">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newObjective}
                                            onChange={(e) => setNewObjective(e.target.value)}
                                            placeholder={t.addStepPlaceholder || "Agrega un paso..."}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddObjectiveCard()
                                                } else if (e.key === 'Escape') {
                                                    setIsAddStepOpen(false)
                                                }
                                            }}
                                            className="flex-1 bg-white/5 border border-black/20 dark:border-white/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary/50 transition-colors text-center font-medium"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAddStepOpen(false)
                                                setNewObjective("")
                                                setNewObjectivePhoto(null)
                                            }}
                                            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
                                            title={lt(language, "Cerrar", "Close")}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
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
                                            {lt(language, "Añadir", "Add")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                )
            })()}

            {/* Progress Reports Timeline Section */}
            <div className="mt-8 border-t border-black/5 dark:border-white/10 pt-6">
                <div className={`flex justify-between items-center ${isTimelineCollapsed && !isReportsOpen ? 'mb-0' : 'mb-4'}`}>
                    <button
                        type="button"
                        onClick={() => setIsTimelineCollapsed(prev => !prev)}
                        className="flex items-center gap-2 text-left cursor-pointer group"
                    >
                        <Target className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">{t.progressReportsLabel || "Bitácora de Avances"}</h4>
                    </button>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setIsTimelineCollapsed(prev => !prev)}
                            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title={isTimelineCollapsed
                                ? pick(language, { es: "Expandir bitácora", en: "Expand log", zh: "展开日志" })
                                : pick(language, { es: "Contraer bitácora", en: "Collapse log", zh: "收起日志" })}
                        >
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isTimelineCollapsed ? '' : 'rotate-180'}`} />
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                const nextOpen = !isReportsOpen
                                setIsReportsOpen(nextOpen)
                                if (nextOpen && isTimelineCollapsed) setIsTimelineCollapsed(false)
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-2 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-primary font-bold text-xs rounded-xl transition-colors cursor-pointer"
                            title={lt(language, "Añadir Avance / Reporte", "Add Progress Report")}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <FileText className="w-4 h-4" />
                        </button>
                    </div>
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
                                {lt(language, "Detalles del Avance", "Progress Details")}
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
                {!isTimelineCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {goal.reports && goal.reports.length > 0 ? (
                        [...goal.reports]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((rep) => {
                                const repDate = new Date(rep.date + 'T00:00:00');
                                const formattedDate = repDate.toLocaleDateString(
                                    lt(language, 'es-ES', 'en-US'),
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
                )}
            </div>

            {/* Full screen Image Lightbox Overlay */}
            {activeOverlayImage && (
                <div
                    onClick={() => setActiveOverlayImage(null)}
                    className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 ${overlayBlur ? "backdrop-blur-md" : ""} animate-in fade-in duration-200`}
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
                        <LocalImage
                            src={activeOverlayImage}
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
                title={lt(language, "¿Reiniciar presupuesto?", "Reset budget?")}
                message={lt(language, "Esto restablecerá tu saldo actual a $0.00. Los reportes de avance no se decolarán ni eliminarán.", "This will reset your current balance to $0.00. Progress reports will not be deleted.")}
                confirmLabel={lt(language, "Reiniciar", "Reset")}
                cancelLabel={lt(language, "Cancelar", "Cancel")}
                variant="danger"
            />

            {/* Edit Goal Modal */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isEditingGoal && (
                        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="glass-scrim"
                                onClick={() => setIsEditingGoal(false)}
                            />
                            <motion.div
                                initial={{ scale: 0.95, y: 15 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 15 }}
                                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                                className="relative z-10 w-full max-w-lg"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <GlassSurface variant="sheet" className="w-full rounded-3xl">
                                    <div className="p-6 sm:p-8 max-h-[90vh] overflow-y-auto custom-scrollbar relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingGoal(false)}
                                            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>

                                        <div className="flex items-center gap-3 mb-6">
                                            <Target className="w-6 h-6 text-foreground shrink-0" />
                                            <h2 className="text-2xl font-bold">
                                                {pick(language, { es: "Editar Meta", en: "Edit Goal", zh: "编辑目标" })}
                                            </h2>
                                        </div>

                                        <form onSubmit={handleSaveGoalEdit} className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t.goalName}</label>
                                                <input
                                                    autoFocus
                                                    required
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    placeholder={t.placeholderGeneral}
                                                    className="w-full glass-field rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t.goalType}</label>
                                                <CustomSelect
                                                    options={[
                                                        { label: t.typeManual || lt(language, "Progreso Manual", "Manual Progress"), value: "general" },
                                                        { label: t.typeChecklist || lt(language, "Cumplimiento de objetivos (Mini tareas)", "By Objectives"), value: "checklist" }
                                                    ]}
                                                    value={editType}
                                                    onChange={(val) => setEditType(val === 'checklist' ? 'checklist' : 'general')}
                                                />
                                            </div>

                                            <div className="flex items-center gap-3 glass-card p-4 rounded-2xl">
                                                <input
                                                    type="checkbox"
                                                    id={`editHasBudget-${goal.id}`}
                                                    checked={editHasBudget}
                                                    onChange={(e) => setEditHasBudget(e.target.checked)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary border-white/10 bg-white/5 cursor-pointer accent-primary"
                                                />
                                                <label htmlFor={`editHasBudget-${goal.id}`} className="text-sm font-medium text-foreground select-none cursor-pointer">
                                                    {lt(language, "¿Establecer presupuesto / meta de ahorro?", "Set budget / savings goal?")}
                                                </label>
                                            </div>

                                            {editHasBudget && (
                                                <div className="space-y-4 glass-card p-4 rounded-2xl">
                                                    <div>
                                                        <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                                                            {`${lt(language, "Presupuesto Objetivo ($)", "Target Budget ($)").replace(/\(\$\)/g, `(${currency})`)}`}
                                                        </label>
                                                        <input
                                                            required
                                                            type="number"
                                                            min="1"
                                                            value={editTargetBudget}
                                                            onChange={(e) => setEditTargetBudget(e.target.value)}
                                                            placeholder="500"
                                                            className="w-full glass-field rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                                            {lt(language, "Origen del dinero", "Money source")}
                                                        </label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditSyncWithBalance(false)}
                                                                className={`p-3 rounded-xl border text-left transition-all ${
                                                                    !editSyncWithBalance
                                                                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent font-semibold'
                                                                        : 'glass-field text-foreground/80 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                                                                }`}
                                                            >
                                                                <div className="text-xs font-bold">
                                                                    {lt(language, "Dinero reservado", "Reserved money")}
                                                                </div>
                                                                <div className={`text-[10px] mt-0.5 ${!editSyncWithBalance ? 'opacity-80' : 'text-muted-foreground'}`}>
                                                                    {lt(language, "Separado del Balance (Añadir / Restar)", "Separate from Balance (Add / Subtract)")}
                                                                </div>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditSyncWithBalance(true)}
                                                                className={`p-3 rounded-xl border text-left transition-all ${
                                                                    editSyncWithBalance
                                                                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent font-semibold'
                                                                        : 'glass-field text-foreground/80 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                                                                }`}
                                                            >
                                                                <div className="text-xs font-bold">
                                                                    {lt(language, "Sincronizar con Balance", "Sync with Balance")}
                                                                </div>
                                                                <div className={`text-[10px] mt-0.5 ${editSyncWithBalance ? 'opacity-80' : 'text-muted-foreground'}`}>
                                                                    {lt(language, "Usa el Balance General automáticamente", "Automatically reflects General Balance")}
                                                                </div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t.descriptionLabel}</label>
                                                <textarea
                                                    value={editDescription}
                                                    onChange={(e) => setEditDescription(e.target.value)}
                                                    placeholder={t.descriptionPlaceholder}
                                                    rows={3}
                                                    className="w-full glass-field rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors resize-none"
                                                />
                                            </div>

                                            <div>
                                                <DatePicker
                                                    label={t.targetDateLabel}
                                                    value={editDate}
                                                    onChange={setEditDate}
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-left">
                                                        {t.inspirationPhotosLabel || pick(language, { es: "Imágenes", en: "Images", zh: "图片" })}
                                                    </label>
                                                    <label className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 cursor-pointer transition-all">
                                                        <Camera className="w-4 h-4" />
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleEditPhotoUpload} />
                                                    </label>
                                                </div>
                                                {editPhotos.length > 0 && (
                                                    <div className="grid grid-cols-1 gap-3 pt-1">
                                                        {editPhotos.map((photo, i) => (
                                                            <div key={i} className="relative w-full rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-center">
                                                                <LocalImage src={photo} alt="" className="w-full max-h-56 h-auto object-contain" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditPhotos(editPhotos.filter((_, idx) => idx !== i))}
                                                                    className="absolute top-2 right-2 p-1.5 bg-black/65 rounded-full text-white hover:bg-red-500 transition-colors"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
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
                                                {pick(language, { es: "Guardar cambios", en: "Save changes", zh: "保存更改" })}
                                            </button>
                                        </form>
                                    </div>
                                </GlassSurface>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Goal Completion Congratulations Modal */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {showCongratsModal && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                                className="fixed inset-0 bg-black/50"
                                onClick={() => setShowCongratsModal(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                onClick={(e) => e.stopPropagation()}
                                className="relative z-10 w-full max-w-sm bg-white dark:bg-[#161618] border border-black/10 dark:border-white/15 rounded-[32px] p-7 shadow-2xl flex flex-col items-center text-center"
                            >
                                {/* Medal / Rosette Icon */}
                                <div className="w-20 h-20 mb-4 text-black dark:text-white">
                                    <svg viewBox="0 0 64 64" fill="currentColor" className="w-full h-full">
                                        <path d="M32 4l4.5 3.6 5.7-.9 2.4 5.3 5.5 1.8-.3 5.8 3.9 4.2-2.9 5 1.4 5.6-4.8 3.1-1.3 5.6-5.7.6-3.6 4.5-5.5-1.9-5.5 1.9-3.6-4.5-5.7-.6-1.3-5.6-4.8-3.1 1.4-5.6-2.9-5 3.9-4.2-.3-5.8 5.5-1.8 2.4-5.3 5.7.9L32 4zm0 11a12 12 0 100 24 12 12 0 000-24z" />
                                        <path d="M20 43l-7 16 7-3 4 5 5-13.5a15.5 15.5 0 01-9-4.5zm24 0a15.5 15.5 0 01-9 4.5L40 61l4-5 7 3-7-16z" />
                                    </svg>
                                </div>

                                <h3 className="font-dancing-n text-3xl text-black dark:text-white mb-2">
                                    {lt(language, "¡Meta Completada!", "Goal Completed!")}
                                </h3>
                                <p className="text-sm font-bold text-foreground mb-1">{goal.title}</p>
                                <p className="text-xs text-muted-foreground mb-6">
                                    {lt(language, "Tu constancia y disciplina dieron frutos. ¡Sigue avanzando!", "Your consistency and discipline paid off. Keep going!")}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowCongratsModal(false)}
                                    className="w-full py-3 rounded-2xl bg-black text-white dark:bg-white dark:text-black font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
                                >
                                    {lt(language, "Continuar", "Continue")}
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
})

