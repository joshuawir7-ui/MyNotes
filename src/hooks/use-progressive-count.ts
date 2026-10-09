"use client"

import { startTransition, useEffect, useRef, useState } from 'react';

const idle = (cb: () => void): number =>
    typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback(cb, { timeout: 250 })
        : (setTimeout(cb, 32) as unknown as number);

const cancelIdle = (id: number) =>
    typeof window !== 'undefined' && 'cancelIdleCallback' in window
        ? window.cancelIdleCallback(id)
        : clearTimeout(id);

export function useProgressiveCount(total: number, resetKey: string, initial = 8, step = 6) {
    const [count, setCount] = useState(() => Math.min(initial, total));
    const prevTotal = useRef(total);
    const prevKey = useRef(resetKey);

    useEffect(() => {
        const delta = total - prevTotal.current;
        if (prevKey.current !== resetKey || prevTotal.current === 0) {
            setCount(Math.min(initial, total)); // New set or initial load
        } else if (delta > 0 && delta <= 10) {
            setCount(total); // Manual creation: show immediately
        }
        prevKey.current = resetKey;
        prevTotal.current = total;
    }, [total, resetKey, initial]);

    useEffect(() => {
        if (count >= total) return;
        const id = idle(() => startTransition(() => setCount(c => Math.min(c + step, total))));
        return () => cancelIdle(id);
    }, [count, total, step]);

    return Math.min(count, total);
}
