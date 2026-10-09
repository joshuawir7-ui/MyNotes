// Performance Debug & Measurement Utility for Paso 1

export interface PerfFlags {
    perfNoLayout: boolean;
    perfNoReveal: boolean;
    perfNoBackdrop: boolean;
    perfNoOrbs: boolean;
    perfNoMotion: boolean;
}

export interface StartupTimeline {
    scriptStart: number;
    hydrated: number | null;
    firstRender: number | null;
    stage1End: number | null;
    stage2End: number | null;
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
    perfNoMotion: false
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

// Auto-load saved flags when module is loaded in browser
if (typeof window !== 'undefined') {
    loadPerfFlags();
}
