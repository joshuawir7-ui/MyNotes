/**
 * sync-logic.ts
 * Lógica pura de sincronización, fusión (3-way merge) y decisiones de red de MyNotes.
 * NO depende de React, Zustand, Capacitor ni APIs del navegador.
 * 100% testeable en Node/navegador sin mocks de red complejos.
 */

export interface SyncableItem {
    id: string;
    lastUpdated?: number;
    [key: string]: any;
}

export interface SyncBackupData {
    notes: any[];
    tasks: any[];
    goals: any[];
    appointments: any[];
    projects: any[];
    taskGroups: any[];
    completedOnceHabits: any[];
    transactions: any[];
    expenseNotes: any[];
    savingsGoal: number;
    dailySnapshots: Record<string, { total: number; completed: number }>;
    user: any;
    deletedItems: Record<string, number>;
    lastUpdated?: number;
}

export interface CollectionDiffResult<T> {
    merged: T[];
    changedLocal: boolean;
    changedRemote: boolean;
}

export interface MergeDataResult {
    merged: SyncBackupData;
    changedLocal: boolean;
    changedRemote: boolean;
}

/** Comprueba si un elemento tiene contenido sustancial para no sobreescribir datos con plantillas vacías. */
export const itemHasContent = (item: any): boolean => {
    if (!item) return false;
    // Si tiene título sustancial, tiene contenido
    if (typeof item.title === 'string' && item.title.trim().length > 0) return true;
    // Si tiene bloques con texto/datos, tiene contenido
    if (Array.isArray(item.blocks)) {
        return item.blocks.some((b: any) => {
            if (!b) return false;
            const c = b.content;
            if (Array.isArray(c)) return c.length > 0;
            if (typeof c === 'string') return c.trim().length > 0;
            if (c && typeof c === 'object') return Object.keys(c).length > 0;
            return false;
        });
    }
    return true;
};

/**
 * Fusiona dos listas de elementos (tasks, goals, etc.) calculando si hubo cambios
 * locales (remoto aportó algo más nuevo) o remotos (local tiene algo más nuevo que subir).
 */
export const mergeListsWithDiff = <T extends SyncableItem>(
    localList: T[] | undefined,
    remoteList: T[] | undefined,
    useLocalForConflicts: boolean = false,
    deletedItems?: Record<string, number>
): CollectionDiffResult<T> => {
    const local = localList || [];
    const remote = remoteList || [];
    const deletes = deletedItems || {};

    const localMap = new Map<string, T>();
    for (const item of local) if (item && item.id) localMap.set(item.id, item);

    const remoteMap = new Map<string, T>();
    for (const item of remote) if (item && item.id) remoteMap.set(item.id, item);

    const allIds = new Set<string>();
    localMap.forEach((_, k) => allIds.add(k));
    remoteMap.forEach((_, k) => allIds.add(k));
    const mergedMap = new Map<string, T>();

    let changedLocal = false;
    let changedRemote = false;

    allIds.forEach(id => {
        const localItem = localMap.get(id);
        const remoteItem = remoteMap.get(id);
        const delTime = deletes[id] || 0;

        const localTime = localItem?.lastUpdated || 0;
        const remoteTime = remoteItem?.lastUpdated || 0;

        const localTombstoned = localItem ? (delTime > 0 && localTime <= delTime) : true;
        const remoteTombstoned = remoteItem ? (delTime > 0 && remoteTime <= delTime) : true;

        // Caso 1: Borrado en ambos lados
        if (localTombstoned && remoteTombstoned) {
            if (localItem && delTime > localTime) {
                changedLocal = true; // El remoto nos informó que este ítem local ya fue borrado
            }
            return;
        }

        // Caso 2: Activo solo en local
        if (localItem && !localTombstoned && (!remoteItem || remoteTombstoned)) {
            mergedMap.set(id, localItem);
            changedRemote = true; // El remoto no lo tiene o lo tenía borrado con fecha vieja
            return;
        }

        // Caso 3: Activo solo en remoto
        if (remoteItem && !remoteTombstoned && (!localItem || localTombstoned)) {
            mergedMap.set(id, remoteItem);
            changedLocal = true; // El local no lo tiene o lo tenía borrado con fecha vieja
            return;
        }

        // Caso 4: Activo en ambos
        if (localItem && remoteItem) {
            const localHas = itemHasContent(localItem);
            const remoteHas = itemHasContent(remoteItem);

            // Protección de contenido vacío
            if (localHas && !remoteHas) {
                mergedMap.set(id, localItem);
                changedRemote = true;
                return;
            }
            if (!localHas && remoteHas) {
                mergedMap.set(id, remoteItem);
                changedLocal = true;
                return;
            }

            if (localTime > remoteTime) {
                mergedMap.set(id, localItem);
                changedRemote = true;
            } else if (remoteTime > localTime) {
                mergedMap.set(id, remoteItem);
                changedLocal = true;
            } else {
                // Tiempos iguales: si el contenido difiere, aplicar desempate y marcar la diferencia
                const contentDiffers = JSON.stringify(localItem) !== JSON.stringify(remoteItem);
                if (contentDiffers) {
                    if (useLocalForConflicts) {
                        mergedMap.set(id, localItem);
                        changedRemote = true;
                    } else {
                        mergedMap.set(id, remoteItem);
                        changedLocal = true;
                    }
                } else {
                    mergedMap.set(id, remoteItem);
                }
            }
        }
    });

    const merged: T[] = [];
    mergedMap.forEach(v => merged.push(v));
    return {
        merged,
        changedLocal,
        changedRemote
    };
};

