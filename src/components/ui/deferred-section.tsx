"use client"

import { ReactNode, useEffect, useState } from "react"

interface DeferredSectionProps {
    children: ReactNode
    order?: number
    minHeight?: number | string
    className?: string
}

// Queue of pending mount callbacks sorted by order priority
let mountQueue: { id: number; order: number; callback: () => void }[] = []
let isProcessingQueue = false
let nextId = 1

function processQueue() {
    if (mountQueue.length === 0) {
        isProcessingQueue = false
        return
    }

    isProcessingQueue = true

    // Sort by order ASC (lower order mounts first)
    mountQueue.sort((a, b) => a.order - b.order)

    const nextItem = mountQueue.shift()

    const run = () => {
        if (nextItem) {
            nextItem.callback()
        }
        // Yield before processing next section
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            window.requestIdleCallback(() => processQueue(), { timeout: 150 })
        } else {
            setTimeout(processQueue, 32)
        }
    }

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(run, { timeout: 150 })
    } else {
        setTimeout(run, 32)
    }
}

function enqueueMount(order: number, callback: () => void): number {
    const id = nextId++
    mountQueue.push({ id, order, callback })
    if (!isProcessingQueue) {
        processQueue()
    }
    return id
}

function cancelMount(id: number) {
    mountQueue = mountQueue.filter(item => item.id !== id)
}

export function DeferredSection({
    children,
    order = 1,
    minHeight = 160,
    className = ""
}: DeferredSectionProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        const id = enqueueMount(order, () => {
            setIsMounted(true)
        })
        return () => {
            cancelMount(id)
        }
    }, [order])

    if (!isMounted) {
        return (
            <div
                style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }}
                className={`w-full rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 ${className}`}
            />
        )
    }

    return <>{children}</>
}
