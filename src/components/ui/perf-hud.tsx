"use client"

import { useEffect, useRef, useState } from "react"
import { getHudStats, getStartupTimeline } from "@/lib/perf-debug"
import { getTextZoomSnapshot } from "@/lib/text-zoom"
import {
    getNativeSafeInsetsMetrics,
    setNativeSafeInsetsOverrideZero,
    NativeSafeInsetsMetrics,
} from "@/lib/safe-insets"
import {
    getPerfTierSnapshot,
    resolveEffectiveAttributes,
    setSessionOverrideTier,
    usePerfTier,
    Tier,
} from "@/lib/perf-tier"

/**
 * Perf HUD — solo se monta con developerMode activo (ver main-layout).
 * Todo el refresco va por ref al DOM una vez por segundo: CERO setState por frame.
 */

type LongTaskEntry = { t: number; dur: number; name: string }

const FRAME_WINDOW_MS = 5000
const LONGTASK_WINDOW_MS = 10000

export function PerfHud() {
    const boxRef = useRef<HTMLDivElement>(null)
    const textRef = useRef<HTMLPreElement>(null)
    const reportRef = useRef<string>("")
    const nativeMetricsRef = useRef<NativeSafeInsetsMetrics | null>(null)
    const benchReportRef = useRef<string>("")
    const [overrideZero, setOverrideZero] = useState(false)
    const [benchStatus, setBenchStatus] = useState<string | null>(null)
    const [benchSummary, setBenchSummary] = useState<string>("")
    const perfTier = usePerfTier()

    useEffect(() => {
        if (typeof window === "undefined") return

        // ── Frames (rAF) ───────────────────────────────────────────────
        // Buffer circular de [timestamp, delta] de los últimos 5 s
        const frameTs: number[] = []
        const frameDt: number[] = []
        let last = performance.now()
        let rafId = 0
        const onFrame = (now: number) => {
            const dt = now - last
            last = now
            frameTs.push(now)
            frameDt.push(dt)
            while (frameTs.length && now - frameTs[0] > FRAME_WINDOW_MS) {
                frameTs.shift()
                frameDt.shift()
            }
            rafId = requestAnimationFrame(onFrame)
        }
        rafId = requestAnimationFrame(onFrame)

        // ── Tareas largas ──────────────────────────────────────────────
        const longTasks: LongTaskEntry[] = []
        const observers: PerformanceObserver[] = []
        const supported: string[] = (PerformanceObserver as any)?.supportedEntryTypes ?? []
        const hasLoaf = supported.includes("long-animation-frame")
        try {
            if (hasLoaf) {
                const po = new PerformanceObserver((list) => {
                    for (const e of list.getEntries() as any[]) {
                        if (e.duration < 50) continue
                        const scripts = (e.scripts ?? []) as any[]
                        const top = scripts
                            .slice()
                            .sort((a, b) => b.duration - a.duration)[0]
                        const name = top
                            ? `${top.invoker || top.name || "script"}${top.sourceURL ? " @" + String(top.sourceURL).split("/").pop() : ""}${top.sourceFunctionName ? " " + top.sourceFunctionName : ""}`
                            : "(sin atribución)"
                        longTasks.push({ t: performance.now(), dur: e.duration, name })
                    }
                })
                po.observe({ type: "long-animation-frame", buffered: false } as any)
                observers.push(po)
            } else if (supported.includes("longtask")) {
                const po = new PerformanceObserver((list) => {
                    for (const e of list.getEntries()) {
                        longTasks.push({ t: performance.now(), dur: e.duration, name: e.name || "longtask" })
                    }
                })
                po.observe({ type: "longtask", buffered: false } as any)
                observers.push(po)
            }
        } catch { /* WebView sin soporte */ }

        // Probe oculto para leer env(safe-area-inset-bottom) real sin polling extra
        const envProbe = document.createElement("div")
        envProbe.style.cssText =
            "position:fixed;bottom:0;left:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;"
        document.body.appendChild(envProbe)

        // ── Pintado 1 vez/s por ref ───────────────────────────────────
        const fmt = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "—" : v.toFixed(d))
        const paint = () => {
            getNativeSafeInsetsMetrics().then((m) => {
                if (m) nativeMetricsRef.current = m
            }).catch(() => {})
            const now = performance.now()
            while (longTasks.length && now - longTasks[0].t > LONGTASK_WINDOW_MS) longTasks.shift()

            const n = frameDt.length
            const span = n > 1 ? frameTs[n - 1] - frameTs[0] : 0
            const fps = span > 0 ? ((n - 1) * 1000) / span : 0
            let worst = 0
            let p95 = 0
            let dropped = 0
            if (n) {
                const sorted = frameDt.slice().sort((a, b) => a - b)
                worst = sorted[n - 1]
                p95 = sorted[Math.min(n - 1, Math.floor(n * 0.95))]
                for (const d of frameDt) if (d > 25) dropped++
            }
            const s = getHudStats()
            const st = getStartupTimeline()
            const route = window.location.pathname + (window.location.hash || "")
            const ltTotal = longTasks.reduce((a, b) => a + b.dur, 0)
            const ltLines = longTasks
                .slice(-4)
                .map((l) => `  ${l.dur.toFixed(0)}ms ${l.name.slice(0, 48)}`)
                .join("\n")

            const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "dev-local"
            const branchName = process.env.NEXT_PUBLIC_GIT_BRANCH || "unknown"
            const tz = getTextZoomSnapshot()
            const sysScaleStr = tz.systemFontScale !== null ? `${tz.systemFontScale.toFixed(2)}x (tope ${tz.maxSystemScale.toFixed(1)}x)` : "n/a (web)"

            const rootStyle = getComputedStyle(document.documentElement)
            const navEl = document.querySelector<HTMLElement>(".nav-shell")
            const navBottomCss = navEl ? getComputedStyle(navEl).bottom : "—"
            const navGapViewport = navEl ? `${(window.innerHeight - navEl.getBoundingClientRect().bottom).toFixed(1)}dp` : "—"
            const envSab = getComputedStyle(envProbe).paddingBottom || "0px"
            const capSab = rootStyle.getPropertyValue("--safe-area-inset-bottom").trim() || "0px"
            const appInset = rootStyle.getPropertyValue("--app-inset-bottom").trim() || "0px"
            const nm = nativeMetricsRef.current
            const nativeBlock = nm
                ? `SDK:${nm.sdkInt} nav:${nm.navMode} d:${nm.density} ovr0:${nm.overrideZero ? "ON" : "OFF"}\n` +
                  `winH:${nm.windowHeightPx}px  WV top:${nm.webViewTopPx} h:${nm.webViewHeightPx} bot:${nm.webViewBottomPx}\n` +
                  `navBars.b:${nm.navBarBottomPx}px (${nm.navBarBottomDp}dp)  ime.b:${nm.imeBottomPx}px (${nm.imeVisible ? "vis" : "hid"})\n` +
                  `solape:${nm.overlapPx}px (${nm.overlapDp}dp)  eff:${nm.effectiveBottomDp}dp`
                : `nativo: web/PC (sin puente Android)`

            const tierSnap = getPerfTierSnapshot()
            const tierAttrs = resolveEffectiveAttributes(tierSnap)
            const winLines = tierSnap.windows
                .slice(-5)
                .map((w) => `p95:${w.p95Ms.toFixed(1)}ms bad:${(w.badShare * 100).toFixed(0)}% smp:${w.samplerAvgCostMs.toFixed(2)}ms`)
                .join(" | ")
            const logLines = tierSnap.decisionLog
                .slice(-20)
                .map((l) => `  ${l}`)
                .join("\n")

            const text =
                `build: ${buildId} (${branchName})\n` +
                `ruta: ${route}\n` +
                (nm?.deviceModel ? `dev: ${nm.deviceModel} WV:${nm.webViewVersion ?? "?"}\n` : "") +
                `tier: ${tierSnap.effectiveTier} (modo:${tierSnap.mode}${tierSnap.sessionOverrideTier ? ` sesOvr:${tierSnap.sessionOverrideTier}` : ""}) | ${tierSnap.reason}\n` +
                `fx: blur=${tierAttrs.fxBlur} sh=${tierAttrs.fxShadow} mot=${tierAttrs.fxMotion} bg=${tierAttrs.fxBg}\n` +
                `estático: ${tierSnap.staticEstimate?.tier ?? "?"} (${tierSnap.staticEstimate?.reasons.join("; ") || "—"})\n` +
                `gpu: ${tierSnap.gpuRenderer || "desconocida"}${tierSnap.unknownGpu ? ` [GPU desconocida: ${tierSnap.unknownGpu}]` : ""}\n` +
                `probe: ${tierSnap.probeMs !== null ? `${tierSnap.probeMs.toFixed(1)}ms (cpuFactor:${tierSnap.cpuFactor?.toFixed(2) ?? "?"}x)` : "pendiente"}\n` +
                `caps: pSave=${tierSnap.powerSaveActive ? 1 : 0} therm=${tierSnap.thermalStatus}${tierSnap.thermalCapped ? "(cap)" : ""} redMot=${tierSnap.prefersReducedMotion ? 1 : 0}\n` +
                (winLines ? `ventanas(5): ${winLines}\n` : "") +
                `texto: ${tz.mode} | zoom: ${tz.appliedZoom}% | sysFont: ${sysScaleStr}\n` +
                `nav.bottom: ${navBottomCss} | gapViewport: ${navGapViewport}\n` +
                `env(sab): ${envSab} | --sab: ${capSab} | --app-b: ${appInset}\n` +
                `${nativeBlock}\n` +
                `FPS(5s): ${fps.toFixed(0)}  peor: ${worst.toFixed(0)}ms  p95: ${p95.toFixed(0)}ms  >25ms: ${dropped}\n` +
                `longtasks(10s): ${longTasks.length} (${ltTotal.toFixed(0)}ms) ${hasLoaf ? "[LoAF]" : "[longtask]"}\n` +
                (ltLines ? ltLines + "\n" : "") +
                `set()/min: ${s.setCallsPerMin}  notas disco/min: ${s.notesWritesPerMin}\n` +
                `ensure(30s): ${s.ensureCallsFirst30s}  persist→worker/min: ${s.persistSendsPerMin} (${s.totalPersistSends})\n` +
                `último clon: ${fmt(s.lastCloneMs, 2)}ms  serializar: ${fmt(s.lastSerializeMs, 0)}ms\n` +
                `estado: ${fmt(s.stateKB, 0)} KB  json arranque: ${fmt(s.storageJsonKB, 0)} KB\n` +
                `rehidratación: ${fmt(s.hydrationMs, 0)}ms  hydrated@${fmt(st.hydrated, 0)}ms  1er render@${fmt(st.firstRender, 0)}ms`
            reportRef.current =
                `MyNotes Perf HUD — ${new Date().toISOString()}\n` +
                `UA: ${navigator.userAgent}\n` +
                `cores: ${(navigator as any).hardwareConcurrency ?? "?"}  mem: ${(navigator as any).deviceMemory ?? "?"}GB  dpr: ${window.devicePixelRatio || 1}  viewport: ${window.innerWidth}x${window.innerHeight}\n` +
                text +
                (logLines ? "\ndecisionLog(20):\n" + logLines : "") +
                (longTasks.length ? "\nlongtasks completas:\n" + longTasks.map((l) => `  ${l.dur.toFixed(0)}ms ${l.name}`).join("\n") : "") +
                (benchReportRef.current ? "\n\n" + benchReportRef.current : "")
            if (textRef.current) textRef.current.textContent = text
        }
        paint()
        const iv = window.setInterval(paint, 1000)

        return () => {
            cancelAnimationFrame(rafId)
            clearInterval(iv)
            observers.forEach((o) => o.disconnect())
            envProbe.remove()
        }
    }, [])

    // ── Arrastre (sin estado React) ──────────────────────────────────
    useEffect(() => {
        const box = boxRef.current
        if (!box) return
        const handle = box.querySelector<HTMLElement>("[data-hud-handle]")
        if (!handle) return
        let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false
        let x = 0, y = 0
        const down = (e: PointerEvent) => {
            dragging = true
            sx = e.clientX; sy = e.clientY; ox = x; oy = y
            handle.setPointerCapture(e.pointerId)
        }
        const move = (e: PointerEvent) => {
            if (!dragging) return
            x = ox + (e.clientX - sx)
            y = oy + (e.clientY - sy)
            box.style.transform = `translate3d(${x}px, ${y}px, 0)`
        }
        const up = () => { dragging = false }
        handle.addEventListener("pointerdown", down)
        handle.addEventListener("pointermove", move, { passive: true })
        handle.addEventListener("pointerup", up)
        handle.addEventListener("pointercancel", up)
        return () => {
            handle.removeEventListener("pointerdown", down)
            handle.removeEventListener("pointermove", move)
            handle.removeEventListener("pointerup", up)
            handle.removeEventListener("pointercancel", up)
        }
    }, [])

    const copyReport = async () => {
        const text = reportRef.current
        const btn = boxRef.current?.querySelector<HTMLButtonElement>("[data-hud-copy]")
        const flash = (msg: string) => {
            if (!btn) return
            btn.textContent = msg
            setTimeout(() => { btn.textContent = "Copiar informe" }, 1500)
        }
        try {
            await navigator.clipboard.writeText(text)
            flash("¡Copiado!")
            return
        } catch { /* sigue con Share */ }
        try {
            const { Share } = await import("@capacitor/share")
            await Share.share({ title: "MyNotes Perf HUD", text })
            flash("Compartido")
        } catch {
            flash("Error al copiar")
        }
    }

    const toggleOverrideZero = async () => {
        const next = !overrideZero
        setOverrideZero(next)
        const updated = await setNativeSafeInsetsOverrideZero(next)
        if (updated) nativeMetricsRef.current = updated
        if (typeof document !== "undefined" && !updated) {
            // En web/PC también permite simular el override a 0
            document.documentElement.style.setProperty("--app-inset-bottom", next ? "0px" : "")
        }
    }

    const runBenchmark = async () => {
        if (benchStatus) return
        setBenchStatus("Iniciando...")
        try {
            const { runDeviceBenchmark } = await import("@/lib/device-benchmark")
            const res = await runDeviceBenchmark((msg) => setBenchStatus(msg))
            benchReportRef.current = res.fullReportText
            setBenchSummary(res.summaryText)
            setBenchStatus(null)
        } catch (err) {
            setBenchSummary(`Error benchmark: ${err instanceof Error ? err.message : String(err)}`)
            setBenchStatus(null)
        }
    }

    return (
        <div
            ref={boxRef}
            data-hud-root="true"
            className="fixed top-16 left-2 z-[9995] w-[296px] max-h-[75vh] overflow-y-auto rounded-xl bg-black/85 text-[10px] leading-[1.35] text-emerald-300 font-mono shadow-lg border border-white/15 select-none"
            style={{ contain: "layout paint" }}
        >
            <div data-hud-handle className="flex items-center justify-between gap-1 px-2 py-1 border-b border-white/10 cursor-move touch-none">
                <span className="text-white/80 font-bold">PERF HUD</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={runBenchmark}
                        onPointerDown={(e) => e.stopPropagation()}
                        disabled={Boolean(benchStatus)}
                        className="px-1.5 py-0.5 rounded text-[9px] bg-sky-500/80 text-white font-bold active:scale-95 disabled:opacity-60"
                        title="Ejecutar Benchmark en este dispositivo"
                    >
                        {benchStatus ? benchStatus : "Benchmark"}
                    </button>
                    <button
                        onClick={toggleOverrideZero}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`px-1.5 py-0.5 rounded text-[9px] active:scale-95 ${overrideZero ? "bg-amber-500 text-black font-bold" : "bg-white/15 text-white"}`}
                        title="Override --app-inset-bottom = 0dp"
                    >
                        {overrideZero ? "Ovr:0" : "Ovr:Auto"}
                    </button>
                    <button
                        data-hud-copy
                        onClick={copyReport}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="px-2 py-0.5 rounded bg-white/15 text-white active:scale-95"
                    >
                        Copiar informe
                    </button>
                </div>
            </div>
            <div className="flex items-center justify-between gap-1 px-2 py-1 border-b border-white/10">
                <span className="text-[9px] text-white/70">Forzar nivel (sesión):</span>
                <div className="flex items-center gap-1">
                    {([
                        { id: null, label: "Auto" },
                        { id: "high", label: "Alto" },
                        { id: "medium", label: "Medio" },
                        { id: "low", label: "Bajo" },
                    ] as { id: Tier | null; label: string }[]).map((opt) => {
                        const active = perfTier.sessionOverrideTier === opt.id
                        return (
                            <button
                                key={opt.label}
                                onClick={() => setSessionOverrideTier(opt.id)}
                                onPointerDown={(e) => e.stopPropagation()}
                                className={`px-1.5 py-0.5 rounded text-[9px] active:scale-95 ${
                                    active ? "bg-emerald-500 text-black font-bold" : "bg-white/10 text-white"
                                }`}
                            >
                                {opt.label}
                            </button>
                        )
                    })}
                </div>
            </div>
            <pre ref={textRef} className="px-2 py-1 whitespace-pre-wrap break-words m-0" />
            {benchSummary && (
                <pre className="px-2 py-1 border-t border-white/10 text-sky-300 whitespace-pre-wrap break-words m-0">
                    {benchSummary}
                </pre>
            )}
        </div>
    )
}

