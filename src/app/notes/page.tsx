"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useStore, Note } from "@/lib/store"
import { useState, useEffect, useMemo, memo } from "react"
import { useSearchParams } from "next/navigation"
import { Plus, StickyNote, Trash2, Calendar, ArrowUpAZ, ArrowDownAZ } from "lucide-react"
import { WelcomeNotesModal } from "@/components/ui/welcome-notes-modal"
import { NoteEditor } from "@/components/notes/note-editor"
import { Reveal } from "@/components/ui/reveal"
import { translations } from "@/lib/translations"
import { PageDescription } from "@/components/ui/page-description"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { MobileContextMenu } from "@/components/ui/mobile-context-menu"
import { getLocalImageSrc } from "@/lib/image-utils"

export default function NotesPage() {
    const notes = useStore(state => state.notes)
    const addNote = useStore(state => state.addNote)
    const deleteNote = useStore(state => state.deleteNote)
    const loadAllNotes = useStore(state => state.loadAllNotes)
    const unloadNotes = useStore(state => state.unloadNotes)
    const language = useStore(state => state.language)
    const showToast = useStore(state => state.showToast)
    const t = translations[language].pages.notes
    const common = translations[language].common
    const [editingNote, setEditingNote] = useState<Note | null>(null)
    const [mounted, setMounted] = useState(false)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'az' | 'za'>('recent')
    const [isSortOpen, setIsSortOpen] = useState(false)
    const searchParams = useSearchParams()

    const sortedNotes = useMemo(() => {
        if (!notes) return []
        return [...notes.filter(n => n && typeof n === 'object' && n.id)].sort((a, b) => {
            if (sortBy === 'recent') {
                const timeA = typeof a.lastUpdated === 'number' ? a.lastUpdated : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
                const timeB = typeof b.lastUpdated === 'number' ? b.lastUpdated : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
                return timeB - timeA
            }
            if (sortBy === 'oldest') {
                const timeA = typeof a.lastUpdated === 'number' ? a.lastUpdated : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
                const timeB = typeof b.lastUpdated === 'number' ? b.lastUpdated : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
                return timeA - timeB
            }
            if (sortBy === 'az') {
                const titleA = (a.title || t.untitled || "Untitled Note").trim().toLowerCase()
                const titleB = (b.title || t.untitled || "Untitled Note").trim().toLowerCase()
                return titleA.localeCompare(titleB)
            }
            if (sortBy === 'za') {
                const titleA = (a.title || t.untitled || "Untitled Note").trim().toLowerCase()
                const titleB = (b.title || t.untitled || "Untitled Note").trim().toLowerCase()
                return titleB.localeCompare(titleA)
            }
            return 0
        })
    }, [notes, sortBy, t.untitled])


    useEffect(() => {
        loadAllNotes()
        return () => {
            unloadNotes()
        }
    }, [loadAllNotes, unloadNotes])

    useEffect(() => {
        setMounted(true)
        // Check for noteId in URL to auto-open
        const noteId = searchParams.get('noteId')
        if (noteId && notes) {
            const noteToOpen = notes.find(n => n.id === noteId)
            if (noteToOpen) {
                setEditingNote(noteToOpen)
                window.history.replaceState({}, '', '/notes')
            }
        }
    }, [notes, searchParams])




    const handleCreateNote = () => {
        const newNote = {
            title: "Untitled Note",
            blocks: [], // Empty blocks
            tags: []
        }
        addNote(newNote)
        // We need to find the newly created note to edit it. 
        // Since addNote is sync but generates ID inside, we might need to rely on it being the last one or return ID.
        // For now, we'll just open the editor after a brief delay or Refactor store to return ID.
        // Optimization: Let's just grab the last one from store update or handle it better.
        // A quick hack for this demo:
        setTimeout(() => {
            // This assumes the store updates and we can get the new note. 
            // Better way: Generate ID here.
        }, 100)
    }

    // Revised Create Handler
    const handleCreateAndEdit = () => {
        const id = Math.random().toString(36).substring(7)
        const newNote = {
            id, // Override random ID generation in store if possible, or just accept store generates it. 
            // Actually store ignores ID passed in Omit<Note,'id'>, so we must rely on store.
            // Let's modify store logic slightly in mind, or just filter.
            // Correct approach with current store:
            title: "",
            blocks: [],
            tags: []
        }

        addNote(newNote)

        // Auto-open last note (Naive but works for single user local)
        // effectively we need to wait for re-render.
        // Ideally we create ID here and pass it.
    }

    // Effect to open last created note? No, that's annoying.
    // Let's simple create a "ghost" note in the editor and save it when verified? 
    // Or just iterate notes to find the one with title "Untitled Note" and recent date.

    return (
        <div className="p-6 h-full container mx-auto max-w-5xl">
            <WelcomeNotesModal />
            <Reveal margin="0px" duration={0.4} className="relative z-30">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                        <PageDescription size="xl" dancing="all">{t.description}</PageDescription>
                    </div>

                    {/* Premium Sorting Dropdown Menu */}
                    <div className="relative self-end md:self-auto">
                        <button
                            onClick={() => setIsSortOpen(!isSortOpen)}
                            className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all duration-300 active:scale-95 cursor-pointer rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center"
                            aria-label="Sort Notes"
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="w-5 h-5">
                                <path d="M4 7H16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                <path d="M8 13H16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        </button>
                        <AnimatePresence>
                            {isSortOpen && (
                                <>
                                    {/* Overlay to close the menu on clicking outside */}
                                    <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 mt-2 w-48 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl dark:shadow-2xl p-1.5 z-20 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-200"
                                    >
                                        <button
                                            onClick={() => { setSortBy('recent'); setIsSortOpen(false); }}
                                            className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-bold rounded-lg transition-colors cursor-pointer ${sortBy === 'recent'
                                                ? 'bg-zinc-200 text-zinc-900 dark:bg-primary dark:text-primary-foreground font-semibold'
                                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <Calendar className="w-3.5 h-3.5" />
                                            {language === 'es' ? 'Más reciente primero' : 'Most recent first'}
                                        </button>
                                        <button
                                            onClick={() => { setSortBy('oldest'); setIsSortOpen(false); }}
                                            className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-bold rounded-lg transition-colors cursor-pointer ${sortBy === 'oldest'
                                                ? 'bg-zinc-200 text-zinc-900 dark:bg-primary dark:text-primary-foreground font-semibold'
                                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <Calendar className="w-3.5 h-3.5" />
                                            {language === 'es' ? 'Más antiguo primero' : 'Oldest first'}
                                        </button>
                                        <button
                                            onClick={() => { setSortBy('az'); setIsSortOpen(false); }}
                                            className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-bold rounded-lg transition-colors cursor-pointer ${sortBy === 'az'
                                                ? 'bg-zinc-200 text-zinc-900 dark:bg-primary dark:text-primary-foreground font-semibold'
                                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <ArrowUpAZ className="w-3.5 h-3.5" />
                                            A-Z
                                        </button>
                                        <button
                                            onClick={() => { setSortBy('za'); setIsSortOpen(false); }}
                                            className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-bold rounded-lg transition-colors cursor-pointer ${sortBy === 'za'
                                                ? 'bg-zinc-200 text-zinc-900 dark:bg-primary dark:text-primary-foreground font-semibold'
                                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <ArrowDownAZ className="w-3.5 h-3.5" />
                                            Z-A
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </header>
            </Reveal>

            <div className="relative z-10">
                    {!mounted ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                            <div className="glass-panel p-6 rounded-2xl border-dashed border-white/20 flex flex-col items-center justify-center min-h-[200px]" />
                            <NoteCardSkeleton />
                            <NoteCardSkeleton />
                        </div>
                    ) : (
                        // Plain CSS grid — no virtualization.
                        // VirtuosoGrid was causing scroll-position jumps: it measures each row height
                        // dynamically and corrects the scroll offset whenever a measurement changes.
                        // Since thumbnail images load asynchronously, each card's height was
                        // changing post-render → Virtuoso corrected scroll → visible jump.
                        // For a local notes list (rarely >500 items) a simple grid is faster,
                        // stable, and eliminates this entire category of scroll bugs.
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                            {/* Create new note button */}
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    const newNote = addNote({ title: "", blocks: [{ id: Math.random().toString(36).substring(7), type: 'text', content: '' }], tags: [] })
                                    setEditingNote(newNote)
                                    showToast(language === 'es' ? "Nota creada" : "Note created", "success")
                                }}
                                className="glass-panel p-6 rounded-2xl border-dashed border-white/20 hover:border-primary/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[200px] group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 mx-auto group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <span className="font-medium">{t.create}</span>
                            </motion.div>

                            {sortedNotes.map((note) => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    onEdit={() => setEditingNote(note)}
                                    onDelete={() => setIsDeleting(note.id)}
                                    t={t}
                                />
                            ))}
                        </div>
                    )}
            </div>

            {/* Editor Modal */}
            {editingNote && (
                <NoteEditor
                    note={editingNote}
                    onClose={() => setEditingNote(null)}
                />
            )}

            <ConfirmationDialog
                isOpen={!!isDeleting}
                onClose={() => setIsDeleting(null)}
                onConfirm={() => {
                    if (isDeleting) {
                        deleteNote(isDeleting)
                        showToast(language === 'es' ? "Nota eliminada" : "Note deleted", "info")
                    }
                }}
                title={t.confirmDelete || "¿Eliminar esta nota?"}
                message={language === 'es' ? "Esta nota se eliminará permanentemente." : "This note will be permanently deleted."}
            />
        </div>
    )
}

// GridContainer and ItemContainer were Virtuoso-specific wrappers — removed along with VirtuosoGrid.

const NoteCardSkeleton = () => (
    <div className="animate-pulse glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between min-h-[200px]">
        <div>
            <div className="h-6 bg-zinc-300 dark:bg-zinc-800 rounded w-3/4 mb-4" />
            <div className="space-y-2">
                <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-full" />
                <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-5/6" />
                <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-2/3" />
            </div>
        </div>
        <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-1/3 mt-4" />
    </div>
)

const NoteCard = memo(({ note, onEdit, onDelete, t }: { note: Note; onEdit: () => void; onDelete: () => void; t: any }) => {
    // Compute thumbnail src synchronously from note blocks.
    // IMPORTANT: thumbSrc is derived only from already-stored data (no async fetch),
    // so it is either a string or null from the very first render — no state update needed.
    const thumbSrc = useMemo(() => {
        if (!note.blocks) return null;
        const imageBlocks = note.blocks.filter(
            (b): b is any => b.type === 'image' && typeof b.content === 'string' && b.content !== ''
        );
        const lastContent = imageBlocks.length > 0 ? imageBlocks[imageBlocks.length - 1].content : null;
        return lastContent ? getLocalImageSrc(lastContent) : null;
    }, [note.blocks]);

    return (
        <MobileContextMenu
            title={note.title || t.untitled}
            onEdit={onEdit}
            onDelete={onDelete}
        >
            <div
                onClick={onEdit}
                className="glass-panel p-6 rounded-2xl hover:scale-[1.02] transition-transform cursor-pointer group flex flex-row items-start justify-between min-h-[160px] gap-4"
            >
                <div className="flex flex-col justify-between h-full flex-1 min-w-0">
                    <div>
                        <h3 className={`text-xl font-bold mb-2 group-hover:text-primary transition-colors truncate ${!note.title ? 'text-muted-foreground italic' : ''}`}>
                            {typeof note.title === 'string' ? (note.title || t.untitled) : t.untitled}
                        </h3>
                        {/* Preview content */}
                        <div className="text-sm text-muted-foreground overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>
                            {(() => {
                                try {
                                    if (!note.blocks || !Array.isArray(note.blocks) || note.blocks.length === 0) return t.empty
                                    const firstBlock = note.blocks[0]
                                    if (firstBlock && typeof firstBlock === 'object' && firstBlock.type === 'text' && typeof firstBlock.content === 'string') {
                                        const cleanText = firstBlock.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
                                        return cleanText || t.empty
                                    }
                                    return `[${note.blocks?.length || 0} Blocks]`
                                } catch (e) {
                                    console.error("Preview error:", e)
                                    return "..."
                                }
                            })()}
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <StickyNote className="w-3 h-3" />
                            <span>{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'No date'}</span>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.2, rotate: 10 }}
                            whileTap={{ scale: 0.8, rotate: -10 }}
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete()
                            }}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Note"
                        >
                            <Trash2 className="w-4 h-4" />
                        </motion.button>
                    </div>
                </div>

                {/*
                  * FIX — Layout-shift prevention:
                  * The thumbnail slot is ALWAYS rendered at 72×72, whether or not this note
                  * has an image. This locks the card's total height from the very first render.
                  *
                  * Before: {thumbSrc && <div ...><img /></div>}
                  *   → card grew by 72px the moment the image src resolved → layout shift
                  *   → VirtuosoGrid detected the changed row height and corrected scroll position
                  *   → visible jump/flicker.
                  *
                  * After: the slot is always in the DOM; when thumbSrc is null the slot is
                  * invisible (opacity-0) but still occupies 72×72. The card height never changes
                  * after mount → no layout shift → no scroll correction needed.
                  *
                  * The image fades in (opacity transition) after the browser fires onLoad —
                  * a pure compositor animation that does not affect layout at all.
                  */}
                <div
                    className="flex-none w-[72px] h-[72px] rounded-xl overflow-hidden self-start mt-1 shrink-0 bg-black/10 dark:bg-white/5"
                    style={{ opacity: thumbSrc ? 1 : 0, pointerEvents: thumbSrc ? 'auto' : 'none' }}
                    aria-hidden={!thumbSrc}
                >
                    {thumbSrc && (
                        <img
                            src={thumbSrc}
                            alt="Note thumbnail"
                            className="note-thumb w-full h-full object-cover"
                            loading="lazy"
                            onLoad={(e) => (e.currentTarget as HTMLImageElement).classList.add('note-thumb--loaded')}
                        />
                    )}
                </div>
            </div>
        </MobileContextMenu>
    )
})
NoteCard.displayName = "NoteCard"

