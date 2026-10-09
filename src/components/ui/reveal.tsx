"use client"

import { motion } from "framer-motion"
import { ReactNode, useEffect, useRef, useState } from "react"
import { getPerfFlags, subscribePerfDebug } from "@/lib/perf-debug"

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

export const Reveal = ({ children, delay = 0, width = "100%", margin = "-20px", duration = 0.3, className }: RevealProps) => {
    const [isMobile, setIsMobile] = useState(false)
    const [isLowEnd, setIsLowEnd] = useState(false)
    const [perfFlags, setPerfFlags] = useState(getPerfFlags())
    // Track whether the entrance animation is still running.
    const [animatingWillChange, setAnimatingWillChange] = useState<"transform, opacity" | "auto">("transform, opacity")
    const domRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }
        checkMobile()
        window.addEventListener("resize", checkMobile)

        if (typeof navigator !== 'undefined') {
            setIsLowEnd(navigator.hardwareConcurrency <= 4)
        }

        const unsub = subscribePerfDebug(() => {
            setPerfFlags(getPerfFlags())
        })

        return () => {
            window.removeEventListener("resize", checkMobile)
            unsub()
        }
    }, [])

    const isNoReveal = perfFlags.perfNoReveal;
    const actualDuration = isNoReveal || isLowEnd ? 0 : Math.min(duration ?? 0.3, MAX_DURATION);
    const actualDelay = isNoReveal || isLowEnd ? 0 : Math.min(delay ?? 0, MAX_DELAY);

    const handleAnimationComplete = () => {
        setAnimatingWillChange("auto")
    }

    if (isNoReveal) {
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
                        ? `fade-in-up-fast ${actualDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${actualDelay}s both`
                        : 'none',
                }}
                className={`${className || ""} transform-gpu`}
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
            className={`${className || ""} transform-gpu`}
        >
            {children}
        </motion.div>
    )
}
