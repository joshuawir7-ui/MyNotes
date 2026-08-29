"use client"

import { getLocalImageSrc } from "@/lib/image-utils"
import React, { useState, useRef, useEffect, useCallback } from "react"
import { useStore, Note, NoteBlock, BlockType } from "@/lib/store"
import { translations } from "@/lib/translations"
import { motion, AnimatePresence } from "framer-motion"
import { App as CapacitorApp } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { X, Type, CheckSquare, Table as TableIcon, Image as ImageIcon, PenTool, Share2, Trash2, StickyNote, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Eraser, ChevronUp, ChevronDown, Check, Plus, Minus, SeparatorHorizontal, Cloud, CheckCircle2, AlertCircle, Paperclip, FileIcon, FileText, FileSpreadsheet, FileAudio, Presentation, Film, PictureInPicture } from "lucide-react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

const isNoteEmpty = (titleStr: string, blocksList: NoteBlock[]) => {
    if (titleStr.trim() !== '') return false;
    for (const block of blocksList) {
        if (!block) continue;
        if (block.type === 'text') {
            const textContent = typeof block.content === 'string' ? block.content : '';
            const cleanText = textContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            if (cleanText !== '') return false;
        } else if (block.type === 'task-list') {
            let listTitle = '';
            let items: any[] = [];
            if (block.content && typeof block.content === 'object' && !Array.isArray(block.content)) {
                listTitle = block.content.title || '';
                items = Array.isArray(block.content.items) ? block.content.items : [];
            } else {
                items = Array.isArray(block.content) ? block.content : [];
            }
            if (listTitle.trim() !== '') return false;
            for (const item of items) {
                if (item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim() !== '') {
                    return false;
                }
            }
        } else if (block.type === 'table') {
            const content = block.content || { headers: [], rows: [] };
            const headers = Array.isArray(content.headers) ? content.headers : [];
            const rows = Array.isArray(content.rows) ? content.rows : [];
            for (const h of headers) {
                if (typeof h === 'string' && h.trim() !== '') return false;
            }
            for (const r of rows) {
                if (Array.isArray(r)) {
                    for (const c of r) {
                        if (typeof c === 'string' && c.trim() !== '') return false;
                    }
                }
            }
        } else if (block.type === 'image') {
            if (typeof block.content === 'string' && block.content.trim() !== '') return false;
        } else if (block.type === 'drawing') {
            if (typeof block.content === 'string' && block.content.trim() !== '') return false;
        } else if (block.type === 'file') {
            if (block.content && typeof block.content === 'object' && block.content.url !== '') return false;
        }
    }
    return true;
};

interface NoteEditorProps {
    note: Note
    onClose: () => void
}

