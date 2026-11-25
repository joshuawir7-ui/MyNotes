"use client"

import { useStore } from "@/lib/store"
import { motion, AnimatePresence } from "framer-motion"
import { getRandomPhilosophicalQuote, getLocalizedPhilosophicalQuoteText } from "@/lib/philosophical-quotes"
import { useState, useEffect } from "react"
import { useDeferredBlur } from "@/hooks/use-deferred-blur"
import { pick } from "@/lib/i18n-inline"

export function CelebrationModal() {
    const language = useStore(state => state.language) || 'en'
    const celebration = useStore(state => state.celebration)
    const clearCelebration = useStore(state => state.clearCelebration)
    const [quoteObj, setQuoteObj] = useState<{ text: string; author: string }>({ text: "", author: "" })
    const scrimBlur = useDeferredBlur(Boolean(celebration))

    useEffect(() => {
        if (celebration) {
            const q = getRandomPhilosophicalQuote()
            setQuoteObj(getLocalizedPhilosophicalQuoteText(q, language))
        }
    }, [celebration, language])

    return (
        <AnimatePresence>
            {celebration && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={clearCelebration}
                        style={{ willChange: "opacity" }}
                        className={`absolute inset-0 bg-black/40 ${scrimBlur ? "backdrop-blur-md" : ""}`}
                    />
                    
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                        style={{ willChange: "transform, opacity" }}
                        className="relative w-full max-w-md bg-white dark:bg-[#161618] border border-black/10 dark:border-white/15 rounded-3xl p-8 text-center shadow-xl flex flex-col items-center"
                    >
                        <h2 className="text-xl font-bold text-black dark:text-white mb-4">
                            {pick(language, {
                                es: `Completaste ${celebration.title}`,
                                en: `You completed ${celebration.title}`,
                                zh: `已完成 ${celebration.title}`
                            })}
                        </h2>
                        
                        <div className="w-full h-[1px] bg-black/10 dark:bg-white/10 mb-8" />
                        
                        <p className="text-2xl text-black dark:text-white mb-8 px-2 leading-relaxed" style={{ fontFamily: '"Times New Roman", Times, serif', fontStyle: 'italic' }}>
                            &ldquo;{quoteObj.text}&rdquo;
                        </p>
                        
                        {quoteObj.author && (
                            <p className="text-sm text-black/60 dark:text-white/60 mb-8 -mt-4 font-medium uppercase tracking-widest">
                                {quoteObj.author}
                            </p>
                        )}
                        
                        <button
                            onClick={clearCelebration}
                            className="bg-black text-white dark:bg-white dark:text-black font-bold px-10 py-3 rounded-2xl hover:scale-105 active:scale-95 transition-all w-32"
                        >
                            {pick(language, { es: "OK", en: "OK", zh: "确定" })}
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
