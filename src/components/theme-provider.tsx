"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Remove strict type constraint to allow passing 'attribute' and other props
export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
