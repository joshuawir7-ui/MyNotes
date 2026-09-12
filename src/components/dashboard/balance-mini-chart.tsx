"use client"

import { useMemo, useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { useRouter } from "next/navigation"
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
    Dot,
} from "recharts"

/* ─── Custom Tooltip ──────────────────────────────────────────────────────── */
const BalanceTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const isPos = d.balance >= 0
    return (
        <div className="bg-white/80 dark:bg-zinc-900/90 backdrop-blur-md border border-black/5 dark:border-white/10 px-3 py-2 rounded-xl shadow-xl text-left">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">{d.label}</p>
            <p className={`text-sm font-black ${isPos ? "text-emerald-500" : "text-rose-500"}`}>
                {isPos ? "+" : ""}
                {Number(d.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>
    )
}

/* ─── Custom Dot ──────────────────────────────────────────────────────────── */
const BalanceDot = (props: any) => {
    const { cx, cy, payload } = props
    if (cx === undefined || cy === undefined) return null
    const isPos = payload.balance >= 0
    const color = isPos ? "#10b981" : "#f43f5e"
    return (
        <circle
            cx={cx}
            cy={cy}
            r={3.5}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
        />
    )
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export function BalanceMiniChart() {
    const transactions = useStore(useShallow((s) => s.transactions ?? []))
    const language = useStore((s) => s.language)
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    /* Build daily balance data (last 30 days) */
    const chartData = useMemo(() => {
        if (!transactions.length) return []

        // Sort transactions ascending by date
        const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

        // Build a map: date → net daily change
        const dailyNet: Record<string, number> = {}
        for (const tx of sorted) {
            const amt = Number(tx.amount) || 0
            const delta = tx.type === "income" ? amt : -amt
            dailyNet[tx.date] = (dailyNet[tx.date] || 0) + delta
        }

        // Generate all dates between first tx and today
        const firstDate = new Date(sorted[0].date + "T00:00:00")
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const points: { label: string; balance: number; date: string }[] = []
        let running = 0
        const cur = new Date(firstDate)

        while (cur <= today) {
            const key = cur.toISOString().split("T")[0]
            running += dailyNet[key] || 0
            const day = cur.getDate()
            const monthShort = cur.toLocaleDateString(language === "es" ? "es-ES" : "en-US", { month: "short" })
            points.push({ label: `${day} ${monthShort}`, balance: running, date: key })
            cur.setDate(cur.getDate() + 1)
        }

        // Keep last 30 points max for readability
        return points.slice(-30)
    }, [transactions, language])

    const currentBalance = chartData.length ? chartData[chartData.length - 1].balance : 0
    const isPositive = currentBalance >= 0

    if (!mounted) {
        return <div className="w-full h-[140px] rounded-2xl animate-pulse bg-zinc-300/10 dark:bg-zinc-800/20" />
    }

    if (!chartData.length) {
        return (
            <div
                onClick={() => router.push("/balance")}
                className="w-full h-[140px] glass-panel rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/10 transition-all border border-white/5 group"
            >
                <span className="text-2xl">💰</span>
                <span className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                    {language === "es" ? "Sin movimientos aún" : "No transactions yet"}
                </span>
            </div>
        )
    }

    /* Determine stroke color dynamically — positive=green, negative=red */
    const lineColor = isPositive ? "#10b981" : "#f43f5e"
    const glowColor = isPositive ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)"

    return (
        <div
            onClick={() => router.push("/balance")}
            className="w-full h-[140px] glass-panel rounded-2xl relative overflow-hidden cursor-pointer group border border-white/5 hover:border-white/10 transition-all"
        >
            {/* Background glow */}
            <div
                className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl transition-all duration-500 pointer-events-none"
                style={{ background: glowColor }}
            />

            {/* Balance badge */}
            <div className="absolute top-3 left-4 z-10 flex flex-col">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
                    {language === "es" ? "Balance" : "Balance"}
                </span>
                <span className={`text-sm font-black leading-tight ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                    {isPositive ? "+" : ""}
                    {Number(currentBalance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>

            {/* Chart */}
            <div className="absolute inset-0 pt-8 pb-1">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                        <defs>
                            <linearGradient id="balGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={lineColor} stopOpacity={0.6} />
                                <stop offset="50%" stopColor={lineColor} stopOpacity={1} />
                                <stop offset="100%" stopColor={lineColor} stopOpacity={0.6} />
                            </linearGradient>
                        </defs>

                        <YAxis domain={["auto", "auto"]} hide />
                        <XAxis dataKey="label" hide />

                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3 3" />

                        <Tooltip
                            content={<BalanceTooltip />}
                            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
                        />

                        <Line
                            type="monotone"
                            dataKey="balance"
                            stroke="url(#balGrad)"
                            strokeWidth={2.5}
                            dot={<BalanceDot />}
                            activeDot={{ r: 5, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
                            animationDuration={1200}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
