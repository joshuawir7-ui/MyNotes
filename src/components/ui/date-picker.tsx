"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react"

interface DatePickerProps {
    value: string
    onChange: (date: string) => void
    label?: string
}

export function DatePicker({ value, onChange, label }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [viewDate, setViewDate] = useState(value ? new Date(value + 'T12:00:00') : new Date())
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]

    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
    }

    const handleSelectDate = (day: number) => {
        const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
        const dateString = selected.toISOString().split('T')[0]
        onChange(dateString)
        setIsOpen(false)
    }

    const isToday = (day: number) => {
        const today = new Date()
        return day === today.getDate() &&
            viewDate.getMonth() === today.getMonth() &&
            viewDate.getFullYear() === today.getFullYear()
    }

    const isSelected = (day: number) => {
        if (!value) return false
        const current = new Date(value + 'T12:00:00')
        return day === current.getDate() &&
            viewDate.getMonth() === current.getMonth() &&
            viewDate.getFullYear() === current.getFullYear()
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 text-left">{label}</label>}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 flex items-center justify-between group focus:border-primary/50 transition-all text-left"
            >
                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
                <span className={value ? "text-foreground font-bold" : "text-zinc-500 dark:text-zinc-400 font-medium"}>
                    {value ? value : "Seleccionar fecha..."}
                </span>
                {value && (
                    <X
                        className="w-4 h-4 text-muted-foreground hover:text-red-400"
                        onClick={(e) => { e.stopPropagation(); onChange(""); }}
                    />
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-[110] top-full mt-2 left-0 w-full min-w-[280px] bg-white dark:bg-[#0f0f0f] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-4 backdrop-blur-xl"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <button onClick={handlePrevMonth} type="button" className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-black text-sm uppercase tracking-tight">
                                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                            </span>
                            <button onClick={handleNextMonth} type="button" className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {days.map(day => (
                                <div key={day} className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 text-center py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square" />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => handleSelectDate(day)}
                                        className={`aspect-square rounded-xl text-sm font-bold flex items-center justify-center transition-all
                                            ${isSelected(day)
                                                ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105'
                                                : isToday(day)
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'
                                            }
                                        `}
                                    >
                                        {day}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0]
                                    onChange(today)
                                    setIsOpen(false)
                                }}
                                className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            >
                                Hoy
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-black/5 rounded-lg transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
