"use client"

import { create } from "zustand"

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface TimerState {
    status: TimerStatus
    durationMs: number
    endAt: number | null // Epoch timestamp in ms when running
    remainingMs: number // Remaining time in ms
    preset: number // In minutes (e.g., 25, 5, 15, 30)
    version: number
    finishedAt: number | null
    isFloating: boolean
    position: { x: number; y: number }
    size: { width: number; height: number }
}

export interface TimerEngine {
    start(durationMs?: number, preset?: number): Promise<void> | void
    pause(): Promise<void> | void
    resume(): Promise<void> | void
    reset(): Promise<void> | void
    stop(): Promise<void> | void
    getState(): TimerState
    subscribe(listener: (state: TimerState) => void): () => void
    setUIPreferences(prefs: Partial<{ isFloating: boolean; position: { x: number; y: number }; size: { width: number; height: number } }>): void
    reconcile(): void
    handleTimeExpired(): void
}

const STORAGE_KEY = 'mynotes_isolated_timer_state_v1'

const DEFAULT_PRESET = 25
const DEFAULT_DURATION_MS = DEFAULT_PRESET * 60 * 1000

const INITIAL_STATE: TimerState = {
    status: 'idle',
    durationMs: DEFAULT_DURATION_MS,
    endAt: null,
    remainingMs: DEFAULT_DURATION_MS,
    preset: DEFAULT_PRESET,
    version: 1,
    finishedAt: null,
    isFloating: false,
    position: { x: 0, y: 0 },
    size: { width: 180, height: 180 }
}

// Side effects tracker to ensure exact-once execution
let lastHandledFinishedAt: number | null = null

function loadPersistedState(): TimerState {
    if (typeof window === 'undefined') return INITIAL_STATE
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return INITIAL_STATE
        const parsed = JSON.parse(raw) as Partial<TimerState>
        const state: TimerState = {
            ...INITIAL_STATE,
            ...parsed,
            position: { ...INITIAL_STATE.position, ...(parsed.position || {}) },
            size: { ...INITIAL_STATE.size, ...(parsed.size || {}) }
        }

        // Reconcile if was running when closed/persisted
        if (state.status === 'running' && state.endAt) {
            const now = Date.now()
            if (now >= state.endAt) {
                state.status = 'finished'
                state.remainingMs = 0
                state.finishedAt = state.endAt
            } else {
                state.remainingMs = Math.max(0, state.endAt - now)
            }
        }
        return state
    } catch (e) {
        console.error("[TimerEngine] Failed to load persisted state:", e)
        return INITIAL_STATE
    }
}

function persistStateOnlyOnEvent(state: TimerState) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
        console.error("[TimerEngine] Failed to persist state:", e)
    }
}

// Dedicated store for high-level timer events (NOT ticking every second)
export const useTimerStore = create<TimerState>(() => loadPersistedState())

class WebTimerEngineImpl implements TimerEngine {
    private onAlarmCallback?: () => void

    constructor() {
        // Initialize once
        if (typeof window !== 'undefined') {
            const current = useTimerStore.getState()
            if (current.status === 'finished' && current.finishedAt && current.finishedAt !== lastHandledFinishedAt) {
                // If it completed while closed, handle side effects on mount
                setTimeout(() => this.triggerSideEffects(current.durationMs), 500)
            }
        }
    }

    getState(): TimerState {
        return useTimerStore.getState()
    }

    subscribe(listener: (state: TimerState) => void): () => void {
        return useTimerStore.subscribe(listener)
    }

