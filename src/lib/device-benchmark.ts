import { getHudStats } from "@/lib/perf-debug"
import { getNativeSafeInsetsMetrics } from "@/lib/safe-insets"
import { useStore } from "@/lib/store"

export interface CpuBenchResult {
    arith20mMs: number
    json1MbMs: number
    sort50kMs: number
    reps: { arith: number[]; json: number[]; sort: number[] }
}

export interface RenderBenchResult {
    avgFps: number
    p50Ms: number
    p95Ms: number
    p99Ms: number
    gt16_7: number
    gt33: number
    gt50: number
    reps: number
}

export interface ModalCycleResult {
    openGt25: number
    closeGt25: number
    openMaxMs: number
    closeMaxMs: number
}

export interface ModalBenchResult {
    target: string
    medianOpenGt25: number
    medianCloseGt25: number
    cycles: ModalCycleResult[]
}

export interface ResourcesSnapshot {
    domNodes: number
    stateKB: number | null
    jsHeapUsedMB: number | null
    jsHeapTotalMB: number | null
    backdropFilterCount: number
    filterCount: number
    maskImageCount: number
    willChangeCount: number
    activeAnimations: number
}

export interface DeviceInfoSnapshot {
    userAgent: string
    deviceModel: string
    sdkInt: number | string
    webViewVersion: string
    hardwareConcurrency: number | string
    deviceMemory: number | string
    devicePixelRatio: number
    viewport: string
    theme: "dark" | "light"
    performanceMode: boolean
    buildId: string
    branch: string
}

export interface DeviceBenchmarkReport {
    timestamp: string
    route: string
    cpu: CpuBenchResult
    render: RenderBenchResult
    modal: ModalBenchResult
    resources: ResourcesSnapshot
    info: DeviceInfoSnapshot
    summaryText: string
    fullReportText: string
}

function median(values: number[]): number {
    if (!values.length) return 0
    const s = values.slice().sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
    return sorted[idx]
}

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r))
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function runCpuRepetition() {
    // 1) Bucle determinista de 20 millones de operaciones aritméticas
    const t0 = performance.now()
    let acc = 123456789
    for (let i = 0; i < 20_000_000; i++) {
        acc = (acc + (i ^ 0x9e3779b9)) | 0
        acc = Math.imul(acc, 1664525) + 1013904223
    }
    if (acc === 42) console.debug(acc)
    const arithMs = performance.now() - t0

    // 2) Construir objeto de ~1 MB y hacer JSON.stringify + JSON.parse
    const t1 = performance.now()
    const items = new Array(14_000)
    for (let i = 0; i < items.length; i++) {
        items[i] = {
            id: `n_${i}`,
            title: `Nota de prueba rendimiento #${i} - MyNotes`,
            done: (i & 1) === 0,
            val: i * 1.25,
        }
    }
    const payload = { version: 1, items }
    const str = JSON.stringify(payload)
    const parsed = JSON.parse(str)
    if (!parsed?.items?.length) console.debug(str.length)
    const jsonMs = performance.now() - t1

    // 3) Ordenar un arreglo de 50.000 números
    const arr = new Array<number>(50_000)
    let seed = 987654321
    for (let i = 0; i < arr.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        arr[i] = seed
    }
    const t2 = performance.now()
    arr.sort((a, b) => a - b)
    const sortMs = performance.now() - t2

    return { arithMs, jsonMs, sortMs }
}

function findBestScrollContainer(): HTMLElement | null {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("*")).filter((el) => {
        if (el.closest("[data-hud-root]")) return false
        const style = getComputedStyle(el)
        if (!/(auto|scroll)/.test(style.overflowY)) return false
        return el.scrollHeight > el.clientHeight + 24 && el.clientHeight > 120
    })
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight))
        return candidates[0]
    }
    return (document.scrollingElement as HTMLElement) || document.documentElement
}

