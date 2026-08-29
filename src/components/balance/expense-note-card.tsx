import React from 'react';
import { ExpenseNote, useStore } from '@/lib/store';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import { getLocalImageSrc } from '@/lib/image-utils';

interface ExpenseNoteCardProps {
    note: ExpenseNote;
    currencySymbol: string;
}

export const ExpenseNoteCard = React.memo(({ note, currencySymbol }: ExpenseNoteCardProps) => {
    const { deleteExpenseNote } = useStore();

    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-3 flex gap-4 transition-all hover:bg-white/10">
            {note.imageBlock?.thumbnailPath || note.imageBlock?.localPath ? (
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-black/20 flex items-center justify-center">
                    <img 
                        src={getLocalImageSrc(note.imageBlock.thumbnailPath || note.imageBlock.localPath!)} 
                        alt={note.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            ) : (
                <div className="w-16 h-16 rounded-xl shrink-0 bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                    <ImageIcon className="w-6 h-6" />
                </div>
            )}
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-white font-medium truncate">{note.title}</h4>
                    <span className="text-rose-400 font-semibold shrink-0">
                        -{currencySymbol}{note.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                {note.description && (
                    <p className="text-white/50 text-sm line-clamp-1 mb-1">{note.description}</p>
                )}
                <div className="flex items-center justify-between mt-auto">
                    <span className="text-white/30 text-xs">
                        {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                    <button 
                        onClick={() => deleteExpenseNote(note.id)}
                        className="text-white/30 hover:text-red-400 transition-colors p-1 -mr-1"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
});
ExpenseNoteCard.displayName = 'ExpenseNoteCard';
