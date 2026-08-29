import React, { useEffect, useMemo, useState } from 'react';
import { Camera, X, Trash2, Check } from 'lucide-react';
import { useStore, ExpenseNote } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { Capacitor } from '@capacitor/core';
import { saveBase64File, getOrCreateThumbnail, getLocalImageSrc } from '@/lib/image-utils';

export function ExpenseNoteForm({ onClose }: { onClose: () => void }) {
    const { expenseNotes, addExpenseNote, updateExpenseNote, deleteExpenseNote, addTransaction } = useStore();
    
    // Get real dynamic balance from transactions
    const transactions = useStore(useShallow(state => state.transactions ?? []));
    const totalWalletBalance = useMemo(() => {
        return transactions.reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0);
    }, [transactions]);

    // Initialize with an empty note if none exist
    useEffect(() => {
        if (!expenseNotes || expenseNotes.length === 0) {
            addExpenseNote({
                id: Math.random().toString(36).substring(7),
                title: '',
                amount: 0,
                description: '',
                createdAt: Date.now()
            });
        }
    }, [expenseNotes, addExpenseNote]);

    const items = expenseNotes || [];

    // Sum of all current prices being entered that are NOT yet confirmed
    const sumatoriaGastos = useMemo(() => {
        return items.reduce((sum, item) => {
            if (item.confirmado) return sum; // Do not subtract if already confirmed (already in balance)
            return sum + (item.amount > 0 ? item.amount : 0);
        }, 0);
    }, [items]);

    const projectedBalance = totalWalletBalance - sumatoriaGastos;

    const handleAddItem = () => {
        addExpenseNote({
            id: Math.random().toString(36).substring(7),
            title: '',
            amount: 0,
            description: '',
            createdAt: Date.now()
        });
    };

    const handleRemoveItem = (id: string) => {
        deleteExpenseNote(id);
    };

    const handleUpdateItem = (id: string, updates: Partial<ExpenseNote>) => {
        updateExpenseNote(id, updates);
    };

    const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            
            try {
                const fileName = `expense_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                let localPath = base64; // Default for web

                if (Capacitor.isNativePlatform()) {
                    const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
                    const savedPath = await saveBase64File(pureBase64, fileName);
                    if (savedPath) {
                        localPath = savedPath;
                    }
                }

                const thumbnailPath = await getOrCreateThumbnail(localPath);

                handleUpdateItem(id, { 
                    imageBlock: {
                        localPath: Capacitor.isNativePlatform() ? localPath : base64,
                        thumbnailPath: thumbnailPath
                    }
                });
            } catch (err) {
                console.error("Error saving image", err);
            }
        };
        reader.readAsDataURL(file);
    };

    const confirmarGasto = (gasto: ExpenseNote) => {
        if (!gasto.amount || gasto.amount <= 0) return;
        if (gasto.confirmado) return;

        // Add real transaction
        addTransaction({
            id: Math.random().toString(36).substring(7),
            type: 'expense',
            amount: gasto.amount,
            currency: '$',
            description: gasto.title || 'Gasto planeado',
            date: new Date().toISOString().split('T')[0],
            createdAt: Date.now()
        });

        // Mark as confirmed
        handleUpdateItem(gasto.id, { confirmado: true });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&display=swap');`}</style>
            
            <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-[32px] w-full max-w-[800px] mx-auto relative max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col">
                
                {/* 1. Header (fila superior) */}
                <div className="flex justify-between items-center mb-[24px] shrink-0">
                    <h2 className="font-['Dancing_Script',cursive] text-[20px] text-[#1a1a1a] font-normal m-0 leading-none">
                        nota de gastos
                    </h2>
                    
                    <div className="flex items-center gap-[12px]">
                        <span className="font-sans font-bold text-[16px] text-[#6b7280]">
                            Balance actual:
                        </span>
                        <span className="font-sans font-bold text-[16px] text-[#1a1a1a]">
                            {totalWalletBalance}$
                        </span>
                        <button onClick={onClose} className="ml-2 p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Cerrar">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-1 pb-4">
                    {items.map((item, index) => (
                        <div key={item.id} className="relative group">
                            {/* 2. Fila de Inputs (Título + Precio + Trash) */}
                            <div className="flex flex-col sm:flex-row gap-[16px] mb-[16px] items-start sm:items-center">
                                <input
                                    type="text"
                                    value={item.title}
                                    onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                                    placeholder="¿Título del gasto?"
                                    disabled={item.confirmado}
                                    className="flex-1 w-full border border-[#e5e7eb] rounded-[12px] px-[18px] py-[14px] text-[15px] placeholder:text-[#9ca3af] bg-transparent outline-none focus:border-zinc-400 text-[#1a1a1a] transition-colors disabled:opacity-60"
                                />
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.amount || ''}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            handleUpdateItem(item.id, { amount: isNaN(val) ? 0 : val });
                                        }}
                                        placeholder="PRECIO"
                                        disabled={item.confirmado}
                                        className="flex-1 sm:w-[140px] border border-[#e5e7eb] rounded-[12px] px-[18px] py-[14px] text-[15px] font-bold text-center placeholder:text-[#9ca3af] bg-transparent outline-none focus:border-zinc-400 text-[#1a1a1a] transition-colors disabled:opacity-60"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                                        title="Eliminar este gasto"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* 3. Textarea "Justificación" */}
                            <textarea
                                value={item.description}
                                onChange={e => {
                                    handleUpdateItem(item.id, { description: e.target.value });
                                }}
                                onInput={e => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                }}
                                placeholder="Justificación, o algo que valide por lo que se está gastando"
                                disabled={item.confirmado}
                                className="w-full border border-[#e5e7eb] rounded-[12px] px-[18px] py-[16px] min-h-[56px] text-[15px] placeholder:text-[#9ca3af] mb-[16px] resize-none bg-transparent outline-none focus:border-zinc-400 text-[#1a1a1a] transition-colors block overflow-hidden disabled:opacity-60"
                            />

                            {/* 4. Input "Imagen del producto" */}
                            <div className="mb-[20px] flex">
                                {item.imageBlock?.localPath ? (
                                    <div className="relative w-[180px] h-[140px] rounded-[12px] overflow-hidden border border-[#e5e7eb] bg-[#f9fafb] group/img shrink-0">
                                        <img src={getLocalImageSrc(item.imageBlock.localPath)} alt="Producto" className="w-full h-full object-contain" />
                                        {!item.confirmado && (
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateItem(item.id, { imageBlock: undefined })}
                                                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <label className={`w-full border border-[#e5e7eb] rounded-[12px] px-[18px] py-[14px] text-center text-[15px] text-[#9ca3af] flex items-center justify-center gap-2 transition-colors ${item.confirmado ? 'opacity-60' : 'cursor-pointer hover:bg-zinc-50'}`}>
                                        <span>Imagen del producto</span>
                                        {!item.confirmado && (
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={e => handleFileChange(item.id, e)}
                                            />
                                        )}
                                    </label>
                                )}
                            </div>

                            {/* 5. Fila inferior (Botón AGREGAR OTRO GASTO + Línea punteada + Botón GASTO) */}
                            <div className="flex items-center gap-[16px] mb-[32px]">
                                {index === items.length - 1 && (
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="bg-[#1a1a1a] text-[#FFFFFF] rounded-[10px] px-[24px] py-[14px] text-[13px] font-bold tracking-[0.5px] uppercase border-none cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-95 transition-all"
                                    >
                                        AGREGAR OTRO GASTO
                                    </button>
                                )}
                                <div className="flex-1 border-t-[2px] border-dashed border-[#d1d5db] h-0"></div>
                                
                                {item.confirmado ? (
                                    <button
                                        type="button"
                                        disabled
                                        className="bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-[10px] px-[24px] py-[13px] text-[13px] font-bold tracking-[0.5px] uppercase flex items-center gap-2 cursor-not-allowed"
                                    >
                                        <Check className="w-4 h-4" />
                                        CONFIRMADO
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => confirmarGasto(item)}
                                        disabled={!item.amount || item.amount <= 0}
                                        className="bg-[#6b7280] text-[#FFFFFF] rounded-[10px] px-[24px] py-[14px] text-[13px] font-bold tracking-[0.5px] uppercase border-none cursor-pointer whitespace-nowrap hover:bg-[#4b5563] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        GASTO
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
