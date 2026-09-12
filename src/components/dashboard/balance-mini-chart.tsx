"use client"

import { useMemo, useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

export function BalanceMiniChart() {
    const rawTransactions = useStore(useShallow((s) => s.transactions ?? []))
    const transactions = useMemo(() => Array.isArray(rawTransactions) ? rawTransactions : [], [rawTransactions])
    const language = useStore((s) => s.language) || "es"
    const router = useRouter()

    const [mounted, setMounted] = useState(false)
    const [lineTimeRange, setLineTimeRange] = useState<"7d" | "30d" | "all">("all")
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    /* ─── Build full balance history matching /balance page algorithm ─── */
    const weeklyHistory = useMemo(() => {
        if (transactions.length === 0) {
            const todayStr = new Date().toISOString().split("T")[0]
            const parts = todayStr.split("-")
            const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : todayStr
            return [{ id: "empty", date: todayStr, label, balance: 0, delta: 0, isUp: true, desc: language === "es" ? "Sin datos" : "No data" }]
        }

        // Sort all transactions chronologically ascending
        const sortedTx = [...transactions].sort((a, b) => {
            const dateA = a.date || ""
            const dateB = b.date || ""
            if (dateA !== dateB) return dateA.localeCompare(dateB)
            return (a.lastUpdated || 0) - (b.lastUpdated || 0)
        })

        const todayVal = new Date()
        let startDateStr = sortedTx[0].date || todayVal.toISOString().split("T")[0]

        if (lineTimeRange === "7d") {
            const d7 = new Date(todayVal)
            d7.setDate(todayVal.getDate() - 6)
            startDateStr = d7.toISOString().split("T")[0]
        } else if (lineTimeRange === "30d") {
            const d30 = new Date(todayVal)
            d30.setDate(todayVal.getDate() - 29)
            startDateStr = d30.toISOString().split("T")[0]
        }

        // Initial balance before startDate
        let runningBalance = 0
        sortedTx.forEach((tx) => {
            if (tx.date && tx.date < startDateStr) {
                const amt = Number(tx.amount) || 0
                runningBalance += tx.type === "expense" ? -amt : amt
            }
        })

        const activeTxList = sortedTx.filter((tx) => !tx.date || tx.date >= startDateStr)
        const history: { id: string; date: string; label: string; balance: number; delta: number; isUp: boolean; desc: string }[] = []

        const dParts = startDateStr.split("-")
        const startLabel = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}` : startDateStr
        history.push({
            id: "start-point",
            date: startDateStr,
            label: startLabel,
            balance: runningBalance,
            delta: 0,
            isUp: true,
            desc: language === "es" ? "Balance inicial" : "Initial balance",
        })

        activeTxList.forEach((tx, idx) => {
            const amt = Number(tx.amount) || 0
            const delta = tx.type === "expense" ? -amt : amt
            runningBalance += delta
            const isUp = delta >= 0
            const txDateParts = (tx.date || "").split("-")
            const label = txDateParts.length === 3 ? `${txDateParts[2]}/${txDateParts[1]}` : tx.date || ""

            history.push({
                id: tx.id || `tx-${idx}`,
                date: tx.date || "",
                label,
                balance: runningBalance,
                delta,
                isUp,
                desc: tx.description || (tx.type === "income" ? (language === "es" ? "Ingreso" : "Income") : (language === "es" ? "Gasto" : "Expense")),
            })
        })

        return history
    }, [transactions, lineTimeRange, language])

    if (!mounted) {
        return <div className="w-full h-[220px] rounded-3xl animate-pulse bg-zinc-300/10 dark:bg-zinc-800/20" />
    }

    if (transactions.length === 0) {
        return (
            <div
                onClick={() => router.push("/balance")}
                className="w-full h-[180px] glass-panel rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/10 transition-all border border-white/5 group"
            >
                <span className="text-3xl">💰</span>
                <span className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                    {language === "es" ? "Sin movimientos aún — Toca para ir a Balance" : "No transactions yet — Tap to open Balance"}
                </span>
            </div>
        )
    }

    /* ─── SVG Math & Layout parameters ─── */
    const balances = weeklyHistory.map((h) => h.balance)
    const rawMax = Math.max(...balances)
    const rawMin = Math.min(...balances)

    const dataMid = (rawMax + rawMin) / 2
    const halfSpan = Math.max((rawMax - rawMin) * 0.55, 1)
    const maxB = dataMid + halfSpan
    const minB = dataMid - halfSpan
    const range = maxB - minB

    const svgW = 540
    const svgH = 200
    const padL = 40
    const padR = 40
    const padTop = 36
    const padBot = 36
    const chartW = svgW - padL - padR
    const chartH = svgH - padTop - padBot
    const n = weeklyHistory.length

    const points = weeklyHistory.map((pt, idx) => {
        const x = padL + (n <= 1 ? chartW / 2 : (idx / (n - 1)) * chartW)
        const norm = Math.min(Math.max((pt.balance - minB) / range, 0), 1)
        const y = padTop + chartH - norm * chartH
        return { x, y, label: pt.label, val: pt.balance, date: pt.date, delta: pt.delta, isUp: pt.isUp, desc: pt.desc, idx, id: pt.id }
    })

    const maxLabels = 7
    const step = n <= maxLabels ? 1 : Math.ceil((n - 1) / (maxLabels - 1))
    const visibleIndices = new Set<number>()
    for (let i = 0; i < n; i += step) visibleIndices.add(i)
    visibleIndices.add(n - 1)

    const activeHoverPoint = hoveredIndex !== null ? points[hoveredIndex] : null

    return (
        <div className="w-full glass-panel rounded-3xl p-4 border border-black/5 dark:border-white/10 shadow-lg select-none relative overflow-hidden">
            {/* Header Filter Selector */}
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/10 text-[11px] font-bold">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            setLineTimeRange("7d")
                        }}
                        className={`px-3 py-0.5 rounded-xl transition-all ${
                            lineTimeRange === "7d"
                                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm font-black"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {language === "es" ? "7 Días" : "7 Days"}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            setLineTimeRange("30d")
                        }}
                        className={`px-3 py-0.5 rounded-xl transition-all ${
                            lineTimeRange === "30d"
                                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm font-black"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {language === "es" ? "30 Días" : "30 Days"}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            setLineTimeRange("all")
                        }}
                        className={`px-3 py-0.5 rounded-xl transition-all ${
                            lineTimeRange === "all"
                                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm font-black"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {language === "es" ? "Todo" : "All"}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => router.push("/balance")}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                    {language === "es" ? "Detalles ➔" : "Details ➔"}
                </button>
            </div>

            {/* SVG Container */}
            <div className="relative w-full">
                <svg
                    className="w-full h-auto overflow-visible"
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    style={{ shapeRendering: "geometricPrecision", textRendering: "geometricPrecision" }}
                >
                    <defs>
                        {/* Green glow filter */}
                        <filter id="miniGlowGreen" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#10b981" floodOpacity="0.5" />
                        </filter>
                        {/* Red glow filter */}
                        <filter id="miniGlowRed" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.5" />
                        </filter>
                        {/* Green area gradient */}
                        <linearGradient id="miniAreaGreen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        {/* Red area gradient */}
                        <linearGradient id="miniAreaRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* Background Grid Lines */}
                    {[0.2, 0.5, 0.8].map((f) => (
                        <line
                            key={f}
                            x1={padL}
                            y1={padTop + chartH * (1 - f)}
                            x2={svgW - padR}
                            y2={padTop + chartH * (1 - f)}
                            stroke="currentColor"
                            className="text-zinc-200 dark:text-zinc-800"
                            strokeWidth="1"
                            strokeDasharray="4,4"
                        />
                    ))}

                    {/* Line Segments (Green up, Red down) */}
                    {points.slice(1).map((pt, i) => {
                        const prevPt = points[i]
                        const isUp = pt.isUp
                        const strokeColor = isUp ? "#10b981" : "#ef4444"
                        const filterId = isUp ? "url(#miniGlowGreen)" : "url(#miniGlowRed)"

                        const p0 = points[Math.max(0, i - 1)]
                        const p1 = prevPt
                        const p2 = pt
                        const p3 = points[Math.min(points.length - 1, i + 2)]

                        const cp1x = p1.x + (p2.x - p0.x) / 5
                        const cp1y = p1.y + (p2.y - p0.y) / 5
                        const cp2x = p2.x - (p3.x - p1.x) / 5
                        const cp2y = p2.y - (p3.y - p1.y) / 5

                        const d = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
                        const segAreaPath = `${d} L ${p2.x.toFixed(1)} ${(svgH - padBot).toFixed(1)} L ${p1.x.toFixed(1)} ${(svgH - padBot).toFixed(1)} Z`
                        const areaGrad = isUp ? "url(#miniAreaGreen)" : "url(#miniAreaRed)"

                        return (
                            <g key={`segment-${pt.id}-${i}`}>
                                <path d={segAreaPath} fill={areaGrad} />
                                <path
                                    d={d}
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    filter={filterId}
                                />
                            </g>
                        )
                    })}

                    {/* Node Dots & Badges */}
                    {points.map((pt) => {
                        const isVisible = visibleIndices.has(pt.idx)
                        const isLatest = pt.idx === points.length - 1
                        const isHovered = hoveredIndex === pt.idx
                        const isUp = pt.isUp

                        const valStr = pt.val % 1 === 0 ? pt.val.toLocaleString() : pt.val.toFixed(1)
                        const textWidth = Math.max(valStr.length * 6.5 + 10, 24)

                        const mainColor = isUp ? "#10b981" : "#ef4444"
                        const badgeBg = isUp ? "#064e3b" : "#4c0519"
                        const badgeText = isUp ? "#34d399" : "#fb7185"

                        return (
                            <g
                                key={`node-${pt.id}-${pt.idx}`}
                                className="cursor-pointer group"
                                onMouseEnter={() => setHoveredIndex(pt.idx)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    router.push("/balance")
                                }}
                            >
                                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

                                {isLatest && (
                                    <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r="9"
                                        fill={mainColor}
                                        opacity="0.35"
                                        className="animate-ping"
                                    />
                                )}

                                <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={isHovered ? 6.5 : 4.5}
                                    fill={mainColor}
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    className="transition-all duration-200"
                                />

                                {(isVisible || isHovered) && (
                                    <g transform={`translate(${pt.x}, ${pt.y - 13})`} className="pointer-events-none">
                                        <rect
                                            x={-textWidth / 2}
                                            y="-11"
                                            width={textWidth}
                                            height="15"
                                            rx="7.5"
                                            fill={badgeBg}
                                            stroke={mainColor}
                                            strokeWidth="1"
                                            className="shadow-md"
                                            opacity={isHovered ? "1" : "0.95"}
                                        />
                                        <text
                                            x="0"
                                            y="-0.5"
                                            textAnchor="middle"
                                            fontSize="8.5"
                                            fontWeight="800"
                                            fill={badgeText}
                                        >
                                            {valStr}$
                                        </text>
                                    </g>
                                )}

                                {isVisible && (
                                    <text
                                        x={pt.x}
                                        y={svgH - 8}
                                        textAnchor="middle"
                                        fontSize="9"
                                        fontWeight="700"
                                        className="fill-zinc-600 dark:fill-zinc-400 font-sans"
                                    >
                                        {pt.label}
                                    </text>
                                )}
                            </g>
                        )
                    })}
                </svg>

                {/* Floating Tooltip Card on Hover */}
                <AnimatePresence>
                    {activeHoverPoint && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl border border-zinc-800 dark:border-zinc-200 pointer-events-none z-20 whitespace-nowrap flex items-center gap-1.5"
                        >
                            <span className="opacity-70">{activeHoverPoint.desc} ({activeHoverPoint.date}):</span>
                            <span className={`font-black ${activeHoverPoint.isUp ? "text-emerald-400 dark:text-emerald-600" : "text-rose-400 dark:text-rose-600"}`}>
                                {activeHoverPoint.delta >= 0 ? `+${activeHoverPoint.delta}$` : `${activeHoverPoint.delta}$`}
                            </span>
                            <span className="opacity-50">|</span>
                            <span className="opacity-80">Bal: ${activeHoverPoint.val.toLocaleString()}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
