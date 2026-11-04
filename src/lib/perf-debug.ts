// Performance Debug & Measurement Utility for Paso 1

export interface PerfFlags {
    perfNoLayout: boolean;
    perfNoReveal: boolean;
    perfNoBackdrop: boolean;
    perfNoOrbs: boolean;
    perfNoMotion: boolean;
    perfNoSync: boolean;
}

export interface StartupTimeline {
    scriptStart: number;
    hydrated: number | null;
    firstRender: number | null;
    stage1End: number | null;
    stage2End: number | null;
}

export interface SyncMetrics {
    totalCycles: number;
    earlyExits: number;
    fullSyncs: number;
    bytesDownloaded: number;
}

const STORAGE_KEY = 'mynotes_perf_flags';
const NAV_HISTORY_KEY = 'mynotes_perf_nav_history';

// Track script execution start as early as module evaluation
const scriptStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

let currentFlags: PerfFlags = {
    perfNoLayout: false,
    perfNoReveal: false,
    perfNoBackdrop: false,
    perfNoOrbs: false,
    perfNoMotion: false,
    perfNoSync: false
};

const startupTimeline: StartupTimeline = {
    scriptStart: scriptStartTime,
    hydrated: null,
    firstRender: null,
    stage1End: null,
    stage2End: null
};

let lastNavDuration: number | null = null;
let navHistory: number[] = [];

const syncMetrics: SyncMetrics = {
    totalCycles: 0,
    earlyExits: 0,
    fullSyncs: 0,
    bytesDownloaded: 0
};

const listeners = new Set<() => void>();

export function getPerfFlags(): PerfFlags {
    return { ...currentFlags };
}

export function setPerfFlag<K extends keyof PerfFlags>(key: K, value: boolean) {
    currentFlags[key] = value;
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFlags));
        } catch (e) {}
        applyDOMFlags();
    }
    notifyListeners();
}

export function loadPerfFlags() {
    if (typeof window === 'undefined') return;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            currentFlags = { ...currentFlags, ...JSON.parse(saved) };
        }
        const savedHistory = localStorage.getItem(NAV_HISTORY_KEY);
        if (savedHistory) {
            navHistory = JSON.parse(savedHistory);
        }
    } catch (e) {}
    applyDOMFlags();
}

export function applyDOMFlags() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    root.classList.toggle('perf-no-backdrop', currentFlags.perfNoBackdrop);
    root.classList.toggle('perf-no-orbs', currentFlags.perfNoOrbs);
    root.classList.toggle('perf-no-motion', currentFlags.perfNoMotion);
}

export function subscribePerfDebug(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notifyListeners() {
    listeners.forEach(fn => fn());
}

// ── Sync Metrics ────────────────────────────────────────────────────────────

export function recordSyncMetric(type: 'earlyExit' | 'fullSync', bytes: number = 0) {
    syncMetrics.totalCycles++;
    if (type === 'earlyExit') {
        syncMetrics.earlyExits++;
    } else {
        syncMetrics.fullSyncs++;
    }
    syncMetrics.bytesDownloaded += bytes;
    console.log(`[Sync Metrics] Total: ${syncMetrics.totalCycles}, Early: ${syncMetrics.earlyExits}, Full: ${syncMetrics.fullSyncs}, Bytes: ${syncMetrics.bytesDownloaded}`);
    notifyListeners();
}

export function getSyncMetrics(): SyncMetrics {
    return { ...syncMetrics };
}

// ── Startup Timeline Marks ──────────────────────────────────────────────────

export function recordStartupMark(mark: keyof Omit<StartupTimeline, 'scriptStart'>) {
    if (typeof performance === 'undefined') return;
    if (startupTimeline[mark] === null) {
        const elapsed = Math.round(performance.now() - scriptStartTime);
        startupTimeline[mark] = elapsed;
        console.log(`[Startup Timeline] ${mark}: ${elapsed}ms`);
        notifyListeners();
    }
}

export function getStartupTimeline(): StartupTimeline {
    return { ...startupTimeline };
}

// ── Navigation Stopwatch ─────────────────────────────────────────────────────

let isNavigating = false;

export function markNavStart(route?: string) {
    if (typeof performance === 'undefined') return;
    try {
        performance.clearMarks('nav-start');
        performance.clearMarks('nav-end');
        performance.clearMeasures('nav');
    } catch (e) {}

    performance.mark('nav-start');
    isNavigating = true;
    if (route) {
        console.log(`[Nav] Navigation started to: ${route}`);
    }
}

export function markNavEnd() {
    if (typeof performance === 'undefined' || !isNavigating) return;
    isNavigating = false;

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    performance.mark('nav-end');
                    const m = performance.measure('nav', 'nav-start', 'nav-end');
                    const duration = Math.round(m.duration);
                    lastNavDuration = duration;
                    navHistory.push(duration);
                    if (navHistory.length > 20) navHistory.shift();
                    
                    try {
                        localStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(navHistory));
                    } catch (e) {}

                    console.log(`[Nav Stopwatch] Route rendered in ${duration}ms (Median: ${getNavMedian()}ms)`);
                    notifyListeners();
                } catch (e) {}
            });
        });
    }
}

