"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useStore, Note } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import React, { useState, useEffect, useMemo, useRef, memo } from "react"
import { useSearchParams } from "next/navigation"
import { Plus, StickyNote, Trash2, Calendar, ArrowUpAZ, ArrowDownAZ, Pin, Image as ImageIcon, Film } from "lucide-react"
import { getFileIcon } from "@/lib/file-icons"
import { WelcomeNotesModal } from "@/components/ui/welcome-notes-modal"
import { isNoteEmpty } from "@/lib/note-utils"
import dynamic from "next/dynamic"

const NoteEditor = dynamic(() => import("@/components/notes/note-editor").then(m => m.NoteEditor), { ssr: false })
import { Reveal } from "@/components/ui/reveal"
import { translations } from "@/lib/translations"
import { PageDescription } from "@/components/ui/page-description"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { MobileContextMenu } from "@/components/ui/mobile-context-menu"
import { getLocalImageSrc } from "@/lib/image-utils"
import { useLocalUrl } from "@/hooks/use-local-url"

export default function NotesPage() {
    const notes = useStore(useShallow(state => state.notes))
    const addNote = useStore(state => state.addNote)
    const deleteNote = useStore(state => state.deleteNote)
    const toggleNotePin = useStore(state => state.toggleNotePin)
    const loadAllNotes = useStore(state => state.loadAllNotes)
    const unloadNotes = useStore(state => state.unloadNotes)
    const language = useStore(state => state.language)
    const appColor = useStore(state => state.appColor ?? 'purple')
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
            const aPinned = !!a.isPinned;
            const bPinned = !!b.isPinned;
            if (aPinned !== bPinned) {
                return aPinned ? -1 : 1;
            }
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

    const hasCleanedUp = React.useRef(false)
    useEffect(() => {
        if (!notes || hasCleanedUp.current) return;
        hasCleanedUp.current = true;
        
        notes.forEach(note => {
            if (isNoteEmpty(note.title || '', note.blocks || [])) {
                deleteNote(note.id);
            }
        });
    }, [notes, deleteNote]);

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

    const handleEditNote = React.useCallback((note: Note) => {
        setEditingNote(note)
    }, [])

    const handleDeleteNote = React.useCallback((id: string) => {
        setIsDeleting(id)
    }, [])

    const handleTogglePin = React.useCallback((id: string) => {
        toggleNotePin(id)
    }, [toggleNotePin])

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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                            {/* Create new note button */}
                            <div
                                onClick={() => {
                                    const newNote = addNote({ title: "", blocks: [{ id: Math.random().toString(36).substring(7), type: 'text', content: '' }], tags: [] })
                                    setEditingNote(newNote)
                                    showToast(language === 'es' ? "Nota creada" : "Note created", "success")
                                }}
                                className="glass-panel p-6 rounded-2xl border-dashed border-white/20 hover:border-primary/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 flex flex-col items-center justify-center text-center cursor-pointer min-h-[200px] group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className={`w-12 h-12 rounded-full ${appColor === 'black' ? 'bg-transparent text-foreground' : 'bg-white/5 group-hover:bg-primary/20 group-hover:text-primary'} flex items-center justify-center mb-4 mx-auto transition-all`}>
                                    <Plus className="w-6 h-6" />
                                </div>
                                <span className="font-medium">{t.create}</span>
                            </div>

                            {sortedNotes.map((note) => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    onEdit={handleEditNote}
                                    onDelete={handleDeleteNote}
                                    onTogglePin={handleTogglePin}
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

type NotePreviewMedia =
    | { kind: 'image'; src: string; driveFileId?: string; blockId?: string }
    | { kind: 'video'; thumbSrc: string | null; videoSrc: string | null; name?: string }
    | { kind: 'file'; fileName: string; fileType: string };

const sessionThumbnailFetchedIds = new Set<string>();

function getRawNoteThumbnail(blocks: any[] | undefined): NotePreviewMedia | null {
    if (!blocks || !Array.isArray(blocks)) return null;
    const candidates: NotePreviewMedia[] = [];

    for (const b of blocks) {
        if (!b || typeof b !== 'object') continue;
        if (b.type === 'image' || b.type === 'drawing') {
            if (typeof b.content === 'string' && b.content.trim() !== '') {
                candidates.push({
                    kind: 'image',
                    src: b.content === 'drive://' && b.driveFileId ? `drive://${b.driveFileId}` : b.content,
                    driveFileId: b.driveFileId,
                    blockId: b.id,
                });
            } else if (b.content && typeof b.content === 'object' && typeof b.content.url === 'string' && b.content.url.trim() !== '') {
                candidates.push({ kind: 'image', src: b.content.url, driveFileId: b.driveFileId, blockId: b.id });
            } else if (b.driveFileId && typeof b.driveFileId === 'string' && b.driveFileId.trim() !== '') {
                candidates.push({ kind: 'image', src: `drive://${b.driveFileId}`, driveFileId: b.driveFileId, blockId: b.id });
            }
        } else if (b.type === 'expense-note') {
            const expImg = typeof b.content === 'object' && b.content ? (b.content.imageUrl || b.content.image) : null;
            if (typeof expImg === 'string' && expImg.trim() !== '') {
                candidates.push({ kind: 'image', src: expImg });
            }
        } else if (b.type === 'video') {
            const thumbSrc = typeof b.thumbnailPath === 'string' && b.thumbnailPath.trim() !== '' ? b.thumbnailPath : null;
            const videoSrc = b.content && typeof b.content === 'object' && typeof b.content.url === 'string' && b.content.url.trim() !== '' ? b.content.url : null;
            const name = b.content && typeof b.content === 'object' ? b.content.name : undefined;
            if (thumbSrc || videoSrc || b.driveFileId) {
                candidates.push({ kind: 'video', thumbSrc, videoSrc, name });
            }
        } else if (b.type === 'file') {
            const fileName = (b.content && typeof b.content === 'object' && b.content.name) ? String(b.content.name) : '';
            const fileType = (b.content && typeof b.content === 'object' && b.content.type) ? String(b.content.type) : '';
            if (fileName || fileType || b.driveFileId) {
                candidates.push({ kind: 'file', fileName: fileName || 'Archivo', fileType });
            }
        } else if (b.type === 'text' && typeof b.content === 'string' && (b.content.includes('<img') || b.content.includes('data-inline-file') || b.content.includes('data-file-card'))) {
            // Scan both <img> and inline file cards in document order so the last added item wins
            const tokenRegex = /<div\b[^>]*\b(?:data-inline-file|data-file-card)\b[^>]*>|<img\b([^>]*?)(?:\/>|>)/gi;
            let match;
            while ((match = tokenRegex.exec(b.content)) !== null) {
                const full = match[0];
                if (full.toLowerCase().startsWith('<div')) {
                    const nameMatch = /\bdata-file-name=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(full);
                    const fileName = nameMatch?.[1] || nameMatch?.[2] || nameMatch?.[3];
                    if (fileName) {
                        candidates.push({ kind: 'file', fileName, fileType: '' });
                    }
                } else {
                    const attrs = match[1] || '';
                    const localUriMatch = /\bdata-local-uri=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(attrs);
                    const srcMatch = /\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(attrs);
                    const candidate = localUriMatch?.[1] || localUriMatch?.[2] || localUriMatch?.[3] || srcMatch?.[1] || srcMatch?.[2] || srcMatch?.[3];
                    if (
                        candidate &&
                        !candidate.startsWith('blob:') &&
                        !candidate.includes('/icons/') &&
                        !candidate.includes('icons/')
                    ) {
                        candidates.push({ kind: 'image', src: candidate });
                    }
                }
            }
        }
    }

    if (candidates.length === 0) return null;
    return candidates[candidates.length - 1];
}

const NoteThumbnail = memo(({ media, noteId }: { media: NotePreviewMedia | null; noteId: string }) => {
    const rawImageUrl = media?.kind === 'image' ? media.src : (media?.kind === 'video' ? media.thumbSrc : null);
    const rawVideoUrl = media?.kind === 'video' && !media.thumbSrc ? media.videoSrc : null;
    const resolvedImageUrl = useLocalUrl(rawImageUrl);
    const resolvedVideoUrl = useLocalUrl(rawVideoUrl);
    const [hasError, setHasError] = useState(false);
    const [viewportFetchedUri, setViewportFetchedUri] = useState<string | null>(null);
    const resolvedFetchedUrl = useLocalUrl(viewportFetchedUri);
    const placeholderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setHasError(false);
        setViewportFetchedUri(null);
    }, [rawImageUrl, resolvedImageUrl, rawVideoUrl, resolvedVideoUrl]);

    const effectiveImageUrl = resolvedFetchedUrl || resolvedImageUrl;
    const driveIdToLazyLoad =
        media?.kind === 'image' &&
        !effectiveImageUrl &&
        (media.driveFileId || (media.src.startsWith('drive://') ? media.src.replace('drive://', '') : ''))
            ? (media.driveFileId || media.src.replace('drive://', ''))
            : '';

    useEffect(() => {
        if (!driveIdToLazyLoad || sessionThumbnailFetchedIds.has(driveIdToLazyLoad)) return;
        const el = placeholderRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    observer.disconnect();
                    if (sessionThumbnailFetchedIds.has(driveIdToLazyLoad)) return;
                    sessionThumbnailFetchedIds.add(driveIdToLazyLoad);
                    import('@/lib/attachment-store')
                        .then(({ ensureAttachment }) =>
                            ensureAttachment({
                                driveFileId: driveIdToLazyLoad,
                                noteId,
                                blockId: media?.kind === 'image' ? media.blockId : undefined,
                                type: 'image',
                            })
                        )
                        .then((res) => {
                            if (res.ok && res.uri) {
                                setViewportFetchedUri(res.uri);
                            }
                        })
                        .catch(() => {});
                }
            },
            { rootMargin: '120px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [driveIdToLazyLoad, noteId, media]);

    if (!media) return null;

    if (media.kind === 'file') {
        const { Icon, imageSrc, color, bg } = getFileIcon(media.fileType, media.fileName);
        const ext = (media.fileName.split('.').pop() || media.fileType || 'FILE').toUpperCase();
        const isAudio = ['MP3', 'WAV', 'OGG', 'M4A', 'AUDIO', 'MPEG'].includes(ext);
        return (
            <div className="w-full mt-3 shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/10">
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt={ext}
                        className={`w-8 h-8 object-contain shrink-0 ${isAudio ? 'dark:invert' : ''}`}
                    />
                ) : (
                    <div className={`w-8 h-8 rounded-lg ${bg} ${color} flex items-center justify-center shrink-0`}>
                        <Icon className="w-4 h-4" />
                    </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-foreground truncate">{media.fileName}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ext}</span>
                </div>
            </div>
        );
    }

    if (media.kind === 'video') {
        const validThumb = !!resolvedImageUrl && !hasError && !resolvedImageUrl.startsWith('indexeddb://') && !resolvedImageUrl.startsWith('drive://');
        if (validThumb) {
            return (
                <div className="w-full mt-3 shrink-0 flex justify-center relative">
                    <img
                        src={resolvedImageUrl}
                        alt={media.name || "Video preview"}
                        className="max-w-full max-h-48 w-auto h-auto rounded-xl"
                        style={{ borderRadius: '12px', display: 'block' }}
                        decoding="async"
                        onError={() => setHasError(true)}
                    />
                    <div className="absolute bottom-2 right-2 bg-black/65 text-white rounded-full p-1 pointer-events-none">
                        <Film className="w-3.5 h-3.5" />
                    </div>
                </div>
            );
        }
        const validVideo = !!resolvedVideoUrl && !hasError && !resolvedVideoUrl.startsWith('indexeddb://') && !resolvedVideoUrl.startsWith('drive://');
        if (validVideo) {
            return (
                <div className="w-full mt-3 shrink-0 flex justify-center relative">
                    <video
                        src={`${resolvedVideoUrl}#t=0.1`}
                        preload="metadata"
                        muted
                        playsInline
                        className="max-w-full max-h-48 w-auto h-auto rounded-xl pointer-events-none"
                        onError={() => setHasError(true)}
                    />
                    <div className="absolute bottom-2 right-2 bg-black/65 text-white rounded-full p-1 pointer-events-none">
                        <Film className="w-3.5 h-3.5" />
                    </div>
                </div>
            );
        }
        return (
            <div className="w-full mt-3 shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/10">
                <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Film className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-foreground truncate">{media.name || 'Video'}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">VIDEO</span>
                </div>
            </div>
        );
    }

    const validSrc = !!effectiveImageUrl && !hasError && !effectiveImageUrl.startsWith('indexeddb://') && !effectiveImageUrl.startsWith('drive://');

    if (!validSrc) {
        return (
            <div ref={placeholderRef} className="w-full mt-3 shrink-0 flex justify-center">
                <div className="w-full h-24 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mt-3 shrink-0 flex justify-center">
            <img
                src={effectiveImageUrl}
                alt="Note thumbnail"
                className="max-w-full max-h-48 w-auto h-auto rounded-xl"
                style={{ borderRadius: '12px', display: 'block' }}
                decoding="async"
                onError={() => setHasError(true)}
            />
        </div>
    );
});
NoteThumbnail.displayName = "NoteThumbnail";

const NoteCard = memo(({ note, onEdit, onDelete, onTogglePin, t }: { note: Note; onEdit: (note: Note) => void; onDelete: (id: string) => void; onTogglePin: (id: string) => void; t: any }) => {
    const rawThumb = useMemo(() => getRawNoteThumbnail(note.blocks), [note.blocks]);

    const previewText = useMemo(() => {
        try {
            if (!note.blocks || !Array.isArray(note.blocks) || note.blocks.length === 0) return t.empty;
            const firstBlock = note.blocks[0];
            if (firstBlock && typeof firstBlock === 'object' && firstBlock.type === 'text' && typeof firstBlock.content === 'string') {
                const cleanText = firstBlock.content
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 160);
                return cleanText || t.empty;
            }
            return `[${note.blocks?.length || 0} Blocks]`;
        } catch (e) {
            return "...";
        }
    }, [note.blocks, t.empty]);

    const handleCardClick = React.useCallback(() => {
        onEdit(note);
    }, [note, onEdit]);

    const handlePinClick = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onTogglePin(note.id);
    }, [note.id, onTogglePin]);

    const handleDeleteClick = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(note.id);
    }, [note.id, onDelete]);

    return (
        <MobileContextMenu
            title={note.title || t.untitled}
            onEdit={handleCardClick}
            onDelete={() => onDelete(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
            isPinned={note.isPinned}
        >
            <div
                onClick={handleCardClick}
                style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 220px' }}
                className="glass-panel p-5 sm:p-6 rounded-2xl hover:scale-[1.02] transition-transform duration-150 cursor-pointer group flex flex-col justify-between min-h-[160px] gap-2 relative w-full"
            >
                {/* Pin button */}
                <button
                    onClick={handlePinClick}
                    className={`absolute top-3 right-3 p-1.5 rounded-full transition-all z-10 bg-white dark:bg-zinc-900 shadow-md border border-black/5 dark:border-white/10 ${note.isPinned ? 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100'}`}
                    title={note.isPinned ? "Desfijar nota" : "Fijar nota"}
                >
                    <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-current' : ''}`} />
                </button>
                <div className="flex flex-col justify-between flex-1 min-w-0 pr-8">
                    <div>
                        <h3 className={`text-lg sm:text-xl font-bold mb-2 group-hover:text-primary transition-colors truncate ${!note.title ? 'text-muted-foreground italic' : ''}`}>
                            {typeof note.title === 'string' ? (note.title || t.untitled) : t.untitled}
                        </h3>
                        {/* Preview content */}
                        <div className="text-sm text-muted-foreground overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>
                            {previewText}
                        </div>
                    </div>
                </div>

                <NoteThumbnail media={rawThumb} noteId={note.id} />

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <StickyNote className="w-3 h-3" />
                        <span>{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'No date'}</span>
                    </div>
                    <button
                        onClick={handleDeleteClick}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                        title="Delete Note"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </MobileContextMenu>
    );
}, (prev, next) => {
    return prev.note.id === next.note.id &&
        prev.note.title === next.note.title &&
        prev.note.isPinned === next.note.isPinned &&
        prev.note.lastUpdated === next.note.lastUpdated &&
        prev.note.blocks === next.note.blocks &&
        prev.t === next.t &&
        prev.onEdit === next.onEdit &&
        prev.onDelete === next.onDelete &&
        prev.onTogglePin === next.onTogglePin;
});
NoteCard.displayName = "NoteCard";

