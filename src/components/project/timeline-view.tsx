"use client"

import { useStore, Project } from "@/lib/store"

interface TimelineViewProps {
    project: Project
}

export function TimelineView({ project }: TimelineViewProps) {
    // Mock timeline logic (in a real app this would calculate positions based on dates)
    return (
        <div className="w-full overflow-x-auto pb-4">
            <div className="min-w-[600px] bg-white/5 dark:bg-black/20 rounded-xl p-6 backdrop-blur-md border border-white/10 dark:border-white/5 relative">
                <h3 className="text-sm font-medium mb-6 text-muted-foreground">Timeline</h3>

                <div className="relative h-20 flex items-center">
                    {/* Timeline Base Line */}
                    <div className="absolute left-0 right-0 h-1 bg-white/10 rounded-full top-1/2 -translate-y-1/2" />

                    {/* Milestones */}
                    {project.milestones.map((milestone, index) => {
                        // Simple distribution for mock visualization
                        const leftPos = `${(index + 1) * 20}%`

                        return (
                            <div
                                key={milestone.id}
                                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
                                style={{ left: leftPos }}
                            >
                                <div className={`w-4 h-4 rounded-full border-2 transition-all 
                            ${milestone.completed ? 'bg-green-500 border-green-500 scale-125' : 'bg-background border-muted-foreground group-hover:border-primary'}`}
                                />
                                <div className="absolute top-6 w-24 text-center">
                                    <div className="text-xs font-semibold truncate">{milestone.title}</div>
                                    <div className="text-[10px] text-muted-foreground">{milestone.date}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
