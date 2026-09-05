"use client"
import { getLocalImageSrc } from "@/lib/image-utils";

import { useStore, Note } from "@/lib/store";
import { useShallow } from 'zustand/react/shallow';
import { translations } from "@/lib/translations";
import { Calendar, StickyNote, Plus, Clock, History, Target, Check } from "lucide-react";
import { useState, useRef, useMemo } from "react";

// Read-only block renderer for dashboard
function NotePreviewRenderer({ note, isPinned = false }: { note: Note; isPinned?: boolean }) {
    if (!note || !note.blocks) return null;

    const handleLinkClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor) {
            e.stopPropagation();
            e.preventDefault();
            const href = anchor.getAttribute('href');
            if (href) {
                window.open(href, '_system');
            }
        }
    };

    return (
        <div className={`flex flex-col ${isPinned ? 'gap-1.5 md:gap-2' : 'gap-4'}`} onClick={handleLinkClick}>

            {note.blocks.map(block => {
                if (block.type === 'text') {
                    return (
                        <div key={block.id} className={`${isPinned ? 'text-[11px] md:text-xs' : 'text-sm'} rich-text-editor opacity-80`} dangerouslySetInnerHTML={{ __html: typeof block.content === 'string' ? block.content : '' }} />
                    );
                }
                if (block.type === 'task-list') {
                    const items = Array.isArray(block.content?.items) ? block.content.items : (Array.isArray(block.content) ? block.content : []);
                    const title = block.content?.title || '';
                    return (
                        <div key={block.id} className={`space-y-1 bg-white/5 ${isPinned ? 'p-2 rounded-lg' : 'p-3 rounded-xl'} border border-white/5`}>
                            {title && <h4 className={`font-bold ${isPinned ? 'text-[11px] md:text-xs' : 'text-sm'} mb-1`}>{title}</h4>}
                            {items.map((item: any, i: number) => (
                                <div key={item.id || i} className={`flex items-start gap-2 ${isPinned ? 'text-[10px] md:text-xs' : 'text-sm'}`}>
                                    <div className={`${isPinned ? 'w-3.5 h-3.5 mt-0.5' : 'w-4 h-4 mt-0.5'} rounded flex items-center justify-center shrink-0 border transition-all ${item.checked ? 'bg-primary border-primary text-black' : 'border-muted-foreground/50 bg-transparent'}`}>
                                        {item.checked && <Check className={`${isPinned ? 'w-2.5 h-2.5' : 'w-3 h-3'} stroke-[3.5]`} />}
                                    </div>
                                    <span className={item.checked ? 'line-through text-muted-foreground opacity-60' : 'opacity-90'} dangerouslySetInnerHTML={{ __html: item.text || '' }} />
                                </div>
                            ))}
                        </div>
                    );
                }
                if (block.type === 'table') {
                    const headers = block.content?.headers || [];
                    const rows = block.content?.rows || [];
                    return (
                        <div key={block.id} className={`overflow-x-auto ${isPinned ? 'rounded-lg p-0.5' : 'rounded-xl p-1'}`}>
                            <table className={`w-full ${isPinned ? 'text-[10px] md:text-xs' : 'text-sm'} border-collapse border border-border`}>
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        {headers.map((h: string, i: number) => <th key={i} className="border-r last:border-r-0 border-border p-1.5 md:p-2 text-left text-muted-foreground font-semibold">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row: string[], i: number) => (
                                        <tr key={i} className="border-b last:border-b-0 border-border">
                                            {row.map((cell: string, j: number) => <td key={j} className="border-r last:border-r-0 border-border p-1.5 md:p-2 opacity-90">{cell}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }
                if (block.type === 'image') {
                    return (
                        <div key={block.id} className={`relative w-full ${isPinned ? 'h-20 rounded-lg' : 'h-40 rounded-xl'} overflow-hidden bg-black/20 border border-white/5`}>
                            {block.content ? (
                                <img src={getLocalImageSrc(block.content)} alt="Note image" className="object-cover w-full h-full hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground">Imagen Vacía</div>
                            )}
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
}

export function DashboardWidgets({ onOpenNote }: { onOpenNote: (note: Note) => void }) {
    const language = useStore(state => state.language);
    const pinnedNoteId = useStore(state => state.pinnedNoteId);
    // For the pinned note and recent note we need full Note objects, but use shallow to avoid
    // re-renders when unrelated notes change their lastUpdated or internal state
    const notes = useStore(useShallow((state) => state.notes));
    const appointments = useStore(useShallow((state) => state.appointments));
    const lastPinnedGoalId = useStore(state => state.lastPinnedGoalId);
    // Granular goal selector: only re-renders when pinned/photos/description/title changes
    const goals = useStore(useShallow((state) => state.goals?.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        pinned: g.pinned,
        photos: g.photos,
    }))));
    const setPinnedNoteId = useStore(state => state.setPinnedNoteId);
    const t = (translations[language]?.dashboard || translations['en'].dashboard) as any;
    const noteTranslations = (translations[language]?.pages?.notes || translations['en'].pages.notes) as any;
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
    const [showPinnedActions, setShowPinnedActions] = useState(false);

    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressActive = useRef(false);

    const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
        // Only run for left click or touch
        if ('button' in e && e.button !== 0) return;
        isLongPressActive.current = false;
        longPressTimerRef.current = setTimeout(() => {
            isLongPressActive.current = true;
            setShowPinnedActions(prev => !prev);
            if (navigator.vibrate) {
                try {
                    navigator.vibrate(50);
                } catch (err) {
                    // Ignore haptic feedback errors if unsupported or blocked
                }
            }
        }, 600);
    };

    const endLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (isLongPressActive.current) {
            setTimeout(() => {
                isLongPressActive.current = false;
            }, 100);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        startLongPress(e);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (isLongPressActive.current) {
            e.preventDefault();
        }
        endLongPress();
    };

    const pinnedNote = notes.find(n => n.id === pinnedNoteId);
    
    // Sort notes by last modified / created
    const recentNote = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const { todayEvents, upcomingEvents } = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date(todayStr);
        const todayEvts = appointments.filter(a => a.date === todayStr);
        const upcomingEvts = appointments.filter(a => {
            if (a.date <= todayStr) return false;
            const eventDate = new Date(a.date);
            const diffTime = Math.abs(eventDate.getTime() - today.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 15;
        }).sort((a, b) => a.date.localeCompare(b.date));
        return { todayEvents: todayEvts, upcomingEvents: upcomingEvts };
    }, [appointments]);

    const targetGoal = useMemo(() => {
        if (!goals || goals.length === 0) return null;
        const pinned = goals.find(g => g.pinned);
        if (pinned) return pinned;

        if (lastPinnedGoalId) {
            const lastPinned = goals.find(g => g.id === lastPinnedGoalId);
            if (lastPinned) return lastPinned;
        }

        const withPhotos = goals.find(g => g.photos && g.photos.length > 0);
        if (withPhotos) return withPhotos;
        return goals[0];
    }, [goals, lastPinnedGoalId]);

    // Calendar generation for mini widget
    const todayDate = new Date();
    const calendarDays = useMemo(() => {
        const todayDateObj = new Date();
        const currentMonth = todayDateObj.getMonth();
        const currentYear = todayDateObj.getFullYear();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

        const cells = [];
        const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
        for (let i = 0; i < firstDayOfMonth; i++) {
            cells.push({ day: prevMonthDays - firstDayOfMonth + i + 1, isCurrentMonth: false });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            cells.push({ day: i, isCurrentMonth: true, isToday: i === todayDateObj.getDate() });
        }
        const remainingCells = 42 - cells.length;
        for (let i = 1; i <= remainingCells; i++) {
            cells.push({ day: i, isCurrentMonth: false });
        }
        return cells;
    }, []);

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* ROW 1: Pinned Note (left) and Calendar (right) */}
            <div className="grid grid-cols-5 gap-3 md:gap-4">
                
                {/* Pinned Note Module - Takes 3 columns */}
                <div 
                    className="col-span-3 glass-panel p-3 md:p-5 rounded-3xl flex flex-col h-[150px] md:h-[180px] relative overflow-hidden border border-white/5 select-none"
                    onMouseDown={startLongPress}
                    onMouseUp={endLongPress}
                    onMouseLeave={endLongPress}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="flex items-center justify-between mb-2 md:mb-4 shrink-0">
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                <StickyNote className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </div>
                        </div>
                        {showPinnedActions && (
                            <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setIsSelectModalOpen(true); 
                                        setShowPinnedActions(false); 
                                    }} 
                                    className="text-[9px] md:text-xs font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-2 md:px-3 py-1 md:py-1.5 rounded-full shrink-0"
                                >
                                    Cambiar
                                </button>
                                {pinnedNote && (
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setPinnedNoteId(null); 
                                            setShowPinnedActions(false); 
                                        }} 
                                        className="text-[9px] md:text-xs font-bold text-muted-foreground hover:text-red-400 transition-colors bg-white/5 px-2 md:px-3 py-1 md:py-1.5 rounded-full shrink-0"
                                    >
                                        Quitar
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div 
                        className="flex-1 overflow-y-auto custom-scrollbar pr-1 cursor-pointer group" 
                        onDoubleClick={(e) => {
                            if (isLongPressActive.current) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                            }
                            if (pinnedNote) onOpenNote(pinnedNote);
                        }}
                    >
                        {!pinnedNote ? (
                            <div 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setIsSelectModalOpen(true); 
                                }}
                                className="flex flex-col items-center justify-center h-full gap-1.5 text-muted-foreground/50 hover:text-primary transition-colors py-4"
                            >
                                <Plus className="w-8 h-8 mb-1 opacity-70" />
                                <span className="font-bold text-sm text-center">Fijar una nota</span>
                                <span className="text-[9px] text-center max-w-[90%] opacity-80">Haz clic aquí para seleccionar.</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 md:gap-1.5 pb-2">
                                <h3 className="font-bold text-sm md:text-base line-clamp-2 group-hover:text-primary transition-colors">{pinnedNote.title || noteTranslations.untitled}</h3>
                                <NotePreviewRenderer note={pinnedNote} isPinned={true} />
                            </div>
                        )}
                    </div>
                </div>
 
                {/* Calendar Events Module - Takes 2 columns */}
                <div className="col-span-2 glass-panel p-3 md:p-5 rounded-3xl flex flex-col h-[150px] md:h-[180px] relative overflow-hidden border border-white/5">
                    <div className="flex items-center justify-center mb-2 md:mb-4 shrink-0">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
                            <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">
                        {todayEvents.length > 0 ? (
                            <div className="space-y-2">
                                <div className="text-[9px] md:text-xs font-bold text-primary mb-1 uppercase tracking-wide text-center">Hoy</div>
                                {todayEvents.map(evt => (
                                    <div key={evt.id} className="bg-white/5 rounded-xl p-2 md:p-3 border border-white/5 flex flex-col items-center text-center w-full">
                                        <h3 className="font-bold text-xs break-words w-full mb-1 px-1 text-center" style={{ color: evt.color || 'inherit' }}>
                                            {evt.title}
                                        </h3>
                                        {evt.time && (
                                            <div className="flex justify-center w-full mb-1">
                                                <span className="text-[8px] md:text-xs font-medium text-muted-foreground whitespace-nowrap bg-background/50 px-1.5 md:px-2 py-0.5 rounded-full text-center">
                                                    {evt.time}
                                                </span>
                                            </div>
                                        )}
                                        {evt.description && <p className="text-[9px] md:text-xs text-muted-foreground break-words w-full mt-0.5 text-center">{evt.description}</p>}
                                        {evt.notes && !evt.description && <p className="text-[9px] md:text-xs text-muted-foreground break-words w-full mt-0.5 text-center">{evt.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="text-[9px] md:text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">Próximos 15 Días</div>
                                {upcomingEvents.length > 0 ? (
                                    upcomingEvents.map(evt => {
                                        const evtDate = new Date(evt.date);
                                        const dateStr = evtDate.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' });
                                        return (
                                            <div key={evt.id} className="flex flex-col py-2 border-b border-white/5 last:border-0 group gap-1 w-full">
                                                <div className="flex items-start gap-1.5 md:gap-3 w-full">
                                                    <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: evt.color || '#3b82f6' }} />
                                                    <h3 className="font-medium text-xs break-words flex-1 group-hover:text-primary transition-colors pr-1 text-left">{evt.title}</h3>
                                                </div>
                                                <div className="text-[10px] md:text-xs font-medium text-muted-foreground w-full text-right opacity-70 group-hover:opacity-100 transition-opacity pr-1">
                                                    {dateStr}
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full py-4 text-muted-foreground/50">
                                        <Clock className="w-8 h-8 mb-2 opacity-20" />
                                        <span className="text-[10px] md:text-sm text-center font-medium">Sin eventos</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* ROW 2: Recent Note (Full width) */}
            {recentNote && recentNote.id !== pinnedNoteId && (
                <div className="glass-panel p-3 md:p-4 rounded-3xl flex flex-col h-[140px] relative overflow-hidden border border-white/5">
                    <div className="flex items-center gap-2 mb-2 shrink-0">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
                            <History className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 cursor-pointer group" onClick={() => onOpenNote(recentNote)}>
                        <div className="flex flex-col gap-1.5 pb-2">
                            <h3 className="font-bold text-base md:text-lg line-clamp-1 group-hover:text-primary transition-colors">{recentNote.title || noteTranslations.untitled}</h3>
                            <NotePreviewRenderer note={recentNote} />
                        </div>
                    </div>
                </div>
            )}

            {/* ROW 3: Goals */}
            {targetGoal && targetGoal.photos && targetGoal.photos.length > 0 && (
                <div className="w-full flex flex-col items-center mb-2">
                    <div className="w-full rounded-3xl bg-white dark:bg-white/5 shadow-sm mb-3 overflow-hidden flex items-center justify-center">
                        <img 
                            src={getLocalImageSrc(targetGoal.photos[0])} 
                            alt="Meta" 
                            className="w-full h-auto object-cover" 
                        />
                    </div>
                    {targetGoal.description ? (
                        <p className="text-sm md:text-base font-medium text-foreground text-center italic px-4 max-w-sm">"{targetGoal.description}"</p>
                    ) : (
                        <p className="text-sm md:text-base font-medium text-foreground text-center italic px-4 max-w-sm">"{targetGoal.title}"</p>
                    )}
                </div>
            )}

            {/* ROW 4: Month Calendar */}
            <div className="glass-panel p-4 md:p-5 rounded-3xl w-full border border-white/5 flex flex-col items-center bg-background/40">
                <div className="w-full flex items-center justify-center mb-4">
                    <h3 className="font-bold text-sm md:text-base capitalize text-foreground/90">
                        {todayDate.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                </div>
                <div className="grid grid-cols-7 w-full gap-1 md:gap-2 mb-2">
                    {['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'].map(day => (
                        <div key={day} className="text-center text-[10px] md:text-xs font-bold text-muted-foreground">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 w-full gap-y-2 gap-x-1">
                    {calendarDays.map((d, i) => (
                        <div key={i} className="flex items-center justify-center w-full aspect-square">
                            <div className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 text-xs md:text-sm transition-colors ${
                                d.isCurrentMonth 
                                    ? (d.isToday ? 'bg-primary text-white font-bold rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]' : 'text-foreground') 
                                    : 'text-muted-foreground/30'
                            }`}>
                                {d.day}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Note Selection Modal for Pinned Note */}
            {isSelectModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-panel w-full max-w-md p-6 rounded-3xl shadow-2xl border border-white/10 flex flex-col max-h-[80vh]">
                        <h2 className="text-xl font-bold mb-4">Seleccionar Nota para Fijar</h2>
                        
                        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2 mb-4">
                            {notes.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No tienes notas creadas.</p>
                            ) : (
                                notes.map(note => (
                                    <button
                                        key={note.id}
                                        onClick={() => {
                                            setPinnedNoteId(note.id);
                                            setIsSelectModalOpen(false);
                                        }}
                                        className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 transition-all flex flex-col gap-1"
                                    >
                                        <span className="font-bold">{note.title || noteTranslations.untitled}</span>
                                        <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</span>
                                    </button>
                                ))
                            )}
                        </div>
                        
                        <button
                            onClick={() => setIsSelectModalOpen(false)}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