export function NoteEditor({ note, onClose }: NoteEditorProps) {
    const updateNote = useStore(state => state.updateNote)
    const deleteNote = useStore(state => state.deleteNote)
    const language = useStore(state => state.language)
    const showToast = useStore(state => state.showToast)
    const storeNote = useStore(state => state.notes.find(n => n.id === note.id))
    const [title, setTitle] = useState(note.title)
    const [blocks, setBlocks] = useState<NoteBlock[]>(note.blocks || [])

    useEffect(() => {
        if (storeNote) {
            setBlocks(storeNote.blocks || []);
            setTitle(storeNote.title || '');
        }
    }, [storeNote?.lastUpdated])
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isKeyboardToolbarVisible, setIsKeyboardToolbarVisible] = useState(false)
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
    const [viewportOffset, setViewportOffset] = useState(0)
    const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null)

    const [isLandscape, setIsLandscape] = useState(false)
    const [showHeader, setShowHeader] = useState(true)
    const lastScrollTop = useRef(0)
    const contentContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return
        const checkOrientation = () => {
            setIsLandscape(window.innerWidth > window.innerHeight)
        }
        checkOrientation()
        window.addEventListener('resize', checkOrientation)
        return () => window.removeEventListener('resize', checkOrientation)
    }, [])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop
        lastScrollTop.current = scrollTop
    }

    useEffect(() => {
        let backListener: any;
        const setupBackListener = async () => {
            try {
                backListener = await CapacitorApp.addListener('backButton', () => {
                    handleCloseRef.current?.();
                });
            } catch (e) {
                console.error("Back button listener failed", e);
            }
        };
        setupBackListener();

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleCloseRef.current?.();
        }
        window.addEventListener('keydown', handleEscape)

        if (typeof window === 'undefined' || !window.visualViewport) return

        const handleResize = () => {
            const vv = window.visualViewport
            if (vv) {
                const offset = window.innerHeight - vv.height
                setViewportOffset(offset > 0 ? offset : 0)
            }
        }

        window.visualViewport.addEventListener('resize', handleResize)
        handleResize()

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize)
        }
    }, [])

    const [formatStates, setFormatStates] = useState({
        bold: false,
        italic: false,
        underline: false,
        justifyLeft: false,
        justifyCenter: false,
        justifyRight: false,
        insertUnorderedList: false,
        insertOrderedList: false,
        h1: false,
        h2: false,
        h3: false,
    })

    const formatStatesRef = useRef(formatStates)
    useEffect(() => {
        formatStatesRef.current = formatStates
    }, [formatStates])

    const updateFormatStates = useCallback(() => {
        if (typeof document === 'undefined') return

        let isH1 = false;
        let isH2 = false;
        let isH3 = false;

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).startContainer;
            while (node && node !== document.body) {
                const nodeName = node.nodeName.toLowerCase();
                if (nodeName === 'h1') isH1 = true;
                if (nodeName === 'h2') isH2 = true;
                if (nodeName === 'h3') isH3 = true;
                node = node.parentNode as Node;
            }
        }

        const nextStates = {
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            justifyLeft: document.queryCommandState('justifyLeft'),
            justifyCenter: document.queryCommandState('justifyCenter'),
            justifyRight: document.queryCommandState('justifyRight'),
            insertUnorderedList: document.queryCommandState('insertUnorderedList'),
            insertOrderedList: document.queryCommandState('insertOrderedList'),
            h1: isH1,
            h2: isH2,
            h3: isH3,
        };

        const currentStates = formatStatesRef.current;
        const hasChanged =
            nextStates.bold !== currentStates.bold ||
            nextStates.italic !== currentStates.italic ||
            nextStates.underline !== currentStates.underline ||
            nextStates.justifyLeft !== currentStates.justifyLeft ||
            nextStates.justifyCenter !== currentStates.justifyCenter ||
            nextStates.justifyRight !== currentStates.justifyRight ||
            nextStates.insertUnorderedList !== currentStates.insertUnorderedList ||
            nextStates.insertOrderedList !== currentStates.insertOrderedList ||
            nextStates.h1 !== currentStates.h1 ||
            nextStates.h2 !== currentStates.h2 ||
            nextStates.h3 !== currentStates.h3;

        if (hasChanged) {
            setFormatStates(nextStates);
        }
    }, [])

    const applyHeading = (tag: 'h1' | 'h2' | 'h3') => {
        if (typeof document === 'undefined') return
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        let isCurrentHeadingActive = false
        let node = selection.getRangeAt(0).startContainer
        while (node && node !== document.body) {
            if (node.nodeName.toLowerCase() === tag) {
                isCurrentHeadingActive = true
                break
            }
            node = node.parentNode as Node
        }

        if (isCurrentHeadingActive) {
            document.execCommand('formatBlock', false, '<p>')
        } else {
            document.execCommand('formatBlock', false, `<${tag}>`)
        }
        updateFormatStates()
    }

    const applyFormat = (command: string, value: string = '') => {
        document.execCommand(command, false, value)
        updateFormatStates()
    }

    // Register selection change listener to update format toolbar buttons state
    useEffect(() => {
        let frameId: number;
        const handler = () => {
            if (!isKeyboardToolbarVisible) return;
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                updateFormatStates();
            });
        }
        document.addEventListener('selectionchange', handler)
        return () => {
            cancelAnimationFrame(frameId);
            document.removeEventListener('selectionchange', handler);
        }
    }, [isKeyboardToolbarVisible, updateFormatStates])

    const moveBlock = useCallback((index: number, direction: 'up' | 'down') => {
        setBlocks(prev => {
            const newIndex = direction === 'up' ? index - 1 : index + 1
            if (newIndex < 0 || newIndex >= prev.length) return prev

            const newBlocks = [...prev]
            const temp = newBlocks[index]
            newBlocks[index] = newBlocks[newIndex]
            newBlocks[newIndex] = temp
            return newBlocks
        })
    }, [])

    // Safety check for translations
    const langSection = translations[language] || translations.en
    const t = langSection.common || translations.en.common
    const noteTranslations = langSection.pages?.notes || translations.en.pages.notes

    const titleInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        // We will autofocus the text body instead of the title based on the user's request.
        // The title auto-focus effect has been removed.
    }, [])

    useEffect(() => {
        console.log("NoteEditor mounted for note:", note.id)
    }, [note.id])

    const titleRef = useRef(title)
    const blocksRef = useRef(blocks)
    titleRef.current = title
    blocksRef.current = blocks
    const skipSaveRef = useRef(false)
    const lastSavedValuesRef = useRef({ title: note.title, blocks: note.blocks || [] })

    const handleCloseRef = useRef<() => void>(undefined)
    handleCloseRef.current = () => {
        const initialHadContent = (note.blocks && note.blocks.length > 0) || (typeof note.title === 'string' && note.title.trim() !== '');
        if (isNoteEmpty(titleRef.current, blocksRef.current) && !initialHadContent) {
            skipSaveRef.current = true
            deleteNote(note.id)
            showToast(language === 'es' ? "Nota vacía eliminada" : "Empty note deleted", "info")
        }
        onClose()
    }

    // Save on unmount or when the window/app is closed (unload/beforeunload)
    useEffect(() => {
        const hasUnsavedChanges = () => {
            return titleRef.current !== lastSavedValuesRef.current.title ||
                JSON.stringify(blocksRef.current) !== JSON.stringify(lastSavedValuesRef.current.blocks)
        }

        const handleUnload = () => {
            if (skipSaveRef.current) return
            if (hasUnsavedChanges()) {
                const initialHadContent = (note.blocks && note.blocks.length > 0) || (typeof note.title === 'string' && note.title.trim() !== '');
                if (isNoteEmpty(titleRef.current, blocksRef.current) && !initialHadContent) {
                    deleteNote(note.id)
                } else {
                    updateNote(note.id, titleRef.current, blocksRef.current)
                }
                lastSavedValuesRef.current = { title: titleRef.current, blocks: blocksRef.current }
            }
        }

        window.addEventListener('beforeunload', handleUnload)
        window.addEventListener('pagehide', handleUnload)

        return () => {
            handleUnload()
            window.removeEventListener('beforeunload', handleUnload)
            window.removeEventListener('pagehide', handleUnload)
        }
    }, [note.id])

    // Debounce save (Auto-save) after 5 seconds of inactivity
    useEffect(() => {
        const timeout = setTimeout(() => {
            handleSave(true)
        }, 5000)
        return () => clearTimeout(timeout)
    }, [blocks, title, note.id])

    const handleSave = async (isAuto = false) => {
        if (!isAuto) setIsSaving(true)

        updateNote(note.id, title, blocks)
        lastSavedValuesRef.current = { title, blocks }

        if (!isAuto) {
            // Artificial delay for feedback if manual
            await new Promise(r => setTimeout(r, 500))
            setIsSaving(false)
            setLastSaved(new Date().toLocaleTimeString())
            showToast(language === 'es' ? "Nota guardada" : "Note saved", "success")

            // Clear "Saved" feedback after 3s
            setTimeout(() => setLastSaved(null), 3000)
        }
    }

    const scrollToBlock = (blockId: string) => {
        setTimeout(() => {
            const element = document.getElementById(`block-${blockId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    }

    const addBlock = (type: BlockType, afterBlockId?: string | null) => {
        const newBlock: NoteBlock = {
            id: Math.random().toString(36).substring(7),
            type,
            content: getDefaultContent(type)
        }

        const currentActiveId = afterBlockId || activeBlockId
        if (currentActiveId) {
            const index = blocks.findIndex(b => b.id === currentActiveId)
            if (index !== -1) {
                const newBlocks = [...blocks]
                const insertIndex = type === 'separator' ? index : index + 1
                newBlocks.splice(insertIndex, 0, newBlock)
                setBlocks(newBlocks)
                scrollToBlock(newBlock.id)
                return
            }
        }

        setBlocks([...blocks, newBlock])
        scrollToBlock(newBlock.id)
    }

    const updateBlock = useCallback((id: string, content: any, extraProps?: any) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, content, ...extraProps } : b))
    }, [])

    const removeBlock = useCallback((id: string) => {
        setBlocks(prev => prev.filter(b => b.id !== id))
    }, [])

    const handleWrapperFocus = useCallback((id: string, type: BlockType) => {
        setActiveBlockId(id);
        if (type === 'text' || type === 'task-list' || type === 'table') {
            setIsKeyboardToolbarVisible(true);
            setTimeout(updateFormatStates, 50);
        } else {
            setIsKeyboardToolbarVisible(false);
        }
    }, [updateFormatStates]);

    const handleWrapperBlur = useCallback((_currentTarget: HTMLElement) => {
        // Mobile soft keyboards (Gboard/Samsung), autocorrect suggestion taps, and scroll gestures
        // trigger transient blur events. We keep the toolbar visible while editing to prevent it from disappearing.
    }, []);

    const handleImageClick = useCallback((url: string) => {
        setFullscreenImageUrl(url);
    }, [])

    const getDefaultContent = (type: BlockType) => {
        switch (type) {
            case 'text': return ''
            case 'task-list': return [{ id: '1', text: 'New Item', checked: false }]
            case 'table': return { headers: ['Col 1', 'Col 2'], rows: [['', '']] }
            case 'image': return '' // URL
            case 'drawing': return '' // Data URL
            case 'file': return { url: '', name: '', type: '' }
            case 'video': return { url: '', name: '', type: '' }
            default: return ''
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl h-[90vh] bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-white/10 rounded-2xl flex flex-col relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">

                {/* PREMIUM HEADER - Collapse and adapt on landscape/portrait */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${showHeader
                        ? (isLandscape ? 'max-h-16 opacity-100 py-2 px-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent' : 'max-h-48 opacity-100 p-4 md:p-6 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent')
                        : 'max-h-0 opacity-0 py-0 border-none pointer-events-none'
                    }`}>
                    {isLandscape ? (
                        /* Landscape Combined Header */
                        <div className="flex items-center justify-between gap-3 h-10">
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                <StickyNote className="w-5 h-5 text-primary shrink-0" />
                                <span className="hidden sm:inline text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground shrink-0">{language === 'es' ? 'Nota:' : 'Note:'}</span>
                                <input
                                    ref={titleInputRef}
                                    className="text-base md:text-lg font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/30 dark:placeholder:text-white/40 flex-1 min-w-[85px] tracking-tight text-foreground"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={noteTranslations.untitled || "Untitled Note"}
                                />
                            </div>

                            {/* Toolbar Buttons Embedded in Landscape Header */}
                            <div className="flex items-center gap-1 px-2 bg-white/5 rounded-full border border-white/5 py-0.5">
                                <button onClick={() => addBlock('text')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-all" title={language === 'es' ? "Texto" : "Text"}>
                                    <Type className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => addBlock('task-list')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-all" title={language === 'es' ? "Lista" : "Task List"}>
                                    <CheckSquare className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => addBlock('table')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-all" title={language === 'es' ? "Tabla" : "Table"}>
                                    <TableIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => addBlock('image')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-all" title={language === 'es' ? "Imagen" : "Image"}>
                                    <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => addBlock('video')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-all" title={language === 'es' ? "Video" : "Video"}>
                                    <Film className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => addBlock('drawing')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-all" title={language === 'es' ? "Dibujo" : "Drawing"}>
                                    <PenTool className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => addBlock('file')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-all" title={language === 'es' ? "Archivo" : "File"}>
                                    <Paperclip className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => addBlock('separator')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-all" title={language === 'es' ? "Separador" : "Separator"}>
                                    <SeparatorHorizontal className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => handleSave()}
                                    disabled={isSaving}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-bold shadow-lg ${lastSaved
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-purple-500/20'
                                        }`}
                                >
                                    <span>{isSaving ? '...' : lastSaved ? (language === 'es' ? 'Guardado' : 'Saved') : (language === 'es' ? 'Guardar' : 'Save')}</span>
                                </button>
                                <button className="p-1.5 rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 transition-all border border-white/10 active:scale-95">
                                    <Share2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setIsDeleting(true)}
                                    className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-full transition-colors active:scale-95"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleCloseRef.current?.()} className="p-1.5 hover:bg-white/10 rounded-full transition-colors active:scale-95">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Portrait Standard Header */
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-2 w-full">
                                <div className="flex items-center gap-2 md:gap-3 text-muted-foreground overflow-hidden flex-1 mr-2">
                                    <StickyNote className="w-5 h-5 text-primary shrink-0" />
                                    <input
                                        ref={titleInputRef}
                                        className="text-base md:text-xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/30 dark:placeholder:text-white/40 flex-1 min-w-0 tracking-tight text-foreground"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder={noteTranslations.untitled || "Untitled Note"}
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                                    <button
                                        onClick={() => handleSave()}
                                        disabled={isSaving}
                                        className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-1.5 md:py-2 rounded-full transition-all text-xs md:text-sm font-bold shadow-lg ${lastSaved
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-purple-500/20'
                                            }`}
                                    >
                                        <span className="hidden xs:inline">{isSaving ? langSection.common.saving : lastSaved ? langSection.common.saved : langSection.common.save}</span>
                                        <span className="xs:hidden inline">{isSaving ? '...' : langSection.common.save}</span>
                                    </button>
                                    <button className="p-1.5 md:p-2.5 rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 transition-all border border-white/10 active:scale-95">
                                        <Share2 className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                    <button
                                        onClick={() => setIsDeleting(true)}
                                        className="p-1.5 md:p-2.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-full transition-colors active:scale-95"
                                    >
                                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                    <button onClick={() => handleCloseRef.current?.()} className="p-1.5 md:p-2.5 hover:bg-white/10 rounded-full transition-colors active:scale-95 ml-0.5 md:ml-2">
                                        <X className="w-5 h-5 md:w-6 md:h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Mobile Toolbar (Options) moved to the top of standard portrait header */}
                            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1.5 border-t border-white/5 mt-1">
                                <ToolbarButton icon={Type} label={language === 'es' ? "Texto" : "Text"} onClick={() => addBlock('text')} />
                                <ToolbarButton icon={CheckSquare} label={language === 'es' ? "Lista" : "Task List"} onClick={() => addBlock('task-list')} />
                                <ToolbarButton icon={TableIcon} label={language === 'es' ? "Tabla" : "Table"} onClick={() => addBlock('table')} />
                                <ToolbarButton icon={ImageIcon} label={language === 'es' ? "Imagen" : "Image"} onClick={() => addBlock('image')} />
                                <ToolbarButton icon={Film} label={language === 'es' ? "Video" : "Video"} onClick={() => addBlock('video')} />
                                <ToolbarButton icon={PenTool} label={language === 'es' ? "Dibujo" : "Drawing"} onClick={() => addBlock('drawing')} />
                                <ToolbarButton icon={Paperclip} label={language === 'es' ? "Archivo" : "File"} onClick={() => addBlock('file')} />
                                <ToolbarButton icon={SeparatorHorizontal} label={language === 'es' ? "Separador" : "Separator"} onClick={() => addBlock('separator')} />
                            </div>
                        </div>
                    )}
                </div>


                {/* Content */}
                <div
                    ref={contentContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-5 md:p-8 space-y-2"
                >

                    {blocks.length === 0 && (
                        <div className="text-center text-muted-foreground mt-20 italic">
                            {language === 'es' ? "Comienza añadiendo un bloque desde la barra superior." : "Start by adding a block from the toolbar above."}
                        </div>
                    )}
                    <AnimatePresence initial={false} mode="popLayout">
                        {blocks.filter(b => b && typeof b === 'object' && b.id).map((block, idx) => (
                            <BlockWrapper
                                key={block.id}
                                block={block}
                                idx={idx}
                                isFirst={idx === 0}
                                isLast={idx === blocks.length - 1}
                                language={language}
                                moveBlock={moveBlock}
                                removeBlock={removeBlock}
                                updateBlock={updateBlock}
                                handleImageClick={handleImageClick}
                                handleWrapperFocus={handleWrapperFocus}
                                handleWrapperBlur={handleWrapperBlur}
                                autoFocus={idx === 0 && note.title === ''}
                                noteId={note.id}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
            <ConfirmationDialog
                isOpen={isDeleting}
                onClose={() => setIsDeleting(false)}
                onConfirm={() => {
                    skipSaveRef.current = true
                    deleteNote(note.id)
                    showToast(language === 'es' ? "Nota eliminada" : "Note deleted", "info")
                    onClose()
                }}
                title={language === 'es' ? '¿Eliminar esta nota?' : 'Delete this note?'}
                message={language === 'es' ? 'Esta nota se eliminará permanentemente.' : 'This note will be permanently deleted.'}
            />

            {/* Keyboard Floating Toolbar */}
            <AnimatePresence>
                {isKeyboardToolbarVisible && (
                    <motion.div
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 26, stiffness: 320 }}
                        style={{ bottom: `${viewportOffset}px` }}
                        className="fixed left-0 right-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-white/10 p-2 flex items-center justify-between shadow-2xl"
                    >
                        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 pr-2">
                            {/* Block Management Group */}
                            {activeBlockId && (
                                <>
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            const idx = blocks.findIndex(b => b.id === activeBlockId);
                                            if (idx > 0) moveBlock(idx, 'up');
                                        }}
                                        disabled={blocks.findIndex(b => b.id === activeBlockId) === 0}
                                        className="p-1.5 rounded-md text-zinc-700 dark:text-white/70 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 shrink-0"
                                        title={language === 'es' ? "Subir Bloque" : "Move Block Up"}
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            const idx = blocks.findIndex(b => b.id === activeBlockId);
                                            if (idx !== -1 && idx < blocks.length - 1) moveBlock(idx, 'down');
                                        }}
                                        disabled={blocks.findIndex(b => b.id === activeBlockId) === blocks.length - 1}
                                        className="p-1.5 rounded-md text-zinc-700 dark:text-white/70 hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 shrink-0"
                                        title={language === 'es' ? "Bajar Bloque" : "Move Block Down"}
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            if (activeBlockId) {
                                                removeBlock(activeBlockId);
                                                setActiveBlockId(null);
                                                setIsKeyboardToolbarVisible(false);
                                            }
                                        }}
                                        className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-all active:scale-95 shrink-0"
                                        title={language === 'es' ? "Eliminar Bloque" : "Delete Block"}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <div className="w-[1px] h-5 bg-zinc-200 dark:bg-white/10 mx-1 shrink-0" />
                                </>
                            )}

                            {/* Headings Group */}
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    applyHeading('h1');
                                }}
                                className={`px-3 py-1.5 rounded-md text-xs font-extrabold transition-all active:scale-95 shrink-0 ${formatStates.h1
                                        ? "bg-purple-600/20 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/30"
                                        : "text-zinc-700 dark:text-white/70 hover:bg-zinc-100 dark:hover:bg-white/10"
                                    }`}
                                title="H1"
                            >
                                H1
                            </button>
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    applyHeading('h2');
                                }}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all active:scale-95 shrink-0 ${formatStates.h2
                                        ? "bg-purple-600/20 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/30"
                                        : "text-zinc-700 dark:text-white/70 hover:bg-zinc-100 dark:hover:bg-white/10"
                                    }`}
                                title="H2"
                            >
                                H2
                            </button>
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    applyHeading('h3');
                                }}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all active:scale-95 shrink-0 ${formatStates.h3
                                        ? "bg-purple-600/20 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/30"
                                        : "text-zinc-700 dark:text-white/70 hover:bg-zinc-100 dark:hover:bg-white/10"
                                    }`}
                                title="H3"
                            >
                                H3
                            </button>

                            <div className="w-[1px] h-5 bg-zinc-200 dark:bg-white/10 mx-1 shrink-0" />

                            {/* Formatting Group */}
                            <FormatButton icon={Bold} label="Negrita" onClick={() => applyFormat('bold')} active={formatStates.bold} />
                            <FormatButton icon={Italic} label="Cursiva" onClick={() => applyFormat('italic')} active={formatStates.italic} />
                            <FormatButton icon={Underline} label="Subrayado" onClick={() => applyFormat('underline')} active={formatStates.underline} />

                            <div className="w-[1px] h-5 bg-zinc-200 dark:bg-white/10 mx-1 shrink-0" />

                            {/* Alignment Group */}
                            <FormatButton icon={AlignLeft} label="Alinear Izquierda" onClick={() => applyFormat('justifyLeft')} active={formatStates.justifyLeft} />
                            <FormatButton icon={AlignCenter} label="Centrar" onClick={() => applyFormat('justifyCenter')} active={formatStates.justifyCenter} />
                            <FormatButton icon={AlignRight} label="Alinear Derecha" onClick={() => applyFormat('justifyRight')} active={formatStates.justifyRight} />

                            <div className="w-[1px] h-5 bg-zinc-200 dark:bg-white/10 mx-1 shrink-0" />

                            {/* Lists Group */}
                            <FormatButton icon={List} label="Viñetas" onClick={() => applyFormat('insertUnorderedList')} active={formatStates.insertUnorderedList} />
                            <FormatButton icon={ListOrdered} label="Numeración" onClick={() => applyFormat('insertOrderedList')} active={formatStates.insertOrderedList} />

                            <div className="w-[1px] h-5 bg-zinc-200 dark:bg-white/10 mx-1 shrink-0" />

                            {/* Highlighters Group */}
                            <span className="text-[9px] uppercase font-bold text-zinc-500 dark:text-white/40 tracking-wider shrink-0 mr-1">{language === 'es' ? "Resaltar:" : "Highlight:"}</span>
                            <HighlightButton color="#fef08a" label={language === 'es' ? "Amarillo" : "Yellow"} onClick={() => applyFormat('backColor', '#fef08a')} />
                            <HighlightButton color="#bbf7d0" label={language === 'es' ? "Verde" : "Green"} onClick={() => applyFormat('backColor', '#bbf7d0')} />
                            <HighlightButton color="#bfdbfe" label={language === 'es' ? "Azul" : "Blue"} onClick={() => applyFormat('backColor', '#bfdbfe')} />
                            <HighlightButton color="#fecaca" label={language === 'es' ? "Rojo" : "Red"} onClick={() => applyFormat('backColor', '#fecaca')} />
                            <HighlightButton color="#e9d5ff" label={language === 'es' ? "Morado" : "Purple"} onClick={() => applyFormat('backColor', '#e9d5ff')} />
                            <FormatButton icon={Eraser} label={language === 'es' ? "Borrar" : "Clear"} onClick={() => applyFormat('backColor', 'transparent')} />
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => {
                                (document.activeElement as HTMLElement)?.blur();
                                setIsKeyboardToolbarVisible(false);
                            }}
                            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-700 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-95 shrink-0 ml-1 border-l border-zinc-200 dark:border-white/10 pl-2.5"
                            title="Cerrar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
            {fullscreenImageUrl && (
                <div
                    className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setFullscreenImageUrl(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
                        onClick={() => setFullscreenImageUrl(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={getLocalImageSrc(fullscreenImageUrl || '')}
                        alt="Fullscreen attachment"
                        className="max-w-full max-h-[90vh] object-contain rounded-xl animate-in zoom-in-95 duration-200"
                    />
                </div>
            )}
        </div>
    )
}

function ToolbarButton({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/10 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    )
}

// Sub-components for blocks (Inline for simplicity now, could separate)

function ImageBlockRenderer({ block, idx, isFirst, isLast, moveBlock, removeBlock, onChange, onImageClick }: any) {
    const [showControls, setShowControls] = useState(true);
    const hasImage = typeof block.content === 'string' && block.content;
    const isDownloading = block.isDownloading;
    const isSynced = !!(block.driveFileId && hasImage && !isDownloading);
    const lastTapRef = useRef(0);

    // Memoize the converted src so convertFileSrc doesn't run on every render
    const imageSrc = React.useMemo(
        () => hasImage ? getLocalImageSrc(block.content) : '',
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [block.content]
    );

    const handleImageTap = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDownloading) {
            onImageClick?.(block.content);
        }
    };

    useEffect(() => {
        if (hasImage && !isDownloading) {
            setShowControls(true);
            const timer = setTimeout(() => {
                setShowControls(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [hasImage, block.content, isDownloading]);

    return (
        <>
            <div
                className={`relative group rounded-xl flex flex-col items-center justify-center transition-all ${hasImage || isDownloading
                        ? 'p-0 bg-transparent border-none min-h-[200px]'
                        : 'border-2 border-dashed border-white/10 p-4 min-h-[200px] bg-black/20'
                    }`}
                onContextMenu={(e) => {
                    if (hasImage && !isDownloading) {
                        e.preventDefault();
                        setShowControls(true);
                        setTimeout(() => setShowControls(false), 3000);
                    }
                }}
            >
                {/* Compact floating overlay for mobile image */}
                {showControls && (hasImage || isDownloading) && (
                    <div className="absolute top-2 right-2 flex gap-1 md:hidden bg-white/90 dark:bg-zinc-950/80 backdrop-blur rounded-lg p-0.5 border border-zinc-200 dark:border-white/10 z-10 animate-in fade-in duration-200">
                        <button
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isFirst) moveBlock(idx, 'up');
                            }}
                            disabled={isFirst}
                            className="p-1 text-zinc-700 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30"
                            title="Subir"
                        >
                            <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isLast) moveBlock(idx, 'down');
                            }}
                            disabled={isLast}
                            className="p-1 text-zinc-700 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30"
                            title="Bajar"
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeBlock(block.id);
                            }}
                            className="p-1 text-red-500 hover:text-red-400"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {isDownloading ? (
                    <div className="flex flex-col items-center justify-center w-full min-h-[200px] bg-black/20 rounded-2xl animate-pulse">
                        <ImageIcon className="w-12 h-12 text-white/20 mb-3 animate-bounce" />
                        <span className="text-white/40 text-sm font-medium">Downloading image...</span>
                    </div>
                ) : hasImage ? (
                    <div className="relative flex justify-center w-full">
                        <img
                            src={imageSrc}
                            alt="Note attachment"
                            className="max-h-[600px] max-w-full rounded-2xl cursor-pointer shadow-sm"
                            onClick={handleImageTap}
                        />
                        {/* Sync status badge */}
                        {isSynced && (
                            <div
                                className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 pointer-events-none"
                                title="Synced with Drive"
                            >
                                <Cloud className="w-3 h-3 text-emerald-400" />
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center">
                        <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-4">Upload an image</p>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id={`file-${block.id}`}
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                    const reader = new FileReader()
                                    reader.onloadend = async () => {
                                        const base64 = reader.result as string;
                                        const { saveBase64ImageToFile } = await import('@/lib/image-utils');
                                        const uri = await saveBase64ImageToFile(base64);
                                        const finalContent = uri || base64;
                                        
                                        // [DEBUG] Log the block exactly as requested by the user
                                        console.log('[DEBUG] Bloque de imagen insertado. Content:', finalContent, 'URI original:', uri);
                                        
                                        onChange(finalContent);
                                    }
                                    reader.readAsDataURL(file)
                                }
                            }}
                        />
                        <label htmlFor={`file-${block.id}`} className="px-4 py-2 bg-primary/20 text-primary rounded-lg cursor-pointer hover:bg-primary/30 transition-colors">
                            Choose File
                        </label>
                    </div>
                )}
            </div>
        </>
    )
}

