"use client"

import { motion } from "framer-motion"
import { ReactNode, useEffect, useState } from "react"

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

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }
        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [])

    if (isMobile) {
        return (
            <div
                style={{
                    width,
                    animation: `fade-in-up-fast ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`,
                }}
                className={`${className || ""} transform-gpu`}
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
                duration: duration,
                delay: delay,
                ease: [0.22, 1, 0.36, 1]
            }}
            style={{ width, willChange: "transform, opacity" }}
            className={`${className || ""} transform-gpu`}
        >
            {children}
        </motion.div>
    )
}