/**
 * Fusión de notas preservando URIs locales de imágenes descargadas.
 */
export const mergeNotesWithDiff = (
    localNotes: any[] | undefined,
    remoteNotes: any[] | undefined,
    useLocalForConflicts: boolean = false,
    deletedItems?: Record<string, number>
): CollectionDiffResult<any> => {
    const listRes = mergeListsWithDiff(localNotes, remoteNotes, useLocalForConflicts, deletedItems);
    const localMap = new Map((localNotes || []).map(n => [n.id, n]));

    const finalNotes = listRes.merged.map(note => {
        const local = localMap.get(note.id);
        const localBlocks = Array.isArray(local?.blocks) ? local.blocks : [];

        // Si la nota ganadora tiene drive:// en bloques pero en local ya teníamos file:// o localPath,
        // preservamos el enlace local de caché para no forzar una redescarga.
        if (Array.isArray(note.blocks)) {
            const preservedBlocks = note.blocks.map((b: any) => {
                if (['image', 'video', 'file', 'drawing'].includes(b.type) && b.driveFileId) {
                    const localB = localBlocks.find((lb: any) => lb.id === b.id && lb.driveFileId === b.driveFileId);
                    if (localB && localB.content) {
                        const localUrl = typeof localB.content === 'string' ? localB.content : localB.content.url;
                        if (localUrl && !localUrl.startsWith('drive://')) {
                            return typeof b.content === 'string'
                                ? { ...b, content: localUrl }
                                : { ...b, content: { ...b.content, url: localUrl } };
                        }
                    }
                }
                return b;
            });
            return { ...note, blocks: preservedBlocks };
        }
        return note;
    });

    return {
        merged: finalNotes,
        changedLocal: listRes.changedLocal,
        changedRemote: listRes.changedRemote
    };
};

/**
 * Fusión de deletedItems (tombstones) con cálculo de diferencias.
 */
export const mergeDeletedItemsWithDiff = (
    localDeleted: Record<string, number> | undefined,
    remoteDeleted: Record<string, number> | undefined
): { merged: Record<string, number>; changedLocal: boolean; changedRemote: boolean } => {
    const local = localDeleted || {};
    const remote = remoteDeleted || {};
    const merged: Record<string, number> = { ...remote };

    let changedLocal = false;
    let changedRemote = false;

    for (const key of Object.keys(local)) {
        const lTime = local[key] || 0;
        const rTime = remote[key] || 0;
        if (lTime > rTime) {
            merged[key] = lTime;
            changedRemote = true;
        }
    }

    for (const key of Object.keys(remote)) {
        const lTime = local[key] || 0;
        const rTime = remote[key] || 0;
        if (rTime > lTime) {
            changedLocal = true;
        }
    }

    // Podar elementos de más de 30 días (solo si son timestamps reales > año 2001)
    const pruneLimit = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const key of Object.keys(merged)) {
        if (merged[key] > 1000000000000 && merged[key] < pruneLimit) {
            delete merged[key];
        }
    }

    return { merged, changedLocal, changedRemote };
};

/**
 * Fusión de UserState.
 */
