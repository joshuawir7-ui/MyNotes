import React, { useState, useRef } from 'react';
import { Camera, X, Check, FileText } from 'lucide-react';
import { useStore, ExpenseNote } from '@/lib/store';
import { Capacitor } from '@capacitor/core';
import { getLocalImageSrc, saveBase64File, getOrCreateThumbnail } from '@/lib/image-utils';

export function ExpenseNoteForm({ onClose }: { onClose: () => void }) {
    const { addExpenseNote } = useStore();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            setImagePreview(base64);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !amount) return;
        setIsSubmitting(true);

        try {
            let imageBlock: ExpenseNote['imageBlock'] = undefined;

            if (imagePreview) {
                const fileName = `expense_${Date.now()}.jpg`;
                let localPath = imagePreview; // Default for web

                if (Capacitor.isNativePlatform()) {
                    const pureBase64 = imagePreview.includes(',') ? imagePreview.split(',')[1] : imagePreview;
                    const savedPath = await saveBase64File(pureBase64, fileName);
                    if (savedPath) {
                        localPath = savedPath;
                    }
                }

                const thumbnailPath = await getOrCreateThumbnail(localPath);

                imageBlock = {
                    localPath: Capacitor.isNativePlatform() ? localPath : imagePreview,
                    thumbnailPath: thumbnailPath
                };
            }

            addExpenseNote({
                id: Math.random().toString(36).substring(7),
                title,
                description,
                amount: parseFloat(amount),
                imageBlock,
                createdAt: Date.now()
            });

            onClose();
        } catch (error) {
            console.error("Error saving expense note:", error);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-20 sm:p-0">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in-0 duration-300">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                                <FileText className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Nueva Nota de Gasto</h2>
                        </div>
                        <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-1">Título</label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                placeholder="Ej: Compra de materiales"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-1">Monto</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-1">Descripción</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50 resize-none"
                                placeholder="Justificación del gasto..."
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-1">Documento adjunto</label>
                            {imagePreview ? (
                                <div className="relative w-full h-40 rounded-xl overflow-hidden group">
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                            type="button" 
                                            onClick={() => setImagePreview(null)}
                                            className="px-4 py-2 bg-red-500/80 text-white rounded-lg backdrop-blur"
                                        >
                                            Eliminar imagen
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-24 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-white/50 hover:text-white/80 hover:border-white/30 hover:bg-white/5 transition-all cursor-pointer"
                                >
                                    <Camera className="w-6 h-6 mb-2" />
                                    <span className="text-sm">Tomar foto o subir archivo</span>
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-3 rounded-xl text-white/70 font-medium hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !title || !amount}
                                className="px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-medium flex items-center gap-2 shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Guardar
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
