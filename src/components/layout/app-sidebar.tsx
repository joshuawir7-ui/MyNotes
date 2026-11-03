/* eslint-disable */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useStore } from "@/lib/store"
import { markNavStart } from "@/lib/perf-debug"
import { useState, useEffect, useRef } from "react"
import { translations } from "@/lib/translations"
import { LanguageToggle } from "@/components/ui/language-toggle"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { SettingsDialog } from "@/components/ui/settings-dialog"
import { motion, AnimatePresence } from "framer-motion"
import {
    Target,
    Calendar as CalendarIcon,
    Sun,
    Layers,
    Archive,
    FileText,
    Plus,
    X,
    CheckCircle2,
    Pencil,
    ChevronLeft,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    ChevronDown,
    Check,
    Wallet
} from "lucide-react"

function ShortcutPicker({ value, onChange }: { value?: number, onChange: (val?: number) => void }) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className="relative inline-block" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all active:scale-95
                    ${value
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10'
                    }
                `}
            >
                <span className="text-[10px] font-black">{value || 'Auto'}</span>
                <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 5 }}
                        className="absolute right-0 bottom-full mb-2 z-[200] bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-1.5 grid grid-cols-3 gap-1 min-w-[100px]"
                    >
                        <button
                            type="button"
                            onClick={() => { onChange(undefined); setIsOpen(false); }}
                            className={`col-span-3 text-[9px] font-black uppercase tracking-widest py-1.5 rounded-lg hover:bg-primary/10 transition-colors ${!value ? 'text-primary' : 'text-zinc-600 dark:text-zinc-400'}`}
                        >
                            Auto
                        </button>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => { onChange(n); setIsOpen(false); }}
                                className={`w-7 h-7 flex items-center justify-center text-[10px] font-black rounded-lg transition-all
                                    ${value === n
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'hover:bg-primary/10 text-zinc-600 dark:text-zinc-300 hover:text-primary'
                                    }
                                `}
                            >
                                {n}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ... (previous Animated components remain same)

// Animated Icon Components (CSS GPU-accelerated micro-transitions for 120fps navigation)
const AnimatedTarget = ({ isActive, appColor }: { isActive: boolean; appColor?: string }) => (
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110 rotate-6' : 'group-hover:scale-105'}`}>
        <Target className={`w-5 h-5 ${
            isActive 
                ? (appColor === 'black' ? 'text-black dark:text-white' : 'text-primary dark:text-[#8b5cf6]')
                : (appColor === 'black' ? 'text-muted-foreground group-hover:text-black dark:group-hover:text-white' : 'text-muted-foreground group-hover:text-primary dark:group-hover:text-[#a78bfa]')
        }`} />
    </div>
)

const AnimatedSun = ({ isActive, appColor }: { isActive: boolean; appColor?: string }) => (
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110 rotate-90' : 'group-hover:scale-105'}`}>
        <Sun className={`w-5 h-5 ${
            isActive 
                ? (appColor === 'black' ? 'text-black dark:text-white' : 'text-primary dark:text-amber-500')
                : (appColor === 'black' ? 'text-muted-foreground group-hover:text-black dark:group-hover:text-white' : 'text-muted-foreground group-hover:text-primary dark:group-hover:text-amber-400')
        }`} />
    </div>
)

const AnimatedTasks = ({ isActive, appColor }: { isActive: boolean; appColor?: string }) => (
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
        <CheckCircle2 className={`w-5 h-5 ${
            isActive 
                ? (appColor === 'black' ? 'text-black dark:text-white' : 'text-primary dark:text-green-500')
                : (appColor === 'black' ? 'text-muted-foreground group-hover:text-black dark:group-hover:text-white' : 'text-muted-foreground group-hover:text-primary dark:group-hover:text-green-400')
        }`} />
    </div>
)

