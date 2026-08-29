import React, { useState, useMemo } from 'react';
import { Camera, X, Trash2 } from 'lucide-react';
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
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap');`}</style>

            {/* Contenedor Principal Pixel Perfect */}
            <div className="relative w-full max-w-[800px] bg-white dark:bg-[#0c0c0c] rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-[#e5e7eb] dark:border-white/10 p-6 sm:p-8 my-auto animate-in zoom-in-95 duration-200">
                {/* 1. Header (fila superior) */}
                <div className="flex justify-between items-center mb-[24px]">
                    <h2 className="font-['Dancing_Script',cursive] text-[20px] font-normal text-[#1a1a1a] dark:text-zinc-100 tracking-tight">
                        nota de gastos
                    </h2>
                    
                    <div className="flex items-center gap-[12px]">
                        <span className="font-sans font-bold text-[16px] text-[#6b7280] dark:text-zinc-400">
                            Balance actual:
                        </span>
                        <span className="font-sans font-bold text-[16px] text-[#6b7280] dark:text-zinc-400">
                            {totalWalletBalance.toLocaleString()}$
                        </span>
                        <span className="text-[#d1d5db] dark:text-zinc-700 text-[16px]">|</span>
                        <span className={`font-sans font-bold text-[16px] ${projectedBalance < 0 ? 'text-red-600 animate-pulse' : 'text-[#1a1a1a] dark:text-white'}`}>
                            {projectedBalance.toLocaleString()}$
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-[16px]">
                    <div className="space-y-[16px] max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                        {items.map((item) => (
                            <div key={item.id} className="space-y-[16px] relative group">
                                {items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="absolute -top-3 right-0 p-1 text-zinc-400 hover:text-red-500 transition-colors"
                                        title="Eliminar este gasto"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}

                                {/* 2. Fila de Inputs (Título + Precio) */}
                                <div className="flex flex-col sm:flex-row gap-[16px]">
                                    <input
                                        type="text"
                                        required
                                        value={item.title}
                                        onChange={e => handleUpdateItem(item.id, 'title', e.target.value)}
                                        placeholder="¿Título del gasto?"
                                        className="flex-1 bg-white dark:bg-zinc-950 border border-[#e5e7eb] dark:border-zinc-700 rounded-[12px] px-[18px] py-[14px] text-[15px] text-[#1a1a1a] dark:text-zinc-100 placeholder:text-[#9ca3af] focus:outline-none focus:border-[#9ca3af]"
                                    />
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={item.price}
                                        onChange={e => handleUpdateItem(item.id, 'price', e.target.value)}
                                        placeholder="PRECIO"
                                        className="w-full sm:w-[180px] bg-white dark:bg-zinc-950 border border-[#e5e7eb] dark:border-zinc-700 rounded-[12px] px-[18px] py-[14px] text-[15px] font-bold text-center text-[#1a1a1a] dark:text-zinc-100 placeholder:text-[#9ca3af] placeholder:font-bold focus:outline-none focus:border-[#9ca3af] uppercase"
                                    />
                                </div>

                                {/* 3. Textarea "Justificación" */}
                                <div>
                                    <textarea
                                        value={item.description}
                                        onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                                        rows={3}
                                        placeholder="Justificación, o algo que valide por lo que se está gastando"
                                        className="w-full bg-white dark:bg-zinc-950 border border-[#e5e7eb] dark:border-zinc-700 rounded-[12px] px-[18px] py-[16px] text-[15px] text-[#1a1a1a] dark:text-zinc-100 placeholder:text-[#9ca3af] focus:outline-none focus:border-[#9ca3af] min-h-[100px] resize-none"
                                    />
                                </div>

                                {/* 4. Input "Imagen del producto" */}
                                <div>
                                    {item.imagePreview ? (
                                        <div className="relative w-full h-36 rounded-[12px] overflow-hidden border border-[#e5e7eb] dark:border-zinc-700 group/img">
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
                                        <label className="w-full border border-[#e5e7eb] dark:border-zinc-700 bg-white dark:bg-zinc-950 rounded-[12px] px-[18px] py-[14px] text-center text-[15px] text-[#9ca3af] hover:text-[#6b7280] dark:hover:text-zinc-200 cursor-pointer transition-colors flex items-center justify-center gap-2">
                                            <Camera className="w-4 h-4 text-[#9ca3af]" />
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

                    {/* 5. Fila inferior (Botón + Línea punteada) */}
                    <div className="flex items-center gap-[16px] pt-[4px]">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="bg-[#1a1a1a] dark:bg-white text-white dark:text-black rounded-[10px] px-[24px] py-[14px] text-[13px] font-bold tracking-[0.5px] uppercase border-none cursor-pointer whitespace-nowrap shadow-sm hover:opacity-90 active:scale-95 transition-all"
                        >
                            AGREGAR OTRO GASTO
                        </button>
                        <div className="flex-1 border-t-[2px] border-dashed border-[#d1d5db] dark:border-zinc-700 h-0" />
                    </div>

                    {/* Acciones de cierre/envío */}
                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-black/5 dark:border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-[10px] text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !isValid}
                            className="px-6 py-2.5 bg-[#1a1a1a] dark:bg-white text-white dark:text-black font-bold text-xs uppercase tracking-wider rounded-[10px] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
                        >
                            {isSubmitting ? "Guardando..." : "GUARDAR GASTOS"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
