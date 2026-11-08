"use client"

import { useState, useEffect } from "react"

export function useIsMobileLandscape(): boolean {
    const [isMobileLandscape, setIsMobileLandscape] = useState(false)

    useEffect(() => {
        const check = () => {
            if (typeof window === "undefined") return
            const isCap = !!(window as any).Capacitor
            const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
            const isLandscape = window.innerWidth > window.innerHeight
            const isCompactHeight = window.innerHeight <= 650
            const isMobile = isCap || isMobileUA || isCompactHeight
            const match = isMobile && isLandscape
            setIsMobileLandscape(match)

            if (typeof document !== "undefined") {
                document.documentElement.classList.toggle("mobile-landscape", match)
            }
        }

        check()
        window.addEventListener("resize", check)
        window.addEventListener("orientationchange", check)
        return () => {
            window.removeEventListener("resize", check)
            window.removeEventListener("orientationchange", check)
        }
    }, [])

    return isMobileLandscape
}
