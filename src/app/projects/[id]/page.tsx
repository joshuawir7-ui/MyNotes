// app/projects/[id]/page.tsx
import { ProjectClientPage } from "./client-page"

export function generateStaticParams() {
    // These are standard IDs we want to export statically. 
    // Client-side Zustand loading will still handle any other dynamic "id" routing directly.
    return [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }]
}

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    return <ProjectClientPage id={resolvedParams.id} />
}