const AnimatedCalendar = ({ isActive, appColor }: { isActive: boolean; appColor?: string }) => (
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110 -translate-y-0.5' : 'group-hover:scale-105'}`}>
        <CalendarIcon className={`w-5 h-5 ${
            isActive 
                ? (appColor === 'black' ? 'text-black dark:text-white' : 'text-primary dark:text-[#8b5cf6]')
                : (appColor === 'black' ? 'text-muted-foreground group-hover:text-black dark:group-hover:text-white' : 'text-muted-foreground group-hover:text-primary dark:group-hover:text-[#a78bfa]')
        }`} />
    </div>
)

const AnimatedLayers = ({ isActive, appColor }: { isActive: boolean; appColor?: string }) => (
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110 -translate-y-0.5' : 'group-hover:scale-105'}`}>
        <Layers className={`w-5 h-5 ${
            isActive 
                ? (appColor === 'black' ? 'text-black dark:text-white' : 'text-primary dark:text-blue-500')
                : (appColor === 'black' ? 'text-muted-foreground group-hover:text-black dark:group-hover:text-white' : 'text-muted-foreground group-hover:text-primary dark:group-hover:text-blue-400')
        }`} />
    </div>
)

const AnimatedArchive = ({ isActive, appColor }: { isActive: boolean; appColor?: string }) => (
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
        <Archive className={`w-5 h-5 ${
            isActive 
                ? (appColor === 'black' ? 'text-black dark:text-white' : 'text-primary dark:text-pink-500')
                : (appColor === 'black' ? 'text-muted-foreground group-hover:text-black dark:group-hover:text-white' : 'text-muted-foreground group-hover:text-primary dark:group-hover:text-pink-400')
        }`} />
    </div>
)

const AnimatedNotes = ({ isActive, appColor }: { isActive: boolean; appColor?: string }) => (
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
        <FileText className={`w-5 h-5 ${
            isActive 
                ? (appColor === 'black' ? 'text-black dark:text-white' : 'text-primary dark:text-amber-500')
                : (appColor === 'black' ? 'text-muted-foreground group-hover:text-black dark:group-hover:text-white' : 'text-muted-foreground group-hover:text-primary dark:group-hover:text-amber-400')
        }`} />
    </div>
)

const AnimatedWallet = ({ isActive, appColor }: { isActive: boolean; appColor?: string }) => (
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
        <Wallet className={`w-5 h-5 ${
            isActive 
                ? (appColor === 'black' ? 'text-black dark:text-white' : 'text-primary dark:text-emerald-500')
                : (appColor === 'black' ? 'text-muted-foreground group-hover:text-black dark:group-hover:text-white' : 'text-muted-foreground group-hover:text-primary dark:group-hover:text-emerald-400')
        }`} />
    </div>
)

