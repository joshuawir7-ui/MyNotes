"use client"

import React, { useState, useEffect } from "react"
import { getLastNavDuration, getNavMedian, subscribePerfDebug } from "@/lib/perf-debug"
import { Activity, Gauge } from "lucide-react"

interface MiniNavOverlayProps {
    onOpenModal: () => void;
}

export function MiniNavOverlay({ onOpenModal }: MiniNavOverlayProps) {
    const [lastNav, setLastNav] = useState<number | null>(getLastNavDuration());
    const [medianNav, setMedianNav] = useState<number | null>(getNavMedian());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const unsubscribe = subscribePerfDebug(() => {
            setLastNav(getLastNavDuration());
            setMedianNav(getNavMedian());
        });
        return unsubscribe;
    }, []);

    if (!mounted || lastNav === null) return null;

    return (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[99990] flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 dark:bg-zinc-950/90 text-white backdrop-blur-md shadow-xl border border-white/20 text-xs font-mono select-none">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span>
                [Nav] <strong className="text-emerald-400">{lastNav}ms</strong>
                {medianNav !== null && <span className="opacity-70 text-[10px] ml-1.5">(Med: {medianNav}ms)</span>}
            </span>
            <button
                onClick={onOpenModal}
                className="ml-1 p-1 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-95"
                title="Abrir Debug de Rendimiento"
            >
                <Gauge className="w-3 h-3 text-amber-300" />
            </button>
        </div>
    );
}
