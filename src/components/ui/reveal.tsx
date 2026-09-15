"use client"

import { motion } from "framer-motion"
import { ReactNode, useEffect, useRef, useState } from "react"

interface RevealProps {
    children: ReactNode
    delay?: number
    width?: "100%" | "fit-content"
    margin?: string
    duration?: number
    className?: string
}

export const Reveal = ({ children, delay = 0, width = "100%", margin = "-20px", duration = 0.4, className }: RevealProps) => {
    const [isMobile, setIsMobile] = useState(false)
    const [isLowEnd, setIsLowEnd] = useState(false)
    // Track whether the entrance animation is still running.
    // "transform, opacity" is active only while animating; released to "auto" on completion
    // to avoid accumulating dead GPU compositing layers across all dashboard cards.
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

        return () => window.removeEventListener("resize", checkMobile)
    }, [])

    const actualDuration = isLowEnd ? 0 : duration;
    const actualDelay = isLowEnd ? 0 : delay;

    const handleAnimationComplete = () => {
        // Release the GPU compositing layer once the entrance animation finishes.
        // Equivalent to: anim.finished.then(() => el.style.willChange = "auto")
        setAnimatingWillChange("auto")
    }

    if (isMobile) {
        return (
            <div
                style={{
                    width,
                    animation: `fade-in-up-fast ${actualDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${actualDelay}s both`,
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
            initial={{ opacity: 0, y: 30 }}
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