const getFileIconAndColor = (type: string, name: string = '') => {
    const ext = (type || name.split('.').pop() || '').toLowerCase();
    if (['pdf'].includes(ext)) return { imageSrc: '/icons/pdf.png', color: '', bg: 'bg-transparent' };
    if (['doc', 'docx'].includes(ext)) return { imageSrc: '/icons/word.png', color: '', bg: 'bg-transparent' };
    if (['xls', 'xlsx', 'csv'].includes(ext)) return { imageSrc: '/icons/excel.png', color: '', bg: 'bg-transparent' };
    if (['ppt', 'pptx'].includes(ext)) return { imageSrc: '/icons/powerpoint.png', color: '', bg: 'bg-transparent' };
    if (['mp3', 'wav', 'ogg', 'm4a', 'audio'].includes(ext)) return { imageSrc: '/icons/audio.png', color: '', bg: 'bg-transparent' };
    return { Icon: FileIcon, color: 'text-primary', bg: 'bg-primary/20' };
};

function FileBlockRenderer({ block, idx, isFirst, isLast, moveBlock, removeBlock, onChange, noteId }: any) {
    const [showControls, setShowControls] = useState(true);
    const fileData = block.content || { url: '', name: '', type: '' };
    const hasFile = !!fileData.url;
    const [isDownloadingState, setIsDownloadingState] = useState(false);
    const isDownloading = block.isDownloading || isDownloadingState;

    const { Icon, imageSrc, color, bg } = getFileIconAndColor(fileData.type, fileData.name);

    const handleFileClick = async () => {
        if (isDownloading) return;
        
        let currentFileUri = fileData.url;
        let needsDownload = !hasFile;
        
        if (typeof window !== 'undefined') {
            if (Capacitor.isNativePlatform()) {
                if (hasFile && currentFileUri) {
                    if (currentFileUri.startsWith('http://localhost/_capacitor_file_')) {
                        currentFileUri = currentFileUri.replace('http://localhost/_capacitor_file_', 'file://');
                    }
                    if (currentFileUri.startsWith('file://')) {
                        try {
                            const { Filesystem } = await import('@capacitor/filesystem');
                            const statRes = await Filesystem.stat({ path: currentFileUri.replace('file://', '') });
                            if (!statRes || statRes.type === 'directory') needsDownload = true;
                        } catch(e) {
                            needsDownload = true;
                        }
                    }
                }

                if (needsDownload && block.driveFileId && noteId) {
                    setIsDownloadingState(true);
                    const { useStore } = await import('@/lib/store');
                    const success = await useStore.getState().downloadAttachment(noteId, block.id);
                    setIsDownloadingState(false);
                    if (success) {
                        const updatedNote = useStore.getState().notes.find(n => n.id === noteId);
                        const updatedBlock = updatedNote?.blocks.find(b => b.id === block.id);
                        if (updatedBlock?.type === 'file' && updatedBlock.content?.url) {
                            currentFileUri = updatedBlock.content.url;
                        } else {
                            useStore.getState().showToast("Error al abrir el archivo descargado", "error");
                            return;
                        }
                    } else {
                        useStore.getState().showToast("Error al descargar el archivo de la nube", "error");
                        return;
                    }
                }
                
                if (!currentFileUri) return;
                
                try {
                    const mimeTypeMap: Record<string, string> = {
                        'pdf': 'application/pdf',
                        'doc': 'application/msword',
                        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'xls': 'application/vnd.ms-excel',
                        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'ppt': 'application/vnd.ms-powerpoint',
                        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'mp3': 'audio/mpeg',
                        'wav': 'audio/wav',
                        'mp4': 'video/mp4'
                    };
                    const ext = fileData.type?.toLowerCase() || '';
                    const mimeType = mimeTypeMap[ext] || '*/*';
                    
                    if (currentFileUri.startsWith('http://localhost/_capacitor_file_')) {
                        currentFileUri = currentFileUri.replace('http://localhost/_capacitor_file_', 'file://');
                    }
                    
                    if (currentFileUri.startsWith('file://')) {
                        const { WidgetSync } = await import('@/lib/store');
                        await WidgetSync.openFile({ url: currentFileUri, mimeType });
                    } else {
                        const { Share } = await import('@capacitor/share');
                        await Share.share({
                            title: fileData.name,
                            url: currentFileUri,
                            dialogTitle: 'Abrir con...'
                        });
                    }
                } catch (e) {
                    console.error("Open/Share failed", e);
                    window.open(getLocalImageSrc(currentFileUri), '_blank');
                }
            } else {
                if (!hasFile) return;
                const src = getLocalImageSrc(currentFileUri);
                // Web / Windows Desktop browser logic
                try {
                    let fileToShare = null;
                    if (src.startsWith('data:')) {
                        const arr = src.split(',');
                        const mime = arr[0].match(/:(.*?);/)?.[1] || '';
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while(n--){
                            u8arr[n] = bstr.charCodeAt(n);
                        }
                        fileToShare = new File([u8arr], fileData.name, { type: mime });
                    } else if (src.startsWith('blob:') || src.startsWith('http')) {
                        const response = await fetch(src);
                        const blob = await response.blob();
                        fileToShare = new File([blob], fileData.name, { type: blob.type });
                    }

                    if (fileToShare && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
                        await navigator.share({
                            files: [fileToShare],
                            title: fileData.name,
                        });
                        return; // Share dialog opened successfully
                    }
                } catch (e) {
                    console.error("Web share failed", e);
                }

                // Fallback si no soporta Web Share API (descargar el archivo forzando el diálogo del navegador)
                const a = document.createElement('a');
                a.href = src;
                a.download = fileData.name || 'archivo';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }
    };

    return (
        <div
            className={`relative group rounded-xl flex flex-col items-center justify-center transition-all ${hasFile || isDownloading
                    ? 'p-4 bg-white/5 border border-white/10 min-h-[100px]'
                    : 'border-2 border-dashed border-white/10 p-4 min-h-[120px] bg-black/20'
                }`}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            {showControls && (hasFile || isDownloading) && (
                <div className="absolute top-2 right-2 flex gap-1 md:hidden bg-white/90 dark:bg-zinc-950/80 backdrop-blur rounded-lg p-0.5 border border-zinc-200 dark:border-white/10 z-10 animate-in fade-in duration-200">
                    <button onMouseDown={(e) => { e.preventDefault(); if (!isFirst) moveBlock(idx, 'up'); }} disabled={isFirst} className="p-1 text-zinc-700 dark:text-white/70 disabled:opacity-30">
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); if (!isLast) moveBlock(idx, 'down'); }} disabled={isLast} className="p-1 text-zinc-700 dark:text-white/70 disabled:opacity-30">
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); removeBlock(block.id); }} className="p-1 text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {isDownloading ? (
                <div className="flex flex-col items-center justify-center w-full animate-pulse">
                    <FileIcon className="w-10 h-10 text-white/20 mb-2 animate-bounce" />
                    <span className="text-white/40 text-sm font-medium">Downloading...</span>
                </div>
            ) : hasFile ? (
                <div className="flex items-center gap-4 w-full cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors" onClick={handleFileClick}>
                    <div className={`w-12 h-12 rounded-lg ${bg} ${color} flex items-center justify-center shrink-0 overflow-hidden`}>
                        {Icon ? <Icon className="w-6 h-6" /> : <img src={imageSrc} alt="Icon" className="w-10 h-10 object-contain drop-shadow-md" />}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">{fileData.name || 'Unknown File'}</span>
                        <span className="text-xs text-muted-foreground truncate uppercase">{fileData.type || 'FILE'}</span>
                    </div>
                </div>
            ) : (
                <div className="text-center">
                    <Paperclip className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-4">Upload a file (PDF, Docx, etc.)</p>
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,audio/*,video/*"
                        className="hidden"
                        id={`file-${block.id}`}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                    const base64 = reader.result as string;
                                    const { saveBase64File } = await import('@/lib/image-utils');
                                    const uri = await saveBase64File(base64, file.name);
                                    
                                    onChange({
                                        url: uri || base64,
                                        name: file.name,
                                        type: file.name.split('.').pop() || 'file'
                                    });
                                }
                                reader.readAsDataURL(file);
                            }
                        }}
                    />
                    <label htmlFor={`file-${block.id}`} className="px-4 py-2 bg-primary/20 text-primary rounded-lg cursor-pointer hover:bg-primary/30 transition-colors">
                        Choose File
                    </label>
                </div>
            )}
        </div>
    );
}

function VideoThumbnailWeb({ src }: { src: string }) {
    const thumbVideoRef = useRef<HTMLVideoElement>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const video = thumbVideoRef.current;
        if (!video) return;

        let timeoutId: any;

        function handleLoadedMetadata() {
            clearTimeout(timeoutId);
            const safeTime = Math.min(1, (video!.duration * 0.1) || 0.1);
            if (video) video.currentTime = safeTime;
        }

        function handleSeeked() {
            console.log('[VIDEO] Frame de miniatura listo en el elemento video (web)');
        }

        function handleError(e: any) {
            clearTimeout(timeoutId);
            console.error('[VIDEO] Error cargando video para miniatura:', video?.error || e);
            setHasError(true);
        }

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('seeked', handleSeeked);
        video.addEventListener('error', handleError);

        // Timeout of 10s if metadata doesn't load
        timeoutId = setTimeout(() => {
            console.error('[VIDEO] Timeout esperando loadedmetadata para miniatura (web):', src);
            setHasError(true);
        }, 10000);

        return () => {
            clearTimeout(timeoutId);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('error', handleError);
        };
    }, [src]);

    if (hasError) {
        return (
            <div className="w-full h-[200px] flex flex-col items-center justify-center bg-black/20 text-red-400">
                <AlertCircle className="w-12 h-12 mb-2" />
                <span className="text-xs font-medium">Error de previsualización</span>
            </div>
        );
    }

    return (
        <video
            ref={thumbVideoRef}
            src={src}
            preload="metadata"
            muted
            playsInline
            className="w-full max-h-[60vh] object-contain opacity-80"
        />
    );
}

function VideoBlockRenderer({ block, idx, isFirst, isLast, moveBlock, removeBlock, onChange, noteId }: any) {
    console.log('[VIDEO] Renderizando thumbnail, path:', block.thumbnailPath);
    const [showControls, setShowControls] = useState(true);
    const videoData = block.content || { url: '', name: '', type: '' };
    const hasVideo = !!videoData.url;
    const [isDownloadingState, setIsDownloadingState] = useState(false);
    const isDownloading = block.isDownloading || isDownloadingState;
    const [isPlaying, setIsPlaying] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [supportsPip, setSupportsPip] = useState(false);

    useEffect(() => {
        if (typeof document !== 'undefined' && 'pictureInPictureEnabled' in document) {
            setSupportsPip(document.pictureInPictureEnabled);
        }
    }, []);

    const togglePip = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoRef.current.requestPictureInPicture();
            }
        } catch (err) {
            console.error("Error with Picture-in-Picture:", err);
        }
    };

    const handlePlayClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDownloading || isProcessing) return;
        
        console.log('[VIDEO] Play presionado para:', videoData.name);
        console.log('[VIDEO] localPath actual:', videoData.url);
        console.log('[VIDEO] driveFileId:', block.driveFileId);

        let currentVideoUri = videoData.url;
        let needsDownload = !hasVideo;
        let localExists = false;
        
        if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
            if (hasVideo && currentVideoUri) {
                if (currentVideoUri.startsWith('http://localhost/_capacitor_file_')) {
                    currentVideoUri = currentVideoUri.replace('http://localhost/_capacitor_file_', 'file://');
                }
                if (currentVideoUri.startsWith('file://')) {
                    try {
                        const { Filesystem } = await import('@capacitor/filesystem');
                        const statRes = await Filesystem.stat({ path: currentVideoUri.replace('file://', '') });
                        if (!statRes || statRes.type === 'directory') needsDownload = true;
                        localExists = !needsDownload;
                    } catch(e) {
                        needsDownload = true;
                    }
                }
            }
            
            console.log('[VIDEO] ¿Archivo local existe?', localExists);

            if (needsDownload) {
                if (!block.driveFileId) {
                    console.error('[VIDEO] No hay localPath válido NI driveFileId — video sin fuente');
                    import('@/lib/store').then(({ useStore }) => {
                        useStore.getState().showToast('Este video no está disponible.', 'error');
                    });
                    return;
                }
                console.log('[VIDEO] Descargando desde Drive...');
                setIsDownloadingState(true);
                const { useStore } = await import('@/lib/store');
                try {
                    const success = await useStore.getState().downloadAttachment(noteId, block.id);
                    setIsDownloadingState(false);
                    if (success) {
                        const updatedNote = useStore.getState().notes.find(n => n.id === noteId);
                        const updatedBlock = updatedNote?.blocks.find(b => b.id === block.id);
                        if (updatedBlock?.type === 'video' && updatedBlock.content?.url) {
                            currentVideoUri = updatedBlock.content.url;
                            console.log('[VIDEO] Descarga completada:', currentVideoUri);
                        }
                    } else {
                        console.error('[VIDEO] FALLÓ la descarga');
                        useStore.getState().showToast("Error al descargar el video de la nube", "error");
                        return;
                    }
                } catch (err) {
                    setIsDownloadingState(false);
                    console.error('[VIDEO] FALLÓ la descarga:', err);
                    useStore.getState().showToast('No se pudo descargar el video.', 'error');
                    return;
                }
            }
        }
        
        console.log('[VIDEO] Reproduciendo desde:', currentVideoUri);
        setIsPlaying(true);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 100MB limit
        if (file.size > 100 * 1024 * 1024) {
            import('@/lib/store').then(({ useStore }) => {
                useStore.getState().showToast("El video es demasiado grande. El límite es 100MB.", "error");
            });
            return;
        }

        setIsProcessing(true);
        try {
            console.log('[VIDEO] Insertando video:', file.name);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const { saveBase64File, generateVideoThumbnail } = await import('@/lib/image-utils');
                const uri = await saveBase64File(base64, file.name);
                console.log('[VIDEO] Archivo guardado en:', uri);
                
                let thumbUri = null;
                console.log('[VIDEO] Generando miniatura...');
                thumbUri = await generateVideoThumbnail(uri, file).catch((err) => {
                    console.error('[VIDEO] FALLÓ la generación de miniatura:', err);
                    return null;
                });
                console.log('[VIDEO] Resultado de miniatura:', thumbUri);

                const newBlock = {
                    type: 'video',
                    fileName: file.name,
                    localPath: uri || base64,
                    thumbnailPath: thumbUri ?? undefined,
                };
                console.log('[VIDEO] Bloque final creado (equivalente a):', JSON.stringify(newBlock));

                // Since onChange here expects (content, meta), we'll do:
                onChange({
                    url: uri || base64,
                    name: file.name,
                    type: file.name.split('.').pop() || 'video'
                }, { thumbnailPath: thumbUri });
                
                setIsProcessing(false);
            }
            reader.readAsDataURL(file);
        } catch (err) {
            console.error("Error processing video", err);
            setIsProcessing(false);
        }
    };

    return (
        <div
            className={`relative group rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden ${hasVideo || isDownloading
                    ? 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10'
                    : 'border-2 border-dashed border-white/10 p-4 min-h-[120px] bg-black/20'
                }`}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            {showControls && (hasVideo || isDownloading) && (
                <div className="absolute top-2 right-2 flex gap-1 md:hidden bg-white/90 dark:bg-zinc-950/80 backdrop-blur rounded-lg p-0.5 border border-zinc-200 dark:border-white/10 z-10 animate-in fade-in duration-200">
                    <button onMouseDown={(e) => { e.preventDefault(); if (!isFirst) moveBlock(idx, 'up'); }} disabled={isFirst} className="p-1 text-zinc-700 dark:text-white/70 disabled:opacity-30">
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); if (!isLast) moveBlock(idx, 'down'); }} disabled={isLast} className="p-1 text-zinc-700 dark:text-white/70 disabled:opacity-30">
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); removeBlock(block.id); }} className="p-1 text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {isProcessing ? (
                <div className="flex flex-col items-center justify-center w-full min-h-[200px] bg-black/20 animate-pulse p-4">
                    <Film className="w-12 h-12 text-white/20 mb-3 animate-bounce" />
                    <span className="text-white/40 text-sm font-medium">Procesando video...</span>
                </div>
            ) : isDownloading ? (
                <div className="flex flex-col items-center justify-center w-full min-h-[200px] bg-black/20 animate-pulse p-4">
                    <Film className="w-12 h-12 text-white/20 mb-3 animate-bounce" />
                    <span className="text-white/40 text-sm font-medium">Downloading video...</span>
                </div>
            ) : hasVideo ? (
                isPlaying ? (
                    <div className="relative w-full group/video bg-black flex items-center justify-center">
                        <video
                            ref={videoRef}
                            src={getLocalImageSrc(videoData.url)}
                            controls
                            autoPlay
                            playsInline
                            className="w-full max-h-[60vh] object-contain bg-black"
                            preload="none"
                            poster={block.thumbnailPath ? getLocalImageSrc(block.thumbnailPath) : undefined}
                        />
                        {supportsPip && (
                            <button
                                onClick={togglePip}
                                className="absolute bottom-3 right-3 z-20 p-2 bg-black/70 hover:bg-black/90 text-white rounded-full backdrop-blur-md border border-white/20 transition-all active:scale-95 shadow-lg flex items-center gap-1.5 text-xs font-medium"
                                title="Picture-in-Picture (Ventana flotante)"
                            >
                                <PictureInPicture className="w-4 h-4" />
                                <span className="hidden sm:inline">PiP</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="relative w-full cursor-pointer bg-black/10 group-hover:bg-black/20 transition-colors" onClick={handlePlayClick}>
                        <VideoThumbnailWeb src={getLocalImageSrc(videoData.url)} />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-16 h-16 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl border border-white/20 group-hover:scale-110 transition-transform">
                                <div className="w-0 h-0 border-t-8 border-t-transparent border-l-[14px] border-l-white border-b-8 border-b-transparent ml-1"></div>
                            </div>
                        </div>
                    </div>
                )
            ) : (
                <div className="text-center w-full">
                    <Film className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-4">Upload a video (MP4, WebM)</p>
                    <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="hidden"
                        id={`video-${block.id}`}
                        onChange={handleFileSelect}
                    />
                    <label htmlFor={`video-${block.id}`} className="px-4 py-2 bg-primary/20 text-primary rounded-lg cursor-pointer hover:bg-primary/30 transition-colors">
                        Choose Video
                    </label>
                </div>
            )}
        </div>
    );
}

const BlockRenderer = React.memo(function BlockRenderer({
    block,
    idx,
    isFirst,
    isLast,
    moveBlock,
    removeBlock,
    onChange,
    autoFocus,
    onFocus,
    onBlur,
    language,
    onImageClick,
    noteId
}: {
    block: NoteBlock,
    idx: number,
    isFirst: boolean,
    isLast: boolean,
    moveBlock: (idx: number, direction: 'up' | 'down') => void,
    removeBlock: (id: string) => void,
    onChange: (c: any) => void,
    autoFocus?: boolean,
    onFocus?: () => void,
    onBlur?: () => void,
    language: string,
    onImageClick?: (url: string) => void,
    noteId: string
}) {
    try {
        if (!block || typeof block !== 'object' || !block.id) return <div className="p-2 border border-red-500/20 bg-red-500/5 rounded text-red-400 text-xs">Invalid Block Structure</div>

        if (block.type === 'text') {
            return (
                <RichTextEditor
                    content={typeof block.content === 'string' ? block.content : ''}
                    onChange={onChange}
                    activeBlockId={block.id}
                    onFocus={onFocus}
                    onBlur={onBlur}
                />
            )
        }

        if (block.type === 'task-list') {
            let title = ''
            let items: any[] = []
            if (block.content && typeof block.content === 'object' && !Array.isArray(block.content)) {
                title = block.content.title || ''
                items = Array.isArray(block.content.items) ? block.content.items : []
            } else {
                items = Array.isArray(block.content) ? block.content : []
            }

            const toggle = (id: string) => {
                const newItems = items.map((i: any) => (i && typeof i === 'object') ? (i.id === id ? { ...i, checked: !i.checked } : i) : i)
                onChange({ title, items: newItems })
            }
            const updateText = (id: string, text: string) => {
                const newItems = items.map((i: any) => (i && typeof i === 'object') ? (i.id === id ? { ...i, text } : i) : i)
                onChange({ title, items: newItems })
            }
            const updateTitle = (newTitle: string) => {
                onChange({ title: newTitle, items })
            }
            const addItem = () => {
                const cleanItems = items.filter(i => i && typeof i === 'object')
                const newItems = [...cleanItems, { id: Math.random().toString(), text: '', checked: false }]
                onChange({ title, items: newItems })
            }
            const insertItemAfter = (id: string) => {
                const cleanItems = items.filter(i => i && typeof i === 'object')
                const index = cleanItems.findIndex(i => i.id === id)
                if (index !== -1) {
                    const newItems = [...cleanItems]
                    newItems.splice(index + 1, 0, { id: Math.random().toString(), text: '', checked: false })
                    onChange({ title, items: newItems })
                    // Focus logic could be added, but react handles focus loss so user just taps or we can use ref
                }
            }
            const removeItem = (id: string) => {
                const newItems = items.filter((i: any) => i && typeof i === 'object' && i.id !== id)
                onChange({ title, items: newItems })
            }

            return (
                <div className="space-y-2">
                    {/* Optional Title Input (RichText compatible) */}
                    <RichTaskTitle
                        content={title}
                        onChange={updateTitle}
                        placeholder={language === 'es' ? "Título de la lista (opcional)..." : "List title (optional)..."}
                        onFocus={onFocus}
                        onBlur={onBlur}
                    />

                    {items.map((item: any, itemIdx: number) => {
                        if (!item || typeof item !== 'object') return null;
                        return (
                            <div key={item.id || itemIdx} className="flex items-center gap-3">
                                <button
                                    onClick={() => toggle(item.id)}
                                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${item.checked ? 'bg-primary text-black' : 'border border-muted-foreground bg-transparent'}`}
                                >
                                    {item.checked && <Check className="w-3.5 h-3.5" />}
                                </button>
                                <RichTaskItem
                                    content={typeof item.text === 'string' ? item.text : ''}
                                    onChange={(newText) => updateText(item.id, newText)}
                                    onEnter={() => insertItemAfter(item.id)}
                                    placeholder={language === 'es' ? "Elemento de tarea..." : "To-do item..."}
                                    checked={item.checked}
                                    onFocus={onFocus}
                                    onBlur={onBlur}
                                />
                                <button onClick={() => insertItemAfter(item.id)} className="text-primary hover:text-primary/70 transition-colors mr-1" title={language === 'es' ? "Añadir debajo" : "Add item below"}>
                                    <Plus className="w-5 h-5" />
                                </button>
                                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-500">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                    <button onClick={addItem} className="text-sm text-primary hover:underline pl-8">
                        {language === 'es' ? "+ Añadir elemento" : "+ Add Item"}
                    </button>
                </div>
            )
        }

        if (block.type === 'table') {
            const content = block.content || { headers: [], rows: [] }
            const headers = Array.isArray(content.headers) ? content.headers : []
            const rows = Array.isArray(content.rows) ? content.rows : []

            const updateHeader = (idx: number, val: string) => {
                const newHeaders = [...headers]
                newHeaders[idx] = val
                onChange({ headers: newHeaders, rows })
            }
            const updateCell = (rIdx: number, cIdx: number, val: string) => {
                const newRows = [...rows]
                newRows[rIdx] = [...(newRows[rIdx] || [])]
                newRows[rIdx][cIdx] = val
                onChange({ headers, rows: newRows })
            }
            const addRow = () => {
                onChange({ headers, rows: [...rows, new Array(headers.length).fill('')] })
            }
            const addColumn = () => {
                const newHeaders = [...headers, `Col ${headers.length + 1}`]
                const newRows = rows.map((r: string[]) => [...r, ''])
                onChange({ headers: newHeaders, rows: newRows })
            }
            const removeRow = () => {
                if (rows.length > 1) {
                    onChange({ headers, rows: rows.slice(0, -1) })
                }
            }
            const removeColumn = () => {
                if (headers.length > 1) {
                    const newHeaders = headers.slice(0, -1)
                    const newRows = rows.map((r: string[]) => r.slice(0, -1))
                    onChange({ headers: newHeaders, rows: newRows })
                }
            }

            return (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-black/20 dark:border-white/10">
                        <thead>
                            <tr>
                                {headers.map((h: string, i: number) => (
                                    <th key={i} className="border border-black/20 dark:border-white/10 p-2 bg-black/5 dark:bg-white/5">
                                        <input
                                            className="bg-transparent text-center font-bold w-full outline-none"
                                            value={typeof h === 'string' ? h : ''}
                                            onChange={(e) => updateHeader(i, e.target.value)}
                                            onFocus={onFocus}
                                            onBlur={onBlur}
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row: string[], rIdx: number) => (
                                <tr key={rIdx}>
                                    {(Array.isArray(row) ? row : []).map((cell: string, cIdx: number) => (
                                        <td key={cIdx} className="border border-black/20 dark:border-white/10 p-2">
                                            <input
                                                className="bg-transparent w-full outline-none"
                                                value={typeof cell === 'string' ? cell : ''}
                                                onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                                                onFocus={onFocus}
                                                onBlur={onBlur}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                        <button onClick={addRow} className="text-xs text-primary hover:underline">+ {language === 'es' ? "Añadir Fila" : "Add Row"}</button>
                        <button onClick={addColumn} className="text-xs text-primary hover:underline">+ {language === 'es' ? "Añadir Columna" : "Add Column"}</button>
                        {rows.length > 1 && (
                            <button onClick={removeRow} className="text-xs text-red-500/70 hover:text-red-500 hover:underline">- {language === 'es' ? "Quitar Fila" : "Remove Row"}</button>
                        )}
                        {headers.length > 1 && (
                            <button onClick={removeColumn} className="text-xs text-red-500/70 hover:text-red-500 hover:underline">- {language === 'es' ? "Quitar Columna" : "Remove Col"}</button>
                        )}
                    </div>
                </div>
            )
        }

        if (block.type === 'image') {
            return (
                <ImageBlockRenderer
                    block={block}
                    idx={idx}
                    isFirst={isFirst}
                    isLast={isLast}
                    moveBlock={moveBlock}
                    removeBlock={removeBlock}
                    onChange={onChange}
                    onImageClick={onImageClick}
                />
            )
        }

        if (block.type === 'drawing') {
            return (
                <div className="relative w-full">
                    <p className="text-xs font-semibold text-muted-foreground/60 mb-2">{language === 'es' ? "Lienzo de dibujo" : "Drawing Canvas"}</p>
                    <div className="h-64 w-full bg-black/30 border border-white/10 rounded-xl relative overflow-hidden">
                        <DrawingCanvas initialData={typeof block.content === 'string' ? block.content : ''} onSave={onChange} />
                    </div>
                </div>
            )
        }

        if (block.type === 'file') {
            return (
                <FileBlockRenderer
                    block={block}
                    idx={idx}
                    isFirst={isFirst}
                    isLast={isLast}
                    moveBlock={moveBlock}
                    removeBlock={removeBlock}
                    onChange={onChange}
                    noteId={noteId}
                />
            )
        }

        if (block.type === 'video') {
            return (
                <VideoBlockRenderer
                    block={block}
                    idx={idx}
                    isFirst={isFirst}
                    isLast={isLast}
                    moveBlock={moveBlock}
                    removeBlock={removeBlock}
                    onChange={onChange}
                    noteId={noteId}
                />
            )
        }

        if (block.type === 'separator') {
            return (
                <div className="w-full py-3 flex items-center justify-center">
                    <hr className="w-full border-t border-zinc-200 dark:border-white/10" />
                </div>
            )
        }

        return <div>Unknown block type: {String(block.type)}</div>
    } catch (e: any) {
        console.error("Error rendering block:", e, block)
        return (
            <div className="p-4 border border-red-500/50 rounded bg-red-500/10 text-red-500">
                Error rendering block: {e?.message || String(e)}
            </div>
        )
    }
});

const BlockWrapper = React.memo(({
    block,
    idx,
    isFirst,
    isLast,
    language,
    moveBlock,
    removeBlock,
    updateBlock,
    handleImageClick,
    handleWrapperFocus,
    handleWrapperBlur,
    autoFocus,
    noteId
}: {
    block: NoteBlock;
    idx: number;
    isFirst: boolean;
    isLast: boolean;
    language: string;
    moveBlock: (idx: number, direction: 'up' | 'down') => void;
    removeBlock: (id: string) => void;
    updateBlock: (id: string, content: any, extraProps?: any) => void;
    handleImageClick: (url: string) => void;
    handleWrapperFocus: (id: string, type: BlockType) => void;
    handleWrapperBlur: (currentTarget: HTMLElement) => void;
    autoFocus: boolean;
    noteId: string;
}) => {
    return (
        <motion.div
            id={`block-${block.id}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            tabIndex={0}
            onFocus={() => handleWrapperFocus(block.id, block.type)}
            onClick={() => handleWrapperFocus(block.id, block.type)}
            onBlur={(e) => handleWrapperBlur(e.currentTarget)}
            className="group relative flex flex-col gap-2 w-full p-2.5 rounded-xl border border-transparent hover:border-white/5 hover:bg-white/[0.01] focus:border-white/10 focus:bg-white/[0.02] focus-within:border-white/10 focus-within:bg-white/[0.02] transition-all outline-none transform-gpu render-optimized"
        >
            <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center justify-between border-b border-white/5 pb-1.5 text-[10px] font-bold text-muted-foreground/60 dark:text-white/70 uppercase tracking-widest select-none transition-opacity duration-200">
                <span className="flex items-center gap-1.5">
                    {getBlockIconAndLabel(block.type, language)}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => moveBlock(idx, 'up')}
                        disabled={isFirst}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-90"
                        title={language === 'es' ? "Subir bloque" : "Move block up"}
                    >
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => moveBlock(idx, 'down')}
                        disabled={isLast}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-90"
                        title={language === 'es' ? "Bajar bloque" : "Move block down"}
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => removeBlock(block.id)}
                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors active:scale-90 ml-1"
                        title={language === 'es' ? "Eliminar bloque" : "Delete block"}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            <div className="pt-1">
                <BlockRenderer
                    block={block}
                    idx={idx}
                    isFirst={isFirst}
                    isLast={isLast}
                    moveBlock={moveBlock}
                    removeBlock={removeBlock}
                    onChange={(content, extraProps) => updateBlock(block.id, content, extraProps)}
                    autoFocus={autoFocus}
                    language={language}
                    onImageClick={handleImageClick}
                    onFocus={() => handleWrapperFocus(block.id, block.type)}
                    noteId={noteId}
                />
            </div>
        </motion.div>
    );
}, (prevProps, nextProps) => {
    return prevProps.block === nextProps.block &&
        prevProps.idx === nextProps.idx &&
        prevProps.isFirst === nextProps.isFirst &&
        prevProps.isLast === nextProps.isLast &&
        prevProps.language === nextProps.language &&
        prevProps.moveBlock === nextProps.moveBlock &&
        prevProps.removeBlock === nextProps.removeBlock &&
        prevProps.updateBlock === nextProps.updateBlock &&
        prevProps.handleImageClick === nextProps.handleImageClick &&
        prevProps.handleWrapperFocus === nextProps.handleWrapperFocus &&
        prevProps.handleWrapperBlur === nextProps.handleWrapperBlur &&
        prevProps.autoFocus === nextProps.autoFocus &&
        prevProps.noteId === nextProps.noteId;
});
BlockWrapper.displayName = 'BlockWrapper';

