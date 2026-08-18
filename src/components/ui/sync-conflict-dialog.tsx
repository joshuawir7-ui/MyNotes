"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Cloud, Smartphone, Check } from "lucide-react";
import { useStore } from "@/lib/store";

export function SyncConflictDialog() {
    const language = useStore((state) => state.language);
    const syncConflict = useStore((state) => state.syncConflict);
    const resolveSyncConflict = useStore((state) => state.resolveSyncConflict);
    const [mounted, setMounted] = useState(false);
    const [isResolving, setIsResolving] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !syncConflict) return null;

    const handleResolve = async (keepLocal: boolean) => {
        setIsResolving(true);
        await resolveSyncConflict(keepLocal);
        setIsResolving(false);
    };

    const formatDate = (timestamp: number) => {
        if (!timestamp) return language === "es" ? "Desconocida" : "Unknown";
        return new Date(timestamp).toLocaleString(language === "es" ? "es-ES" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    };

    // Calculate summaries
    const localNotesCount = (syncConflict.localData.notes || []).length;
    const localTasksCount = (syncConflict.localData.tasks || []).length;
    
    const remoteNotesCount = (syncConflict.remoteData.notes || []).length;
    const remoteTasksCount = (syncConflict.remoteData.tasks || []).length;

    return createPortal(
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-md z-[99998]"
            />
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="pointer-events-auto w-full max-w-md rounded-[2rem] bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10 p-6 flex flex-col overflow-hidden relative"
                >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                    
                    <div className="flex items-center gap-3 mb-2 mt-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white leading-tight">
                            {language === "es" ? "Conflicto de sincronización" : "Sync Conflict"}
                        </h2>
                    </div>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 mt-2 leading-relaxed">
                        {language === "es"
                            ? "Ambas versiones tienen cambios recientes. ¿Cuál versión deseas conservar?"
                            : "Both versions have recent changes. Which version do you want to keep?"}
                    </p>

                    <div className="flex flex-col gap-3">
                        {/* Local Option */}
                        <button
                            onClick={() => handleResolve(true)}
                            disabled={isResolving}
                            className="relative w-full p-4 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all text-left group disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <div className="flex items-start gap-4">
                                <div className="mt-1 shrink-0 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-500/20 text-zinc-600 dark:text-zinc-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                    <Smartphone className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                                        {language === "es" ? "Este dispositivo (Local)" : "This device (Local)"}
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                        {language === "es" ? "Modificado: " : "Modified: "} 
                                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                            {formatDate(syncConflict.localTimestamp)}
                                        </span>
                                    </p>
                                    <div className="flex gap-3 mt-2 text-xs font-medium">
                                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                                            {localNotesCount} {language === "es" ? "notas" : "notes"}
                                        </span>
                                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                                            {localTasksCount} {language === "es" ? "tareas" : "tasks"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Remote Option */}
                        <button
                            onClick={() => handleResolve(false)}
                            disabled={isResolving}
                            className="relative w-full p-4 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all text-left group disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <div className="flex items-start gap-4">
                                <div className="mt-1 shrink-0 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    <Cloud className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                                        {language === "es" ? "Google Drive (Nube)" : "Google Drive (Cloud)"}
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                        {language === "es" ? "Modificado: " : "Modified: "}
                                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                            {formatDate(syncConflict.remoteTimestamp)}
                                        </span>
                                    </p>
                                    <div className="flex gap-3 mt-2 text-xs font-medium">
                                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                                            {remoteNotesCount} {language === "es" ? "notas" : "notes"}
                                        </span>
                                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                                            {remoteTasksCount} {language === "es" ? "tareas" : "tasks"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="mt-5 text-center px-4">
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 uppercase tracking-wider font-bold">
                            {language === "es" 
                                ? "Advertencia: La versión no seleccionada se perderá." 
                                : "Warning: The unselected version will be lost."}
                        </p>
                    </div>
                </motion.div>
            </div>
        </>,
        document.body
    );
}
