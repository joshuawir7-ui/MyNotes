import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

export function ModeToggle() {
    const { setTheme, theme } = useTheme()

    // Prevent hydration mismatch by mounting only on client
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true), [])

    if (!mounted) return null

    const cycleTheme = () => {
        if (theme === 'light') setTheme('dark')
        else if (theme === 'dark') setTheme('system')
        else setTheme('light')
    }

    return (
        <button
            onClick={cycleTheme}
            className="relative p-2 rounded-xl hover:bg-white/10 transition-colors border border-white/5 active:scale-95 overflow-hidden flex items-center justify-center w-10 h-10"
            aria-label="Toggle theme"
        >
            <AnimatePresence mode="wait" initial={false}>
                {theme === 'dark' ? (
                    <motion.div
                        key="moon"
                        initial={{ y: 20, rotate: 45, opacity: 0 }}
                        animate={{ y: 0, rotate: 0, opacity: 1 }}
                        exit={{ y: -20, rotate: -45, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "backOut" }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Moon className="h-5 w-5 transition-all text-blue-400" />
                    </motion.div>
                ) : theme === 'system' ? (
                    <motion.div
                        key="system"
                        initial={{ y: 20, rotate: 45, opacity: 0 }}
                        animate={{ y: 0, rotate: 0, opacity: 1 }}
                        exit={{ y: -20, rotate: -45, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "backOut" }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Monitor className="h-5 w-5 transition-all text-gray-400" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ y: 20, rotate: -45, opacity: 0 }}
                        animate={{ y: 0, rotate: 0, opacity: 1 }}
                        exit={{ y: -20, rotate: 45, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "backOut" }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Sun className="h-5 w-5 transition-all text-orange-400" />
                    </motion.div>
                )}
            </AnimatePresence>
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}

