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

export const Reveal = ({ children, delay = 0, width = "100%", duration = 0.25, className }: RevealProps) => {
    const pathname = usePathname() || "/"
    const [perfFlags, setPerfFlags] = useState(getPerfFlags())
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
        return () => { unsub() }
    }, [pathname])

    const shouldAnimate = shouldAnimateRef.current && !perfFlags.perfNoReveal
    const actualDuration = Math.min(duration ?? 0.25, 0.3)
    const actualDelay = Math.min(delay ?? 0, 0.1)

    return (
        <div
            ref={domRef}
            style={{
                width,
                ...(shouldAnimate ? {
                    animation: `fade-in-up-fast ${actualDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${actualDelay}s both`,
                } : {})
            }}
            className={className || ""}
        >
            {children}
        </div>
    )
}


