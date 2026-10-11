// interaction-gate.ts
let last = 0;
const mark = () => { last = performance.now(); };

if (typeof window !== 'undefined') {
    ['touchstart','touchmove','scroll','pointerdown','keydown'].forEach(ev =>
        window.addEventListener(ev, mark, { passive: true, capture: true }));
}

export const isIdle = (ms = 800) => performance.now() - last > ms;

export function whenIdle(fn: () => void, ms = 800) {
    const tick = () => (isIdle(ms) ? fn() : setTimeout(tick, 250));
    tick();
}
