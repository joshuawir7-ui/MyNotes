"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import { Capacitor } from "@capacitor/core"

export function GoogleGsiLoader() {
    const [shouldLoad, setShouldLoad] = useState(false)

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            setShouldLoad(true)
        }
    }, [])

    if (!shouldLoad) return null

    return (
        <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
        />
    )
}