export function getLastNavDuration(): number | null {
    return lastNavDuration;
}

export function getNavHistory(): number[] {
    return [...navHistory];
}

export function getNavMedian(): number | null {
    if (navHistory.length === 0) return null;
    const sorted = [...navHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function clearNavHistory() {
    navHistory = [];
    lastNavDuration = null;
    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem(NAV_HISTORY_KEY);
        } catch (e) {}
    }
    notifyListeners();
}

export function perfStamp(): string {
    const rel = typeof performance !== 'undefined' ? performance.now().toFixed(1) : '0.0';
    const wall = new Date().toISOString().slice(11, 23);
    return `+${rel}ms (${wall})`;
}

let telemetryInitialized = false;

export function initPerfTelemetry() {
    if (typeof window === 'undefined' || telemetryInitialized) return;
    telemetryInitialized = true;

    // 1. PerformanceObserver for longtask (>50ms) and long-animation-frame
    if (typeof PerformanceObserver !== 'undefined') {
        const supported = (PerformanceObserver as any).supportedEntryTypes || [];

        if (supported.includes('longtask')) {
            try {
                const ltObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries() as any[]) {
                        const startMs = entry.startTime ? entry.startTime.toFixed(1) : '0.0';
                        const durMs = entry.duration ? entry.duration.toFixed(1) : '0.0';
                        const wall = new Date().toISOString().slice(11, 23);
                        const attr = Array.isArray(entry.attribution)
                            ? entry.attribution
                                  .map((a: any) => `${a.name || 'unknown'}:${a.containerType || ''}${a.containerSrc ? `(${a.containerSrc})` : ''}`)
                                  .join(',')
                            : 'none';
                        console.log(
                            `[PERF][lag][longtask] +${startMs}ms (${wall}) duration=${durMs}ms name=${entry.name} attribution=${attr}`
                        );
                    }
                });
                ltObserver.observe({ type: 'longtask', buffered: true });
            } catch (e) {}
        }

        if (supported.includes('long-animation-frame')) {
            try {
                const loafObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries() as any[]) {
                        const startMs = entry.startTime ? entry.startTime.toFixed(1) : '0.0';
                        const durMs = entry.duration ? entry.duration.toFixed(1) : '0.0';
                        const blockMs = entry.blockingDuration ? entry.blockingDuration.toFixed(1) : '0.0';
                        const wall = new Date().toISOString().slice(11, 23);
                        const scripts = Array.isArray(entry.scripts)
                            ? entry.scripts
                                  .map((s: any) => {
                                      const src = s.sourceURL ? s.sourceURL.split('/').slice(-2).join('/') : 'inline';
                                      const fn = s.sourceFunctionName || s.invoker || 'anon';
                                      const sdur = s.duration ? Math.round(s.duration) : 0;
                                      return `${fn}@${src}(${sdur}ms)`;
                                  })
                                  .join(' | ')
                            : 'no-scripts';
                        console.log(
                            `[PERF][lag][long-animation-frame] +${startMs}ms (${wall}) duration=${durMs}ms blocking=${blockMs}ms scripts=${scripts}`
                        );
                    }
                });
                loafObserver.observe({ type: 'long-animation-frame', buffered: true });
            } catch (e) {}
        }
    }

    // 2. Temporary window.fetch wrapper for [PERF][net] telemetry
    if (typeof window.fetch === 'function' && !(window.fetch as any).__perfWrapped) {
        const origFetch = window.fetch.bind(window);

        const sanitizeUrl = (rawUrl: string): string => {
            try {
                const u = new URL(rawUrl, window.location.origin);
                const safeParams: string[] = [];
                const allowedKeys = ['uploadType', 'alt', 'fields', 'q', 'pageSize'];
                u.searchParams.forEach((val, key) => {
                    if (allowedKeys.includes(key)) {
                        safeParams.push(`${key}=${val.slice(0, 60)}`);
                    } else {
                        safeParams.push(`${key}=[REDACTED]`);
                    }
                });
                const qs = safeParams.length > 0 ? `?${safeParams.join('&')}` : '';
                return `${u.origin}${u.pathname}${qs}`;
            } catch {
                return rawUrl.split('?')[0];
            }
        };

        const getShortInitiator = (): string => {
            try {
                const stack = new Error().stack || '';
                const lines = stack
                    .split('\n')
                    .slice(2)
                    .map(l => l.trim())
                    .filter(l => !l.includes('perf-debug') && !l.includes('fetchWithTimeout'));
                return lines.slice(0, 2).join(' <- ') || 'unknown';
            } catch {
                return 'unknown';
            }
        };

        const wrappedFetch: typeof window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
            const cleanUrl = sanitizeUrl(rawUrl);
            const initiator = getShortInitiator();

            let reqBytes = 0;
            if (init?.body) {
                if (typeof init.body === 'string') reqBytes = init.body.length;
                else if (init.body instanceof Blob) reqBytes = init.body.size;
                else if (init.body instanceof ArrayBuffer) reqBytes = init.body.byteLength;
            }

            try {
                const response = await origFetch(input, init);
                const dur = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(1);
                const clHeader = response.headers?.get('content-length');
                let resBytes: string = clHeader ? `${clHeader}B` : 'unknown';

                if (!clHeader && response.clone) {
                    try {
                        const cloned = response.clone();
                        cloned.blob().then(b => {
                            console.log(
                                `[PERF][net][size-resolved] ${perfStamp()} ${method} ${cleanUrl} resSize=${b.size}B (${(b.size / 1024).toFixed(1)}KB)`
                            );
                        }).catch(() => {});
                    } catch {}
                }

                console.log(
                    `[PERF][net] ${perfStamp()} ${method} ${cleanUrl} status=${response.status} reqSize=${reqBytes}B resSize=${resBytes} duration=${dur}ms initiator=[${initiator}]`
                );
                return response;
            } catch (err: any) {
                const dur = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(1);
                console.log(
                    `[PERF][net] ${perfStamp()} ${method} ${cleanUrl} status=ERR(${err?.name || 'Error'}:${err?.message || String(err)}) reqSize=${reqBytes}B duration=${dur}ms initiator=[${initiator}]`
                );
                throw err;
            }
        };

        (wrappedFetch as any).__perfWrapped = true;
        window.fetch = wrappedFetch;
    }
}

// Auto-load saved flags and telemetry when module is loaded in browser
if (typeof window !== 'undefined') {
    loadPerfFlags();
    initPerfTelemetry();
}
