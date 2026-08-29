import React from 'react';
import { ExpenseNote, useStore } from '@/lib/store';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import { getLocalImageSrc } from '@/lib/image-utils';

interface ExpenseNoteCardProps {
    note: ExpenseNote;
    currencySymbol: string;
}

export const ExpenseNoteCard = React.memo(({ note, currencySymbol }: ExpenseNoteCardProps) => {
    const { deleteExpenseNote, updateExpenseNote, addTransaction } = useStore();

    const handleSpent = () => {
        // 1. Mark as spent
        updateExpenseNote(note.id, { isSpent: true });
        
        // 2. Add real transaction
        addTransaction({
            id: Math.random().toString(36).substring(7),
            type: 'expense',
            amount: note.amount.toString(),
            currency: currencySymbol,
            description: note.title,
            date: new Date().toISOString().split('T')[0],
            createdAt: Date.now()
        });
    };

    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-3 flex gap-4 transition-all hover:bg-white/10 group">
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
                <div className="flex items-center justify-between mt-auto pt-1">
                    <span className="text-white/30 text-xs flex items-center gap-2">
                        {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleSpent}
                            className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                        >
                            Gastado
                        </button>
                        <button 
                            onClick={() => deleteExpenseNote(note.id)}
                            className="text-white/30 hover:text-red-400 transition-colors p-1"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
ExpenseNoteCard.displayName = 'ExpenseNoteCard';
