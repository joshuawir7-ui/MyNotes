import React, { useEffect, useMemo, useState } from 'react';
import { Camera, X, Trash2, Check } from 'lucide-react';
import { useStore, ExpenseNote } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { Capacitor } from '@capacitor/core';
import { saveBase64File, getOrCreateThumbnail, getLocalImageSrc } from '@/lib/image-utils';
import { LocalImage } from '@/components/ui/local-image';
import { useDeferredBlur } from '@/hooks/use-deferred-blur';
import { pick } from '@/lib/i18n-inline';

export function ExpenseNoteForm({ onClose }: { onClose: () => void }) {
    const scrimBlur = useDeferredBlur(true);
    const language = useStore(state => state.language) || 'en';
    const currency = useStore(state => state.currency) || (language === 'zh' ? '¥' : '$');
    const expenseNotes = useStore(useShallow(state => state.expenseNotes));
    const addExpenseNote = useStore(state => state.addExpenseNote);
    const updateExpenseNote = useStore(state => state.updateExpenseNote);
    const deleteExpenseNote = useStore(state => state.deleteExpenseNote);
    const addTransaction = useStore(state => state.addTransaction);
    
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
                } else {
                    const { saveBase64ImageToFile } = await import('@/lib/image-utils');
                    const savedUri = await saveBase64ImageToFile(base64);
                    if (savedUri) {
                        localPath = savedUri;
                    }
                }

                const thumbnailPath = await getOrCreateThumbnail(localPath);

                handleUpdateItem(id, { 
                    imageBlock: {
                        localPath,
                        thumbnailPath
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
            type: 'expense',
            amount: gasto.amount,
            currency,
            description: gasto.title || pick(language, { es: 'Gasto planeado', en: 'Planned expense', zh: '计划支出' }),
            date: new Date().toISOString().split('T')[0]
        });

        // Mark as confirmed
        handleUpdateItem(gasto.id, { confirmado: true });
    };

    const handleClose = () => {
        const items = expenseNotes || [];
        items.forEach(item => {
            if (!item.title || item.title.trim() === '') {
                deleteExpenseNote(item.id);
            }
        });
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 ${scrimBlur ? "backdrop-blur-sm" : ""} animate-in fade-in duration-200`}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&display=swap');`}</style>
            
            <div className="bg-[#FFFFFF] dark:bg-zinc-900 border border-transparent dark:border-zinc-800/80 rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-2xl p-4 sm:p-[32px] w-full max-w-[800px] mx-auto relative max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col transition-colors">
                
                {/* 1. Header (fila superior) */}
                <div className="flex justify-between items-center mb-[24px] shrink-0 gap-2">
                    <h2 className="font-['Dancing_Script',cursive] text-[20px] text-[#1a1a1a] dark:text-zinc-100 font-normal m-0 leading-none">
                        {pick(language, { es: 'nota de gastos', en: 'expense notes', zh: '支出笔记' })}
                    </h2>
                    
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-sans font-medium text-[11px] sm:text-[13px] text-[#6b7280] dark:text-zinc-400">
                            {pick(language, { es: 'Balance actual:', en: 'Current balance:', zh: '当前余额：' })}
                        </span>
                        <span className={`font-sans font-bold text-[11px] sm:text-[13px] ${sumatoriaGastos > 0 ? 'text-red-500 dark:text-red-400' : 'text-[#1a1a1a] dark:text-zinc-100'}`}>
                            {projectedBalance}{currency}
                        </span>
                        <button onClick={handleClose} className="ml-1 sm:ml-2 p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" title={pick(language, { es: 'Cerrar', en: 'Close', zh: '关闭' })}>
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
                                    placeholder={pick(language, { es: '¿Título del gasto?', en: 'Expense title?', zh: '支出标题？' })}
                                    disabled={item.confirmado}
                                    className="flex-1 w-full border border-[#e5e7eb] dark:border-zinc-800 rounded-[12px] px-[18px] py-[14px] text-[15px] placeholder:text-[#9ca3af] dark:placeholder:text-zinc-500 bg-transparent outline-none focus:border-zinc-400 dark:focus:border-zinc-600 text-[#1a1a1a] dark:text-zinc-100 transition-colors disabled:opacity-60"
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
                                        placeholder={pick(language, { es: 'PRECIO', en: 'PRICE', zh: '价格' })}
                                        disabled={item.confirmado}
                                        className="flex-1 sm:w-[140px] border border-[#e5e7eb] dark:border-zinc-800 rounded-[12px] px-[18px] py-[14px] text-[15px] font-bold text-center placeholder:text-[#9ca3af] dark:placeholder:text-zinc-500 bg-transparent outline-none focus:border-zinc-400 dark:focus:border-zinc-600 text-[#1a1a1a] dark:text-zinc-100 transition-colors disabled:opacity-60"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="p-3 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-xl transition-colors shrink-0"
                                        title={pick(language, { es: 'Eliminar este gasto', en: 'Delete this expense', zh: '删除此支出' })}
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
                                placeholder={pick(language, { es: 'Justificación, o algo que valide por lo que se está gastando', en: 'Justification or reason for this expense', zh: '支出理由或说明' })}
                                disabled={item.confirmado}
                                className="w-full border border-[#e5e7eb] dark:border-zinc-800 rounded-[12px] px-[18px] py-[16px] min-h-[56px] text-[15px] placeholder:text-[#9ca3af] dark:placeholder:text-zinc-500 mb-[16px] resize-none bg-transparent outline-none focus:border-zinc-400 dark:focus:border-zinc-600 text-[#1a1a1a] dark:text-zinc-100 transition-colors block overflow-hidden disabled:opacity-60"
                            />

                            {/* 4. Input "Imagen del producto" */}
                            {(() => {
                                const imgSrc = item.imageBlock?.localPath
                                    || (item.imageBlock?.driveFileId ? `drive://${item.imageBlock.driveFileId}` : undefined)
                                    || item.imageBlock?.thumbnailPath;
                                return (
                            <div className="mb-[20px] flex">
                                {imgSrc ? (
                                    <div className="relative w-[180px] h-[140px] rounded-[12px] overflow-hidden border border-[#e5e7eb] dark:border-zinc-800 bg-[#f9fafb] dark:bg-zinc-800/50 group/img shrink-0">
                                        <LocalImage src={imgSrc} alt="Product" className="w-full h-full object-contain" />
                                        {!item.confirmado && (
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateItem(item.id, { imageBlock: undefined })}
                                                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <label className={`w-full border border-[#e5e7eb] dark:border-zinc-800 rounded-[12px] px-[18px] py-[14px] text-center text-[15px] text-[#9ca3af] dark:text-zinc-400 flex items-center justify-center gap-2 transition-colors ${item.confirmado ? 'opacity-60' : 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                        <span>{pick(language, { es: 'Imagen del producto', en: 'Product image', zh: '商品图片' })}</span>
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
                                );
                            })()}

                            {/* 5. Fila inferior (Botón AGREGAR OTRO GASTO + Línea punteada + Botón GASTO) */}
                            <div className="flex items-center justify-between gap-2 sm:gap-[16px] mb-[32px] w-full">
                                {index === items.length - 1 ? (
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="bg-[#1a1a1a] dark:bg-zinc-100 text-[#FFFFFF] dark:text-zinc-900 rounded-[10px] px-3 sm:px-[24px] py-3 sm:py-[14px] text-[11px] sm:text-[13px] font-bold tracking-[0.5px] uppercase border-none cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-95 transition-all shrink-0"
                                    >
                                        {pick(language, { es: 'AGREGAR OTRO GASTO', en: 'ADD ANOTHER EXPENSE', zh: '添加另一笔支出' })}
                                    </button>
                                ) : null}
                                <div className="flex-1 border-t-[2px] border-dashed border-[#d1d5db] dark:border-zinc-700 h-0 min-w-0 hidden sm:block"></div>
                                
                                {item.confirmado ? (
                                    <button
                                        type="button"
                                        disabled
                                        className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-[10px] px-3 sm:px-[24px] py-2.5 sm:py-[13px] text-[11px] sm:text-[13px] font-bold tracking-[0.5px] uppercase flex items-center gap-1.5 sm:gap-2 cursor-not-allowed shrink-0 ml-auto sm:ml-0"
                                    >
                                        <Check className="w-4 h-4" />
                                        {pick(language, { es: 'CONFIRMADO', en: 'CONFIRMED', zh: '已确认' })}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => confirmarGasto(item)}
                                        disabled={!item.amount || item.amount <= 0}
                                        className="bg-[#6b7280] dark:bg-zinc-700 text-[#FFFFFF] dark:text-zinc-100 rounded-[10px] px-3 sm:px-[24px] py-3 sm:py-[14px] text-[11px] sm:text-[13px] font-bold tracking-[0.5px] uppercase border-none cursor-pointer whitespace-nowrap hover:bg-[#4b5563] dark:hover:bg-zinc-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-auto sm:ml-0"
                                    >
                                        {pick(language, { es: 'GASTO', en: 'SPEND', zh: '确认支出' })}
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
