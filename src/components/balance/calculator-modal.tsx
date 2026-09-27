"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, History, Trash2, Check, ArrowRight, Delete } from "lucide-react"

interface CalculatorModalProps {
    isOpen: boolean
    onClose: () => void
    onApplyAmount?: (amount: string) => void
    language?: string
}

interface HistoryItem {
    id: string
    expression: string
    result: string
    timestamp: string
}

export function CalculatorModal({ isOpen, onClose, onApplyAmount, language = "es" }: CalculatorModalProps) {
    const [displayValue, setDisplayValue] = useState<string>("0")
    const [prevValue, setPrevValue] = useState<number | null>(null)
    const [operator, setOperator] = useState<"+" | "-" | "*" | "/" | null>(null)
    const [equationStr, setEquationStr] = useState<string>("")
    const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false)
    const [showHistory, setShowHistory] = useState<boolean>(false)
    const [copied, setCopied] = useState<boolean>(false)
    const [history, setHistory] = useState<HistoryItem[]>([])

    // Load history from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("mynotes_calc_history")
            if (saved) {
                setHistory(JSON.parse(saved))
            }
        } catch (e) {
            console.error("Error loading calculator history", e)
        }
    }, [])

    // Save history to localStorage
    const saveHistory = (newHistory: HistoryItem[]) => {
        setHistory(newHistory)
        try {
            localStorage.setItem("mynotes_calc_history", JSON.stringify(newHistory))
        } catch (e) {
            console.error("Error saving calculator history", e)
        }
    }

    const clearHistory = () => {
        saveHistory([])
    }

    const formatNumber = (val: string) => {
        if (!val || val === "Error" || val === "NaN" || val === "Infinity") return val
        const parts = val.split(".")
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart
    }

    const handleDigit = (digit: string) => {
        if (waitingForOperand) {
            setDisplayValue(digit)
            setWaitingForOperand(false)
        } else {
            if (displayValue === "0") {
                setDisplayValue(digit)
            } else if (displayValue.replace(/[^0-9]/g, "").length < 14) {
                setDisplayValue(displayValue + digit)
            }
        }
    }

    const handleDecimal = () => {
        if (waitingForOperand) {
            setDisplayValue("0.")
            setWaitingForOperand(false)
        } else if (!displayValue.includes(".")) {
            setDisplayValue(displayValue + ".")
        }
    }

    const handleClear = () => {
        setDisplayValue("0")
        setPrevValue(null)
        setOperator(null)
        setEquationStr("")
        setWaitingForOperand(false)
    }

    const handleToggleSign = () => {
        if (displayValue === "0" || displayValue === "Error") return
        if (displayValue.startsWith("-")) {
            setDisplayValue(displayValue.slice(1))
        } else {
            setDisplayValue("-" + displayValue)
        }
    }

    const handlePercentage = () => {
        const num = parseFloat(displayValue)
        if (isNaN(num)) return
        const res = (num / 100).toString()
        setDisplayValue(res)
    }

    const handleBackspace = () => {
        if (waitingForOperand) return
        if (displayValue.length <= 1 || (displayValue.length === 2 && displayValue.startsWith("-"))) {
            setDisplayValue("0")
        } else {
            setDisplayValue(displayValue.slice(0, -1))
        }
    }

    const getOpSymbol = (op: "+" | "-" | "*" | "/" | null) => {
        switch (op) {
            case "+": return "+"
            case "-": return "−"
            case "*": return "×"
            case "/": return "÷"
            default: return ""
        }
    }

    const calculate = (a: number, b: number, op: "+" | "-" | "*" | "/"): number => {
        switch (op) {
            case "+": return a + b
            case "-": return a - b
            case "*": return a * b
            case "/": return b !== 0 ? a / b : NaN
            default: return b
        }
    }

    const handleOperator = (nextOperator: "+" | "-" | "*" | "/") => {
        const inputNum = parseFloat(displayValue)

        if (isNaN(inputNum)) return

        if (prevValue === null) {
            setPrevValue(inputNum)
            setEquationStr(`${formatNumber(displayValue)} ${getOpSymbol(nextOperator)}`)
        } else if (operator && !waitingForOperand) {
            const result = calculate(prevValue, inputNum, operator)
            if (isNaN(result)) {
                setDisplayValue("Error")
                setPrevValue(null)
                setOperator(null)
                setEquationStr("")
                return
            }
            const cleanResult = Number(result.toFixed(8)).toString()
            setDisplayValue(cleanResult)
            setPrevValue(result)
            setEquationStr(`${formatNumber(cleanResult)} ${getOpSymbol(nextOperator)}`)
        } else {
            setEquationStr(`${formatNumber(prevValue.toString())} ${getOpSymbol(nextOperator)}`)
        }

        setWaitingForOperand(true)
        setOperator(nextOperator)
    }

    const handleEquals = () => {
        if (operator === null || prevValue === null) return

        const inputNum = parseFloat(displayValue)
        if (isNaN(inputNum)) return

        const result = calculate(prevValue, inputNum, operator)
        if (isNaN(result)) {
            setDisplayValue("Error")
            setPrevValue(null)
            setOperator(null)
            setEquationStr("")
            return
        }

        const cleanResult = Number(result.toFixed(8)).toString()
        const fullExpr = `${formatNumber(prevValue.toString())} ${getOpSymbol(operator)} ${formatNumber(displayValue)}`

        // Add to history
        const now = new Date()
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            expression: fullExpr,
            result: cleanResult,
            timestamp: timeStr
        }

        saveHistory([newItem, ...history])

        setEquationStr(`${fullExpr} =`)
        setDisplayValue(cleanResult)
        setPrevValue(null)
        setOperator(null)
        setWaitingForOperand(true)
    }

    const handleApply = () => {
        if (onApplyAmount && displayValue !== "Error") {
            onApplyAmount(displayValue)
            setCopied(true)
            setTimeout(() => {
                setCopied(false)
                onClose()
            }, 500)
        }
    }

    const handleSelectHistoryItem = (item: HistoryItem) => {
        setDisplayValue(item.result)
        setEquationStr(item.expression)
        setWaitingForOperand(true)
    }

    // Keyboard support
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key >= "0" && e.key <= "9") {
                handleDigit(e.key)
            } else if (e.key === "." || e.key === ",") {
                handleDecimal()
            } else if (e.key === "+") {
                handleOperator("+")
            } else if (e.key === "-") {
                handleOperator("-")
            } else if (e.key === "*") {
                handleOperator("*")
            } else if (e.key === "/") {
                e.preventDefault()
                handleOperator("/")
            } else if (e.key === "Enter" || e.key === "=") {
                e.preventDefault()
                handleEquals()
            } else if (e.key === "Backspace") {
                handleBackspace()
            } else if (e.key === "Escape") {
                handleClear()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, displayValue, prevValue, operator, waitingForOperand])

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 25 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 25 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="w-full max-w-[340px] sm:max-w-[370px] bg-white/75 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] rounded-[38px] p-5 relative overflow-hidden select-none flex flex-col gap-4 text-foreground"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header Bar (History toggle on left, Close button on right) */}
                    <div className="flex items-center justify-between px-1 pt-1">
                        <button
                            type="button"
                            onClick={() => setShowHistory(!showHistory)}
                            className={`p-2 rounded-2xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                                showHistory
                                    ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-md"
                                    : "bg-black/5 dark:bg-white/10 text-muted-foreground hover:text-foreground"
                            }`}
                            title={language === "es" ? "Historial de operaciones" : "History"}
                        >
                            <History className="w-4 h-4" />
                            {history.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-black/20 text-[10px] font-black leading-none">
                                    {history.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-muted-foreground hover:text-foreground rounded-2xl transition-all active:scale-95"
                        >
                            <X className="w-4.5 h-4.5" />
                        </button>
                    </div>

                    {/* Collapsible History Drawer */}
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-black/5 dark:bg-white/5 rounded-3xl p-3 border border-black/5 dark:border-white/10 overflow-hidden flex flex-col max-h-[220px]"
                            >
                                <div className="flex items-center justify-between pb-2 mb-1 border-b border-black/5 dark:border-white/10 px-1">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                        {language === "es" ? "Historial de operaciones" : "Calculation History"}
                                    </span>
                                    {history.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={clearHistory}
                                            className="text-rose-500 hover:text-rose-600 p-1 hover:bg-rose-500/10 rounded-lg transition-colors text-xs flex items-center gap-1 font-bold"
                                            title={language === "es" ? "Borrar historial" : "Clear history"}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            {language === "es" ? "Borrar" : "Clear"}
                                        </button>
                                    )}
                                </div>

                                <div className="overflow-y-auto space-y-1.5 pr-1 custom-scrollbar max-h-[160px]">
                                    {history.length === 0 ? (
                                        <div className="py-6 text-center text-xs text-muted-foreground">
                                            {language === "es" ? "Aún no hay cálculos guardados" : "No calculation history yet"}
                                        </div>
                                    ) : (
                                        history.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelectHistoryItem(item)}
                                                className="p-2.5 rounded-2xl bg-white/70 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-800 border border-black/5 dark:border-white/5 cursor-pointer transition-all flex justify-between items-center group active:scale-[0.98]"
                                            >
                                                <div className="flex flex-col min-w-0 pr-2">
                                                    <span className="text-[10px] font-medium text-muted-foreground truncate">
                                                        {item.expression}
                                                    </span>
                                                    <span className="text-sm font-extrabold text-foreground tracking-tight">
                                                        = {formatNumber(item.result)}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-muted-foreground/60 shrink-0 font-medium">
                                                    {item.timestamp}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Translucent Display Container */}
                    <div className="bg-white/80 dark:bg-zinc-950/70 border border-white/60 dark:border-zinc-800/80 rounded-3xl p-4 shadow-inner flex flex-col justify-between min-h-[105px] text-right transition-all relative overflow-hidden">
                        {/* Upper expression line */}
                        <div className="text-xs sm:text-sm font-medium text-zinc-400 dark:text-zinc-500 h-5 flex items-center justify-end overflow-hidden truncate">
                            {equationStr}
                        </div>

                        {/* Main large result line */}
                        <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight overflow-x-auto custom-scrollbar leading-none py-1">
                            {formatNumber(displayValue)}
                        </div>

                        {/* Apply result to Balance button */}
                        {onApplyAmount && (
                            <div className="flex justify-between items-center pt-2 mt-1 border-t border-black/5 dark:border-white/5">
                                <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                                    {language === "es" ? "Resultado" : "Result"}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                                        copied
                                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                            : "bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 shadow-sm"
                                    }`}
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            {language === "es" ? "¡Aplicado!" : "Applied!"}
                                        </>
                                    ) : (
                                        <>
                                            {language === "es" ? "Usar en Balance" : "Use in Balance"}
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Keypad Grid (4 Columns x 5 Rows) */}
                    <div className="grid grid-cols-4 gap-2.5 pt-1">
                        {/* Row 1: C, ±, %, ÷ */}
                        <button
                            type="button"
                            onClick={handleClear}
                            className="h-12 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-foreground font-extrabold text-sm transition-all active:scale-95 shadow-sm"
                        >
                            C
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleSign}
                            className="h-12 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-foreground font-extrabold text-sm transition-all active:scale-95 shadow-sm"
                        >
                            ±
                        </button>
                        <button
                            type="button"
                            onClick={handlePercentage}
                            className="h-12 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-foreground font-extrabold text-sm transition-all active:scale-95 shadow-sm"
                        >
                            %
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOperator("/")}
                            className={`h-12 rounded-2xl font-black text-xl transition-all active:scale-95 shadow-md flex items-center justify-center ${
                                operator === "/" && waitingForOperand
                                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-950 ring-2 ring-zinc-950 dark:ring-white"
                                    : "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-zinc-950/20"
                            }`}
                        >
                            ÷
                        </button>

                        {/* Row 2: 7, 8, 9, × */}
                        <button
                            type="button"
                            onClick={() => handleDigit("7")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            7
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDigit("8")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            8
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDigit("9")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            9
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOperator("*")}
                            className={`h-12 rounded-2xl font-black text-xl transition-all active:scale-95 shadow-md flex items-center justify-center ${
                                operator === "*" && waitingForOperand
                                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-950 ring-2 ring-zinc-950 dark:ring-white"
                                    : "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-zinc-950/20"
                            }`}
                        >
                            ×
                        </button>

                        {/* Row 3: 4, 5, 6, − */}
                        <button
                            type="button"
                            onClick={() => handleDigit("4")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            4
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDigit("5")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            5
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDigit("6")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            6
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOperator("-")}
                            className={`h-12 rounded-2xl font-black text-xl transition-all active:scale-95 shadow-md flex items-center justify-center ${
                                operator === "-" && waitingForOperand
                                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-950 ring-2 ring-zinc-950 dark:ring-white"
                                    : "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-zinc-950/20"
                            }`}
                        >
                            −
                        </button>

                        {/* Row 4: 1, 2, 3, + */}
                        <button
                            type="button"
                            onClick={() => handleDigit("1")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            1
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDigit("2")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            2
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDigit("3")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            3
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOperator("+")}
                            className={`h-12 rounded-2xl font-black text-xl transition-all active:scale-95 shadow-md flex items-center justify-center ${
                                operator === "+" && waitingForOperand
                                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-950 ring-2 ring-zinc-950 dark:ring-white"
                                    : "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-zinc-950/20"
                            }`}
                        >
                            +
                        </button>

                        {/* Row 5: 0, ., ⌫, = */}
                        <button
                            type="button"
                            onClick={() => handleDigit("0")}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            0
                        </button>
                        <button
                            type="button"
                            onClick={handleDecimal}
                            className="h-12 rounded-2xl bg-white/90 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-750 text-foreground font-extrabold text-lg transition-all active:scale-95 shadow-sm border border-black/5 dark:border-white/5"
                        >
                            .
                        </button>
                        <button
                            type="button"
                            onClick={handleBackspace}
                            className="h-12 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-foreground font-extrabold text-sm transition-all active:scale-95 shadow-sm flex items-center justify-center"
                            title={language === "es" ? "Borrar último número" : "Backspace"}
                        >
                            <Delete className="w-5 h-5 text-muted-foreground" />
                        </button>
                        <button
                            type="button"
                            onClick={handleEquals}
                            className="h-12 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-black text-xl transition-all active:scale-95 shadow-md flex items-center justify-center"
                        >
                            =
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