function DrawingCanvas({ initialData, onSave }: { initialData: string, onSave: (d: string) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    // Load initial data
    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas && initialData) {
            const ctx = canvas.getContext('2d')
            const img = new Image()
            img.onload = () => ctx?.drawImage(img, 0, 0)
            img.src = initialData
        }
    }, [initialData])

    const startDraw = (e: any) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        ctx.beginPath()
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
        setIsDrawing(true)
    }

    const draw = (e: any) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
    }

    const stopDraw = () => {
        if (!isDrawing) return
        setIsDrawing(false)
        const canvas = canvasRef.current
        if (canvas) {
            onSave(canvas.toDataURL())
        }
    }

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={400}
            className="w-full h-full cursor-crosshair touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
        />
    )
}

function FormatButton({ icon: Icon, label, onClick, active }: { icon: any, label: string, onClick: () => void, active?: boolean }) {
    return (
        <button
            onMouseDown={(e) => {
                e.preventDefault();
                onClick();
            }}
            className={`p-1.5 rounded transition-all active:scale-95 shrink-0 ${active
                    ? "bg-purple-600/20 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/30 font-bold"
                    : "hover:bg-white/10 text-muted-foreground hover:text-foreground"
                }`}
            title={label}
        >
            <Icon className="w-4 h-4" />
        </button>
    );
}

