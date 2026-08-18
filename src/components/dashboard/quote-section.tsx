"use client"

import { useStore } from "@/lib/store"
import { useEffect, useState, useMemo } from "react"
import { phrases } from "@/lib/phrases"
import { motion, AnimatePresence } from "framer-motion"

export function QuoteSection() {
    const language = useStore(state => state.language)
    const [mounted, setMounted] = useState(false)
    const [quoteIndex, setQuoteIndex] = useState(0)

    const currentPhrases = useMemo(() => (phrases as any)[language] || phrases.en, [language])

    useEffect(() => {
        setMounted(true)
        setQuoteIndex(Math.floor(Math.random() * currentPhrases.length))
    }, [currentPhrases])

    useEffect(() => {
        if (!mounted) return

        const quote = currentPhrases[quoteIndex]
        if (!quote) return

        const textLength = quote.text.length
        const paragraphCount = quote.text.split(/\r?\n/).filter((p: string) => p.trim() !== '').length

        // 9s for short phrases, 15s for medium or longer phrases (> 65 chars or multi-paragraph)
        const isMediumOrLong = textLength > 65 || paragraphCount > 1
        const duration = isMediumOrLong ? 15000 : 9000

        const timer = setTimeout(() => {
            setQuoteIndex((prev) => {
                if (currentPhrases.length <= 1) return 0
                let nextIndex = Math.floor(Math.random() * currentPhrases.length)
                // Ensure we don't show the exact same phrase consecutively if possible
                let attempts = 0
                while (nextIndex === prev && attempts < 10) {
                    nextIndex = Math.floor(Math.random() * currentPhrases.length)
                    attempts++
                }
                return nextIndex
            })
        }, duration)

        return () => clearTimeout(timer)
    }, [mounted, quoteIndex, currentPhrases])

    if (!mounted) return (
        <div className="w-full mb-8 h-28 animate-pulse bg-secondary/10 rounded-2xl border border-white/5" />
    )

    const quote = currentPhrases[quoteIndex]

    // Fallback if index gets out of bounds
    if (!quote) return null

    return (
        <div className="w-full relative">
            {/* Main Container Card */}
            <div className="max-w-3xl mx-auto glass-panel rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-all duration-500 hover:border-white/20 min-h-[140px] sm:min-h-[120px] overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${language}-${quoteIndex}`}
                        initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -15, filter: "blur(8px)" }}
                        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
                        style={{ willChange: "transform, opacity, filter" }}
                        className="flex flex-col items-center w-full transform-gpu"
                    >
                        <p className="text-xl sm:text-2xl font-semibold leading-relaxed text-foreground/90 tracking-wide font-dancing">
                            "{quote.text}"
                        </p>

                        {/* Author Section */}
                        <div className="mt-4 flex flex-col items-center gap-1 w-full">
                            <div className="h-px w-6 bg-primary/30 mb-1" />
                            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-[0.25em]">
                                {quote.author}
                            </span>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}

