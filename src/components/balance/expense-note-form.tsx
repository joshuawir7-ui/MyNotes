import React, { useState, useRef, useMemo } from 'react';
import { Camera, X, Check, FileText, Trash2, Plus } from 'lucide-react';
import { useStore, ExpenseNote } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { Capacitor } from '@capacitor/core';
import { saveBase64File, getOrCreateThumbnail } from '@/lib/image-utils';

type ExpenseItemInput = {
    id: string;
    title: string;
    price: string;
    description: string;
    imagePreview: string | null;
};

export function ExpenseNoteForm({ onClose }: { onClose: () => void }) {
    const { addExpenseNote } = useStore();
    
    // Get real dynamic balance from transactions
    const transactions = useStore(useShallow(state => state.transactions ?? []));
    const totalWalletBalance = useMemo(() => {
        return transactions.reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0);
    }, [transactions]);

    const [items, setItems] = useState<ExpenseItemInput[]>([
        { id: Math.random().toString(36).substring(7), title: '', price: '', description: '', imagePreview: null }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sum of all current prices being entered
    const sumatoriaGastos = useMemo(() => {
        return items.reduce((sum, item) => {
            const p = parseFloat(item.price);
            return sum + (isNaN(p) || p < 0 ? 0 : p);
        }, 0);
    }, [items]);

    const projectedBalance = totalWalletBalance - sumatoriaGastos;

    const handleAddItem = () => {
        // Validation: Last item must have a title and a valid price
        const lastItem = items[items.length - 1];
        if (lastItem && (!lastItem.title.trim() || !lastItem.price || parseFloat(lastItem.price) <= 0)) {
            return;
        }

        setItems(prev => [
            ...prev,
            { id: Math.random().toString(36).substring(7), title: '', price: '', description: '', imagePreview: null }
        ]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleUpdateItem = (id: string, field: keyof ExpenseItemInput, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            handleUpdateItem(id, 'imagePreview', base64);
        };
        reader.readAsDataURL(file);
    };

    const isValid = useMemo(() => {
        return items.length > 0 && items.every(item => item.title.trim().length > 0 && parseFloat(item.price) > 0);
    }, [items]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || isSubmitting) return;
        setIsSubmitting(true);

        try {
            for (const item of items) {
                let imageBlock: ExpenseNote['imageBlock'] = undefined;

                if (item.imagePreview) {
                    const fileName = `expense_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                    let localPath = item.imagePreview; // Default for web

                    if (Capacitor.isNativePlatform()) {
                        const pureBase64 = item.imagePreview.includes(',') ? item.imagePreview.split(',')[1] : item.imagePreview;
                        const savedPath = await saveBase64File(pureBase64, fileName);
                        if (savedPath) {
                            localPath = savedPath;
                        }
                    }

                    const thumbnailPath = await getOrCreateThumbnail(localPath);

                    imageBlock = {
                        localPath: Capacitor.isNativePlatform() ? localPath : item.imagePreview,
                        thumbnailPath: thumbnailPath
                    };
                }

                addExpenseNote({
                    id: Math.random().toString(36).substring(7),
                    title: item.title.trim(),
                    description: item.description.trim(),
                    amount: parseFloat(item.price),
                    imageBlock,
                    createdAt: Date.now()
                });
            }

            onClose();
        } catch (error) {
            console.error("Error saving expense notes:", error);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-xl bg-white dark:bg-[#0c0c0c] border border-black/10 dark:border-white/10 rounded-[32px] sm:rounded-[40px] shadow-2xl p-6 sm:p-8 my-auto animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10 mb-6">
                    <h2 className="font-serif italic text-2xl sm:text-3xl text-zinc-900 dark:text-zinc-100 tracking-tight">
                        nota de gastos
                    </h2>
                    
                    <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                        <span className="text-zinc-500 dark:text-zinc-400">
                            Balance actual: {totalWalletBalance.toLocaleString()}$
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <span className={`font-black text-lg sm:text-xl ${projectedBalance < 0 ? 'text-red-600 animate-pulse' : 'text-red-500 dark:text-rose-500'}`}>
                            {projectedBalance.toLocaleString()}$
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                        {items.map((item, index) => (
                            <div key={item.id} className="space-y-3 p-4 sm:p-5 bg-zinc-50 dark:bg-zinc-900/60 rounded-3xl border border-black/5 dark:border-white/10 relative group">
                                {items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                        title="Eliminar este gasto"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Row 1: Title & Price */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2">
                                        <input
                                            type="text"
                                            required
                                            value={item.title}
                                            onChange={e => handleUpdateItem(item.id, 'title', e.target.value)}
                                            placeholder="¿Título del gasto?"
                                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-medium text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={item.price}
                                            onChange={e => handleUpdateItem(item.id, 'price', e.target.value)}
                                            placeholder="PRECIO"
                                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-black text-center text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 uppercase"
                                        />
                                    </div>
                                </div>

                                {/* Row 2: Description */}
                                <div>
                                    <textarea
                                        value={item.description}
                                        onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                                        rows={2}
                                        placeholder="Justificación, o algo que valide por lo que se está gastando"
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 resize-none"
                                    />
                                </div>

                                {/* Row 3: Image Upload */}
                                <div>
                                    {item.imagePreview ? (
                                        <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 group/img">
                                            <img src={item.imagePreview} alt="Producto" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateItem(item.id, 'imagePreview', null)}
                                                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="w-full py-3 px-4 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 rounded-2xl flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer transition-colors">
                                            <Camera className="w-4 h-4" />
                                            <span>Imagen del producto</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={e => handleFileChange(item.id, e)}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Button AGREGAR OTRO GASTO + Dashed Line */}
                    <div className="flex items-center pt-2">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="px-5 py-3 bg-black dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all shrink-0"
                        >
                            AGREGAR OTRO GASTO
                        </button>
                        <div className="border-t-2 border-dashed border-zinc-300 dark:border-zinc-700 flex-1 ml-4" />
                    </div>

                    {/* Actions / Submit */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !isValid}
                            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                        >
                            {isSubmitting ? "Guardando..." : "Guardar Gastos"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
