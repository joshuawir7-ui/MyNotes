"use client"

import { useState, useEffect } from "react"
import { useTimerStore, timerEngine, TimerStatus } from "@/lib/timer-engine"

export interface TimerRemainingInfo {
    status: TimerStatus
    durationMs: number
    remainingMs: number
    seconds: number
    formatted: string
    progress: number // 0 to 1
    isActive: boolean
    preset: number
}

function formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function useTimerRemaining(): TimerRemainingInfo {
    const status = useTimerStore(s => s.status)
    const endAt = useTimerStore(s => s.endAt)
    const remainingMsState = useTimerStore(s => s.remainingMs)
    const durationMs = useTimerStore(s => s.durationMs)
    const preset = useTimerStore(s => s.preset)

    // LOCAL component state: updates only in component memory, ZERO Zustand writes
    const [localRemainingMs, setLocalRemainingMs] = useState(() => {
        if (status === 'running' && endAt) {
            return Math.max(0, endAt - Date.now())
        }
        return remainingMsState
    })

    useEffect(() => {
        if (status !== 'running' || !endAt) {
            setLocalRemainingMs(remainingMsState)
            return
        }

        // Immediately update on status/endAt change
        const initialRem = Math.max(0, endAt - Date.now())
        setLocalRemainingMs(initialRem)
        if (initialRem === 0) {
            timerEngine.handleTimeExpired()
            return
        }

        // Ticking loop running in local state every 250ms (only while running and document visible)
        const intervalId = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
                return
            }
            const rem = Math.max(0, endAt - Date.now())
            setLocalRemainingMs(rem)

            if (rem === 0) {
                timerEngine.handleTimeExpired()
            }
        }, 250)

        return () => clearInterval(intervalId)
    }, [status, endAt, remainingMsState])

    const totalSeconds = Math.ceil(localRemainingMs / 1000)
    const progress = durationMs > 0 ? Math.min(1, Math.max(0, 1 - (localRemainingMs / durationMs))) : 0

    return {
        status,
        durationMs,
        remainingMs: localRemainingMs,
        seconds: totalSeconds,
        formatted: formatTime(totalSeconds),
        progress,
        isActive: status === 'running',
        preset
    }
}