async function runScrollPass(durationMs = 5000) {
    const scroller = findBestScrollContainer()
    const startScrollTop = scroller ? scroller.scrollTop : window.scrollY
    const maxScroll = scroller
        ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        : Math.max(0, document.documentElement.scrollHeight - window.innerHeight)

    const dts: number[] = []
    let dir = 1
    let last = performance.now()
    const start = last

    while (performance.now() - start < durationMs) {
        const now = await nextFrame()
        const dt = now - last
        last = now
        dts.push(dt)

        if (maxScroll > 0) {
            const step = Math.max(4, Math.round((dt / 16.67) * 9)) * dir
            if (scroller && scroller !== document.documentElement && scroller !== document.body) {
                scroller.scrollBy(0, step)
                if (scroller.scrollTop >= maxScroll - 2) dir = -1
                else if (scroller.scrollTop <= 2) dir = 1
            } else {
                window.scrollBy(0, step)
                if (window.scrollY >= maxScroll - 2) dir = -1
                else if (window.scrollY <= 2) dir = 1
            }
        }
    }

    if (scroller && scroller !== document.documentElement && scroller !== document.body) {
        scroller.scrollTop = startScrollTop
    } else {
        window.scrollTo(0, startScrollTop)
    }

    const totalMs = dts.reduce((a, b) => a + b, 0) || 1
    const avgFps = (dts.length * 1000) / totalMs
    const sorted = dts.slice().sort((a, b) => a - b)
    return {
        avgFps,
        p50Ms: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        p99Ms: percentile(sorted, 0.99),
        gt16_7: dts.filter((d) => d > 16.7).length,
        gt33: dts.filter((d) => d > 33).length,
        gt50: dts.filter((d) => d > 50).length,
    }
}

async function measureWindowFrames(ms: number) {
    const dts: number[] = []
    let last = performance.now()
    const start = last
    while (performance.now() - start < ms) {
        const now = await nextFrame()
        dts.push(now - last)
        last = now
    }
    return {
        gt25: dts.filter((d) => d > 25).length,
        maxMs: dts.length ? Math.max(...dts) : 0,
    }
}

function findModalTrigger(): { label: string; open: () => boolean; close: () => void } {
    // Prefer "Nueva Meta" if on /goals, otherwise use Settings modal (present on all main pages)
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    const newGoalBtn = buttons.find((b) => /nueva meta|new goal/i.test(b.textContent || ""))
    if (newGoalBtn) {
        return {
            label: "Nueva Meta",
            open: () => {
                newGoalBtn.click()
                return true
            },
            close: () => {
                const closeBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
                    (b) => b.querySelector("svg.lucide-x") && b.offsetParent !== null
                )
                if (closeBtn) closeBtn.click()
                else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
            },
        }
    }

    const settingsBtn = buttons.find(
        (b) =>
            /ajustes|settings|configuración|设置/i.test(b.title || "") &&
            b.offsetParent !== null
    )
    return {
        label: settingsBtn ? "Ajustes" : "Sin modal",
        open: () => {
            if (!settingsBtn) return false
            settingsBtn.click()
            return true
        },
        close: () => {
            const closeBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
                (b) => b.querySelector("svg.lucide-x") && b.offsetParent !== null
            )
            if (closeBtn) closeBtn.click()
        },
    }
}

export function collectResourcesSnapshot(): ResourcesSnapshot {
    const all = Array.from(document.getElementsByTagName("*"))
    let backdropFilterCount = 0
    let filterCount = 0
    let maskImageCount = 0
    let willChangeCount = 0

    for (const el of all) {
        if ((el as HTMLElement).closest?.("[data-hud-root]")) continue
        const s = getComputedStyle(el)
        const bf = s.backdropFilter || (s as any).webkitBackdropFilter || "none"
        if (bf && bf !== "none") backdropFilterCount++
        if (s.filter && s.filter !== "none") filterCount++
        const mi = s.maskImage || (s as any).webkitMaskImage || "none"
        if (mi && mi !== "none") maskImageCount++
        if (s.willChange && s.willChange !== "auto") willChangeCount++
    }

    const mem = (performance as any).memory
    const hudStats = getHudStats()
    return {
        domNodes: all.length,
        stateKB: hudStats.stateKB !== null ? Math.round(hudStats.stateKB) : null,
        jsHeapUsedMB: mem?.usedJSHeapSize ? +(mem.usedJSHeapSize / (1024 * 1024)).toFixed(1) : null,
        jsHeapTotalMB: mem?.totalJSHeapSize ? +(mem.totalJSHeapSize / (1024 * 1024)).toFixed(1) : null,
        backdropFilterCount,
        filterCount,
        maskImageCount,
        willChangeCount,
        activeAnimations: typeof document.getAnimations === "function" ? document.getAnimations().length : 0,
    }
}

