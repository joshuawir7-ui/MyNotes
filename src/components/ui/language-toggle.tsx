"use client"

import * as React from "react"
import { Languages, Check } from "lucide-react"
import { useStore } from "@/lib/store"
import { Language } from "@/lib/translations"
import { motion, AnimatePresence } from "framer-motion"

const SUPPORTED_LANGUAGES: { code: Language; label: string; flag: string }[] = [
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'pt', label: 'Português', flag: '🇧🇷' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
]

interface LanguageToggleProps {
    hideLabel?: boolean
}

export function LanguageToggle({ hideLabel = false }: LanguageToggleProps) {
    const language = useStore(state => state.language)
    const setLanguage = useStore(state => state.setLanguage)
    const [mounted, setMounted] = React.useState(false)
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        setMounted(true)
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    if (!mounted) return null

    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0]

    return (
        <div ref={containerRef} className="relative w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center gap-2 p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Seleccionar idioma"
            >
                <Languages className="h-[1.2rem] w-[1.2rem] transition-all" />
                {!hideLabel && <span className="text-sm font-medium flex-1 text-left">{currentLang.label}</span>}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 5, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute top-full right-0 md:left-0 md:right-auto z-[100] w-max min-w-[180px] mt-2 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden py-1 max-h-[300px] overflow-y-auto"
                    >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => {
                                    setLanguage(lang.code)
                                    setIsOpen(false)
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-primary/10 transition-colors
                                ${language === lang.code ? "text-primary font-bold bg-primary/5" : "text-zinc-700 dark:text-zinc-300"}
                                `}
                            >
                                <span className="flex-1 px-1 whitespace-nowrap">{lang.label}</span>
                                {language === lang.code && <Check className="w-3.5 h-3.5" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
