"use client"

/**
 * PriorityReminderSettings
 *
 * Settings section for configuring up to 3 daily reminder times for high-priority tasks.
 * Features:
 * - Global enable/disable toggle (same visual style as other settings toggles)
 * - 3 configurable time slots with a custom time picker
 * - Custom bottom-sheet modal with quick-pick grid + wheel picker
 * - Uses same design tokens as the rest of SettingsDialog (no ad-hoc styles)
 * - Duplicate-slot validation with warning
 * - "Restore defaults" link
 * - showToast for feedback
 */

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Clock, RotateCcw, ChevronUp, ChevronDown, Check } from "lucide-react"
import { useStore } from "@/lib/store"

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format "HH:mm" (24h) → "H:MM AM/PM" for display */
function formatTime(time24: string): string {
    const [h, m] = time24.split(":").map(Number)
    const period = h >= 12 ? "PM" : "AM"
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

/** Parse "H:MM AM/PM" or "HH:mm" → "HH:mm" */
function parseToHHMM(display: string): string {
    // Already in 24h format
    if (/^\d{1,2}:\d{2}$/.test(display) && !display.includes("AM") && !display.includes("PM")) {
        const [h, m] = display.split(":").map(Number)
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    }
    const match = display.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!match) return "12:00"
    let h = Number(match[1])
    const m = Number(match[2])
    const period = match[3].toUpperCase()
    if (period === "AM" && h === 12) h = 0
    if (period === "PM" && h !== 12) h += 12
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// Quick-pick grid options (display values)
const QUICK_TIMES = [
    "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM",
    "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM",
    "10:00 PM", "11:00 PM", "6:00 AM", "9:00 AM",
]

// ─────────────────────────────────────────────────────────────────────────────
// WheelColumn — scrollable drum roll for hours or minutes
// ─────────────────────────────────────────────────────────────────────────────

function WheelColumn({
    values,
    selected,
    onChange,
    label,
}: {
    values: string[]
    selected: string
    onChange: (v: string) => void
    label: string
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const ITEM_H = 44

    // Scroll to selected on mount / when selected changes
    useEffect(() => {
        const idx = values.indexOf(selected)
        if (idx >= 0 && containerRef.current) {
            containerRef.current.scrollTo({ top: idx * ITEM_H, behavior: "smooth" })
        }
    }, [selected, values])

    const handleScroll = () => {
        if (!containerRef.current) return
        const idx = Math.round(containerRef.current.scrollTop / ITEM_H)
        const clamped = Math.max(0, Math.min(idx, values.length - 1))
        if (values[clamped] !== selected) onChange(values[clamped])
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
            <div className="relative w-16 h-[132px] overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                {/* Selection indicator */}
                <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[44px] border-y border-primary/40 bg-primary/10 z-10" />
                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto no-scrollbar snap-y snap-mandatory"
                    style={{ scrollbarWidth: "none" }}
                >
                    {/* Top padding */}
                    <div className="h-[44px]" />
                    {values.map((v) => (
                        <div
                            key={v}
                            onClick={() => onChange(v)}
                            className={`snap-center flex items-center justify-center h-[44px] text-base font-bold cursor-pointer transition-all ${
                                v === selected
                                    ? "text-primary scale-110"
                                    : "text-muted-foreground/60 scale-95"
                            }`}
                        >
                            {v}
                        </div>
                    ))}
                    {/* Bottom padding */}
                    <div className="h-[44px]" />
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// TimePicker modal
// ─────────────────────────────────────────────────────────────────────────────

function TimePickerModal({
    isOpen,
    initial,
    slotIndex,
    existingSlots,
    language,
    onClose,
    onConfirm,
}: {
    isOpen: boolean
    initial: string   // "HH:mm"
    slotIndex: number
    existingSlots: string[]
    language: string
    onClose: () => void
    onConfirm: (time: string) => void
}) {
    const [tab, setTab] = useState<"quick" | "custom">("quick")
    const [wheelHour, setWheelHour] = useState(() => {
        const h = Number(initial.split(":")[0])
        return String(h === 0 ? 12 : h > 12 ? h - 12 : h).padStart(2, "0")
    })
    const [wheelMin, setWheelMin] = useState(() => initial.split(":")[1] || "00")
    const [wheelPeriod, setWheelPeriod] = useState<"AM" | "PM">(() =>
        Number(initial.split(":")[0]) >= 12 ? "PM" : "AM"
    )
    const [duplicate, setDuplicate] = useState(false)

    const hours12  = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
    const minutes  = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]
    const periods: ("AM" | "PM")[] = ["AM", "PM"]

    /** Get the "HH:mm" value of current wheel selection */
    const wheelValue = (): string => {
        let h = Number(wheelHour)
        if (wheelPeriod === "AM" && h === 12) h = 0
        if (wheelPeriod === "PM" && h !== 12) h += 12
        return `${String(h).padStart(2, "0")}:${wheelMin}`
    }

    const checkDuplicate = (candidate: string) => {
        const others = existingSlots.filter((_, i) => i !== slotIndex)
        return others.includes(candidate)
    }

    const handleQuickPick = (display: string) => {
        const hhmm = parseToHHMM(display)
        if (checkDuplicate(hhmm)) { setDuplicate(true); return }
        setDuplicate(false)
        onConfirm(hhmm)
    }

    const handleWheelConfirm = () => {
        const hhmm = wheelValue()
        if (checkDuplicate(hhmm)) { setDuplicate(true); return }
        setDuplicate(false)
        onConfirm(hhmm)
    }

    if (typeof document === "undefined") return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[999999] flex items-end justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Bottom sheet */}
                    <motion.div
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 28, stiffness: 320 }}
                        className="relative w-full max-w-sm mx-auto bg-white dark:bg-zinc-900 rounded-t-[2rem] px-5 pt-3 pb-6 shadow-2xl border-t border-black/10 dark:border-white/10"
                    >
                        {/* Handle */}
                        <div className="w-10 h-1.5 bg-black/15 dark:bg-white/20 rounded-full mx-auto mb-4" />

                        <p className="text-center font-bold text-sm mb-3">
                            {language === "es" ? "Elige un horario" : "Choose a time"}
                        </p>

                        {/* Tabs */}
                        <div className="flex rounded-xl overflow-hidden border border-black/10 dark:border-white/10 mb-4">
                            {(["quick", "custom"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => { setTab(t); setDuplicate(false) }}
                                    className={`flex-1 py-2 text-xs font-bold transition-all ${
                                        tab === t
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                    }`}
                                >
                                    {t === "quick"
                                        ? (language === "es" ? "Rápido" : "Quick")
                                        : (language === "es" ? "Personalizado" : "Custom")
                                    }
                                </button>
                            ))}
                        </div>

                        {/* Duplicate warning */}
                        <AnimatePresence>
                            {duplicate && (
                                <motion.p
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-xs text-amber-500 dark:text-amber-400 text-center mb-3"
                                >
                                    {language === "es"
                                        ? "⚠️ Ese horario ya está asignado a otro recordatorio"
                                        : "⚠️ That time is already used by another reminder"}
                                </motion.p>
                            )}
                        </AnimatePresence>

                        {/* Quick pick grid */}
                        {tab === "quick" && (
                            <div className="grid grid-cols-3 gap-2">
                                {QUICK_TIMES.map((qt) => {
                                    const hhmm = parseToHHMM(qt)
                                    const isSelected = hhmm === initial
                                    return (
                                        <motion.button
                                            key={qt}
                                            whileTap={{ scale: 0.93 }}
                                            onClick={() => handleQuickPick(qt)}
                                            className={`py-3 rounded-xl text-xs font-bold transition-all ${
                                                isSelected
                                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                                    : "bg-black/5 dark:bg-white/5 text-foreground hover:bg-primary/15 dark:hover:bg-primary/20"
                                            }`}
                                        >
                                            {qt}
                                        </motion.button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Wheel picker */}
                        {tab === "custom" && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <WheelColumn
                                        values={hours12}
                                        selected={wheelHour}
                                        onChange={setWheelHour}
                                        label={language === "es" ? "Hora" : "Hour"}
                                    />
                                    <span className="text-2xl font-black text-primary pb-1">:</span>
                                    <WheelColumn
                                        values={minutes}
                                        selected={wheelMin}
                                        onChange={setWheelMin}
                                        label={language === "es" ? "Min" : "Min"}
                                    />
                                    <WheelColumn
                                        values={periods}
                                        selected={wheelPeriod}
                                        onChange={(v) => setWheelPeriod(v as "AM" | "PM")}
                                        label=""
                                    />
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleWheelConfirm}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/20"
                                >
                                    <Check className="w-4 h-4" />
                                    {language === "es" ? "Confirmar" : "Confirm"}
                                </motion.button>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PriorityReminderSettings() {
    const language = useStore((s) => s.language)
    const priorityReminderSettings = useStore((s) => s.priorityReminderSettings)
    const setPriorityReminderSlot   = useStore((s) => s.setPriorityReminderSlot)
    const togglePriorityReminders   = useStore((s) => s.togglePriorityReminders)
    const resetPriorityReminderDefaults = useStore((s) => s.resetPriorityReminderDefaults)
    const showToast = useStore((s) => s.showToast)

    const { enabled, slots } = priorityReminderSettings

    const [pickerOpen, setPickerOpen] = useState<number | null>(null)

    const handleConfirm = (index: number, time: string) => {
        setPriorityReminderSlot(index, time)
        setPickerOpen(null)
        showToast(
            language === "es" ? "Recordatorio actualizado" : "Reminder updated",
            "success"
        )

        // Reschedule on Capacitor platforms
        import("@/lib/notifications").then(({ NotificationManager }) => {
            const state = useStore.getState()
            if ("schedulePriorityReminders" in NotificationManager) {
                (NotificationManager as any).schedulePriorityReminders(state.priorityReminderSettings)
            }
        }).catch(() => {})
    }

    const handleReset = () => {
        resetPriorityReminderDefaults()
        showToast(
            language === "es" ? "Horarios restablecidos" : "Times reset to defaults",
            "info"
        )
        import("@/lib/notifications").then(({ NotificationManager }) => {
            const state = useStore.getState()
            if ("schedulePriorityReminders" in NotificationManager) {
                (NotificationManager as any).schedulePriorityReminders(state.priorityReminderSettings)
            }
        }).catch(() => {})
    }

    const labels = language === "es"
        ? ["Recordatorio 1", "Recordatorio 2", "Recordatorio 3"]
        : ["Reminder 1", "Reminder 2", "Reminder 3"]

    return (
        <>
            {/* Card container — same style as other settings sections */}
            <div className="flex flex-col gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">

                {/* Header row: icon + title + toggle */}
                <motion.div
                    onClick={() => togglePriorityReminders(!enabled)}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-between cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors duration-300 ${
                            enabled
                                ? "bg-primary/20 text-primary dark:bg-primary/30"
                                : "bg-black/5 dark:bg-white/10 text-zinc-500 dark:text-zinc-400"
                        }`}>
                            <Bell className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">
                                {language === "es" ? "Tareas prioritarias" : "Priority tasks"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {language === "es" ? "Hasta 3 recordatorios diarios" : "Up to 3 daily reminders"}
                            </p>
                        </div>
                    </div>

                    {/* Toggle pill */}
                    <button
                        tabIndex={-1}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 pointer-events-none ${
                            enabled ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                            enabled ? "translate-x-6" : "translate-x-1"
                        }`} />
                    </button>
                </motion.div>

                {/* Slot rows — only shown when enabled */}
                <AnimatePresence>
                    {enabled && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col gap-2 overflow-hidden"
                        >
                            {slots.map((slot, i) => (
                                <motion.button
                                    key={i}
                                    id={`priority-reminder-slot-${i}`}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setPickerOpen(i)}
                                    className="flex items-center justify-between w-full px-3 py-2.5 bg-white/60 dark:bg-white/5 rounded-xl border border-black/8 dark:border-white/8 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all min-h-[44px]"
                                >
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-primary/70" />
                                        <span className="text-xs font-semibold text-muted-foreground">{labels[i]}</span>
                                    </div>
                                    <span className="text-sm font-bold text-primary">{formatTime(slot)}</span>
                                </motion.button>
                            ))}

                            {/* Reset defaults */}
                            <motion.button
                                whileTap={{ scale: 0.96 }}
                                onClick={handleReset}
                                className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" />
                                {language === "es" ? "Restaurar valores por defecto" : "Restore defaults"}
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Time Picker modal */}
            {pickerOpen !== null && (
                <TimePickerModal
                    isOpen={pickerOpen !== null}
                    initial={slots[pickerOpen] ?? "12:00"}
                    slotIndex={pickerOpen}
                    existingSlots={slots}
                    language={language}
                    onClose={() => setPickerOpen(null)}
                    onConfirm={(time) => handleConfirm(pickerOpen, time)}
                />
            )}
        </>
    )
}
