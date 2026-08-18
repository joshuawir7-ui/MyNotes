"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, RefreshCw, WifiOff } from "lucide-react"
import { useStore } from "@/lib/store"

// ─── helpers ────────────────────────────────────────────────────────────────

const FIRST_USE_KEY = "mynotes_first_use_date"
const PROMPT_COUNT_PREFIX = "mynotes_cloud_prompt_count_"
const PROMPT_LAST_SHOWN_KEY = "mynotes_cloud_prompt_last_shown"
const SESSION_EXPIRED_FIRST_KEY = "mynotes_session_expired_first_date"
const BANNER_DISMISSED_KEY = "mynotes_reconnect_banner_dismissed"
const BANNER_DAILY_COUNT_KEY = "mynotes_reconnect_banner_daily_count"
const BANNER_DAILY_DATE_KEY = "mynotes_reconnect_banner_daily_date"

function isBannerDismissedForever(): boolean {
    if (typeof window === "undefined") return false
    return localStorage.getItem(BANNER_DISMISSED_KEY) === "true"
}

function dismissBannerForever() {
    if (typeof window === "undefined") return
    localStorage.setItem(BANNER_DISMISSED_KEY, "true")
}

// Max 3 shows per day, shown randomly (~60% chance each time)
function shouldShowBannerToday(): boolean {
    if (typeof window === "undefined") return false
    if (isBannerDismissedForever()) return false

    const today = new Date().toISOString().split("T")[0]
    const storedDate = localStorage.getItem(BANNER_DAILY_DATE_KEY)

    // New day → reset counter
    if (storedDate !== today) {
        localStorage.setItem(BANNER_DAILY_DATE_KEY, today)
        localStorage.setItem(BANNER_DAILY_COUNT_KEY, "0")
    }

    const count = parseInt(localStorage.getItem(BANNER_DAILY_COUNT_KEY) || "0", 10)
    if (count >= 3) return false

    // Random gate — ~60% chance so it doesn't always appear
    if (Math.random() > 0.6) return false

    return true
}

function incrementBannerDailyCount() {
    if (typeof window === "undefined") return
    const current = parseInt(localStorage.getItem(BANNER_DAILY_COUNT_KEY) || "0", 10)
    localStorage.setItem(BANNER_DAILY_COUNT_KEY, String(current + 1))
}

function getMonthKey() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function daysBetween(a: Date, b: Date) {
    return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function initFirstUseDate() {
    if (typeof window === "undefined") return
    if (!localStorage.getItem(FIRST_USE_KEY)) {
        localStorage.setItem(FIRST_USE_KEY, new Date().toISOString())
    }
}

function getMonthlyPromptCount() {
    const key = PROMPT_COUNT_PREFIX + getMonthKey()
    return parseInt(localStorage.getItem(key) || "0", 10)
}

function incrementMonthlyPromptCount() {
    const key = PROMPT_COUNT_PREFIX + getMonthKey()
    const current = getMonthlyPromptCount()
    localStorage.setItem(key, String(current + 1))
}

function shouldShowConnectPrompt(): boolean {
    if (typeof window === "undefined") return false

    const firstUseStr = localStorage.getItem(FIRST_USE_KEY)
    if (!firstUseStr) return false

    const firstUse = new Date(firstUseStr)
    const now = new Date()

    // Must be at least 2 days since first use
    if (daysBetween(firstUse, now) < 2) return false

    // Max 3 times per month
    if (getMonthlyPromptCount() >= 3) return false

    // Don't show the same day if already shown today
    const lastShown = localStorage.getItem(PROMPT_LAST_SHOWN_KEY)
    if (lastShown) {
        const lastDate = new Date(lastShown)
        if (
            lastDate.getFullYear() === now.getFullYear() &&
            lastDate.getMonth() === now.getMonth() &&
            lastDate.getDate() === now.getDate()
        ) {
            return false
        }
    }

    return true
}

function initSessionExpiredDate() {
    if (typeof window === "undefined") return
    if (!localStorage.getItem(SESSION_EXPIRED_FIRST_KEY)) {
        localStorage.setItem(SESSION_EXPIRED_FIRST_KEY, new Date().toISOString())
    }
}

function clearSessionExpiredDate() {
    if (typeof window === "undefined") return
    localStorage.removeItem(SESSION_EXPIRED_FIRST_KEY)
}

function sessionExpiredDays(): number {
    const str = localStorage.getItem(SESSION_EXPIRED_FIRST_KEY)
    if (!str) return 0
    return daysBetween(new Date(str), new Date())
}

// ─── Google Drive SVG icon ────────────────────────────────────────────────────
function GoogleDriveIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
        </svg>
    )
}

