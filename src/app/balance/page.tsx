"use client"
// Force HMR Update para balance en tiempo real

import { CustomSelect } from "@/components/ui/custom-select"
import { useShallow } from "zustand/react/shallow"
import { Virtuoso } from "react-virtuoso"
import { Reveal } from "@/components/ui/reveal"
import { useStore, Transaction, Appointment } from "@/lib/store"
import { translations } from "@/lib/translations"
import { useState, useEffect, useMemo } from "react"
import { Plus, Wallet, X, Trash2, Edit2, ArrowUpRight, ArrowDownRight, Calendar, DollarSign, Check, Coins, ChevronDown, AlertTriangle, TrendingUp, PieChart, RotateCcw, FileText } from "lucide-react"
import { ExpenseNoteForm } from "@/components/balance/expense-note-form"
import { ExpenseNoteCard } from "@/components/balance/expense-note-card"
import { motion, AnimatePresence } from "framer-motion"
import { BalanceOnboarding } from "@/components/balance/balance-onboarding"

// Custom Calendar component matching the user's mockup design
interface CustomCalendarProps {
    selectedDate: string;
    onSelectDate: (dateStr: string) => void;
    onClear: () => void;
    language: string;
    minDateStr?: string;
}

function CustomCalendar({ selectedDate, onSelectDate, onClear, language, minDateStr }: CustomCalendarProps) {
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11

    const monthsEs = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const months = language === 'es' ? monthsEs : monthsEn;

    const weekdaysEs = ["DO", "LU", "MA", "MI", "JU", "VI", "SA"];
    const weekdaysEn = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const weekdays = language === 'es' ? weekdaysEs : weekdaysEn;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startWeekday = new Date(currentYear, currentMonth, 1).getDay();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(prev => prev - 1);
        } else {
            setCurrentMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    const cells: { dayNum: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = startWeekday - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const m = currentMonth === 0 ? 11 : currentMonth - 1;
        const y = currentMonth === 0 ? currentYear - 1 : currentYear;
        cells.push({
            dayNum: d,
            dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            isCurrentMonth: false
        });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({
            dayNum: d,
            dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            isCurrentMonth: true
        });
    }

    // Next month padding
    const totalCells = cells.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
        const m = currentMonth === 11 ? 0 : currentMonth + 1;
        const y = currentMonth === 11 ? currentYear + 1 : currentYear;
        cells.push({
            dayNum: d,
            dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            isCurrentMonth: false
        });
    }

    const isToday = (dateStr: string) => {
        const tStr = new Date().toISOString().split('T')[0];
        return dateStr === tStr;
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-xl w-full max-w-[280px] mx-auto text-zinc-800 dark:text-zinc-200 select-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-1 font-bold text-sm capitalize">
                    <span>{months[currentMonth]} de {currentYear}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <ChevronDown className="w-4 h-4 transform rotate-180" />
                    </button>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {weekdays.map(w => (
                    <span key={w} className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                        {w}
                    </span>
                ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
                {cells.map((cell, idx) => {
                    const isSelected = selectedDate === cell.dateStr;
                    const isCellToday = isToday(cell.dateStr);
                    const isBeforeMinDate = minDateStr ? cell.dateStr < minDateStr : false;

                    return (
                        <button
                            key={idx}
                            type="button"
                            disabled={isBeforeMinDate}
                            onClick={() => onSelectDate(cell.dateStr)}
                            className={`h-8 w-8 rounded-lg text-xs flex items-center justify-center transition-all
                                ${!cell.isCurrentMonth ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-700 dark:text-zinc-300'}
                                ${isCellToday && !isSelected ? 'border border-blue-500 font-bold' : ''}
                                ${isBeforeMinDate ? 'opacity-30 cursor-not-allowed' : ''}
                                ${isSelected
                                    ? 'bg-[#0070f3] text-white font-bold shadow'
                                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-850'
                                }
                            `}
                        >
                            {cell.dayNum}
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-bold">
                <button
                    type="button"
                    onClick={onClear}
                    className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 transition-colors"
                >
                    {language === 'es' ? "Borrar" : "Clear"}
                </button>
                <button
                    type="button"
                    onClick={() => onSelectDate(new Date().toISOString().split('T')[0])}
                    className="text-blue-500 hover:text-blue-650 transition-colors"
                >
                    {language === 'es' ? "Hoy" : "Today"}
                </button>
            </div>
        </div>
    );
}

export default function BalancePage() {
    const language = useStore(state => state.language) || 'en'
    const rawTransactions = useStore(useShallow(state => state.transactions ?? []))
    const transactions = Array.isArray(rawTransactions) ? rawTransactions : []
    const balance = useMemo(() => {
        return transactions.reduce((sum, t) => {
            const amt = Number(t.amount) || 0;
            return sum + (t.type === 'expense' ? -amt : amt);
        }, 0);
    }, [transactions])
    
    const rawExpenseNotes = useStore(useShallow(state => state.expenseNotes ?? []))
    const expenseNotes = Array.isArray(rawExpenseNotes) ? rawExpenseNotes : []
    const totalDocumentedExpenses = useMemo(() => {
        return expenseNotes.reduce((sum, n) => sum + (Number(n.amount) || 0), 0);
    }, [expenseNotes])
    const projectedBalance = balance - totalDocumentedExpenses

    const rawAppointments = useStore(useShallow(state => state.appointments ?? []))
    const appointments = Array.isArray(rawAppointments) ? rawAppointments : []
    const savingsGoal = useStore(state => state.savingsGoal ?? 400)
    const addTransaction = useStore(state => state.addTransaction)
    const deleteTransaction = useStore(state => state.deleteTransaction)
    const clearAllTransactions = useStore(state => state.clearAllTransactions)
    const setSavingsGoal = useStore(state => state.setSavingsGoal)
    const updateAppointment = useStore(state => state.updateAppointment)
    const showToast = useStore(state => state.showToast)


    const t = ((translations[language]?.pages as any)?.balance || (translations['en'].pages as any).balance) as any

    const isHydrated = useStore(state => state.isHydrated)
    const [mounted, setMounted] = useState(false)
    const [isEditingGoal, setIsEditingGoal] = useState(false)
    const [tempGoalValue, setTempGoalValue] = useState("")

    // Toggle between 'donut' and 'line' (wavy line)
    const [chartType, setChartType] = useState<"donut" | "line">("donut")

    // Custom deletion modal states
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
    const [transactionToDeleteId, setTransactionToDeleteId] = useState<string | null>(null)

    // Quick-add input on main dashboard
    const [quickAmount, setQuickAmount] = useState("")

    // Form inputs & modal control
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [showExpenseNoteModal, setShowExpenseNoteModal] = useState(false)
    const [txType, setTxType] = useState<"income" | "expense">("expense")

    const [txAmount, setTxAmount] = useState("")
    const [txCurrency, setTxCurrency] = useState("$")
    const [txDescription, setTxDescription] = useState("")
    const [txDate, setTxDate] = useState("")

    const [txReminderDate, setTxReminderDate] = useState("")
    const [showDatePicker, setShowDatePicker] = useState(false)
    const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)

    // Manage dismissed session warnings
    const [dismissedReminders, setDismissedReminders] = useState<string[]>([])
    const [selectedTxDetails, setSelectedTxDetails] = useState<Transaction | null>(null)
    const [showOnboarding, setShowOnboarding] = useState(false)

    useEffect(() => {
        setMounted(true)
        setTxDate(new Date().toISOString().split('T')[0])
        
        // Check if onboarding has been seen
        const hasSeenOnboarding = localStorage.getItem('balanceOnboardingSeen')
        if (!hasSeenOnboarding) {
            setShowOnboarding(true)
        }
    }, [])

    const handleCloseOnboarding = () => {
        setShowOnboarding(false)
        localStorage.setItem('balanceOnboardingSeen', 'true')
    }

    const todayStr = new Date().toISOString().split('T')[0]

    // Find pending recovery reminders that are due today or in the past
    const pendingRecoveryReminders = appointments.filter(appt => {
        return (
            appt.notes?.startsWith('recovery_reminder:') &&
            appt.status === 'pending' &&
            appt.date <= todayStr
        )
    })

    const visibleReminders = pendingRecoveryReminders.filter(appt => !dismissedReminders.includes(appt.id))

    // Percentage of the savings goal
    const percentage = savingsGoal > 0 ? (balance / savingsGoal) * 100 : 0
    const boundedPercentage = Math.min(Math.max(percentage, 0), 100)

    // SVG Circular ring constants
    const radius = 90
    const strokeWidth = 16
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (boundedPercentage / 100) * circumference

    // Backtracks transactions to calculate daily balances over the last 7 days for the line chart
    const getWeeklyBalanceHistory = () => {
        const history = []
        const todayVal = new Date()

        for (let i = 6; i >= 0; i--) {
            const d = new Date()
            d.setDate(todayVal.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]

            let tempBalance = balance
            transactions.forEach(tx => {
                if (tx.date && tx.date > dateStr) {
                    const txAmt = tx.amount
                    const delta = tx.type === 'expense'
                        ? (txAmt > 0 ? -txAmt : txAmt)
                        : txAmt
                    tempBalance -= delta
                }
            })

            const weekdaysEs = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
            const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            const label = language === 'es' ? weekdaysEs[d.getDay()] : weekdaysEn[d.getDay()]

            history.push({
                date: dateStr,
                label,
                balance: tempBalance
            })
        }
        return history
    }

    const weeklyHistory = useMemo(() => getWeeklyBalanceHistory(), [transactions, balance, language])

    const handleSaveGoal = (e: React.FormEvent) => {
        e.preventDefault()
        const parsed = parseFloat(tempGoalValue)
        if (isNaN(parsed) || parsed <= 0) {
            showToast(language === 'es' ? "Por favor ingresa una meta válida mayor a 0" : "Please enter a valid goal greater than 0", "error")
            return
        }
        setSavingsGoal(parsed)
        showToast(language === 'es' ? "Meta actualizada" : "Savings goal updated", "success")
        setIsEditingGoal(false)
    }

    const handleQuickAction = (type: "income" | "expense") => {
        const val = parseFloat(quickAmount)
        if (isNaN(val) || val === 0) { // Allows negative values!
            // If the quick amount field is empty, open the transaction modal
            setTxType(type)
            setTxAmount("")
            setTxReminderDate("")
            setTxCurrency("$")
            setTxDescription("")
            setShowDatePicker(false)
            setIsModalOpen(true)
            return
        }

        const fallbackDesc = type === 'income'
            ? (language === 'es' ? 'Ingreso' : 'Income')
            : (language === 'es' ? 'Gasto' : 'Expense')

        addTransaction({
            amount: val,
            type: type,
            description: fallbackDesc,
            date: todayStr,
            currency: "$"
        })

        showToast(
            language === 'es'
                ? (type === 'income' ? `Registrado: +${val}$` : `Registrado: ${val}$`)
                : (type === 'income' ? `Registered: +${val}$` : `Registered: ${val}$`),
            "success"
        )
        setQuickAmount("")
    }

    const handleTransactionSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const amountNum = parseFloat(txAmount)
        if (isNaN(amountNum) || amountNum === 0) { // Allows negative values!
            showToast(language === 'es' ? "Por favor ingresa un monto válido" : "Please enter a valid amount", "error")
            return
        }

        const fallbackDesc = txType === 'income'
            ? (language === 'es' ? 'Ingreso' : 'Income')
            : (language === 'es' ? 'Gasto' : 'Expense')

        const txPayload: any = {
            amount: amountNum,
            type: txType,
            description: txDescription.trim() || fallbackDesc,
            date: txDate || todayStr,
            currency: txCurrency
        }

        if (txType === 'expense' && txReminderDate) {
            txPayload.recoveryDate = txReminderDate
        } else if (txType === 'income' && txReminderDate) {
            txPayload.conservationGoalDate = txReminderDate
        }

        addTransaction(txPayload)

        showToast(
            language === 'es'
                ? (txType === 'income' ? "Ingreso agregado exitosamente" : "Gasto registrado exitosamente")
                : (txType === 'income' ? "Income added successfully" : "Expense registered successfully"),
            "success"
        )

        setTxAmount("")
        setTxDescription("")
        setTxReminderDate("")
        setTxCurrency("$")
        setShowDatePicker(false)
        setShowCurrencyPicker(false)
        setIsModalOpen(false)
    }

    const handleDeleteTransaction = (id: string) => {
        setTransactionToDeleteId(id)
    }

    const handleClearHistory = () => {
        setIsClearConfirmOpen(true)
    }

    const handleResetBalance = () => {
        setIsResetConfirmOpen(true)
    }

    const confirmResetBalance = () => {
        if (balance === 0) {
            showToast(language === 'es' ? 'El balance ya es 0' : 'Balance is already 0', 'success')
            setIsResetConfirmOpen(false)
            return
        }
        // Insert an adjustment transaction to bring balance to exactly 0
        const adjustment = -balance
        addTransaction({
            amount: Math.abs(adjustment),
            type: balance > 0 ? 'expense' : 'income',
            description: language === 'es' ? 'Ajuste: Balance reiniciado a $0' : 'Adjustment: Balance reset to $0',
            date: todayStr,
            currency: '$'
        })
        showToast(language === 'es' ? 'Balance reiniciado a $0' : 'Balance reset to $0', 'success')
        setIsResetConfirmOpen(false)
    }

    const handleResolveReminder = (apptId: string) => {
        updateAppointment(apptId, { status: 'completed' })
        showToast(language === 'es' ? "Capital marcado como recuperado" : "Capital marked as recovered", "success")
    }

    const formatTransactionDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split('-');
            if (parts.length !== 3) return dateStr;
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            const d = new Date(year, month, day);

            const daysEs = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
            const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const days = language === 'es' ? daysEs : daysEn;

            const dayName = days[d.getDay()];
            const dd = String(day).padStart(2, '0');
            const mm = String(month + 1).padStart(2, '0');

            return `${dayName}/${dd}/${mm}/${year}`;
        } catch (e) {
            return dateStr;
        }
    }

    const sortedTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0
            const dateB = b.date ? new Date(b.date).getTime() : 0
            if (dateB !== dateA) return dateB - dateA
            return (b.lastUpdated || 0) - (a.lastUpdated || 0)
        })
    }, [transactions])

    if (!mounted || !isHydrated) return (
        <div className="flex flex-col h-[calc(100vh-5rem)] md:h-screen p-4 md:p-8 w-full max-w-5xl mx-auto">
            <div className="animate-pulse">
                <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded-3xl mb-6"></div>
                <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded mb-4"></div>
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        </div>
    )

    // Renders the sharp pointed SVG line chart (representing capital breakdown)
    const renderLineChart = () => {
        const balances = weeklyHistory.map(h => h.balance)
        const maxB = Math.max(...balances, savingsGoal)
        const minB = Math.min(...balances, 0)
        const range = Math.max(maxB - minB, 1)

        const width = 500
        const height = 140

        // Stretch points all the way to the edges (25 to 475)
        const points = weeklyHistory.map((pt, idx) => {
            const x = 25 + (idx / 6) * 450
            const y = height - 35 - ((pt.balance - minB) / range) * 75
            return { x, y, label: pt.label, val: pt.balance }
        })

        // Draw straight line paths for a pointed, sharp-edged style
        let dPath = `M ${points[0].x} ${points[0].y}`
        for (let i = 1; i < points.length; i++) {
            dPath += ` L ${points[i].x} ${points[i].y}`
        }

        return (
            <div className="relative w-full h-56 flex flex-col items-center justify-center select-none bg-transparent">
                <svg className="w-full h-full max-w-[480px]" viewBox="0 0 500 140">
                    <line x1="20" y1="30" x2="480" y2="30" className="stroke-zinc-100 dark:stroke-zinc-800/60" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="20" y1="70" x2="480" y2="70" className="stroke-zinc-100 dark:stroke-zinc-800/60" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="20" y1="110" x2="480" y2="110" className="stroke-zinc-100 dark:stroke-zinc-800/60" strokeWidth="1" strokeDasharray="3,3" />

                    <path
                        d={dPath}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {points.map((pt, idx) => (
                        <g key={idx}>
                            <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="4.5"
                                className="fill-[#ef4444] stroke-white dark:stroke-zinc-950"
                                strokeWidth="2"
                            />
                            <text
                                x={pt.x}
                                y={pt.y - 12}
                                textAnchor="middle"
                                className="fill-foreground font-black text-[10px]"
                            >
                                {pt.val.toLocaleString()}$
                            </text>
                            <text
                                x={pt.x}
                                y={130}
                                textAnchor="middle"
                                className="fill-muted-foreground text-[9px] font-extrabold uppercase"
                            >
                                {pt.label}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6 pb-16">
            
            {showOnboarding && <BalanceOnboarding onClose={handleCloseOnboarding} />}

            {/* Warning Banners for Due Capital Recovery Reminders */}
            <AnimatePresence>
                {visibleReminders.map(appt => (
                    <motion.div
                        key={appt.id}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-rose-600/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 p-4 rounded-3xl flex justify-between items-center gap-3 shadow-md w-full"
                    >
                        <div className="flex items-center gap-2.5 flex-1 text-xs sm:text-sm font-semibold">
                            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                            <span>
                                {language === 'es'
                                    ? `Recordatorio de recuperación: Debes cobrar ${appt.title.replace('Recuperar capital: ', '')} programado para hoy o días pasados.`
                                    : `Recovery reminder: You need to recover ${appt.title.replace('Recover capital: ', '')} scheduled for today or past days.`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleResolveReminder(appt.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow transition-all shrink-0 active:scale-95"
                            >
                                {language === 'es' ? "Recuperado" : "Recovered"}
                            </button>
                            <button
                                onClick={() => setDismissedReminders(prev => [...prev, appt.id])}
                                className="text-rose-500 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                                title={language === 'es' ? "Quitar" : "Dismiss"}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Split Desktop Responsive Grid (Left column: Donut/Line + Meta details | Right column: History list + Actions) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

                {/* LEFT COLUMN: Chart + Tienes Balance Text + Meta Details */}
                <div className="space-y-3 flex flex-col items-center w-full">

                    <Reveal margin="0px" duration={0.8} className="w-full">
                        <div className="flex flex-col items-center justify-center p-3 pb-1 bg-transparent relative overflow-hidden w-full">

                            {/* Header containing title and chart variation toggle */}
                            <div className="flex items-center justify-between w-full mb-2 px-2 max-w-[280px]">
                                <div className="w-8 h-8" />
                                <h1 className="text-3xl font-bold tracking-tight text-foreground font-dancing text-center flex-1">
                                    Balance
                                </h1>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowOnboarding(true)}
                                        className="p-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-muted-foreground hover:text-foreground active:scale-95 shrink-0"
                                        title={language === 'es' ? "Ayuda" : "Help"}
                                    >
                                        <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold text-current">?</div>
                                    </button>
                                    <button
                                        onClick={() => setChartType(prev => prev === 'donut' ? 'line' : 'donut')}
                                        className="p-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-muted-foreground hover:text-foreground active:scale-95 shrink-0"
                                        title={chartType === 'donut' ? (language === 'es' ? "Ver gráfico de líneas" : "Show line chart") : (language === 'es' ? "Ver gráfico circular" : "Show circular chart")}
                                    >
                                        {chartType === 'donut' ? <TrendingUp className="w-4 h-4" /> : <PieChart className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {chartType === 'line' ? (
                                renderLineChart()
                            ) : (
                                /* SVG Donut */
                                <div className="relative w-56 h-56 flex items-center justify-center select-none">
                                    <svg className="w-full h-full transform rotate-90 scale-x-[-1]" viewBox="0 0 200 200">
                                        <defs>
                                            <linearGradient id="blueProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="currentColor" className="text-[#3b82f6] dark:text-white" />
                                                <stop offset="100%" stopColor="currentColor" className="text-[#1d4ed8] dark:text-white" />
                                            </linearGradient>
                                        </defs>

                                        <circle
                                            cx="100"
                                            cy="100"
                                            r={radius}
                                            className="stroke-zinc-200 dark:stroke-zinc-800"
                                            strokeWidth={strokeWidth}
                                            fill="transparent"
                                        />

                                        <motion.circle
                                            cx="100"
                                            cy="100"
                                            r={radius}
                                            stroke="url(#blueProgressGradient)"
                                            strokeWidth={strokeWidth}
                                            fill="transparent"
                                            strokeDasharray={circumference}
                                            initial={{ strokeDashoffset: circumference }}
                                            animate={{ strokeDashoffset }}
                                            transition={{ duration: 1.2, ease: "easeOut" }}
                                            strokeLinecap="round"
                                        />
                                    </svg>

                                    <div className="absolute flex flex-col items-center justify-center text-zinc-400 dark:text-white pointer-events-none">
                                        <Wallet className="w-16 h-16" />
                                    </div>

                                </div>
                            )}

                            {/* Flanked Balance display */}
                            <div className="flex flex-col items-center justify-center gap-2 mt-2 w-full px-4">
                                <div className="flex items-center justify-center gap-4 w-full relative">
                                    <div className="h-[1px] bg-black/10 dark:bg-white/10 flex-1" />
                                    <span className="text-sm font-extrabold tracking-wider uppercase text-foreground shrink-0 whitespace-nowrap">
                                        {language === 'es' ? 'Tienes' : 'You have'}: {balance.toLocaleString()}$
                                    </span>
                                    <div className="h-[1px] bg-black/10 dark:bg-white/10 flex-1" />
                                    <button
                                        onClick={() => setShowExpenseNoteModal(true)}
                                        className="absolute right-0 text-zinc-500 dark:text-zinc-400 hover:text-foreground transition-all active:scale-95 p-1"
                                        title={language === 'es' ? "Nueva Nota de Gasto" : "New Expense Note"}
                                    >
                                        <FileText className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                        </div>
                    </Reveal>
                    {/* Meta budget row + quick-add input + buttons */}
                    <Reveal margin="0px" duration={0.8} delay={0.1} className="w-full">
                        <div className="p-3 bg-transparent flex flex-col gap-3 w-full border-t border-black/5 dark:border-white/5 pt-3">
                            {/* Meta & Input row */}
                            <div className="relative flex items-center justify-center gap-4 w-full min-h-[40px]">
                                {/* Savings Goal Info */}
                                <div className={isEditingGoal ? "relative flex items-center gap-2 shrink-0" : "absolute left-1 flex items-center gap-2 shrink-0"}>
                                    {isEditingGoal ? (
                                        <form onSubmit={handleSaveGoal} className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                type="number"
                                                value={tempGoalValue}
                                                onChange={(e) => setTempGoalValue(e.target.value)}
                                                className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs w-20 text-foreground focus:outline-none font-bold"
                                                placeholder="Goal..."
                                            />
                                            <button type="submit" className="p-1 text-emerald-500 hover:scale-105 transition-all">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button type="button" onClick={() => setIsEditingGoal(false)} className="p-1 text-rose-500 hover:scale-105 transition-all">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-purple-650 dark:text-purple-400">
                                                Meta: {savingsGoal}$
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setTempGoalValue(savingsGoal.toString())
                                                    setIsEditingGoal(true)
                                                }}
                                                className="p-1 text-muted-foreground hover:text-purple-650 transition-colors"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Quick Add Input (allows negative for debt) */}
                                <div className="flex justify-center w-full">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={quickAmount}
                                        onChange={(e) => setQuickAmount(e.target.value)}
                                        placeholder="0.00 $"
                                        className="w-full max-w-[100px] bg-black/5 dark:bg-white/5 border border-zinc-300 dark:border-zinc-700 rounded-2xl py-2 px-3 focus:outline-none focus:border-zinc-400 text-center font-bold text-sm text-foreground placeholder:font-normal placeholder:text-muted-foreground/45"
                                    />
                                </div>
                            </div>

                            {/* Centered Actions Buttons */}
                            <div className="flex gap-4 justify-center w-full pt-1">
                                <button
                                    onClick={() => handleQuickAction("income")}
                                    className="px-6 py-3 bg-[#5c5c5c] hover:bg-[#4d4d4d] text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow"
                                >
                                    {language === 'es' ? "Agregar" : "Agregar"}
                                </button>
                                <button
                                    onClick={() => handleQuickAction("expense")}
                                    className="px-6 py-3 bg-[#242424] hover:bg-[#1a1a1a] text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow"
                                >
                                    {language === 'es' ? "Gaste" : "Gaste"}
                                </button>
                                <button
                                    onClick={handleResetBalance}
                                    className="p-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 rounded-2xl transition-all hover:scale-[1.05] active:scale-95"
                                    title={language === 'es' ? 'Reiniciar balance a $0' : 'Reset balance to $0'}
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </div>

                        </div>
                    </Reveal>

                </div>

                {/* RIGHT COLUMN: Wallet History List */}
                <div className="space-y-5 w-full flex flex-col justify-start">

                    <Reveal margin="0px" duration={0.8} delay={0.2} className="w-full">
                        <div className="flex flex-col space-y-4 w-full">

                            {/* Wallet History Header + Clear History Action */}
                            <div className="flex justify-between items-center px-1 pb-1">
                                <h2 className="text-lg font-black tracking-tight text-foreground uppercase">
                                    {language === 'es' ? "Historial De billetera" : "Wallet History"}
                                </h2>
                                {transactions.length > 0 && (
                                    <button
                                        onClick={handleClearHistory}
                                        className="p-2 text-rose-500 hover:text-rose-650 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer shrink-0"
                                        title={language === 'es' ? "Eliminar Historial" : "Clear History"}
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            {/* Wallet items stack */}
                            {sortedTransactions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-white/5 border border-dashed border-black/10 dark:border-white/10 rounded-3xl text-center w-full">
                                    <p className="text-xs text-muted-foreground">
                                        {language === 'es' ? "Aún no hay ingresos o gastos registrados." : "No income or expenses registered yet."}
                                    </p>
                                </div>
                            ) : (
                                <div className="relative w-full">
                                    <div
                                        className="grid grid-cols-1 w-full max-h-[360px] md:max-h-[540px] pr-1 pt-3 pb-4"
                                        style={{
                                            maskImage: 'linear-gradient(to bottom, transparent 0px, black 12px, black calc(100% - 16px), transparent 100%)',
                                            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 12px, black calc(100% - 16px), transparent 100%)'
                                        }}
                                    >
                                     <Virtuoso
                                         style={{ height: '100%', minHeight: '360px' }}
                                         data={sortedTransactions}
                                         itemContent={(index, tx) => (
                                             <div
                                                 key={tx.id}
                                                 onClick={() => setSelectedTxDetails(tx)}
                                                 className={`mb-3 flex items-center justify-between p-4 rounded-3xl text-white shadow-md relative group overflow-hidden w-full cursor-pointer hover:brightness-105 active:scale-[0.99] transition-all
                                                     ${tx.type === 'income'
                                                         ? 'bg-[#00b050] dark:bg-[#7030a0]'
                                                         : 'bg-[#e60000]'
                                                     }`}
                                             >
                                                 <div className="flex items-center gap-3 w-full pr-8">
                                                     <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                                                         {tx.type === 'income'
                                                             ? <ArrowUpRight className="w-5 h-5 text-[#00b050] dark:text-[#7030a0]" />
                                                             : <ArrowDownRight className="w-5 h-5 text-[#e60000]" />
                                                         }
                                                     </div>

                                                     <div className="flex-1 min-w-0 pr-2">
                                                         <div className="flex flex-col">
                                                             <span className="font-extrabold text-sm tracking-tight sm:text-base">
                                                                 {tx.type === 'income'
                                                                     ? (tx.amount < 0
                                                                         ? (language === 'es' ? `Gane ${tx.amount}${tx.currency || '$'}` : `Earned ${tx.amount}${tx.currency || '$'}`)
                                                                         : (language === 'es' ? `Gane +${tx.amount}${tx.currency || '$'}` : `Earned +${tx.amount}${tx.currency || '$'}`)
                                                                     )
                                                                     : (tx.amount < 0
                                                                         ? (language === 'es' ? `Gaste ${tx.amount}${tx.currency || '$'}` : `Spent ${tx.amount}${tx.currency || '$'}`)
                                                                         : (language === 'es' ? `Gaste -${tx.amount}${tx.currency || '$'}` : `Spent -${tx.amount}${tx.currency || '$'}`)
                                                                     )
                                                                 }
                                                             </span>
                                                             <span className="text-xs text-white/90 truncate block mt-0.5 font-medium">
                                                                 {tx.description}
                                                             </span>
                                                         </div>
                                                     </div>

                                                     <div className="text-[10px] sm:text-xs font-black uppercase text-white/95 shrink-0 text-right self-center wallet-history-date">
                                                         {formatTransactionDate(tx.date)}
                                                     </div>
                                                 </div>

                                                 <button
                                                     onClick={(e) => {
                                                         e.stopPropagation()
                                                         handleDeleteTransaction(tx.id)
                                                     }}
                                                     className="absolute top-1/2 right-2.5 -translate-y-1/2 p-2 bg-black/25 hover:bg-black/45 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 z-10"
                                                     title={t.deleteTransactionConfirm}
                                                 >
                                                     <Trash2 className="w-3.5 h-3.5 text-white" />
                                                 </button>
                                             </div>
                                         )}
                                     />
                                    </div>
                            </div>
                        )}
                        </div>
                    </Reveal>

                    <Reveal margin="0px" duration={0.8} delay={0.4} className="w-full">
                        <div className="bg-transparent rounded-[32px] p-2 mt-4 relative w-full overflow-hidden max-h-[300px] flex flex-col border border-white/5">
                            <div className="flex justify-between items-center px-2 pb-2">
                                <h2 className="text-lg font-black tracking-tight text-foreground uppercase">
                                    {language === 'es' ? "Notas de Gastos" : "Expense Notes"}
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                {expenseNotes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center text-center p-6 bg-white/5 border border-white/10 rounded-[24px]">
                                        <FileText className="w-8 h-8 text-white/20 mb-3" />
                                        <p className="text-white/40 text-sm font-medium">
                                            {language === 'es' ? "No hay notas de gastos" : "No expense notes yet"}
                                        </p>
                                    </div>
                                ) : (
                                    [...expenseNotes].sort((a, b) => b.createdAt - a.createdAt).map(note => (
                                        <ExpenseNoteCard key={note.id} note={note} currencySymbol="$" />
                                    ))
                                )}
                            </div>
                        </div>
                    </Reveal>

                </div>

            </div>

            {/* GASTE / GANE Unified Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-[#0c0c0c] w-full max-w-md p-6 sm:p-8 rounded-[40px] border border-black/5 dark:border-white/10 shadow-2xl relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-6 left-6 p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-full border border-zinc-200 dark:border-zinc-700 transition-all hover:scale-110 active:scale-95"
                            >
                                <X className="w-5 h-5 stroke-[2.5]" />
                            </button>

                            <div className="text-center mt-6 mb-6">
                                <h2 className="text-2xl font-black tracking-widest text-foreground uppercase">
                                    {txType === 'expense' ? 'GASTE' : 'GANE'}
                                </h2>
                            </div>

                            <form onSubmit={handleTransactionSubmit} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Amount Input with gray border, allowing negative values for debt */}
                                    <div className="relative">
                                        <input
                                            autoFocus
                                            required
                                            type="number"
                                            step="0.01"
                                            value={txAmount}
                                            onChange={(e) => setTxAmount(e.target.value)}
                                            placeholder={txType === 'expense' ? "Monto (ej: -12)" : "Monto (ej: -12)"}
                                            className="w-full bg-white border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 rounded-2xl px-4 py-3 focus:outline-none focus:border-zinc-400 focus:ring-0 text-center font-bold text-sm text-foreground placeholder:text-zinc-400"
                                        />
                                    </div>

                                    <div className="relative flex items-center">
                                        {showCurrencyPicker ? (
                                            <div className="flex gap-1 justify-center items-center w-full h-full bg-zinc-100 dark:bg-zinc-850 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 z-10">
                                                {["$", "€", "¥", "Pesos"].map(curr => (
                                                    <button
                                                        key={curr}
                                                        type="button"
                                                        onClick={() => {
                                                            setTxCurrency(curr)
                                                            setShowCurrencyPicker(false)
                                                        }}
                                                        className={`w-10 py-1.5 rounded-lg text-xs font-bold transition-all ${txCurrency === curr ? 'bg-primary text-white' : 'hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground'}`}
                                                    >
                                                        {curr}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrencyPicker(true)}
                                                className="w-full py-3.5 bg-zinc-500 hover:bg-zinc-650 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Coins className="w-3.5 h-3.5" />
                                                {txCurrency === '$' ? 'MONEDA' : `MONEDA: ${txCurrency}`}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <textarea
                                        value={txDescription}
                                        onChange={(e) => setTxDescription(e.target.value)}
                                        placeholder={language === 'es' ? "¿En que gastaste?" : "What did you spend on?"}
                                        rows={3}
                                        className="w-full bg-white border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 rounded-2xl px-4 py-3 focus:outline-none focus:border-zinc-400 focus:ring-0 text-sm text-foreground placeholder:text-zinc-400"
                                    />
                                </div>

                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowDatePicker(true)}
                                        className="w-full py-3.5 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>
                                            {txType === 'expense'
                                                ? (txReminderDate ? `${language === 'es' ? 'Recuperar el: ' : 'Recover: '}${txReminderDate}` : (language === 'es' ? "Fecha que esperas recuperarlo" : "Expected Capital Recovery Date"))
                                                : (txReminderDate ? `${language === 'es' ? 'Conservar hasta: ' : 'Conserve: '}${txReminderDate}` : (language === 'es' ? "META DE CONSERVACION C." : "Capital Conservation Goal"))
                                            }
                                        </span>
                                        <Calendar className="w-4 h-4" />
                                    </button>

                                    {/* Centered Modal overlay calendar */}
                                    <AnimatePresence>
                                        {showDatePicker && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                                                onClick={() => setShowDatePicker(false)}
                                            >
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                                    className="bg-transparent relative"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <CustomCalendar
                                                        selectedDate={txReminderDate}
                                                        minDateStr={txDate || todayStr}
                                                        onSelectDate={(date) => {
                                                            setTxReminderDate(date)
                                                            setShowDatePicker(false)
                                                        }}
                                                        onClear={() => {
                                                            setTxReminderDate("")
                                                            setShowDatePicker(false)
                                                        }}
                                                        language={language}
                                                    />
                                                </motion.div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="pt-2">
                                    {txType === 'expense' ? (
                                        <button
                                            type="submit"
                                            className="w-full py-3.5 bg-[#242424] hover:bg-[#1a1a1a] text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-md"
                                        >
                                            {language === 'es' ? "Gaste" : "Confirm Spend"}
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            className="w-full py-3.5 bg-[#5c5c5c] hover:bg-[#4d4d4d] text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-md"
                                        >
                                            {language === 'es' ? "Gane" : "Confirm Income"}
                                        </button>
                                    )}
                                </div>

                                <div className="text-center pt-2">
                                    <p className="text-[10px] text-zinc-500 leading-relaxed dark:text-zinc-400">
                                        {txType === 'expense'
                                            ? (language === 'es'
                                                ? "ATENCION: para tener un mejor control y gestión de tu capital prestado o gastado, apunta en lo que gastaste o quien se lo prestaste ¿ESPECIFICAMENTE a quién? y cuando, para que si en caso que haya sido prestado, para cuando lo cobres no tengas sorpresas sepas a quien y cuanto,"
                                                : "ATTENTION: to have better control and management of your lent or spent capital, note what you spent on or who you lent it to SPECIFICALLY to whom? and when, so in case it was lent, you won't have surprises when you collect it, knowing who and how much,")
                                            : (language === 'es'
                                                ? "Felicidades, que sigas así!!"
                                                : "Congratulations, keep it up!!")
                                        }
                                    </p>
                                </div>

                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── CLEAR ALL HISTORY CONFIRMATION MODAL ── */}
            <AnimatePresence>
                {isClearConfirmOpen && (
                    <motion.div
                        key="clear-confirm-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsClearConfirmOpen(false)}
                    >
                        <motion.div
                            key="clear-confirm-modal"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                        >
                            {/* Header rojo */}
                            <div className="bg-red-600 px-6 pt-6 pb-4 flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                                    <Trash2 className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-white font-black text-lg tracking-tight text-center">
                                    {language === 'es' ? '¿Eliminar todo el historial?' : 'Clear all history?'}
                                </h3>
                            </div>
                            {/* Body */}
                            <div className="bg-white dark:bg-zinc-900 px-6 py-5 flex flex-col gap-4">
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center leading-relaxed">
                                    {language === 'es'
                                        ? 'Esta acción eliminará todas tus transacciones, reiniciará tu saldo a $0 y quitará los recordatorios de cobro y metas activas. Esta acción no se puede deshacer.'
                                        : 'This will delete all your transactions, reset your balance to $0 and remove any active reminders and conservation goals. This cannot be undone.'}
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsClearConfirmOpen(false)}
                                        className="flex-1 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                                    >
                                        {language === 'es' ? 'Cancelar' : 'Cancel'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            clearAllTransactions()
                                            setIsClearConfirmOpen(false)
                                            showToast(language === 'es' ? 'Historial eliminado exitosamente' : 'Wallet history cleared successfully', 'success')
                                        }}
                                        className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        {language === 'es' ? 'Sí, eliminar todo' : 'Yes, clear all'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── RESET BALANCE TO ZERO CONFIRMATION MODAL ── */}
            <AnimatePresence>
                {isResetConfirmOpen && (
                    <motion.div
                        key="reset-balance-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsResetConfirmOpen(false)}
                    >
                        <motion.div
                            key="reset-balance-modal"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                        >
                            {/* Header naranja/ámbar */}
                            <div className="bg-gradient-to-br from-orange-500 to-rose-500 px-6 pt-6 pb-4 flex flex-col items-center gap-3">
                                <motion.div
                                    initial={{ rotate: 0 }}
                                    animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                                    transition={{ duration: 0.6, delay: 0.1 }}
                                    className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center"
                                >
                                    <RotateCcw className="w-8 h-8 text-white" />
                                </motion.div>
                                <h3 className="text-white font-black text-lg tracking-tight text-center">
                                    {language === 'es' ? '¿Reiniciar el balance?' : 'Reset balance?'}
                                </h3>
                            </div>
                            {/* Body */}
                            <div className="bg-white dark:bg-zinc-900 px-6 py-5 flex flex-col gap-4">
                                <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl p-4 text-center">
                                    <p className="text-orange-700 dark:text-orange-400 font-bold text-sm">
                                        {language === 'es' ? 'Balance actual:' : 'Current balance:'}
                                    </p>
                                    <p className="text-orange-600 dark:text-orange-300 font-black text-2xl mt-1">
                                        {balance.toLocaleString()}$
                                    </p>
                                </div>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center leading-relaxed">
                                    {language === 'es'
                                        ? 'Se agregará una transacción de ajuste para llevar tu balance a $0. El historial se conserva.'
                                        : 'An adjustment transaction will be added to bring your balance to $0. History is preserved.'}
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsResetConfirmOpen(false)}
                                        className="flex-1 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                                    >
                                        {language === 'es' ? 'Cancelar' : 'Cancel'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmResetBalance}
                                        className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-black text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-md"
                                    >
                                        {language === 'es' ? 'Sí, reiniciar a $0' : 'Yes, reset to $0'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── DELETE SINGLE TRANSACTION CONFIRMATION MODAL ── */}
            <AnimatePresence>
                {transactionToDeleteId && (
                    <motion.div
                        key="delete-tx-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setTransactionToDeleteId(null)}
                    >
                        <motion.div
                            key="delete-tx-modal"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <div className="bg-zinc-800 dark:bg-zinc-900 px-6 pt-6 pb-4 flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-zinc-300" />
                                </div>
                                <h3 className="text-white font-black text-base tracking-tight text-center">
                                    {language === 'es' ? '¿Eliminar transacción?' : 'Delete transaction?'}
                                </h3>
                                <p className="text-zinc-400 text-xs text-center">
                                    {language === 'es' ? 'El saldo se ajustará automáticamente.' : 'Your balance will be adjusted automatically.'}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 px-6 py-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTransactionToDeleteId(null)}
                                    className="flex-1 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        deleteTransaction(transactionToDeleteId)
                                        setTransactionToDeleteId(null)
                                        showToast(language === 'es' ? 'Transacción eliminada' : 'Transaction deleted', 'success')
                                    }}
                                    className="flex-1 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-black text-sm transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    {language === 'es' ? 'Eliminar' : 'Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Transaction Details Modal */}
            <AnimatePresence>
                {selectedTxDetails && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedTxDetails(null)}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5"
                        >
                            {/* Header bar */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-2.5 rounded-2xl ${
                                        selectedTxDetails.type === 'income'
                                            ? 'bg-emerald-500/10 text-emerald-500 dark:bg-purple-500/10 dark:text-purple-400'
                                            : 'bg-rose-500/10 text-rose-500'
                                    }`}>
                                        {selectedTxDetails.type === 'income'
                                            ? <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                                            : <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
                                        }
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 text-muted-foreground">
                                        {selectedTxDetails.type === 'income'
                                            ? (language === 'es' ? 'Ingreso' : 'Income')
                                            : (language === 'es' ? 'Gasto' : 'Expense')
                                        }
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedTxDetails(null)}
                                    className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Amount card */}
                            <div className={`p-5 rounded-2xl flex flex-col items-center justify-center text-center text-white shadow-md ${
                                selectedTxDetails.type === 'income'
                                    ? 'bg-[#00b050] dark:bg-[#7030a0]'
                                    : 'bg-[#e60000]'
                            }`}>
                                <span className="text-xs uppercase font-extrabold text-white/80 tracking-wider">
                                    {language === 'es' ? 'Monto Registrado' : 'Amount Recorded'}
                                </span>
                                <span className="text-3xl font-black mt-1 tracking-tight">
                                    {selectedTxDetails.type === 'income' ? '+' : '-'}
                                    {Math.abs(selectedTxDetails.amount)} {selectedTxDetails.currency || '$'}
                                </span>
                            </div>

                            {/* Info list */}
                            <div className="space-y-3 bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                        {language === 'es' ? 'Concepto / Descripción' : 'Concept / Description'}
                                    </span>
                                    <p className="text-sm font-semibold text-foreground mt-0.5 break-words">
                                        {selectedTxDetails.description || (language === 'es' ? 'Sin descripción' : 'No description')}
                                    </p>
                                </div>

                                <div className="h-px bg-black/5 dark:bg-white/5 w-full" />

                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                            {language === 'es' ? 'Fecha de Registro' : 'Recorded Date'}
                                        </span>
                                        <p className="text-xs font-semibold text-foreground mt-0.5">
                                            {formatTransactionDate(selectedTxDetails.date)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                            {language === 'es' ? 'Moneda' : 'Currency'}
                                        </span>
                                        <p className="text-xs font-semibold text-foreground mt-0.5">
                                            {selectedTxDetails.currency || '$'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const id = selectedTxDetails.id
                                        setSelectedTxDetails(null)
                                        handleDeleteTransaction(id)
                                    }}
                                    className="flex-1 py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {language === 'es' ? 'Eliminar' : 'Delete'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTxDetails(null)}
                                    className="flex-1 py-3 px-4 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-foreground font-bold text-xs transition-all"
                                >
                                    {language === 'es' ? 'Cerrar' : 'Close'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showExpenseNoteModal && (
                <ExpenseNoteForm onClose={() => setShowExpenseNoteModal(false)} />
            )}
        </div>
    )
}
