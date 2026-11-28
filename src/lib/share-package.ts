import { Capacitor } from "@capacitor/core"
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"
import { NoteBlock as Block, Goal, GoalObjective, GoalReport, useStore } from "@/lib/store"
import { pick } from "@/lib/i18n-inline"

export interface SharedNotePayload {
    format: "mynotes-share-v1"
    kind: "note"
    exportedAt: number
    note: {
        title: string
        blocks: Block[]
        tags?: string[]
    }
}

export interface SharedGoalPayload {
    format: "mynotes-share-v1"
    kind: "goal"
    exportedAt: number
    goal: {
        title: string
        description: string
        type?: Goal["type"]
        targetDate: string
        objectives?: GoalObjective[]
        targetValue?: number
        currentValue?: number
        startValue?: number
        unit?: string
        reports?: GoalReport[]
    }
}

export type SharedPayload = SharedNotePayload | SharedGoalPayload

function slugify(name: string, fallback: string): string {
    const clean = (name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40)
    return clean || fallback
}

async function shareFileNativeOrWeb(
    fileName: string,
    mimeType: string,
    data: string,
    isBase64: boolean,
    shareTitle: string
) {
    if (Capacitor.isNativePlatform()) {
        const res = await Filesystem.writeFile({
            path: fileName,
            data,
            directory: Directory.Cache,
            ...(isBase64 ? {} : { encoding: Encoding.UTF8 }),
        })
        await Share.share({
            title: shareTitle,
            files: [res.uri],
        })
        return
    }

    const blob = isBase64
        ? (() => {
              const bin = atob(data)
              const arr = new Uint8Array(bin.length)
              for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
              return new Blob([arr], { type: mimeType })
          })()
        : new Blob([data], { type: mimeType })

    const file = new File([blob], fileName, { type: mimeType })
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: shareTitle, files: [file] })
        return
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareGoalAsFile(goal: Goal, language: string) {
    const payload: SharedGoalPayload = {
        format: "mynotes-share-v1",
        kind: "goal",
        exportedAt: Date.now(),
        goal: {
            title: goal.title,
            description: goal.description || "",
            type: goal.type,
            targetDate: goal.targetDate || "",
            objectives: goal.objectives?.map((s) => ({ ...s })),
            targetValue: goal.targetValue,
            currentValue: goal.currentValue,
            startValue: goal.startValue,
            unit: goal.unit,
            reports: goal.reports?.map((l) => ({ ...l })),
        },
    }
    const fileName = `${slugify(goal.title, "meta")}.mynotes`
    const title = pick(language, {
        es: `Meta: ${goal.title}`,
        en: `Goal: ${goal.title}`,
        zh: `目标：${goal.title}`,
    })
    await shareFileNativeOrWeb(fileName, "application/vnd.mynotes", JSON.stringify(payload, null, 2), false, title)
}

export async function shareNoteAsFile(
    note: { title: string; blocks: Block[]; tags?: string[] },
    language: string
) {
    const payload: SharedNotePayload = {
        format: "mynotes-share-v1",
        kind: "note",
        exportedAt: Date.now(),
        note: {
            title: note.title || "",
            blocks: (note.blocks || []).map((b) => ({ ...b })),
            tags: note.tags ? [...note.tags] : [],
        },
    }
    const fileName = `${slugify(note.title, "nota")}.mynotes`
    const title = pick(language, {
        es: `Nota: ${note.title || "Sin título"}`,
        en: `Note: ${note.title || "Untitled"}`,
        zh: `笔记：${note.title || "无标题"}`,
    })
    await shareFileNativeOrWeb(fileName, "application/vnd.mynotes", JSON.stringify(payload, null, 2), false, title)
}

function stripHtml(html: string): string {
    if (!html) return ""
    const div = document.createElement("div")
    div.innerHTML = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    return (div.textContent || div.innerText || "").replace(/\n{3,}/g, "\n\n").trim()
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const out: string[] = []
    for (const para of text.split(/\r?\n/)) {
        if (!para.trim()) {
            out.push("")
            continue
        }
        const words = para.split(/\s+/)
        let line = ""
        for (const w of words) {
            const test = line ? `${line} ${w}` : w
            if (ctx.measureText(test).width > maxWidth && line) {
                out.push(line)
                line = w
            } else {
                line = test
            }
        }
        if (line) out.push(line)
    }
    return out
}

