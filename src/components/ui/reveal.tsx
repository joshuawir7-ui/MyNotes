"use client"

import React, { ReactNode, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { getPerfFlags, subscribePerfDebug } from "@/lib/perf-debug"

interface RevealProps {
    children: ReactNode
    delay?: number
    width?: "100%" | "fit-content"
    margin?: string
    duration?: number
    className?: string
}

// Track visited routes in this browser session
const visitedRoutesInSession = new Set<string>();

export const Reveal = ({ children, delay = 0, width = "100%", duration = 0.3, className }: RevealProps) => {
    const pathname = usePathname() || "/"
    const [perfFlags, setPerfFlags] = useState(getPerfFlags())
    const [isFinished, setIsFinished] = useState(false)
    const domRef = useRef<HTMLDivElement>(null)

    // Evaluate animation decision ONCE per mount pass so re-renders do NOT swap node structures
    const shouldAnimateRef = useRef<boolean | null>(null)
    if (shouldAnimateRef.current === null) {
        const isLowEnd = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) <= 4 : false
        const isFirstVisit = !visitedRoutesInSession.has(pathname)
        const isNoReveal = getPerfFlags().perfNoReveal
        shouldAnimateRef.current = !isNoReveal && !isLowEnd && isFirstVisit
    }

    useEffect(() => {
        visitedRoutesInSession.add(pathname)

        const unsub = subscribePerfDebug(() => {
            setPerfFlags(getPerfFlags())
        })

        // Clean up animation properties after completion to leave a 100% clean static DOM node
        const animDuration = Math.min(duration ?? 0.3, 0.35)
        const animDelay = Math.min(delay ?? 0, 0.12)
        const totalMs = (animDuration + animDelay) * 1000 + 80

        const timer = setTimeout(() => {
            setIsFinished(true)
        }, totalMs)

        return () => {
            unsub()
            clearTimeout(timer)
        }
    }, [pathname, delay, duration])

    const shouldAnimate = shouldAnimateRef.current && !perfFlags.perfNoReveal && !isFinished
    const actualDuration = Math.min(duration ?? 0.3, 0.35)
    const actualDelay = Math.min(delay ?? 0, 0.12)

    return (
        <div
            ref={domRef}
            style={{
                width,
                ...(shouldAnimate ? {
                    animation: `fade-in-up-fast ${actualDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${actualDelay}s backwards`,
                    willChange: 'transform, opacity',
                } : {})
            }}
            className={className || ""}
        >
            {children}
        </div>
    )
}


