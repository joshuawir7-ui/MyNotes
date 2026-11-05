"use client"

import { create } from "zustand"
import { registerPlugin, Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"

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
    checkOverlayPermission(): Promise<boolean>
    requestOverlayPermission(): Promise<void>
    getBubbleSettings(): Promise<{ mode: 'always' | 'outside' | 'never'; hasPermission: boolean; isSupported: boolean }>
    setBubbleMode(mode: 'always' | 'outside' | 'never'): Promise<void>
    openAppSettings(): Promise<void>
    openBatteryOptimizationSettings(): Promise<void>
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
        if (typeof window !== 'undefined') {
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.reconcile()
                }
            })
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
        const p = preset ?? current.preset ?? DEFAULT_PRESET
        const d = durationMs ?? (p * 60 * 1000)
        const now = Date.now()
        const endAt = now + d

        const next: TimerState = {
            ...current,
            status: 'running',
            durationMs: d,
            endAt,
            remainingMs: d,
            preset: p,
            finishedAt: null,
            version: current.version + 1
        }

        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)
    }

    pause(): void {
        const current = this.getState()
        if (current.status !== 'running') return

        const now = Date.now()
        const remainingMs = current.endAt ? Math.max(0, current.endAt - now) : current.remainingMs

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

        // 1. Play Web Audio alarm (repeats over 5.2 seconds)
        try {
            if (typeof window !== 'undefined') {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
                if (AudioCtx) {
                    const ctx = new AudioCtx()
                    const pulseTimes = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8]
                    pulseTimes.forEach(t => {
                        const osc = ctx.createOscillator()
                        const gain = ctx.createGain()
                        osc.connect(gain)
                        gain.connect(ctx.destination)
                        osc.type = 'sine'
                        osc.frequency.setValueAtTime(640, ctx.currentTime + t)
                        osc.frequency.exponentialRampToValueAtTime(840, ctx.currentTime + t + 0.3)
                        gain.gain.setValueAtTime(0.2, ctx.currentTime + t)
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.45)
                        osc.start(ctx.currentTime + t)
                        osc.stop(ctx.currentTime + t + 0.5)
                    })
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

    async checkOverlayPermission(): Promise<boolean> { return false; }
    async requestOverlayPermission(): Promise<void> {}
    async getBubbleSettings(): Promise<{ mode: 'always' | 'outside' | 'never'; hasPermission: boolean; isSupported: boolean }> {
        const mode = (typeof localStorage !== 'undefined' ? localStorage.getItem('mynotes_bubble_mode') : null) as any || 'outside';
        return { mode, hasPermission: false, isSupported: false };
    }
    async setBubbleMode(mode: 'always' | 'outside' | 'never'): Promise<void> {
        if (typeof localStorage !== 'undefined') localStorage.setItem('mynotes_bubble_mode', mode);
    }
    async openAppSettings(): Promise<void> {}
    async openBatteryOptimizationSettings(): Promise<void> {}
}

interface NativeTimerPlugin {
    start(options: { durationMs: number; preset: number }): Promise<any>
    pause(): Promise<any>
    resume(): Promise<any>
    reset(): Promise<any>
    stop(): Promise<any>
    getState(): Promise<any>
    checkOverlayPermission(): Promise<{ granted: boolean }>
    requestOverlayPermission(): Promise<{ requested: boolean }>
    getBubbleSettings(): Promise<{ mode: string; hasPermission: boolean; isSupported: boolean }>
    setBubbleMode(options: { mode: string }): Promise<{ mode: string }>
    openAppSettings(): Promise<void>
    openBatteryOptimizationSettings(): Promise<void>
    addListener(eventName: 'timerStateChanged', listenerFunc: (state: any) => void): Promise<{ remove: () => Promise<void> }>
}

const NativeTimer = registerPlugin<NativeTimerPlugin>('Timer')

class NativeTimerEngineImpl implements TimerEngine {
    constructor() {
        this.init()
    }

    private async init() {
        if (typeof window === 'undefined') return
        try {
            await NativeTimer.addListener('timerStateChanged', (nativeState: any) => {
                this.syncFromNative(nativeState)
            })

            const initial = await NativeTimer.getState()
            if (initial) {
                this.syncFromNative(initial)
            }

            if (Capacitor.isNativePlatform()) {
                App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) {
                        this.reconcile()
                    }
                })
            }
        } catch (e) {
            console.error('[NativeTimerEngine] Init failed:', e)
        }
    }

    private syncFromNative(nativeState: any) {
        if (!nativeState) return
        const current = useTimerStore.getState()
        const next: TimerState = {
            ...current,
            status: nativeState.status || current.status,
            durationMs: nativeState.durationMs ?? current.durationMs,
            endAt: nativeState.endAt ?? null,
            remainingMs: nativeState.remainingMs ?? current.remainingMs,
            preset: nativeState.preset ?? current.preset,
            version: nativeState.version ?? (current.version + 1),
            finishedAt: nativeState.finishedAt ?? null
        }
        useTimerStore.setState(next)
        persistStateOnlyOnEvent(next)

        if (next.status === 'finished') {
            this.triggerJSSideEffectsOnly(next.durationMs)
        }
    }

    getState(): TimerState {
        return useTimerStore.getState()
    }

    subscribe(listener: (state: TimerState) => void): () => void {
        return useTimerStore.subscribe(listener)
    }

    async start(durationMs?: number, preset?: number): Promise<void> {
        const p = preset ?? this.getState().preset ?? DEFAULT_PRESET
        const d = durationMs ?? p * 60 * 1000
        try {
            const res = await NativeTimer.start({ durationMs: d, preset: p })
            this.syncFromNative(res)
        } catch (e) {
            console.error('[NativeTimerEngine] start failed:', e)
        }
    }

    async pause(): Promise<void> {
        try {
            const res = await NativeTimer.pause()
            this.syncFromNative(res)
        } catch (e) {
            console.error('[NativeTimerEngine] pause failed:', e)
        }
    }

    async resume(): Promise<void> {
        try {
            const res = await NativeTimer.resume()
            this.syncFromNative(res)
        } catch (e) {
            console.error('[NativeTimerEngine] resume failed:', e)
        }
    }

    async reset(): Promise<void> {
        try {
            const res = await NativeTimer.reset()
            this.syncFromNative(res)
        } catch (e) {
            console.error('[NativeTimerEngine] reset failed:', e)
        }
    }

    async stop(): Promise<void> {
        try {
            const res = await NativeTimer.stop()
            this.syncFromNative(res)
        } catch (e) {
            console.error('[NativeTimerEngine] stop failed:', e)
        }
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
        NativeTimer.getState().then((state: any) => {
            this.syncFromNative(state)
        }).catch(console.error)
    }

    handleTimeExpired(): void {
        this.reconcile()
    }

    async checkOverlayPermission(): Promise<boolean> {
        try {
            const res = await NativeTimer.checkOverlayPermission()
            return !!res?.granted
        } catch {
            return false
        }
    }

    async requestOverlayPermission(): Promise<void> {
        try {
            await NativeTimer.requestOverlayPermission()
        } catch (e) {
            console.error('[NativeTimerEngine] requestOverlayPermission failed:', e)
        }
    }

    async getBubbleSettings(): Promise<{ mode: 'always' | 'outside' | 'never'; hasPermission: boolean; isSupported: boolean }> {
        try {
            const res = await NativeTimer.getBubbleSettings()
            return {
                mode: (res?.mode as any) || 'outside',
                hasPermission: !!res?.hasPermission,
                isSupported: true
            }
        } catch {
            return { mode: 'outside', hasPermission: false, isSupported: false }
        }
    }

    async setBubbleMode(mode: 'always' | 'outside' | 'never'): Promise<void> {
        try {
            await NativeTimer.setBubbleMode({ mode })
        } catch (e) {
            console.error('[NativeTimerEngine] setBubbleMode failed:', e)
        }
    }

    async openAppSettings(): Promise<void> {
        try {
            await NativeTimer.openAppSettings()
        } catch (e) {
            console.error('[NativeTimerEngine] openAppSettings failed:', e)
        }
    }

    async openBatteryOptimizationSettings(): Promise<void> {
        try {
            await NativeTimer.openBatteryOptimizationSettings()
        } catch (e) {
            console.error('[NativeTimerEngine] openBatteryOptimizationSettings failed:', e)
        }
    }

    private triggerJSSideEffectsOnly(durationMs: number): void {
        const current = this.getState()
        if (current.finishedAt && current.finishedAt === lastHandledFinishedAt) {
            return
        }
        lastHandledFinishedAt = current.finishedAt

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
            console.error('[NativeTimerEngine] Incrementing focus time failed:', e)
        }
    }
}

function createTimerEngine(): TimerEngine {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        return new NativeTimerEngineImpl()
    }
    return new WebTimerEngineImpl()
}

export const timerEngine: TimerEngine = createTimerEngine()

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
