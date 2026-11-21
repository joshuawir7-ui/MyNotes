"use client"

import { useEffect, useState } from "react"
import { useStore } from "@/lib/store"

function isLowEndDevice(): boolean {
    if (typeof navigator === "undefined") return false
    const nav = navigator as any
    const lowCores = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4
    const lowMem = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2
    return lowCores || lowMem
}

export function useDeferredBlur(isOpen: boolean, delayMs = 260): boolean {
    const performanceMode = useStore(state => state.performanceMode)
    const [blurActive, setBlurActive] = useState(false)

    useEffect(() => {
        if (!isOpen || performanceMode || isLowEndDevice()) {
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
    }, [isOpen, delayMs, performanceMode])

    return blurActive
}