export const mergeUserWithDiff = (localUser: any, remoteUser: any): { merged: any; changedLocal: boolean; changedRemote: boolean } => {
    if (!remoteUser && !localUser) return { merged: {}, changedLocal: false, changedRemote: false };
    if (!remoteUser) return { merged: localUser, changedLocal: false, changedRemote: true };
    if (!localUser) return { merged: remoteUser, changedLocal: true, changedRemote: false };

    const merged: any = {
        xp: Math.max(localUser.xp || 0, remoteUser.xp || 0),
        level: Math.max(localUser.level || 1, remoteUser.level || 1),
        streak: Math.max(localUser.streak || 0, remoteUser.streak || 0),
        focusTimeMinutes: Math.max(localUser.focusTimeMinutes || 0, remoteUser.focusTimeMinutes || 0)
    };
    if (localUser.dailyGoal || remoteUser.dailyGoal) {
        merged.dailyGoal = Math.max(localUser.dailyGoal || 0, remoteUser.dailyGoal || 0);
    }

    let changedLocal = false;
    let changedRemote = false;

    for (const k of ['xp', 'level', 'streak', 'focusTimeMinutes', 'dailyGoal'] as const) {
        const lVal = localUser[k] || 0;
        const rVal = remoteUser[k] || 0;
        const mVal = merged[k] || 0;
        if (lVal < mVal) changedLocal = true;
        if (rVal < mVal) changedRemote = true;
    }

    return { merged, changedLocal, changedRemote };
};

/**
 * Fusión de DailySnapshots.
 */
export const mergeSnapshotsWithDiff = (localSnapshots: any, remoteSnapshots: any): { merged: any; changedLocal: boolean; changedRemote: boolean } => {
    const local = localSnapshots || {};
    const remote = remoteSnapshots || {};
    const merged: any = { ...remote };

    let changedLocal = false;
    let changedRemote = false;

    const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const key of allKeys) {
        const l = local[key];
        const r = remote[key];
        if (l && !r) {
            merged[key] = l;
            changedRemote = true;
        } else if (!l && r) {
            merged[key] = r;
            changedLocal = true;
        } else if (l && r) {
            const tot = Math.max(l.total || 0, r.total || 0);
            const comp = Math.max(l.completed || 0, r.completed || 0);
            merged[key] = { total: tot, completed: comp };
            if ((l.total || 0) < tot || (l.completed || 0) < comp) changedLocal = true;
            if ((r.total || 0) < tot || (r.completed || 0) < comp) changedRemote = true;
        }
    }

    return { merged, changedLocal, changedRemote };
};

/**
 * Fusión global de los 11 conjuntos de datos.
 * Devuelve `changedLocal` (si local debe actualizarse) y `changedRemote` (si remoto debe actualizarse).
 */
