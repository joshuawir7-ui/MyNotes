"use client"

import { useEffect } from "react"
import { useStore } from "@/lib/store"
import { usePathname } from "next/navigation"

export function KeyboardShortcuts() {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if not in an input/textarea
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable
            ) {
                return
            }

            const key = parseInt(e.key)
            if (isNaN(key) || key < 1 || key > 9) return

            // Logic to find task using latest store state without subscribing to changes
            const { tasks, toggleTask } = useStore.getState()
            const today = new Date().toISOString().split('T')[0]
            const todaysTasks = tasks.filter(t => {
                const isRecurring = t.recurrence !== 'None'
                if (!isRecurring) return !t.completed || (t.completed && (t.completedDates?.includes(today) ?? false))
                return true
            })

            // Find by assigned key first
            let taskToToggle = tasks.find(t => t.shortcutKey === key)

            // If not found by assigned key, check if it's an auto-shortcut
            if (!taskToToggle) {
                taskToToggle = todaysTasks.find((t, idx) => {
                    // Only match if this task doesn't have a DIFFERENT manual shortcut assigned
                    // and its position matches the key
                    return !t.shortcutKey && (idx + 1) === key
                })
            }

            if (taskToToggle) {
                e.preventDefault()
                toggleTask(taskToToggle.id)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    return null // Pure logic component
}