function HighlightButton({ color, label, onClick }: { color: string, label: string, onClick: () => void }) {
    return (
        <button
            onMouseDown={(e) => {
                e.preventDefault();
                onClick();
            }}
            className="w-5 h-5 rounded-full border border-zinc-300 dark:border-white/20 transition-transform hover:scale-110 active:scale-90 shrink-0"
            style={{ backgroundColor: color }}
            title={label}
        />
    );
}

function linkifyHTML(html: string): string {
    if (!html) return '';
    // Split the HTML by anchor tags to avoid touching existing links
    const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi);
    const urlRegex = /(https?:\/\/(?:[^\s<"'](?!&(?:nbsp|quot|apos|lt|gt);))+)/gi;

    return parts.map((part, index) => {
        // If index is odd, it's an <a> tag, return it as is
        if (index % 2 !== 0) {
            return part;
        }
        // If index is even, it's plain HTML text, so linkify it
        return part.replace(urlRegex, (url) => {
            // Trim trailing punctuation from the url and put it outside the <a> tag
            const trailingPunctuationRegex = /[.,!?;:]+$/;
            const match = url.match(trailingPunctuationRegex);
            if (match) {
                const punctuation = match[0];
                const cleanUrl = url.slice(0, -punctuation.length);
                return `<a href="${cleanUrl}" target="_blank" class="text-primary underline hover:opacity-80">${cleanUrl}</a>${punctuation}`;
            }
            return `<a href="${url}" target="_blank" class="text-primary underline hover:opacity-80">${url}</a>`;
        });
    }).join('');
}

function stripInlineColors(html: string): string {
    if (!html) return '';
    if (typeof window === 'undefined') return html;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove color styles from all elements, preserving others like background-color
        const styledElements = doc.querySelectorAll('[style]');
        styledElements.forEach(el => {
            const style = el.getAttribute('style');
            if (style) {
                const cleanStyles = style.split(';')
                    .map(s => s.trim())
                    .filter(s => {
                        const lower = s.toLowerCase();
                        return !lower.startsWith('color') && !lower.includes('text-decoration-color') && !lower.includes('-webkit-text-fill-color');
                    })
                    .join('; ');
                if (cleanStyles) {
                    el.setAttribute('style', cleanStyles);
                } else {
                    el.removeAttribute('style');
                }
            }
        });

        // Replace <font> tags with their child nodes
        const fontElements = doc.querySelectorAll('font');
        fontElements.forEach(font => {
            const fragment = doc.createDocumentFragment();
            while (font.firstChild) {
                fragment.appendChild(font.firstChild);
            }
            font.parentNode?.replaceChild(fragment, font);
        });

        return doc.body.innerHTML;
    } catch (e) {
        console.error("Error sanitizing HTML colors:", e);
        return html;
    }
}

function cleanContainerStyle(el: HTMLDivElement | null) {
    if (!el) return;
    try {
        const style = el.getAttribute('style');
        if (style) {
            const cleanStyles = style.split(';')
                .map(s => s.trim())
                .filter(s => {
                    const lower = s.toLowerCase();
                    return !lower.startsWith('color') && !lower.includes('text-decoration-color');
                })
                .join('; ');
            if (cleanStyles) {
                if (el.getAttribute('style') !== cleanStyles) {
                    el.setAttribute('style', cleanStyles);
                }
            } else {
                el.removeAttribute('style');
            }
        }
    } catch (e) {
        console.error("Error cleaning container style:", e);
    }
}

const RichTaskTitle = React.memo(function RichTaskTitle({ content, onChange, onFocus, onBlur, placeholder }: { content: string, onChange: (c: string) => void, onFocus?: () => void, onBlur?: () => void, placeholder?: string }) {
    const editorRef = useRef<HTMLDivElement>(null);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (editorRef.current) {
            if (document.activeElement === editorRef.current && !isFirstLoad.current) {
                return;
            }
            cleanContainerStyle(editorRef.current);
            const cleaned = stripInlineColors(content || '');
            if (isFirstLoad.current || editorRef.current.innerHTML !== cleaned) {
                editorRef.current.innerHTML = cleaned;
                isFirstLoad.current = false;
            }
        }
    }, [content]);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleInput = () => {
        if (editorRef.current) {
            const newContent = editorRef.current.innerHTML;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                onChange(newContent);
            }, 500);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (editorRef.current) onChange(editorRef.current.innerHTML);
        }
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                if (editorRef.current) {
                    cleanContainerStyle(editorRef.current);
                    const cleaned = stripInlineColors(editorRef.current.innerHTML);
                    if (editorRef.current.innerHTML !== cleaned) {
                        editorRef.current.innerHTML = cleaned;
                    }
                    onChange(editorRef.current.innerHTML); // Flush immediately on blur
                }
                if (onBlur) onBlur();
            }}
            {...({ placeholder: placeholder || "Título..." } as any)}
            className="w-full bg-transparent border-none outline-none font-bold text-lg mb-2 text-foreground relative empty:before:content-[attr(placeholder)] empty:before:text-muted-foreground/30 dark:empty:before:text-white/40 before:absolute before:pointer-events-none rich-text-editor rich-task-title"
        />
    );
}, (prev, next) => {
    return prev.content === next.content && prev.placeholder === next.placeholder;
});

