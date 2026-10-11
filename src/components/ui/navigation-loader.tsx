"use client"

import React, { useState, useEffect, useRef, Suspense } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useStore } from "@/lib/store"

function NavigationLoaderContent() {
    const pathname = usePathname()
    const [isLoading, setIsLoading] = useState(false)
    const prevPathRef = useRef(pathname)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const appColor = useStore(state => state.appColor)

    useEffect(() => {
        const handleAnchorClick = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('a')
            if (target && target.href) {
                try {
                    const url = new URL(target.href, window.location.href)
                    if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
                        setIsLoading(true)
                        if (timerRef.current) clearTimeout(timerRef.current)
                        timerRef.current = setTimeout(() => {
                            setIsLoading(false)
                        }, 1600)
                    }
                } catch (err) {
                    /* ignore invalid urls */
                }
            }
        }

        document.addEventListener('click', handleAnchorClick, true)
        return () => {
            document.removeEventListener('click', handleAnchorClick, true)
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    useEffect(() => {
        if (prevPathRef.current !== pathname) {
            prevPathRef.current = pathname
            const t = setTimeout(() => {
                setIsLoading(false)
            }, 100)
            return () => clearTimeout(t)
        }
    }, [pathname])

    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background/85 backdrop-blur-md select-none pointer-events-auto"
                >
                    <div className="relative flex flex-col items-center justify-center p-6 text-center">
                        {/* Glowing ring aura */}
                        <div className={`absolute w-28 h-28 rounded-full animate-ping opacity-25 ${appColor === 'black' ? 'bg-zinc-500' : 'bg-primary'}`} />

                        {/* Centered App N Logo */}
                        <motion.div
                            initial={{ scale: 0.85, rotate: -5 }}
                            animate={{ scale: [0.92, 1.08, 0.92], rotate: [0, 4, 0] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                            className="relative z-10 w-24 h-24 flex items-center justify-center mb-3"
                        >
                            <img
                                src="/images/n-logo-new.png"
                                alt="MyNotes Logo"
                                className="w-20 h-20 object-contain drop-shadow-xl dark:invert"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </motion.div>

                        {/* App Title */}
                        <motion.span
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl font-extrabold font-dancing tracking-tight text-foreground"
                        >
                            MyNotes
                        </motion.span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export function NavigationLoader() {
    return (
        <Suspense fallback={null}>
            <NavigationLoaderContent />
        </Suspense>
    )
}
