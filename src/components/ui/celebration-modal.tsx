"use client"

import { useStore } from "@/lib/store"
import { motion, AnimatePresence } from "framer-motion"
import { PHILOSOPHICAL_QUOTES } from "@/lib/quotes"
import { useState, useEffect } from "react"

export function CelebrationModal() {
    const celebration = useStore(state => state.celebration)
    const clearCelebration = useStore(state => state.clearCelebration)
    const [quote, setQuote] = useState("")

    useEffect(() => {
        if (celebration) {
            const randomQuote = PHILOSOPHICAL_QUOTES[Math.floor(Math.random() * PHILOSOPHICAL_QUOTES.length)]
            setQuote(randomQuote)
        }
    }, [celebration])

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
                        className="absolute inset-0 bg-black/40 backdrop-blur-md"
                    />
                    
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                        style={{ willChange: "transform, opacity" }}
                        className="relative w-full max-w-md bg-white rounded-3xl p-8 text-center shadow-xl flex flex-col items-center"
                    >
                        <h2 className="text-xl font-bold text-black mb-4">
                            Completaste {celebration.title}
                        </h2>
                        
                        <div className="w-full h-[1px] bg-black/10 mb-8" />
                        
                        <p className="text-2xl text-black mb-8 px-2 leading-relaxed" style={{ fontFamily: '"Times New Roman", Times, serif', fontStyle: 'italic' }}>
                            "{quote.split(' - ')[0]}"
                        </p>
                        
                        {quote.includes(' - ') && (
                            <p className="text-sm text-black/60 mb-8 -mt-4 font-medium uppercase tracking-widest">
                                {quote.split(' - ')[1]}
                            </p>
                        )}
                        
                        <button
                            onClick={clearCelebration}
                            className="bg-black text-white font-bold px-10 py-3 rounded-2xl hover:scale-105 active:scale-95 transition-all w-32"
                        >
                            OK
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