const RichTaskItem = React.memo(function RichTaskItem({ content, onChange, onEnter, onFocus, onBlur, placeholder, checked }: { content: string, onChange: (c: string) => void, onEnter?: () => void, onFocus?: () => void, onBlur?: () => void, placeholder?: string, checked: boolean }) {
    const editorRef = useRef<HTMLDivElement>(null);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (editorRef.current) {
            if (document.activeElement === editorRef.current && !isFirstLoad.current) {
                return;
            }
            cleanContainerStyle(editorRef.current);
            const cleaned = stripInlineColors(linkifyHTML(content || ''));
            if (isFirstLoad.current || editorRef.current.innerHTML !== cleaned) {
                editorRef.current.innerHTML = cleaned;
                isFirstLoad.current = false;
            }
        }
    }, [content]);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleInput = () => {
        if (editorRef.current) {
            const newContent = editorRef.current.innerHTML;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                onChange(newContent);
            }, 500);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (editorRef.current) onChange(editorRef.current.innerHTML);
            if (onEnter) onEnter();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData('text/plain');
        const html = e.clipboardData.getData('text/html');
        e.preventDefault();

        let contentToInsert = '';
        if (html) {
            contentToInsert = stripInlineColors(html);
        } else if (text) {
            contentToInsert = linkifyHTML(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }

        document.execCommand('insertHTML', false, contentToInsert);
        handleInput();
    };

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor) {
            const href = anchor.getAttribute('href');
            if (href) {
                e.preventDefault();
                window.open(href, '_system');
            }
        }
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                if (editorRef.current) {
                    cleanContainerStyle(editorRef.current);
                    const linkified = stripInlineColors(linkifyHTML(editorRef.current.innerHTML));
                    if (editorRef.current.innerHTML !== linkified) {
                        editorRef.current.innerHTML = linkified;
                    }
                    onChange(editorRef.current.innerHTML); // Flush immediately on blur
                }
                if (onBlur) onBlur();
            }}
            onPaste={handlePaste}
            onClick={handleClick}
            {...({ placeholder: placeholder || "Elemento..." } as any)}
            className={`flex-1 bg-transparent border-none outline-none text-base text-foreground relative empty:before:content-[attr(placeholder)] empty:before:text-muted-foreground/30 dark:empty:before:text-white/40 before:absolute before:pointer-events-none rich-text-editor ${checked ? 'line-through text-muted-foreground/50' : ''}`}
        />
    );
}, (prev, next) => {
    return prev.content === next.content && prev.checked === next.checked && prev.placeholder === next.placeholder;
});

