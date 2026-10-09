"use client"

import React, { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, Gauge, RotateCcw, Activity, CheckCircle2, Sliders, Layers, Sparkles } from "lucide-react"
import {
    getPerfFlags,
    setPerfFlag,
    subscribePerfDebug,
    getStartupTimeline,
    getLastNavDuration,
    getNavMedian,
    getNavHistory,
    clearNavHistory,
    PerfFlags
} from "@/lib/perf-debug"

interface PerfDebugModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PerfDebugModal({ isOpen, onClose }: PerfDebugModalProps) {
    const [flags, setFlags] = useState<PerfFlags>(getPerfFlags());
    const [mounted, setMounted] = useState(false);
    const [timeline, setTimeline] = useState(getStartupTimeline());
    const [lastNav, setLastNav] = useState<number | null>(getLastNavDuration());
    const [medianNav, setMedianNav] = useState<number | null>(getNavMedian());
    const [history, setHistory] = useState<number[]>(getNavHistory());

    useEffect(() => {
        setMounted(true);
        const unsubscribe = subscribePerfDebug(() => {
            setFlags(getPerfFlags());
            setTimeline(getStartupTimeline());
            setLastNav(getLastNavDuration());
            setMedianNav(getNavMedian());
            setHistory(getNavHistory());
        });
        return () => { unsubscribe(); };
    }, []);

    if (!mounted || !isOpen) return null;

    const toggleFlag = (key: keyof PerfFlags) => {
        setPerfFlag(key, !flags[key]);
    };

    const resetAllFlags = () => {
        (Object.keys(flags) as (keyof PerfFlags)[]).forEach(k => setPerfFlag(k, false));
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-white/10 overflow-y-auto max-h-[90vh] text-left select-none"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                    <Gauge className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                                        Debug de Rendimiento
                                        <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                                            Paso 1
                                        </span>
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Diagnóstico de navegación e isoladores experimentales
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Navigation Stopwatch Section */}
                        <div className="bg-zinc-100 dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-white/10 mb-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-black uppercase tracking-wider text-foreground">
                                        Cronómetro de Navegación
                                    </span>
                                </div>
                                <button
                                    onClick={clearNavHistory}
                                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 bg-white/50 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-black/5 dark:border-white/10"
                                >
                                    <RotateCcw className="w-3 h-3" /> Limpiar
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-center mb-3">
                                <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-black/5 dark:border-white/10">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                                        Última Navegación
                                    </span>
                                    <span className="text-2xl font-black text-primary font-mono">
                                        {lastNav !== null ? `${lastNav} ms` : '--'}
                                    </span>
                                </div>
                                <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-black/5 dark:border-white/10">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                                        Mediana (Últimas {history.length})
                                    </span>
                                    <span className="text-2xl font-black text-emerald-500 font-mono">
                                        {medianNav !== null ? `${medianNav} ms` : '--'}
                                    </span>
                                </div>
                            </div>

                            {history.length > 0 && (
                                <div className="text-[11px] font-mono text-muted-foreground truncate">
                                    Historial: {history.join('ms, ')}ms
                                </div>
                            )}
                        </div>

                        {/* Diagnostic Toggles */}
                        <div className="space-y-3 mb-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-primary" />
                                    Interruptores de Aislamiento
                                </span>
                                <button
                                    onClick={resetAllFlags}
                                    className="text-[10px] font-bold text-primary hover:underline"
                                >
                                    Restablecer Todo
                                </button>
                            </div>

                            <div className="space-y-2">
                                {[
                                    { key: 'perfNoLayout' as const, label: 'perf-no-layout', desc: 'Desactiva prop layout en motion.main (sin reflow espacial)' },
                                    { key: 'perfNoReveal' as const, label: 'perf-no-reveal', desc: 'Entradas inmediatas en <Reveal> (0 delay / 0 duration)' },
                                    { key: 'perfNoBackdrop' as const, label: 'perf-no-backdrop', desc: 'Desactiva backdrop-filter en todo el sitio' },
                                    { key: 'perfNoOrbs' as const, label: 'perf-no-orbs', desc: 'Oculta orbes de fondo con blur ambiental' },
                                    { key: 'perfNoMotion' as const, label: 'perf-no-motion', desc: 'Reducción global de animaciones CSS/Framer Motion' }
                                ].map((item) => {
                                    const active = flags[item.key];
                                    return (
                                        <div
                                            key={item.key}
                                            onClick={() => toggleFlag(item.key)}
                                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                                active
                                                    ? 'bg-primary/10 border-primary/40 shadow-sm'
                                                    : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-white/5 hover:border-zinc-300'
                                            }`}
                                        >
                                            <div className="pr-3">
                                                <span className={`text-xs font-mono font-bold block ${active ? 'text-primary' : 'text-foreground'}`}>
                                                    {item.label}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground block">
                                                    {item.desc}
                                                </span>
                                            </div>
                                            <div
                                                className={`w-9 h-5 rounded-full p-0.5 transition-colors relative shrink-0 ${
                                                    active ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'
                                                }`}
                                            >
                                                <div
                                                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                                        active ? 'translate-x-4' : 'translate-x-0'
                                                    }`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Startup Timeline */}
                        <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200 dark:border-white/10 mb-4">
                            <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2 mb-3">
                                <Layers className="w-4 h-4 text-primary" />
                                Línea de Tiempo de Inicio (ms)
                            </span>
                            <div className="space-y-1.5 text-xs font-mono">
                                <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
                                    <span className="text-muted-foreground">1. Script Principal</span>
                                    <span className="font-bold text-foreground">0 ms</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
                                    <span className="text-muted-foreground">2. Store Hidratado</span>
                                    <span className="font-bold text-primary">
                                        {timeline.hydrated !== null ? `${timeline.hydrated} ms` : 'esperando...'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
                                    <span className="text-muted-foreground">3. Primer Render Útil (Hoy)</span>
                                    <span className="font-bold text-emerald-500">
                                        {timeline.firstRender !== null ? `${timeline.firstRender} ms` : 'esperando...'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
                                    <span className="text-muted-foreground">4. Fin Startup Etapa 1 (Rachas)</span>
                                    <span className="font-bold text-amber-500">
                                        {timeline.stage1End !== null ? `${timeline.stage1End} ms` : 'esperando...'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">5. Fin Startup Etapa 2 (Widgets)</span>
                                    <span className="font-bold text-indigo-400">
                                        {timeline.stage2End !== null ? `${timeline.stage2End} ms` : 'esperando...'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer Instructions */}
                        <div className="text-[11px] text-muted-foreground text-center leading-relaxed">
                            💡 <strong>Instrucciones para el teléfono</strong>: Prueba activando un interruptor a la vez, cambia 5 veces de pestaña (Hoy → Tareas → Notas → Balance) y anota si la mediana de navegación baja.
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