// ─── MyNotes letter-n icon ────────────────────────────────────────────────────
function MyNotesIcon({ size = 40 }: { size?: number }) {
    return (
        <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-white rounded-2xl shadow-md border border-black/10"
        >
            <span
                style={{ fontSize: size * 0.55, lineHeight: 1 }}
                className="font-serif font-black text-black select-none"
            >
                n
            </span>
        </div>
    )
}

// ─── Connect to Cloud Modal (first time / never logged in) ────────────────────
function ConnectToCloudModal({ onClose, onLogin, language }: {
    onClose: () => void
    onLogin: () => void
    language: string
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="relative w-full max-w-[340px] rounded-[2.2rem] bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10 p-7 flex flex-col items-center text-center overflow-hidden"
        >
            {/* close */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>

            {/* icons row */}
            <div className="flex items-center justify-center gap-4 mb-5">
                <img src="/images/n-logo-new.png" alt="MyNotes Logo" className="w-[68px] h-[68px] object-contain" />
                <img src="/images/curved-arrow.png" alt="Sync" className="w-[55px] object-contain mx-2" />
                <img src="/images/drive-logo-new.png" alt="Google Drive Logo" className="w-[72px] h-[72px] object-contain" />
            </div>

            {/* title */}
            <h2 className="text-[32px] leading-none font-bold text-zinc-900 dark:text-white mb-3 font-dancing">
                {language === "es" ? "¡Conéctese a la nube!" : "Connect to the Cloud!"}
            </h2>

            {/* subtitle */}
            <p className="text-[13px] font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6 max-w-[280px]">
                {language === "es"
                    ? "tus datos tendrán un respaldo en la nube, dentro de tu Drive, solo inicia con tu cuenta de Google."
                    : "your data will be backed up in the cloud inside your Drive — just sign in with your Google account."}
            </p>

            {/* CTA button */}
            <button
                onClick={onLogin}
                className="w-[220px] py-2.5 rounded-md bg-black dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
            >
                {language === "es" ? "Iniciar sesión" : "Sign in"}
            </button>
        </motion.div>
    )
}

// ─── Reconnect Account Modal (session expired) ────────────────────────────────
function ReconnectModal({ onClose, onLogin, language }: {
    onClose: () => void
    onLogin: () => void
    language: string
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="relative w-full max-w-[320px] rounded-[2.2rem] bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10 p-7 flex flex-col items-center text-center overflow-hidden"
        >
            {/* close */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>

            {/* plug emoji / icon */}
            <div className="text-6xl mb-4 select-none" style={{ lineHeight: 1 }}>🔌</div>

            {/* title */}
            <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">
                {language === "es" ? "Reconecte su cuenta" : "Reconnect your account"}
            </h2>

            {/* description */}
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6 max-w-[260px]">
                {language === "es"
                    ? "Lleva ya un tiempo sin hacer un respaldo en la nube, recomendamos que conecte su cuenta Google para hacer un Backup de sus datos en su drive"
                    : "It has been a while since your last cloud backup. We recommend reconnecting your Google account to back up your data to Drive."}
            </p>

            {/* CTA button */}
            <button
                onClick={onLogin}
                className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:scale-[1.03] active:scale-[0.97] transition-all shadow-lg shadow-violet-500/30"
            >
                <RefreshCw className="w-4 h-4" />
                {language === "es" ? "Re-conectar cuenta" : "Reconnect account"}
            </button>
        </motion.div>
    )
}

// ─── Liquid Glass Top Banner (session expired) ────────────────────────────────
const BANNER_DURATION = 4 // seconds

function LiquidGlassBanner({ onClose, onDismissForever, onLogin, language }: {
    onClose: () => void
    onDismissForever: () => void
    onLogin: () => void
    language: string
}) {
    const [showDismissMenu, setShowDismissMenu] = useState(false)

    useEffect(() => {
        const timer = setTimeout(onClose, BANNER_DURATION * 1000)
        return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            transition={{ type: "spring", damping: 20, stiffness: 220 }}
            className="fixed top-3 left-1/2 z-[99998] -translate-x-1/2 w-[calc(100%-2rem)] max-w-md pointer-events-auto overflow-hidden"
            style={{
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(24px) saturate(180%) brightness(1.08)",
                WebkitBackdropFilter: "blur(24px) saturate(180%) brightness(1.08)",
                border: "1.5px solid rgba(255,255,255,0.35)",
                boxShadow: "0 8px 32px 0 rgba(120,80,255,0.10), 0 1.5px 0 0 rgba(255,255,255,0.5) inset",
                borderRadius: "1.25rem",
            }}
        >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
                {/* icon */}
                <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-amber-400/20 text-amber-500">
                    <WifiOff className="w-4 h-4" />
                </div>

                {/* text */}
                <p className="flex-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100 leading-snug">
                    {language === "es" ? "Debe reconectar su cuenta." : "You need to reconnect your account."}
                </p>

                {/* reconnect */}
                <button
                    onClick={onLogin}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-violet-600/90 hover:bg-violet-500 text-white text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                    {language === "es" ? "Reconectar" : "Reconnect"}
                </button>

                {/* dismiss menu trigger */}
                <div className="relative shrink-0">
                    <button
                        onClick={() => setShowDismissMenu(v => !v)}
                        className="p-1 rounded-full text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        title={language === "es" ? "Opciones" : "Options"}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>

                    <AnimatePresence>
                        {showDismissMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-1.5 z-10 min-w-[160px] rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 shadow-xl overflow-hidden"
                            >
                                <button
                                    onClick={onClose}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                >
                                    {language === "es" ? "Ocultar" : "Hide"}
                                </button>
                                <button
                                    onClick={onDismissForever}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                >
                                    {language === "es" ? "No mostrar más" : "Don't show again"}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    )
}

// ─── Backdrop ─────────────────────────────────────────────────────────────────
function Backdrop({ onClose }: { onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[99996]"
        />
    )
}

// ─── Main exported component ──────────────────────────────────────────────────
export function CloudPrompt() {
    const language = useStore((state) => state.language)
    const googleUser = useStore((state) => state.googleUser)
    const googleSessionExpired = useStore((state) => state.googleSessionExpired)

    const [mounted, setMounted] = useState(false)
    const [showConnectModal, setShowConnectModal] = useState(false)
    const [showReconnectModal, setShowReconnectModal] = useState(false)
    const [showBanner, setShowBanner] = useState(false)

    useEffect(() => {
        setMounted(true)
        initFirstUseDate()
    }, [])

    // ── Track session-expired start date ──────────────────────────────────────
    useEffect(() => {
        if (!mounted) return
        if (googleSessionExpired && googleUser) {
            initSessionExpiredDate()
        } else {
            clearSessionExpiredDate()
        }
    }, [googleSessionExpired, googleUser, mounted])

    // ── Show the banner whenever session is expired (unless dismissed forever) ──
    useEffect(() => {
        if (!mounted) return
        if (googleSessionExpired && googleUser && shouldShowBannerToday()) {
            incrementBannerDailyCount()
            setShowBanner(true)
        } else {
            setShowBanner(false)
        }
    }, [googleSessionExpired, googleUser, mounted])

    // ── Show "connect" or "reconnect" modal after delay ───────────────────────
    useEffect(() => {
        if (!mounted) return

        // Schedule check after a small delay so the app can finish rendering
        const timer = setTimeout(() => {
            if (!googleUser) {
                // Never logged in — show connect prompt
                if (shouldShowConnectPrompt()) {
                    setShowConnectModal(true)
                    localStorage.setItem(PROMPT_LAST_SHOWN_KEY, new Date().toISOString())
                    incrementMonthlyPromptCount()
                }
            } else if (googleSessionExpired) {
                // Logged in once, but session expired for ≥2 days
                if (sessionExpiredDays() >= 2) {
                    setShowReconnectModal(true)
                }
            }
        }, 4000) // 4s after layout mount — app already loaded

        return () => clearTimeout(timer)
    }, [mounted, googleUser, googleSessionExpired])

    const handleLogin = useCallback(() => {
        setShowConnectModal(false)
        setShowReconnectModal(false)
        setShowBanner(false)
        window.dispatchEvent(new CustomEvent("mynotes:open-settings-cloud"))
    }, [])

    const handleCloseBanner = useCallback(() => setShowBanner(false), [])
    const handleDismissBannerForever = useCallback(() => {
        dismissBannerForever()
        setShowBanner(false)
    }, [])
    const handleCloseConnect = useCallback(() => setShowConnectModal(false), [])
    const handleCloseReconnect = useCallback(() => setShowReconnectModal(false), [])

    if (!mounted) return null

    return createPortal(
        <>
            {/* ── Liquid Glass Top Banner ─────────────────────────────── */}
            <AnimatePresence>
                {showBanner && (
                    <LiquidGlassBanner
                        onClose={handleCloseBanner}
                        onDismissForever={handleDismissBannerForever}
                        onLogin={handleLogin}
                        language={language}
                    />
                )}
            </AnimatePresence>

            {/* ── Modal backdrop & card ───────────────────────────────── */}
            <AnimatePresence>
                {(showConnectModal || showReconnectModal) && (
                    <>
                        <Backdrop onClose={showConnectModal ? handleCloseConnect : handleCloseReconnect} />
                        <div className="fixed inset-0 z-[99997] flex items-center justify-center p-4 pointer-events-none">
                            <div className="pointer-events-auto w-full flex justify-center">
                                {showConnectModal && (
                                    <ConnectToCloudModal
                                        onClose={handleCloseConnect}
                                        onLogin={handleLogin}
                                        language={language}
                                    />
                                )}
                                {showReconnectModal && (
                                    <ReconnectModal
                                        onClose={handleCloseReconnect}
                                        onLogin={handleLogin}
                                        language={language}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </>,
        document.body
    )
}