const RichTextEditor = React.memo(function RichTextEditor({ content, onChange, activeBlockId, onFocus, onBlur }: { content: string, onChange: (c: string) => void, activeBlockId: string, onFocus?: () => void, onBlur?: () => void }) {
    const editorRef = useRef<HTMLDivElement>(null);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        isFirstLoad.current = true;
    }, [activeBlockId]);

    useEffect(() => {
        if (editorRef.current) {
            if (document.activeElement === editorRef.current && !isFirstLoad.current) {
                return;
            }
            cleanContainerStyle(editorRef.current);
            const cleaned = stripInlineColors(linkifyHTML(content || ''));
            if (isFirstLoad.current || editorRef.current.innerHTML !== cleaned) {
                editorRef.current.innerHTML = cleaned;
                isFirstLoad.current = false;
            }
        }
    }, [content]);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleInput = () => {
        if (editorRef.current) {
            const newContent = editorRef.current.innerHTML;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                onChange(newContent);
            }, 500); // 500ms debounce
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData('text/plain');
        const html = e.clipboardData.getData('text/html');
        e.preventDefault();

        let contentToInsert = '';
        if (html) {
            contentToInsert = stripInlineColors(html);
        } else if (text) {
            contentToInsert = linkifyHTML(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }

        document.execCommand('insertHTML', false, contentToInsert);
        handleInput();
    };

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor) {
            const href = anchor.getAttribute('href');
            if (href) {
                e.preventDefault();
                window.open(href, '_system');
            }
        }
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onFocus={onFocus}
            onBlur={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                if (editorRef.current) {
                    cleanContainerStyle(editorRef.current);
                    const linkified = stripInlineColors(linkifyHTML(editorRef.current.innerHTML));
                    if (editorRef.current.innerHTML !== linkified) {
                        editorRef.current.innerHTML = linkified;
                    }
                    onChange(editorRef.current.innerHTML); // Flush immediately on blur
                }
                if (onBlur) onBlur();
            }}
            onPaste={handlePaste}
            onClick={handleClick}
            {...({ placeholder: "Escribe algo aquí..." } as any)}
            className="rich-text-editor w-full min-h-[30px] bg-transparent border-none outline-none text-base text-foreground relative empty:before:content-[attr(placeholder)] empty:before:text-muted-foreground/30 dark:empty:before:text-white/40 before:absolute before:pointer-events-none"
        />
    );
}, (prev, next) => {
    return prev.content === next.content && prev.activeBlockId === next.activeBlockId;
});