function parseWebViewFromUA(ua: string): string {
    const m = ua.match(/Chrome\/([\d.]+)/)
    return m ? m[1] : "unknown"
}

export async function collectDeviceInfoSnapshot(): Promise<DeviceInfoSnapshot> {
    const native = await getNativeSafeInsetsMetrics()
    const ua = navigator.userAgent
    const isDark = document.documentElement.classList.contains("dark")
    const performanceMode = Boolean(useStore.getState().performanceMode)

    return {
        userAgent: ua,
        deviceModel: native?.deviceModel || (navigator as any).userAgentData?.model || "Web/Desktop",
        sdkInt: native?.sdkInt ?? "web",
        webViewVersion: native?.webViewVersion || parseWebViewFromUA(ua),
        hardwareConcurrency: navigator.hardwareConcurrency ?? "?",
        deviceMemory: (navigator as any).deviceMemory ?? "?",
        devicePixelRatio: +(window.devicePixelRatio || 1).toFixed(2),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        theme: isDark ? "dark" : "light",
        performanceMode,
        buildId: process.env.NEXT_PUBLIC_BUILD_ID || "dev-local",
        branch: process.env.NEXT_PUBLIC_GIT_BRANCH || "unknown",
    }
}

export async function runDeviceBenchmark(
    onProgress?: (msg: string) => void
): Promise<DeviceBenchmarkReport> {
    const route = window.location.pathname + (window.location.hash || "")

    // a) CPU-JS (3 reps)
    const arithReps: number[] = []
    const jsonReps: number[] = []
    const sortReps: number[] = []
    for (let i = 0; i < 3; i++) {
        onProgress?.(`CPU-JS ${i + 1}/3...`)
        await sleep(30)
        const r = runCpuRepetition()
        arithReps.push(+r.arithMs.toFixed(1))
        jsonReps.push(+r.jsonMs.toFixed(1))
        sortReps.push(+r.sortMs.toFixed(1))
    }
    const cpu: CpuBenchResult = {
        arith20mMs: +median(arithReps).toFixed(1),
        json1MbMs: +median(jsonReps).toFixed(1),
        sort50kMs: +median(sortReps).toFixed(1),
        reps: { arith: arithReps, json: jsonReps, sort: sortReps },
    }

    // b) Render scroll 5s x 3 reps
    const fpsReps: number[] = []
    const p50Reps: number[] = []
    const p95Reps: number[] = []
    const p99Reps: number[] = []
    const gt16Reps: number[] = []
    const gt33Reps: number[] = []
    const gt50Reps: number[] = []
    for (let i = 0; i < 3; i++) {
        onProgress?.(`Scroll 5s (${i + 1}/3)...`)
        const sr = await runScrollPass(5000)
        fpsReps.push(sr.avgFps)
        p50Reps.push(sr.p50Ms)
        p95Reps.push(sr.p95Ms)
        p99Reps.push(sr.p99Ms)
        gt16Reps.push(sr.gt16_7)
        gt33Reps.push(sr.gt33)
        gt50Reps.push(sr.gt50)
        await sleep(150)
    }
    const render: RenderBenchResult = {
        avgFps: +median(fpsReps).toFixed(1),
        p50Ms: +median(p50Reps).toFixed(1),
        p95Ms: +median(p95Reps).toFixed(1),
        p99Ms: +median(p99Reps).toFixed(1),
        gt16_7: Math.round(median(gt16Reps)),
        gt33: Math.round(median(gt33Reps)),
        gt50: Math.round(median(gt50Reps)),
        reps: 3,
    }

    // c) Modal open/close 3x
    const modalTarget = findModalTrigger()
    const cycles: ModalCycleResult[] = []
    for (let i = 0; i < 3; i++) {
        onProgress?.(`Modal ${i + 1}/3...`)
        const opened = modalTarget.open()
        const openRes = opened ? await measureWindowFrames(420) : { gt25: 0, maxMs: 0 }
        await sleep(100)
        if (opened) modalTarget.close()
        const closeRes = opened ? await measureWindowFrames(380) : { gt25: 0, maxMs: 0 }
        cycles.push({
            openGt25: openRes.gt25,
            closeGt25: closeRes.gt25,
            openMaxMs: +openRes.maxMs.toFixed(1),
            closeMaxMs: +closeRes.maxMs.toFixed(1),
        })
        await sleep(120)
    }
    const modal: ModalBenchResult = {
        target: modalTarget.label,
        medianOpenGt25: Math.round(median(cycles.map((c) => c.openGt25))),
        medianCloseGt25: Math.round(median(cycles.map((c) => c.closeGt25))),
        cycles,
    }

    // d) Recursos & e) Info
    onProgress?.("Recursos...")
    const resources = collectResourcesSnapshot()
    const info = await collectDeviceInfoSnapshot()

    const summaryText =
        `[BENCH ${route}]\n` +
        `CPU(med): 20M=${cpu.arith20mMs}ms  JSON1M=${cpu.json1MbMs}ms  sort50k=${cpu.sort50kMs}ms\n` +
        `Scroll5s(med): ${render.avgFps}fps  p50=${render.p50Ms} p95=${render.p95Ms} p99=${render.p99Ms}ms\n` +
        `Frames >16.7:${render.gt16_7} >33:${render.gt33} >50:${render.gt50}\n` +
        `Modal(${modal.target}): open>25=${modal.medianOpenGt25} close>25=${modal.medianCloseGt25}\n` +
        `DOM:${resources.domNodes}  bf:${resources.backdropFilterCount} flt:${resources.filterCount} mask:${resources.maskImageCount} wc:${resources.willChangeCount} anim:${resources.activeAnimations}\n` +
        `Heap:${resources.jsHeapUsedMB ?? "?"}MB  Estado:${resources.stateKB ?? "?"}KB\n` +
        `Dev:${info.deviceModel} SDK:${info.sdkInt} WV:${info.webViewVersion} dpr:${info.devicePixelRatio} tema:${info.theme} perf:${info.performanceMode}`

    const fullReportText =
        `--- MyNotes Device Benchmark (${new Date().toISOString()}) ---\n` +
        `ruta: ${route}\n` +
        `modelo: ${info.deviceModel} | SDK_INT: ${info.sdkInt} | WebView: ${info.webViewVersion}\n` +
        `cores: ${info.hardwareConcurrency} | mem: ${info.deviceMemory}GB | dpr: ${info.devicePixelRatio} | viewport: ${info.viewport}\n` +
        `tema: ${info.theme} | performanceMode: ${info.performanceMode} | build: ${info.buildId} | rama: ${info.branch}\n` +
        `UA: ${info.userAgent}\n` +
        `CPU-JS (mediana 3 reps):\n` +
        `  20M ops: ${cpu.arith20mMs}ms [${cpu.reps.arith.join(", ")}]\n` +
        `  JSON 1MB: ${cpu.json1MbMs}ms [${cpu.reps.json.join(", ")}]\n` +
        `  Sort 50k: ${cpu.sort50kMs}ms [${cpu.reps.sort.join(", ")}]\n` +
        `Render Scroll 5s (mediana 3 reps):\n` +
        `  FPS: ${render.avgFps} | p50: ${render.p50Ms}ms | p95: ${render.p95Ms}ms | p99: ${render.p99Ms}ms\n` +
        `  Frames >16.7ms: ${render.gt16_7} | >33ms: ${render.gt33} | >50ms: ${render.gt50}\n` +
        `Modal (${modal.target}, 3 ciclos):\n` +
        `  Mediana >25ms: open=${modal.medianOpenGt25}, close=${modal.medianCloseGt25}\n` +
        modal.cycles
            .map((c, idx) => `  Ciclo ${idx + 1}: open>25=${c.openGt25} (max ${c.openMaxMs}ms), close>25=${c.closeGt25} (max ${c.closeMaxMs}ms)`)
            .join("\n") +
        `\nRecursos:\n` +
        `  DOM: ${resources.domNodes} | Estado: ${resources.stateKB ?? "?"}KB | JSHeap: ${resources.jsHeapUsedMB ?? "?"}/${resources.jsHeapTotalMB ?? "?"}MB\n` +
        `  backdrop-filter: ${resources.backdropFilterCount} | filter: ${resources.filterCount} | mask-image: ${resources.maskImageCount} | will-change: ${resources.willChangeCount} | animaciones: ${resources.activeAnimations}`

    return {
        timestamp: new Date().toISOString(),
        route,
        cpu,
        render,
        modal,
        resources,
        info,
        summaryText,
        fullReportText,
    }
}
