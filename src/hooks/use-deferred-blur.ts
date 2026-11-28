"use client"

import { useEffect, useState } from "react"
import { usePerfTier, resolveEffectiveAttributes } from "@/lib/perf-tier"

export function useDeferredBlur(isOpen: boolean, delayMs = 260): boolean {
    const tierState = usePerfTier()
    const attrs = resolveEffectiveAttributes(tierState)
    const allowBlur = attrs.tier === "high" && attrs.fxBlur === "on"
    const [blurActive, setBlurActive] = useState(false)

    useEffect(() => {
        if (!isOpen || !allowBlur) {
            setBlurActive(false)
            return
        }
        const timer = window.setTimeout(() => {
            setBlurActive(true)
        }, delayMs)
        return () => {
            window.clearTimeout(timer)
            setBlurActive(false)
        }
    }, [isOpen, delayMs, allowBlur])

    return blurActive
}