function getBlockIconAndLabel(type: BlockType, language: string) {
    const isEs = language === 'es';
    switch (type) {
        case 'text':
            return (
                <>
                    <Type className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isEs ? "Texto" : "Text"}</span>
                </>
            );
        case 'task-list':
            return (
                <>
                    <CheckSquare className="w-3.5 h-3.5 text-green-400" />
                    <span>{isEs ? "Lista de tareas" : "Task List"}</span>
                </>
            );
        case 'table':
            return (
                <>
                    <TableIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isEs ? "Tabla" : "Table"}</span>
                </>
            );
        case 'image':
            return (
                <>
                    <ImageIcon className="w-3.5 h-3.5 text-yellow-400" />
                    <span>{isEs ? "Imagen" : "Image"}</span>
                </>
            );
        case 'drawing':
            return (
                <>
                    <PenTool className="w-3.5 h-3.5 text-orange-400" />
                    <span>{isEs ? "Dibujo" : "Drawing"}</span>
                </>
            );
        case 'file':
            return (
                <>
                    <Paperclip className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isEs ? "Archivo" : "File"}</span>
                </>
            );
        case 'video':
            return (
                <>
                    <Film className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isEs ? "Video" : "Video"}</span>
                </>
            );
        default:
            return <span>{type}</span>;
    }
}
