"use client"

import { useState, useEffect } from "react"

export function useIsMobileLandscape(): boolean {
    const [isMobileLandscape, setIsMobileLandscape] = useState(false)

    useEffect(() => {
        const check = () => {
            if (typeof window === "undefined") return

            // 1. Capacitor native mobile app
            const isCap = !!(window as any).Capacitor && (typeof (window as any).Capacitor.isNativePlatform === 'function' ? (window as any).Capacitor.isNativePlatform() : true)

            // 2. Check User Agent
            const ua = navigator.userAgent || ""
            const isDesktopOS = /Windows NT|Macintosh|Linux x86_64/i.test(ua) && !/Android/i.test(ua)

            // If it is a PC/Desktop (Windows, Mac, etc.) and NOT a native Android/iOS APK, it is PC!
            if (isDesktopOS && !isCap) {
                setIsMobileLandscape(false)
                if (typeof document !== "undefined") {
                    document.documentElement.classList.remove("mobile-landscape")
                }
                return
            }

            // 3. Mobile detection
            const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
            const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
            const isMobileDevice = isCap || (isMobileUA && hasTouch)

            // 4. Orientation
            const isLandscape = window.innerWidth > window.innerHeight
            const match = !!(isMobileDevice && isLandscape)

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
