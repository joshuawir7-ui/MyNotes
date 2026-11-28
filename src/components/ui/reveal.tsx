"use client"

import React, { ReactNode, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { getPerfFlags, subscribePerfDebug } from "@/lib/perf-debug"
import { getPerfTierSnapshot, resolveEffectiveAttributes } from "@/lib/perf-tier"

interface RevealProps {
    children: ReactNode
    delay?: number
    width?: "100%" | "fit-content"
    margin?: string
    duration?: number
    className?: string
}

const visitedRoutesInSession = new Set<string>();

export const Reveal = ({ children, delay = 0, width = "100%", duration = 0.25, className }: RevealProps) => {
    const pathname = usePathname() || "/"
    const [perfFlags, setPerfFlags] = useState(getPerfFlags())
    const domRef = useRef<HTMLDivElement>(null)

    const attrs = resolveEffectiveAttributes(getPerfTierSnapshot())
    const motion = attrs.fxMotion

    const shouldAnimateRef = useRef<boolean | null>(null)
    if (shouldAnimateRef.current === null) {
        const isFirstVisit = !visitedRoutesInSession.has(pathname)
        const isNoReveal = getPerfFlags().perfNoReveal
        shouldAnimateRef.current = !isNoReveal && motion !== "minimal" && isFirstVisit
    }

    useEffect(() => {
        visitedRoutesInSession.add(pathname)
        const unsub = subscribePerfDebug(() => {
            setPerfFlags(getPerfFlags())
        })
        return () => { unsub() }
    }, [pathname])

    const shouldAnimate = shouldAnimateRef.current && !perfFlags.perfNoReveal && motion !== "minimal"
    const scale = motion === "reduced" ? 0.6 : 1
    const actualDuration = +(Math.min(duration ?? 0.25, 0.3) * scale).toFixed(2)
    const actualDelay = motion === "full" ? Math.min(delay ?? 0, 0.1) : 0

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
