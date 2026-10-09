"use client"

import { motion } from "framer-motion"
import { ReactNode, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { getPerfFlags, subscribePerfDebug } from "@/lib/perf-debug"
import { useIsMobile } from "@/hooks/use-is-mobile"

interface RevealProps {
    children: ReactNode
    delay?: number
    width?: "100%" | "fit-content"
    margin?: string
    duration?: number
    className?: string
}

const MAX_DELAY = 0.12;    // max seconds
const MAX_DURATION = 0.3;  // max seconds
const MOBILE_ANIMATION_BUDGET = 6;

// Track visited routes in this browser session
const visitedRoutesInSession = new Set<string>();

let activePathname = "";
let pathRevealCounter = 0;

function getPathRevealCount(pathname: string): number {
    if (pathname !== activePathname) {
        activePathname = pathname;
        pathRevealCounter = 0;
    }
    pathRevealCounter += 1;
    return pathRevealCounter;
}

export const Reveal = ({ children, delay = 0, width = "100%", margin = "-20px", duration = 0.3, className }: RevealProps) => {
    const isMobile = useIsMobile()
    const pathname = usePathname() || "/"
    const [isLowEnd, setIsLowEnd] = useState(false)
    const [perfFlags, setPerfFlags] = useState(getPerfFlags())
    const [animatingWillChange, setAnimatingWillChange] = useState<"transform, opacity" | "auto">("transform, opacity")
    const domRef = useRef<HTMLDivElement>(null)

    // Calculate budget & session status during render
    const revealIndex = getPathRevealCount(pathname)
    const isFirstVisitToRoute = !visitedRoutesInSession.has(pathname)
    const withinBudget = revealIndex <= MOBILE_ANIMATION_BUDGET

    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            setIsLowEnd(navigator.hardwareConcurrency <= 4)
        }

        // Mark current route as visited after mount
        visitedRoutesInSession.add(pathname)

        const unsub = subscribePerfDebug(() => {
            setPerfFlags(getPerfFlags())
        })

        return () => {
            unsub()
        }
    }, [pathname])

    const isNoReveal = perfFlags.perfNoReveal;
    const shouldAnimate = !isNoReveal && !isLowEnd && isFirstVisitToRoute && withinBudget;

    const actualDuration = shouldAnimate ? Math.min(duration ?? 0.3, MAX_DURATION) : 0;
    const actualDelay = shouldAnimate ? Math.min(delay ?? 0, MAX_DELAY) : 0;

    const handleAnimationComplete = () => {
        setAnimatingWillChange("auto")
    }

    if (!shouldAnimate) {
        return (
            <div style={{ width }} className={className || ""} ref={domRef}>
                {children}
            </div>
        )
    }

    if (isMobile) {
        return (
            <div
                style={{
                    width,
                    animation: actualDuration > 0
                        ? `fade-in-up-fast ${actualDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${actualDelay}s backwards`
                        : 'none',
                }}
                className={className || ""}
                ref={domRef}
            >
                {children}
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: margin }}
            transition={{
                duration: actualDuration,
                delay: actualDelay,
                ease: [0.22, 1, 0.36, 1]
            }}
            style={{
                width,
                willChange: animatingWillChange,
            }}
            onAnimationComplete={handleAnimationComplete}
            className={className || ""}
        >
            {children}
        </motion.div>
    )
}

