"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Check } from "lucide-react"

interface Option {
    label: string
    value: string
}

interface CustomSelectProps {
    options: Option[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    onOpenChange?: (open: boolean) => void
}

export function CustomSelect({ options, value, onChange, placeholder, className, onOpenChange }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const selectedOption = options.find(opt => opt.value === value)

    const toggleOpen = (open: boolean) => {
        setIsOpen(open)
        if (onOpenChange) {
            onOpenChange(open)
        }
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                toggleOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [onOpenChange])

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => toggleOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2 bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl hover:border-primary/50 transition-all text-[13px] font-medium shadow-sm"
            >
                <span className={selectedOption ? "text-foreground" : "text-zinc-500 dark:text-zinc-400"}>
                    {selectedOption ? selectedOption.label : (placeholder || "Select option")}
                </span>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 5, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute z-[100] w-full bg-white dark:bg-zinc-900 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden py-1"
                    >
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value)
                                    toggleOpen(false)
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-[13px] hover:bg-primary/10 transition-colors
                                ${value === option.value ? "text-primary font-bold" : "text-zinc-700 dark:text-zinc-300"}
                                `}
                            >
                                {option.label}
                                {value === option.value && <Check className="w-3.5 h-3.5" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