export async function shareNoteAsJpg(
    note: { title: string; blocks: Block[] },
    language: string
) {
    const width = 1080
    const padX = 72
    const maxW = width - padX * 2
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D unavailable")

    const titleText = (note.title || pick(language, { es: "Nota sin título", en: "Untitled Note", zh: "无标题笔记" })).trim()
    ctx.font = "bold 48px system-ui, -apple-system, sans-serif"
    const titleLines = wrapTextLines(ctx, titleText, maxW)

    type RenderLine = { text: string; kind: "text" | "task-done" | "task" | "sep" | "gap" }
    const bodyLines: RenderLine[] = []
    ctx.font = "400 30px system-ui, -apple-system, sans-serif"

    for (const b of note.blocks || []) {
        if (b.type === "text") {
            const plain = stripHtml(String(b.content || ""))
            if (plain) {
                for (const l of wrapTextLines(ctx, plain, maxW)) {
                    bodyLines.push({ text: l, kind: "text" })
                }
                bodyLines.push({ text: "", kind: "gap" })
            }
        } else if (b.type === "task-list") {
            const listItems = Array.isArray(b.content)
                ? b.content
                : Array.isArray(b.content?.items)
                    ? b.content.items
                    : []
            if (b.content?.title) {
                bodyLines.push({ text: String(b.content.title), kind: "text" })
            }
            for (const it of listItems) {
                const wrapped = wrapTextLines(ctx, String(it.text || ""), maxW - 44)
                wrapped.forEach((l, idx) => {
                    bodyLines.push({
                        text: idx === 0 ? `${it.completed ? "☑" : "☐"}  ${l}` : `     ${l}`,
                        kind: it.completed ? "task-done" : "task",
                    })
                })
            }
            bodyLines.push({ text: "", kind: "gap" })
        } else if (b.type === "table") {
            const rows = Array.isArray(b.content)
                ? b.content
                : Array.isArray(b.content?.rows)
                    ? b.content.rows
                    : []
            for (const row of rows) {
                if (Array.isArray(row)) {
                    const rowStr = row.map((c: any) => String(c ?? "")).join("  |  ")
                    for (const l of wrapTextLines(ctx, rowStr, maxW)) {
                        bodyLines.push({ text: l, kind: "text" })
                    }
                }
            }
            bodyLines.push({ text: "", kind: "gap" })
        } else if (b.type === "separator") {
            bodyLines.push({ text: "", kind: "sep" })
        } else if (b.type === "image") {
            bodyLines.push({ text: "[Imagen adjunta]", kind: "text" })
        } else if (b.type === "file") {
            const fname = b.content?.name || b.content?.fileName || "adjunto"
            bodyLines.push({ text: `[Archivo: ${fname}]`, kind: "text" })
        }
    }

    const lineHeight = 44
    const titleHeight = titleLines.length * 60
    const bodyHeight = Math.max(120, bodyLines.reduce((acc, l) => acc + (l.kind === "gap" ? 20 : l.kind === "sep" ? 28 : lineHeight), 0))
    const height = Math.min(4096, 180 + titleHeight + bodyHeight + 100)

    canvas.width = width
    canvas.height = height

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = "#18181b"
    ctx.fillRect(0, 0, width, 14)

    let y = 96
    ctx.fillStyle = "#09090b"
    ctx.font = "bold 48px system-ui, -apple-system, sans-serif"
    for (const tl of titleLines) {
        ctx.fillText(tl, padX, y)
        y += 60
    }

    y += 12
    ctx.strokeStyle = "#e4e4e7"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(padX, y)
    ctx.lineTo(width - padX, y)
    ctx.stroke()
    y += 52

    ctx.font = "400 30px system-ui, -apple-system, sans-serif"
    for (const item of bodyLines) {
        if (y > height - 90) break
        if (item.kind === "gap") {
            y += 20
            continue
        }
        if (item.kind === "sep") {
            ctx.strokeStyle = "#e4e4e7"
            ctx.beginPath()
            ctx.moveTo(padX, y - 10)
            ctx.lineTo(width - padX, y - 10)
            ctx.stroke()
            y += 28
            continue
        }
        ctx.fillStyle = item.kind === "task-done" ? "#71717a" : "#27272a"
        ctx.fillText(item.text, padX, y)
        y += lineHeight
    }

    ctx.fillStyle = "#a1a1aa"
    ctx.font = "600 22px system-ui, -apple-system, sans-serif"
    ctx.fillText("MyNotes", padX, height - 42)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    const base64 = dataUrl.split(",")[1] || ""
    const fileName = `${slugify(note.title, "nota")}.jpg`
    await shareFileNativeOrWeb(fileName, "image/jpeg", base64, true, titleText)
}

export function importSharedPayload(
    rawJson: string
): { kind: "note"; id: string; title: string } | { kind: "goal"; title: string } | null {
    try {
        const parsed = JSON.parse(rawJson) as Partial<SharedPayload>
        if (!parsed || parsed.format !== "mynotes-share-v1") return null

        const store = useStore.getState()
        if (parsed.kind === "note" && parsed.note) {
            const created = store.addNote({
                title: parsed.note.title || "",
                blocks: Array.isArray(parsed.note.blocks) ? parsed.note.blocks : [],
                tags: Array.isArray(parsed.note.tags) ? parsed.note.tags : [],
            })
            return { kind: "note", id: created.id, title: created.title }
        }

        if (parsed.kind === "goal" && parsed.goal) {
            store.addGoal({
                title: parsed.goal.title || "Meta compartida",
                description: parsed.goal.description || "",
                type: parsed.goal.type || "checklist",
                targetDate: parsed.goal.targetDate || "",
                photos: [],
                objectives: Array.isArray(parsed.goal.objectives) ? parsed.goal.objectives : [],
                targetValue: parsed.goal.targetValue,
                currentValue: parsed.goal.currentValue,
                startValue: parsed.goal.startValue,
                unit: parsed.goal.unit,
                reports: Array.isArray(parsed.goal.reports) ? parsed.goal.reports : [],
            })
            return { kind: "goal", title: parsed.goal.title || "Meta compartida" }
        }
        return null
    } catch {
        return null
    }
}
