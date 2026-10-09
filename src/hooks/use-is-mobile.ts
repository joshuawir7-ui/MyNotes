"use client"

import { useSyncExternalStore } from "react"

const MOBILE_MEDIA_QUERY = "(max-width: 767px)"

function subscribe(callback: () => void) {
    if (typeof window === "undefined") return () => {}
    const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY)
    mediaQueryList.addEventListener("change", callback)
    return () => {
        mediaQueryList.removeEventListener("change", callback)
    }
}

function getSnapshot(): boolean {
    if (typeof window === "undefined") return false
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function getServerSnapshot(): boolean {
    return false
}

export function useIsMobile(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
