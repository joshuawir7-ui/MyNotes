"use client"

import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { ArrowLeft, MoreHorizontal, Play, Calendar, CheckCircle2 } from "lucide-react"
import { TaskList } from "@/components/project/task-list"
import { TimelineView } from "@/components/project/timeline-view"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { useEffect, useState } from "react"

export function ProjectClientPage({ id }: { id: string }) {
    const router = useRouter()
    const projects = useStore(state => state.projects)
    const loadAllTasks = useStore(state => state.loadAllTasks)
    const unloadTasks = useStore(state => state.unloadTasks)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        loadAllTasks()
        setMounted(true)
        return () => {
            unloadTasks()
        }
    }, [loadAllTasks, unloadTasks])

    if (!mounted) return <div className="min-h-screen bg-background" />

    const project = projects.find(p => p.id === id)

    if (!project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <div className="text-center glass-panel p-8 rounded-2xl">
                    <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
                    <button
                        onClick={() => router.push('/')}
                        className="text-primary hover:underline"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6 sm:p-12 font-[family-name:var(--font-geist-sans)] transition-colors duration-300 relative selection:bg-primary/30">
            {/* Ambient Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] dark:bg-purple-900/20" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] dark:bg-blue-900/20" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto w-full pb-24 flex flex-col gap-8">
                {/* Header */}
                <header className="flex justify-between items-center w-full">
                    <button
                        onClick={() => router.push('/')}
                        className="p-3 -ml-2 rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm group"
                    >
                        <ArrowLeft className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>
                    <ModeToggle />
                </header>

                <main className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {/* Project Banner */}
                    <div className="relative w-full h-64 rounded-3xl overflow-hidden p-8 flex flex-col justify-end shadow-2xl group">
                        <div
                            className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                            style={{ background: `linear-gradient(135deg, ${project.color} 0%, #18181b 100%)` }}
                        />
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

                        <div className="relative z-10 flex justify-between items-end">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white mb-4">
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                    Active Project
                                </div>
                                <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md">{project.title}</h1>
                                <div className="flex items-center gap-3 text-white/80 text-sm font-medium">
                                    <div className="h-1.5 w-32 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                                        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${project.progress}%` }} />
                                    </div>
                                    <span>{project.progress}% Complete</span>
                                </div>
                            </div>

                            <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center bg-white/10 backdrop-blur-md shadow-lg">
                                <span className="text-lg font-bold text-white">{project.progress}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <section className="glass-panel rounded-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Timeline
                            </h2>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Q1 2024</span>
                        </div>
                        <TimelineView project={project} />
                    </section>

                    {/* Tasks */}
                    <section>
                        <div className="flex justify-between items-center mb-6 px-1">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <CheckCircle2 className="w-6 h-6 text-primary" />
                                Tasks
                            </h2>
                            <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
                                <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>
                        <TaskList projectId={project.id} />
                    </section>
                </main>
            </div>

            {/* Floating Action Button */}
            <div className="fixed bottom-8 right-8 left-8 max-w-4xl mx-auto flex justify-end pointer-events-none z-50">
                <button className="pointer-events-auto bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full shadow-[0_0_20px_rgba(127,13,242,0.4)] flex items-center gap-3 font-bold transition-all hover:scale-105 active:scale-95 group">
                    <Play className="w-5 h-5 fill-current group-hover:translate-x-0.5 transition-transform" />
                    Start Focus Session
                </button>
            </div>
        </div>
    )
}