    start(durationMs?: number, preset?: number): void {
        const current = this.getState()
        const resolvedPreset = preset ?? current.preset ?? DEFAULT_PRESET
        const resolvedDurationMs = durationMs ?? (resolvedPreset * 60 * 1000)
        const now = Date.now()
        const endAt = now + resolvedDurationMs

        const next: TimerState = {
            ...current,
            status: 'running',
            durationMs: resolvedDurationMs,
            preset: resolvedPreset,
            endAt,
            remainingMs: resolvedDurationMs,
            version: current.version + 1,
            finishedAt: null
        }

        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)
    }

    pause(): void {
        const current = this.getState()
        if (current.status !== 'running' || !current.endAt) return

        const now = Date.now()
        const remainingMs = Math.max(0, current.endAt - now)

        const next: TimerState = {
            ...current,
            status: 'paused',
            remainingMs,
            endAt: null,
            version: current.version + 1
        }

        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)
    }

    resume(): void {
        const current = this.getState()
        if (current.status !== 'paused') return

        const now = Date.now()
        const endAt = now + current.remainingMs

        const next: TimerState = {
            ...current,
            status: 'running',
            endAt,
            version: current.version + 1
        }

        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)
    }

    reset(): void {
        const current = this.getState()
        const durationMs = (current.preset ?? DEFAULT_PRESET) * 60 * 1000

        const next: TimerState = {
            ...current,
            status: 'idle',
            durationMs,
            remainingMs: durationMs,
            endAt: null,
            finishedAt: null,
            version: current.version + 1
        }

        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)
    }

    stop(): void {
        this.reset()
    }

    setUIPreferences(prefs: Partial<{ isFloating: boolean; position: { x: number; y: number }; size: { width: number; height: number } }>): void {
        const current = this.getState()
        const next: TimerState = {
            ...current,
            isFloating: prefs.isFloating ?? current.isFloating,
            position: prefs.position ? { ...current.position, ...prefs.position } : current.position,
            size: prefs.size ? { ...current.size, ...prefs.size } : current.size,
            version: current.version + 1
        }
        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)
    }

    reconcile(): void {
        const current = this.getState()
        if (current.status === 'running' && current.endAt) {
            const now = Date.now()
            if (now >= current.endAt) {
                this.handleTimeExpired()
            }
        }
    }

    handleTimeExpired(): void {
        const current = this.getState()
        if (current.status === 'finished') return // Already handled

        const next: TimerState = {
            ...current,
            status: 'finished',
            remainingMs: 0,
            endAt: null,
            finishedAt: current.endAt || Date.now(),
            version: current.version + 1
        }

        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)

        this.triggerSideEffects(current.durationMs)
    }

    private triggerSideEffects(durationMs: number): void {
        const current = this.getState()
        if (current.finishedAt && current.finishedAt === lastHandledFinishedAt) {
            return // Guard against duplicate execution
        }
        lastHandledFinishedAt = current.finishedAt

        // 1. Play Web Audio alarm
        try {
            if (typeof window !== 'undefined') {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
                if (AudioCtx) {
                    const ctx = new AudioCtx()
                    const osc = ctx.createOscillator()
                    const gain = ctx.createGain()
                    osc.connect(gain)
                    gain.connect(ctx.destination)
                    osc.type = 'sine'
                    osc.frequency.setValueAtTime(520, ctx.currentTime)
                    gain.gain.setValueAtTime(0.15, ctx.currentTime)
                    osc.start()
                    osc.stop(ctx.currentTime + 0.6)
                }
            }
        } catch (e) {
            console.error("[TimerEngine] Audio beep failed:", e)
        }

        // 2. Web Notification
        try {
            if (typeof window !== 'undefined' && "Notification" in window && Notification.permission === "granted") {
                new Notification("MyNotes", {
                    body: "⏰ ¡El tiempo de enfoque ha terminado!",
                    icon: "/favicon.ico"
                })
            }
        } catch (e) {
            console.error("[TimerEngine] Notification failed:", e)
        }

        // 3. Increment focus time in main store if available
        try {
            const minutes = Math.max(1, Math.round(durationMs / 60000))
            if (typeof window !== 'undefined') {
                import('./store').then(({ useStore }) => {
                    const store = useStore.getState()
                    if (typeof store.incrementFocusTime === 'function') {
                        store.incrementFocusTime(minutes)
                    }
                    if (typeof store.addXP === 'function') {
                        store.addXP(minutes >= 25 ? 50 : 25)
                    }
                }).catch(console.error)
            }
        } catch (e) {
            console.error("[TimerEngine] Incrementing focus time failed:", e)
        }
    }
}

export const timerEngine: TimerEngine = new WebTimerEngineImpl()

/**
 * Migration helper: loads legacy timer from store data if present
 */
export function migrateLegacyTimerState(legacyTimer: any) {
    if (!legacyTimer || typeof legacyTimer !== 'object') return
    const current = timerEngine.getState()
    if (current.status !== 'idle') return // Active isolated timer takes priority

    if (legacyTimer.targetTimestamp && legacyTimer.targetTimestamp > Date.now()) {
        const remainingMs = legacyTimer.targetTimestamp - Date.now()
        const durationMs = (legacyTimer.timeLeft || 1500) * 1000
        const preset = Math.round(durationMs / 60000)
        timerEngine.start(durationMs, preset)
    } else if (legacyTimer.timeLeft && legacyTimer.timeLeft > 0) {
        const durationMs = legacyTimer.timeLeft * 1000
        const preset = Math.round(durationMs / 60000)
        const next: TimerState = {
            ...current,
            durationMs,
            remainingMs: durationMs,
            preset,
            isFloating: !!legacyTimer.isFloating,
            position: legacyTimer.position || current.position,
            size: legacyTimer.size || current.size
        }
        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)
    }
}
