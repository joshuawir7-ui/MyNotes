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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&display=swap');`}</style>
            
            <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-[32px] w-full max-w-[800px] mx-auto relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                
                {/* 1. Header (fila superior) */}
                <div className="flex justify-between items-center mb-[24px]">
                    <h2 className="font-['Dancing_Script',cursive] text-[20px] text-[#1a1a1a] font-normal m-0 leading-none">
                        nota de gastos
                    </h2>
                    
                    <div className="flex items-center gap-[12px]">
                        <span className="font-sans font-bold text-[16px] text-[#6b7280]">
                            Balance actual:
                        </span>
                        <span className="font-sans font-bold text-[16px] text-[#6b7280]">
                            {totalWalletBalance}$
                        </span>
                        <div className="w-[1px] h-[20px] bg-[#d1d5db]"></div>
                        <span className="font-sans font-bold text-[16px] text-[#1a1a1a]">
                            {projectedBalance}$
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {items.map((item) => (
                        <div key={item.id} className="relative group">
                            {items.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="absolute -right-2 top-2 p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors z-10"
                                    title="Eliminar este gasto"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}

                            {/* 2. Fila de Inputs (Título + Precio) */}
                            <div className="flex flex-col sm:flex-row gap-[16px] mb-[16px]">
                                <input
                                    type="text"
                                    required
                                    value={item.title}
                                    onChange={e => handleUpdateItem(item.id, 'title', e.target.value)}
                                    placeholder="¿Título del gasto?"
                                    className="flex-1 border border-[#e5e7eb] rounded-[12px] px-[18px] py-[14px] text-[15px] placeholder:text-[#9ca3af] bg-transparent outline-none focus:border-zinc-400 text-[#1a1a1a] transition-colors"
                                />
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={item.price}
                                    onChange={e => handleUpdateItem(item.id, 'price', e.target.value)}
                                    placeholder="PRECIO"
                                    className="w-full sm:w-[180px] border border-[#e5e7eb] rounded-[12px] px-[18px] py-[14px] text-[15px] font-bold text-center placeholder:text-[#9ca3af] bg-transparent outline-none focus:border-zinc-400 text-[#1a1a1a] transition-colors"
                                />
                            </div>

                            {/* 3. Textarea "Justificación" */}
                            <textarea
                                value={item.description}
                                onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                                placeholder="Justificación, o algo que valide por lo que se está gastando"
                                className="w-full border border-[#e5e7eb] rounded-[12px] px-[18px] py-[16px] min-h-[100px] text-[15px] placeholder:text-[#9ca3af] mb-[16px] resize-none bg-transparent outline-none focus:border-zinc-400 text-[#1a1a1a] transition-colors block"
                            />

                            {/* 4. Input "Imagen del producto" */}
                            <div className="mb-[20px]">
                                {item.imagePreview ? (
                                    <div className="relative w-full h-[140px] rounded-[12px] overflow-hidden border border-[#e5e7eb] group/img">
                                        <img src={item.imagePreview} alt="Producto" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateItem(item.id, 'imagePreview', null)}
                                            className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="w-full border border-[#e5e7eb] rounded-[12px] px-[18px] py-[14px] text-center text-[15px] text-[#9ca3af] cursor-pointer flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors">
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

                    {/* 5. Fila inferior (Botón + Línea punteada) */}
                    <div className="flex items-center gap-[16px] mb-[24px]">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="bg-[#1a1a1a] text-[#FFFFFF] rounded-[10px] px-[24px] py-[14px] text-[13px] font-bold tracking-[0.5px] uppercase border-none cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-95 transition-all"
                        >
                            AGREGAR OTRO GASTO
                        </button>
                        <div className="flex-1 border-t-[2px] border-dashed border-[#d1d5db] h-0"></div>
                    </div>

                    {/* Actions / Submit */}
                    <div className="flex justify-end items-center gap-[16px] pt-[16px]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-[24px] py-[14px] text-[#6b7280] font-bold hover:bg-zinc-100 rounded-[12px] transition-colors text-[15px]"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !isValid}
                            className="px-[32px] py-[14px] bg-[#ff0044] hover:bg-[#e0003c] text-[#FFFFFF] font-bold text-[15px] uppercase tracking-[0.5px] rounded-full transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                        >
                            {isSubmitting ? "Guardando..." : "GUARDAR GASTOS"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
