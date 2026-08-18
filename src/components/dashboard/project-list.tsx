"use client"

import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { translations } from "@/lib/translations"

export function ProjectList() {
    const projects = useStore(state => state.projects)
    const language = useStore(state => state.language)
    const router = useRouter()
    const t = translations[language].dashboard.projects

    return (
        <div className="grid gap-4">
            {projects.map((project) => (
                <div
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="group p-4 rounded-xl bg-white/95 dark:bg-zinc-900/90 hover:bg-white/100 dark:hover:bg-zinc-800/90 border border-black/5 dark:border-white/5 shadow-sm md:bg-white/5 md:dark:bg-black/20 md:hover:bg-white/10 md:dark:hover:bg-white/5 md:border-white/10 md:shadow-none md:backdrop-blur-sm transition-all cursor-pointer"
                >
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">{project.title}</h3>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>

                    <div className="w-full bg-secondary/30 rounded-full h-2 mb-2">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${project.progress}%`, backgroundColor: project.color }}
                        />
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                        {project.progress}% {t.complete}
                    </div>
                </div>
            ))}
        </div>
    )
}