export function AppSidebar() {
    const pathname = usePathname()
    const projects = useStore(state => state.projects)
    const addProject = useStore(state => state.addProject)
    const language = useStore(state => state.language)
    const appColor = useStore(state => state.appColor ?? 'purple')
    const tasks = useStore(state => state.tasks)
    const setTaskShortcut = useStore(state => state.setTaskShortcut)
    const tourStep = useStore(state => state.tourStep)
    const [isCreatingProject, setIsCreatingProject] = useState(false)
    const [newProjectTitle, setNewProjectTitle] = useState("")
    const [logoType, setLogoType] = useState<'text' | 'image'>('text')
    const [isMounted, setIsMounted] = useState(false)

    const [isMobileDevice, setIsMobileDevice] = useState(false)
    const [isAPK, setIsAPK] = useState(false)
    const [isLiteDevice, setIsLiteDevice] = useState(false)

    useEffect(() => {
        setIsMounted(true)
        const checkDevice = () => {
            const mobileWidth = window.innerWidth < 768
            const capacitor = !!(window as any).Capacitor
            setIsMobileDevice(mobileWidth)
            setIsAPK(capacitor)
        }
        checkDevice()
        window.addEventListener('resize', checkDevice)

        // Low-end device detection for cheaper blur (nav-glass-lite)
        if (typeof navigator !== 'undefined') {
            const nav = navigator as any
            const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2
            const lowCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4
            if (lowMemory || lowCores) {
                setIsLiteDevice(true)
            }
        }

        // Only toggle if not an APK/Mobile View?
        // User wants it 'tal como estaba' for desktop
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                setLogoType(prev => prev === 'text' ? 'image' : 'text')
            }
        }, 8000)

        return () => {
            clearInterval(interval)
            window.removeEventListener('resize', checkDevice)
        }
    }, [])

    const t = translations[language].nav

    const navItems = [
        { href: "/goals", label: t.goals, icon: AnimatedTarget },
        { href: "/balance", label: t.balance, icon: AnimatedWallet },
        { href: "/", label: t.today, icon: AnimatedSun },
        { href: "/tasks", label: t.tasks, icon: AnimatedTasks },
        { href: "/calendar", label: t.calendar, icon: AnimatedCalendar },
        { href: "/notes", label: t.notes, icon: AnimatedNotes },
    ]

    const handleCreateProject = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newProjectTitle.trim()) return

        const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
        const randomColor = colors[Math.floor(Math.random() * colors.length)]

        addProject({
            title: newProjectTitle,
            color: randomColor,
            status: 'Active'
        })
        setNewProjectTitle("")
        setIsCreatingProject(false)
    }

    const handleCreateProjectMobile = () => {
        const title = window.prompt(t.newProject)
        if (title?.trim()) {
            const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
            const randomColor = colors[Math.floor(Math.random() * colors.length)]
            addProject({
                title: title.trim(),
                color: randomColor,
                status: 'Active'
            })
        }
    }

    return (
        <aside
            className={`nav-glass ${isLiteDevice ? 'nav-glass-lite' : ''} fixed z-50
            bottom-4 left-3 right-3 mx-auto w-[88%] max-w-xs sm:max-w-sm h-[50px] flex flex-row items-center px-1.5 py-0
            rounded-full
            md:top-4 md:bottom-4 md:left-4 md:right-auto md:mx-0 md:w-60 md:h-auto md:flex-col md:pt-8 md:pb-8 md:px-4 md:overflow-y-auto md:!bg-white/95 dark:md:!bg-zinc-900/95 md:shadow-2xl md:rounded-[2.5rem] md:before:hidden md:[box-shadow:0_20px_60px_rgba(0,0,0,0.12)] no-scrollbar`}
        >

            {/* Logo/Brand Area (Desktop only) */}
            <div className="hidden md:flex flex-col items-center mb-8 shrink-0">
                <div className="w-24 h-24 flex items-center justify-center mb-2 animate-float relative">
                    {(isMobileDevice || isAPK) ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={logoType}
                                initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.8, rotate: 20 }}
                                transition={{ duration: 0.5 }}
                                className="flex items-center justify-center w-20 h-20"
                            >
                                {logoType === 'text' ? (
                                    <img src="/images/custom-n-v2.png" className="w-18 h-18 object-contain dark:invert" alt="Logo N" />
                                ) : (
                                    <img src="/images/notes-logo-v4.png" className="w-18 h-18 object-contain dark:brightness-0 dark:invert" alt="Notes Logo" />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={logoType}
                                initial={{ opacity: 0, rotateY: 90 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                exit={{ opacity: 0, rotateY: -90 }}
                                transition={{ duration: 0.5 }}
                                className="flex items-center justify-center w-36 h-36"
                            >
                                {logoType === 'text' ? (
                                    <img src="/images/custom-n-v2.png" className="w-32 h-32 object-contain dark:invert" alt="Logo N" />
                                ) : (
                                    <img src="/images/notes-logo-v4.png" className="w-32 h-32 object-contain dark:brightness-0 dark:invert" alt="Notes Logo" />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
                {!isMobileDevice && !isAPK && (
                    <h1 className="text-2xl font-bold tracking-tight font-dancing">MyNotes</h1>
                )}
            </div>

            {/* Mobile Navigation Row */}
            <nav className="flex md:hidden items-center justify-between w-full h-full px-2.5">
                <div className="flex items-center justify-around flex-1 gap-0.5">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        const isBlinking = item.href === '/tasks' && tourStep === 0
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => markNavStart(item.href)}
                                id={item.href === '/tasks' ? "nav-item-tasks" : undefined}
                                className={`relative flex items-center justify-center p-1.5 rounded-full transition-all duration-150 group shrink-0 ${isBlinking ? 'animate-pulse-green border border-green-500 bg-green-500/20' : ''
                                    }`}
                                title={isMounted ? item.label : ""}
                            >
                                {isActive && appColor !== 'black' && (
                                    <div
                                        className="absolute inset-0 bg-primary/15 rounded-full z-0 pointer-events-none transition-colors duration-150"
                                    />
                                )}
                                <div className={`relative z-10 flex items-center justify-center transition-transform duration-150 ${isActive ? 'scale-105' : 'scale-90 opacity-70 group-hover:opacity-100'}`}>
                                    <item.icon isActive={isActive} appColor={appColor} />
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {/* Settings integrated in mobile pill */}
                <div className="flex items-center gap-0 border-l border-black/5 dark:border-white/5 pl-2 ml-1 shrink-0">
                    <div className="[&_button]:!border-none [&_button]:!bg-transparent [&_button]:!p-1 [&_button]:scale-90 opacity-80 hover:opacity-100 transition-opacity">
                        <SettingsDialog />
                    </div>
                </div>
            </nav>

            {/* Desktop-only Navigation (Hidden on Mobile) */}
            <nav className="hidden md:flex md:flex-col md:items-stretch md:space-y-1 shrink-0 w-full relative">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    const isBlinking = item.href === '/tasks' && tourStep === 0
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => markNavStart(item.href)}
                            id={item.href === '/tasks' ? "nav-item-tasks-desktop" : undefined}
                            className={`relative flex items-center justify-center md:px-4 md:py-3 rounded-2xl text-sm font-medium transition-colors duration-200 group
                                ${isActive
                                    ? (appColor === 'black' ? 'text-black dark:text-white font-bold' : 'text-primary')
                                    : 'text-muted-foreground hover:text-foreground'
                                } ${isBlinking ? 'animate-pulse-green border border-green-500/50 bg-green-500/10' : ''}`}
                            title={isMounted ? item.label : ""}
                        >
                            {isActive && appColor !== 'black' && (
                                <div
                                    className="absolute inset-0 bg-primary/10 rounded-2xl z-0 pointer-events-none"
                                />
                            )}
                            <div className="relative z-10 flex flex-row items-center justify-start gap-3 w-full">
                                <item.icon isActive={isActive} appColor={appColor} />
                                <span className="inline-block">{isMounted ? item.label : ""}</span>
                            </div>
                        </Link>
                    )
                })}
            </nav>

            {/* Projects Section - Desktop only */}
            <div className="hidden md:flex flex-col md:flex-1 h-full md:h-auto items-center md:items-stretch overflow-x-auto md:overflow-y-auto md:overflow-x-hidden no-scrollbar shrink-0 md:shrink border-r md:border-none border-black/10 dark:border-white/10 pr-2 md:pr-0">
                <div className="hidden md:flex items-center justify-between px-3 mb-2 shrink-0">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isMounted ? t.projects : "Projects"}</h3>
                    <button
                        onClick={() => setIsCreatingProject(!isCreatingProject)}
                        className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                {/* Create Project Input (Desktop only) */}
                {/* CSS Grid 0fr→1fr avoids animating height (which causes Layout/Reflow on every frame).
                    The transition runs in the compositor thread: no layout recalculation per frame. */}
                <div className="hidden md:block shrink-0">
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateRows: isCreatingProject ? '1fr' : '0fr',
                            transition: 'grid-template-rows 0.35s var(--easing-enter)',
                        }}
                    >
                        <form
                            onSubmit={handleCreateProject}
                            className="overflow-hidden"
                            style={{ opacity: isCreatingProject ? 1 : 0, transition: 'opacity 0.25s ease' }}
                        >
                            <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-md p-1 border border-black/10 dark:border-white/10 mb-2 mx-2">
                                <input
                                    autoFocus={isCreatingProject}
                                    type="text"
                                    placeholder={t.newProject}
                                    value={newProjectTitle}
                                    onChange={(e) => setNewProjectTitle(e.target.value)}
                                    className="w-full bg-transparent border-none outline-none text-xs px-1 h-6"
                                />
                                <button type="button" onClick={() => setIsCreatingProject(false)} className="text-muted-foreground hover:text-red-400">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>


                <div className="flex flex-row md:flex-col gap-1 md:space-y-1 items-center md:items-stretch h-full md:h-auto py-2 md:py-0 shrink-0">
                    {isMounted && projects.map(project => (
                        <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className={`flex items-center justify-center md:justify-start p-3 md:px-3 md:py-2.5 rounded-2xl text-sm transition-all duration-300 group shrink-0
                        ${pathname === `/projects/${project.id}`
                                    ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
                                    : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground'
                                }`}
                            title={project.title}
                        >
                            <motion.div
                                initial="initial"
                                whileHover="hover"
                                whileTap="tap"
                                className="flex flex-row items-center justify-center md:justify-start gap-4 w-full"
                            >
                                <div
                                    className="w-3.5 h-3.5 md:w-2.5 md:h-2.5 rounded-sm ring-4 ring-transparent group-hover:ring-black/5 dark:group-hover:ring-white/5 transition-all shadow-sm"
                                    style={{ backgroundColor: project.color, boxShadow: `0 0 10px ${project.color}40` }}
                                />
                                <span className="hidden md:inline font-bold tracking-tight text-zinc-700 dark:text-zinc-300 group-hover:text-foreground transition-colors">{project.title}</span>
                            </motion.div>
                        </Link>
                    ))}
                    {/* Add Project Button Mobile */}
                    <button
                        onClick={handleCreateProjectMobile}
                        className="md:hidden flex items-center justify-center p-3 rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Shortcuts Configuration - Hidden on Mobile */}
            <div className="hidden md:block mt-4 pt-4 border-t border-black/5 dark:border-white/5 shrink-0 relative z-[50]">
                <div className="flex items-center justify-between px-3 mb-2">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{t.shortcuts}</h3>
                </div>
                <div className="space-y-1 px-1">
                    {isMounted && (() => {
                        return tasks.filter(t => {
                            const today = new Date().toISOString().split('T')[0]
                            if (t.recurrence === 'None') return !t.completed || (t.completed && (t.completedDates?.includes(today) ?? false))
                            return true
                        }).slice(0, 9).map((task, idx) => (
                            <div key={task.id} className="flex items-center gap-3 px-3 py-2 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-2xl group/item hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:border-black/10 dark:hover:border-white/20 transition-all duration-300">
                                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-[10px] font-black text-primary">{task.shortcutKey || idx + 1}</span>
                                </div>
                                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 truncate flex-1 group-hover/item:text-foreground transition-colors">{task.title}</span>
                                <ShortcutPicker
                                    value={task.shortcutKey}
                                    onChange={(val) => setTaskShortcut(task.id, val)}
                                />
                            </div>
                        ))
                    })()}
                </div>
            </div>

            {/* Settings (Desktop only) */}
            <div className="hidden md:flex flex-wrap ml-2 md:ml-0 md:mt-auto py-2 md:py-0 px-2 md:px-3 md:border-t md:border-black/5 dark:md:border-white/5 md:pt-4 flex-row items-center justify-center shrink-0">
                <SettingsDialog />
            </div>

        </aside >
    )
}
