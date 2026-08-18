"use client"

import { motion } from "framer-motion"

interface PageDescriptionProps {
    children: React.ReactNode
    delay?: number
    animate?: boolean
    size?: "xs" | "sm" | "md" | "lg" | "xl"
    duration?: number
    className?: string
    direction?: "left" | "right"
    dancing?: "mobile" | "all" | "none"
}

export function PageDescription({
    children,
    delay = 0,
    animate = true,
    size = "xs",
    duration = 2.0,
    className = "",
    direction = "left",
    dancing = "mobile"
}: PageDescriptionProps) {
    const xOffset = direction === "left" ? 50 : -50;

    const animationProps = animate ? {
        initial: { opacity: 0, x: xOffset, filter: "blur(15px)" },
        animate: { opacity: 1, x: 0, filter: "blur(0px)" },
    } : {
        initial: { opacity: 1, x: 0, filter: "blur(0px)" },
        animate: { opacity: 1, x: 0, filter: "blur(0px)" },
    }

    const sizeClasses = {
        xs: "text-[14px] md:text-[15px]",
        sm: "text-lg md:text-xl",
        md: "text-xl md:text-2xl",
        lg: "text-2xl md:text-3xl",
        xl: "text-3xl md:text-4xl",
        "2xl": "text-4xl md:text-5xl"
    }

    const fontClass = dancing === "all" ? "font-dancing" : dancing === "none" ? "" : "font-dancing-mobile";
    const weightClass = dancing !== "none" ? "font-semibold" : "font-bold";

    return (
        <motion.p
            {...animationProps}
            transition={{
                duration: duration,
                delay: delay,
                ease: [0.16, 1, 0.3, 1]
            }}
            className={`${sizeClasses[size]} text-black dark:text-zinc-300 ${weightClass} tracking-wide ${fontClass} ${className}`}
            style={{
                textTransform: 'none'
            }}
        >
            {children}
        </motion.p>
    )
}