export const mergeBackupData = (
    local: SyncBackupData,
    remote: SyncBackupData,
    useLocalForConflicts: boolean = false
): MergeDataResult => {
    const delRes = mergeDeletedItemsWithDiff(local.deletedItems, remote.deletedItems);

    const notesRes = mergeNotesWithDiff(local.notes, remote.notes, useLocalForConflicts, delRes.merged);
    const tasksRes = mergeListsWithDiff(local.tasks, remote.tasks, useLocalForConflicts, delRes.merged);
    const goalsRes = mergeListsWithDiff(local.goals, remote.goals, useLocalForConflicts, delRes.merged);
    const apptsRes = mergeListsWithDiff(local.appointments, remote.appointments, useLocalForConflicts, delRes.merged);
    const projsRes = mergeListsWithDiff(local.projects, remote.projects, useLocalForConflicts, delRes.merged);
    const groupsRes = mergeListsWithDiff(local.taskGroups, remote.taskGroups, useLocalForConflicts, delRes.merged);
    const habitsRes = mergeListsWithDiff(local.completedOnceHabits || [], remote.completedOnceHabits || [], useLocalForConflicts, delRes.merged);
    const txRes = mergeListsWithDiff(local.transactions || [], remote.transactions || [], useLocalForConflicts, delRes.merged);
    const expRes = mergeListsWithDiff(local.expenseNotes || [], remote.expenseNotes || [], useLocalForConflicts, delRes.merged);

    const userRes = mergeUserWithDiff(local.user, remote.user);
    const snapRes = mergeSnapshotsWithDiff(local.dailySnapshots, remote.dailySnapshots);

    let changedLocal = delRes.changedLocal || notesRes.changedLocal || tasksRes.changedLocal ||
        goalsRes.changedLocal || apptsRes.changedLocal || projsRes.changedLocal ||
        groupsRes.changedLocal || habitsRes.changedLocal || txRes.changedLocal ||
        expRes.changedLocal || userRes.changedLocal || snapRes.changedLocal;

    let changedRemote = delRes.changedRemote || notesRes.changedRemote || tasksRes.changedRemote ||
        goalsRes.changedRemote || apptsRes.changedRemote || projsRes.changedRemote ||
        groupsRes.changedRemote || habitsRes.changedRemote || txRes.changedRemote ||
        expRes.changedRemote || userRes.changedRemote || snapRes.changedRemote;

    // Savings Goal
    const localGoal = local.savingsGoal ?? 400;
    const remoteGoal = remote.savingsGoal ?? 400;
    let mergedSavingsGoal = remoteGoal;
    if (localGoal !== remoteGoal) {
        if ((local.lastUpdated || 0) > (remote.lastUpdated || 0)) {
            mergedSavingsGoal = localGoal;
            changedRemote = true;
        } else {
            mergedSavingsGoal = remoteGoal;
            changedLocal = true;
        }
    }

    return {
        merged: {
            notes: notesRes.merged,
            tasks: tasksRes.merged,
            goals: goalsRes.merged,
            appointments: apptsRes.merged,
            projects: projsRes.merged,
            taskGroups: groupsRes.merged,
            completedOnceHabits: habitsRes.merged,
            transactions: txRes.merged,
            expenseNotes: expRes.merged,
            savingsGoal: mergedSavingsGoal,
            dailySnapshots: snapRes.merged,
            user: userRes.merged,
            deletedItems: delRes.merged,
            lastUpdated: remote.lastUpdated || 0
        },
        changedLocal,
        changedRemote
    };
};

/**
 * Sanea y filtra la información antes de subir a Google Drive:
 * - NUNCA sube `isDownloading`.
 * - NUNCA sube `localPath` ni `thumbnailPath` ni URLs locales (`file://`, `capacitor://`, `content://`, `http://localhost`, `data:`).
 * - Si un bloque tiene `driveFileId`, su URL se normaliza a `drive://${driveFileId}`.
 */
export const sanitizeDataForDriveUpload = (data: SyncBackupData): any => {
    const isLocalUrl = (u: any): boolean => {
        if (typeof u !== 'string') return false;
        return u.startsWith('file://') || u.startsWith('capacitor://') ||
               u.startsWith('content://') || u.startsWith('http://localhost') ||
               u.startsWith('data:') || u.length > 500;
    };

    const cleanNotes = (data.notes || []).map(note => ({
        ...note,
        blocks: (note.blocks || []).map((b: any) => {
            if (!b) return b;
            const { isDownloading, localPath, ...cleanBlock } = b;

            if (['image', 'video', 'file', 'drawing'].includes(cleanBlock.type) && cleanBlock.driveFileId) {
                const url = typeof cleanBlock.content === 'string' ? cleanBlock.content : cleanBlock.content?.url;
                if (isLocalUrl(url)) {
                    const cleanUrl = `drive://${cleanBlock.driveFileId}`;
                    return {
                        ...cleanBlock,
                        content: typeof cleanBlock.content === 'string' ? cleanUrl : { ...cleanBlock.content, url: cleanUrl }
                    };
                }
            }
            return cleanBlock;
        })
    }));

    const cleanExpenseNotes = (data.expenseNotes || []).map(exp => {
        if (!exp) return exp;
        if (exp.imageBlock) {
            const { localPath, thumbnailPath, ...cleanImg } = exp.imageBlock;
            return {
                ...exp,
                imageBlock: cleanImg
            };
        }
        return exp;
    });

    return {
        ...data,
        notes: cleanNotes,
        expenseNotes: cleanExpenseNotes
    };
};

/** Decisión pura de salida temprana. */
export const shouldEarlyExit = (input: {
    localLastUpdated: number;
    remoteLastUpdated: number;
    localMd5?: string;
    remoteMd5?: string;
}): boolean => {
    const { localLastUpdated, remoteLastUpdated, localMd5, remoteMd5 } = input;
    if (remoteLastUpdated <= 0) return false;
    if (localLastUpdated !== remoteLastUpdated) return false;
    if (remoteMd5 && localMd5 && remoteMd5 !== localMd5) return false;
    return true;
};
