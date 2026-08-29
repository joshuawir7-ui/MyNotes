import { create } from 'zustand'
// Force HMR Update para balance en tiempo real
import { persist, createJSONStorage } from 'zustand/middleware'
import { Language, translations } from './translations'
import { migrateBase64Images } from './image-utils';
import { NotificationManager } from './notifications';
import { Preferences } from '@capacitor/preferences'
import { registerPlugin, Capacitor } from '@capacitor/core'
import { get, set as idbSet, del } from 'idb-keyval'
import { App } from '@capacitor/app'

const isNative = Capacitor.isNativePlatform();

export const WidgetSync = registerPlugin<{
    updateWidgetData: (data: { goals: string, appointments: string, notes: string, tasks: string, dailySnapshots?: string, notificationsEnabled?: string }) => Promise<void>;
    showHabitNotification: (data: { tasks: string }) => Promise<void>;
    getTasks: () => Promise<{ tasks: string }>;
    getNotes: () => Promise<{ notes: string }>;
    getAppointments: () => Promise<{ appointments: string }>;
    getPendingOpenNote: () => Promise<{ noteId: string | null }>;
    clearPendingOpenNote: () => Promise<void>;
    enqueueCloudSync: (data: { token: string, payload: string }) => Promise<void>;
    openMiuiAutostart: () => Promise<void>;
    openBatteryOptimizationSettings: () => Promise<void>;
    startTaskGroupReminder: () => Promise<void>;
    stopTaskGroupReminder: () => Promise<void>;
    enqueueImageDownload: (data: { token: string, driveFileId: string, noteId: string, blockId: string, fileName?: string }) => Promise<void>;
    openAppSettings: () => Promise<void>;
    requestNotificationPermission: () => Promise<void>;
    openFile: (data: { url: string, mimeType?: string }) => Promise<void>;
    generateVideoThumbnailNative: (data: { videoPath: string }) => Promise<{ base64: string }>;
}>('WidgetSync');

if (isNative) {
    WidgetSync.addListener('imageDownloaded', (data: { driveFileId: string, noteId: string, blockId: string, localUri: string }) => {
        const state = useStore.getState();
        if (state.updateNoteBlockContent) {
            const note = state.notes.find(n => n.id === data.noteId);
            const block = note?.blocks?.find(b => b.id === data.blockId);
            if (block?.type === 'file') {
                const oldContent = typeof block.content === 'object' && block.content !== null ? block.content : {};
                state.updateNoteBlockContent(data.noteId, data.blockId, { ...oldContent, url: data.localUri });
            } else {
                state.updateNoteBlockContent(data.noteId, data.blockId, data.localUri);
            }
        }
    });
}

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

const writeDebounces: Record<string, any> = {};
const pendingWrites: Record<string, string> = {};

const indexedDBStore = {
    db: null as any,
    init: async () => {
        if (typeof window === 'undefined') return null;
        if (indexedDBStore.db) return indexedDBStore.db;
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('MyNotesDatabase', 1);
                request.onupgradeneeded = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('files')) {
                        db.createObjectStore('files');
                    }
                };
                request.onsuccess = (e: any) => {
                    indexedDBStore.db = e.target.result;
                    resolve(indexedDBStore.db);
                };
                request.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },
    get: async (key: string): Promise<string | null> => {
        const db = await indexedDBStore.init();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction('files', 'readonly');
                const store = tx.objectStore('files');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },
    set: async (key: string, val: string): Promise<boolean> => {
        const db = await indexedDBStore.init();
        if (!db) return false;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction('files', 'readwrite');
                const store = tx.objectStore('files');
                const request = store.put(val, key);
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    }
};

export const readAllTasksFromDisk = async (currentInMemory: Task[]): Promise<Task[]> => {
    if (typeof window === 'undefined') return currentInMemory;
    try {
        let dataStr: string | null = null;
        if (isNative) {
            try {
                const result = await Filesystem.readFile({
                    path: 'mynotes_full_tasks.json',
                    directory: Directory.Data,
                    encoding: Encoding.UTF8
                });
                dataStr = result.data as string;
            } catch (e) { }
        } else {
            // Web: Try IndexedDB first
            dataStr = await indexedDBStore.get('mynotes_full_tasks');
            // Migration fallback
            if (!dataStr) {
                dataStr = localStorage.getItem('mynotes_full_tasks');
                if (dataStr) {
                    await indexedDBStore.set('mynotes_full_tasks', dataStr);
                    try {
                        localStorage.removeItem('mynotes_full_tasks');
                    } catch (e) { }
                }
            }
        }
        if (dataStr) {
            const parsed = JSON.parse(dataStr);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (err) {
        console.warn('Failed to read all tasks from disk', err);
    }
    return currentInMemory;
};

export const readAllNotesFromDisk = async (currentInMemory: Note[]): Promise<Note[]> => {
    if (typeof window === 'undefined') return currentInMemory;
    try {
        let dataStr: string | null = null;
        if (isNative) {
            try {
                const result = await Filesystem.readFile({
                    path: 'mynotes_full_notes.json',
                    directory: Directory.Data,
                    encoding: Encoding.UTF8
                });
                dataStr = result.data as string;
            } catch (e) { }
        } else {
            // Web: Try IndexedDB first
            dataStr = await indexedDBStore.get('mynotes_full_notes');
            // Migration fallback
            if (!dataStr) {
                dataStr = localStorage.getItem('mynotes_full_notes');
                if (dataStr) {
                    await indexedDBStore.set('mynotes_full_notes', dataStr);
                    try {
                        localStorage.removeItem('mynotes_full_notes');
                    } catch (e) { }
                }
            }
        }
        if (dataStr) {
            const parsed = JSON.parse(dataStr);
            if (Array.isArray(parsed)) {
                return mergeNotesLists(currentInMemory, parsed, false);
            }
        }
    } catch (err) {
        console.warn('Failed to read all notes from disk', err);
    }
    return currentInMemory;
};

export const saveAllTasksToDisk = async (tasks: Task[]) => {
    if (typeof window === 'undefined') return;
    try {
        const data = JSON.stringify(tasks);
        if (isNative) {
            await Filesystem.writeFile({
                path: 'mynotes_full_tasks.json',
                data,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
        } else {
            // Web: save to IndexedDB
            const success = await indexedDBStore.set('mynotes_full_tasks', data);
            if (!success) {
                try {
                    localStorage.setItem('mynotes_full_tasks', data);
                } catch (err) {
                    console.warn('Failed to save to localStorage fallback', err);
                }
            }
        }
    } catch (err) {
        console.warn('Failed to save all tasks to disk', err);
    }
};

export const saveAllNotesToDisk = async (notes: Note[]) => {
    if (typeof window === 'undefined') return;
    try {
        const data = JSON.stringify(notes);
        if (isNative) {
            await Filesystem.writeFile({
                path: 'mynotes_full_notes.json',
                data,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
        } else {
            // Web: save to IndexedDB
            const success = await indexedDBStore.set('mynotes_full_notes', data);
            if (!success) {
                try {
                    localStorage.setItem('mynotes_full_notes', data);
                } catch (err) {
                    console.warn('Failed to save to localStorage fallback', err);
                }
            }
        }
    } catch (err) {
        console.warn('Failed to save all notes to disk', err);
    }
};

// AppStateChange listener is placed at the end of the file to ensure all store functions are fully hoisted and initialized

// Custom storage for Capacitor to avoid SharedPreferences size limits (1-2MB)
let syncInProgress = false;
let syncWorker: Worker | null = null;
if (typeof window !== 'undefined') {
    syncWorker = new Worker(new URL('./sync-worker.ts', import.meta.url));
}

// Enhanced to include backup and recovery to prevent data loss
const capacitorStorage = {
    getItem: async (name: string): Promise<string | null> => {
        if (typeof window === 'undefined') return null;

        // Return pending in-memory write if it exists to keep reads consistent
        if (pendingWrites[name] !== undefined) {
            return pendingWrites[name];
        }

        const tryRead = async (suffix: string) => {
            if (!isNative) return null; // Web bypasses filesystem check
            try {
                const result = await Filesystem.readFile({
                    path: `${name}${suffix}.json`,
                    directory: Directory.Data,
                    encoding: Encoding.UTF8,
                });
                if (result.data && (result.data as string).trim() !== '' && result.data !== '{}') {
                    // Quick JSON validation to ensure it's not corrupted
                    JSON.parse(result.data as string);
                    return result.data as string;
                }
            } catch (e) {
                // Ignore read/parse errors
            }
            return null;
        };

        // 1. Try primary file
        let data = await tryRead('');
        if (data) {
            pendingWrites[name] = data; // Cache it
            return data;
        }

        // 2. Try backup file
        data = await tryRead('.bak');
        if (data) {
            console.warn("Recovered data from backup file");
            pendingWrites[name] = data; // Cache it
            return data;
        }

        // 3. Fallback to idb-keyval / Preferences (migration from older versions / Web support)
        try {
            const idbValue = await get(name);
            if (idbValue && idbValue !== '{}') {
                pendingWrites[name] = idbValue;
                return idbValue;
            }
            const { value } = await Preferences.get({ key: name });
            if (value && value !== '{}') {
                try {
                    JSON.parse(value); // Validate
                    if (isNative) {
                        await Filesystem.writeFile({
                            path: `${name}.json`,
                            data: value,
                            directory: Directory.Data,
                            encoding: Encoding.UTF8,
                        });
                        await Preferences.remove({ key: name });
                    } else {
                        await idbSet(name, value);
                        try { await Preferences.remove({ key: name }); } catch(e){}
                    }
                    pendingWrites[name] = value; // Cache it
                    return value;
                } catch (migrateErr) {
                    console.error("Migration parse/write failed", migrateErr);
                    // On web, if JSON is valid but filesystem operations failed/skipped, we still return the value
                    if (!isNative) {
                        pendingWrites[name] = value; // Cache it
                        return value;
                    }
                }
            }
        } catch (prefErr) { }

        return null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        if (typeof window === 'undefined') return;

        // Safety check to avoid overwriting stored data with an unhydrated initial state
        try {
            const parsed = JSON.parse(value);
            if (parsed && parsed.state && parsed.state.isHydrated === false) {
                console.warn("[Storage] Preventing write of unhydrated state to protect data");
                return;
            }
        } catch (e) {
            console.error("[Storage] JSON parse error in setItem safety check", e);
        }

        // Cache the latest value in-memory immediately
        pendingWrites[name] = value;

        if (writeDebounces[name]) {
            clearTimeout(writeDebounces[name]);
        }

        const performWrite = async () => {
            const dataToWrite = pendingWrites[name];
            if (!dataToWrite) return;

            try {
                // Safety check to avoid writing corrupted/empty state if something went wrong
                if (dataToWrite === '{}') {
                    console.warn("Preventing write of empty state to protect data");
                    return;
                }

                if (isNative) {
                    // 1. Backup the current file before overwriting
                    try {
                        const existing = await Filesystem.readFile({
                            path: `${name}.json`,
                            directory: Directory.Data,
                            encoding: Encoding.UTF8,
                        });
                        if (existing.data) {
                            await Filesystem.writeFile({
                                path: `${name}.bak.json`,
                                data: existing.data,
                                directory: Directory.Data,
                                encoding: Encoding.UTF8,
                            });
                        }
                    } catch (e) { } // It's okay if backup fails (e.g. file doesn't exist yet)

                    // 2. Write the new data
                    await Filesystem.writeFile({
                        path: `${name}.json`,
                        data: dataToWrite,
                        directory: Directory.Data,
                        encoding: Encoding.UTF8,
                    });
                } else {
                    // Web fallback using idb-keyval
                    await idbSet(name, dataToWrite);
                }
            } catch (e) {
                console.error('Storage save error', e);
            }
        };

        // Debounce by 2000ms on both web and native to prevent UI stutter/disk thrashing (especially during Pomodoro ticks)
        writeDebounces[name] = setTimeout(performWrite, 2000);
    },
    removeItem: async (name: string): Promise<void> => {
        if (typeof window === 'undefined') return;
        delete pendingWrites[name];
        if (isNative) {
            try { await Filesystem.deleteFile({ path: `${name}.json`, directory: Directory.Data }); } catch (e) { }
            try { await Filesystem.deleteFile({ path: `${name}.bak.json`, directory: Directory.Data }); } catch (e) { }
        } else {
            try { await del(name); } catch (e) { }
            try { await Preferences.remove({ key: name }); } catch (e) { }
        }
    },
};

export const flushStorage = async () => {
    for (const name of Object.keys(pendingWrites)) {
        if (writeDebounces[name]) {
            clearTimeout(writeDebounces[name]);
            delete writeDebounces[name];
        }
        const dataToWrite = pendingWrites[name];
        if (dataToWrite && dataToWrite !== '{}') {
            try {
                if (isNative) {
                    try {
                        const existing = await Filesystem.readFile({
                            path: `${name}.json`,
                            directory: Directory.Data,
                            encoding: Encoding.UTF8,
                        });
                        if (existing.data) {
                            await Filesystem.writeFile({
                                path: `${name}.bak.json`,
                                data: existing.data,
                                directory: Directory.Data,
                                encoding: Encoding.UTF8,
                            });
                        }
                    } catch (e) { }

                    await Filesystem.writeFile({
                        path: `${name}.json`,
                        data: dataToWrite,
                        directory: Directory.Data,
                        encoding: Encoding.UTF8,
                    });
                } else {
                    await Preferences.set({
                        key: name,
                        value: dataToWrite
                    });
                }
            } catch (e) {
                console.error('flushStorage error', e);
            }
        }
    }
};

// Register beforeunload event on web to immediately flush any pending writes before tab/browser close
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        for (const name of Object.keys(pendingWrites)) {
            if (writeDebounces[name]) {
                clearTimeout(writeDebounces[name]);
                delete writeDebounces[name];
            }
            const dataToWrite = pendingWrites[name];
            if (dataToWrite && dataToWrite !== '{}') {
                try {
                    // Save to both standard key and _cap_ prefixed key to ensure compatibility with Preferences
                    localStorage.setItem(name, dataToWrite);
                    localStorage.setItem(`_cap_${name}`, dataToWrite);
                } catch (e) {
                    console.error('Failed to flush store to localStorage on beforeunload', e);
                }
            }
        }
    });
}

export const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getInitialLanguage = (): Language => {
    if (typeof window === 'undefined') return 'en'
    const browserLang = window.navigator.language.split('-')[0]
    return (Object.keys(translations).includes(browserLang)) ? browserLang as Language : 'en'
}

// Helper: check if an item has meaningful content (not empty)
const itemHasContent = (item: any): boolean => {
    if (!item) return false;
    // For notes: check blocks array
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
    // For tasks/goals: has a title
    if (typeof item.title === 'string') return item.title.trim().length > 0;
    return true; // Unknown type, assume has content
};

const mergeLists = <T extends { id: string; lastUpdated?: number }>(
    localList: T[] | undefined,
    remoteList: T[] | undefined,
    useLocalForConflicts: boolean,
    deletedItems?: Record<string, number>
): T[] => {
    const local = localList || [];
    const remote = remoteList || [];
    const mergedMap = new Map<string, T>();
    const deletes = deletedItems || {};

    // First add all remote items
    for (const item of remote) {
        if (item && item.id) {
            const deletedTime = deletes[item.id];
            const itemTime = item.lastUpdated || 0;
            if (deletedTime && itemTime <= deletedTime) {
                continue; // Discard deleted item
            }
            mergedMap.set(item.id, item);
        }
    }

    // Merge local items, resolving conflicts based on individual item timestamps
    for (const item of local) {
        if (item && item.id) {
            const deletedTime = deletes[item.id];
            const itemTime = item.lastUpdated || 0;
            if (deletedTime && itemTime <= deletedTime) {
                continue; // Discard deleted item
            }

            const existing = mergedMap.get(item.id);
            if (existing) {
                const existingTime = existing.lastUpdated || 0;
                const localTime = itemTime;

                // SAFETY: Never overwrite an item that has content with one that is empty.
                // If remote is empty/blank but local has real content, local always wins.
                const remoteHasContent = itemHasContent(existing);
                const localHasContent = itemHasContent(item);
                if (localHasContent && !remoteHasContent) {
                    mergedMap.set(item.id, item);
                    continue;
                }
                // Conversely, if remote has content and local is empty, keep remote (do nothing).
                if (!localHasContent && remoteHasContent) {
                    continue;
                }

                if (localTime > existingTime) {
                    // Local is newer, overwrite remote
                    mergedMap.set(item.id, item);
                } else if (localTime === existingTime) {
                    // Equal or missing timestamps: use useLocalForConflicts fallback
                    if (useLocalForConflicts) {
                        mergedMap.set(item.id, item);
                    }
                }
                // Remote is newer, keep existing (do nothing)
            } else {
                // Not in remote, add it
                mergedMap.set(item.id, item);
            }
        }
    }

    return Array.from(mergedMap.values());
}

const mergeNotesLists = (
    localNotes: Note[] | undefined,
    remoteNotes: Note[] | undefined,
    useLocalForConflicts: boolean,
    deletedItems?: Record<string, number>
): Note[] => {
    const merged = mergeLists(localNotes, remoteNotes, useLocalForConflicts, deletedItems);

    const localMap = new Map((localNotes || []).map(n => [n.id, n]));
    const remoteMap = new Map((remoteNotes || []).map(n => [n.id, n]));

    return merged.map(note => {
        const local = localMap.get(note.id);
        const remote = remoteMap.get(note.id);

        const localBlocks = Array.isArray(local?.blocks) ? local!.blocks : [];
        const remoteBlocks = Array.isArray(remote?.blocks) ? remote!.blocks : [];
        const currentBlocks = Array.isArray(note.blocks) ? note.blocks : [];

        // Helper: does a blocks array contain real text/content?
        const blocksHaveContent = (blocks: any[]) => blocks.some(b => {
            if (!b) return false;
            const c = b.content;
            if (Array.isArray(c)) return c.length > 0;
            if (typeof c === 'string') return c.trim().length > 0;
            if (c && typeof c === 'object') return Object.keys(c).length > 0;
            return false;
        });

        const currentHasContent = blocksHaveContent(currentBlocks);
        const localHasContent = blocksHaveContent(localBlocks);
        const remoteHasContent = blocksHaveContent(remoteBlocks);

        // SAFETY: if the winning note has no content, check if local or remote have content to recover
        if (!currentHasContent) {
            // Prefer whichever has content — local takes priority on tie
            if (localHasContent) {
                return { ...note, blocks: localBlocks };
            }
            if (remoteHasContent) {
                return { ...note, blocks: remoteBlocks };
            }
        }

        // If current blocks are empty (zero length), also try to recover
        if (currentBlocks.length === 0) {
            if (localBlocks.length > 0) {
                return { ...note, blocks: localBlocks };
            }
            if (remoteBlocks.length > 0) {
                return { ...note, blocks: remoteBlocks };
            }
        }

        // PREVENT OVERWRITING LOCAL CACHE:
        // If we picked the remote note, but the remote block has a stripped `drive://` URL,
        // and we already have a real local URL (file:// or data:) for the same block, preserve the local URL.
        let finalNote = note;
        if (finalNote === remote) {
            const preservedBlocks = finalNote.blocks.map(b => {
                if (['image', 'video', 'file'].includes(b.type) && b.driveFileId && b.content?.url?.startsWith('drive://')) {
                    const localB = localBlocks.find(lb => lb.id === b.id && lb.driveFileId === b.driveFileId);
                    if (localB && localB.content?.url && !localB.content.url.startsWith('drive://')) {
                        return {
                            ...b,
                            content: { ...b.content, url: localB.content.url }
                        };
                    }
                }
                return b;
            });
            finalNote = { ...finalNote, blocks: preservedBlocks };
        }

        return finalNote;
    });
};

const mergeDeletedItems = (
    localDeleted: Record<string, number> | undefined,
    remoteDeleted: Record<string, number> | undefined
): Record<string, number> => {
    const local = localDeleted || {};
    const remote = remoteDeleted || {};
    const merged: Record<string, number> = { ...remote };

    for (const key of Object.keys(local)) {
        merged[key] = Math.max(merged[key] || 0, local[key]);
    }

    // Prune deletedItems older than 30 days to keep the state small
    const pruneLimit = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const key of Object.keys(merged)) {
        if (merged[key] < pruneLimit) {
            delete merged[key];
        }
    }

    return merged;
};


const mergeUser = (localUser: any, remoteUser: any): any => {
    if (!remoteUser) return localUser;
    if (!localUser) return remoteUser;
    return {
        xp: Math.max(localUser.xp || 0, remoteUser.xp || 0),
        level: Math.max(localUser.level || 1, remoteUser.level || 1),
        streak: Math.max(localUser.streak || 0, remoteUser.streak || 0),
        focusTimeMinutes: Math.max(localUser.focusTimeMinutes || 0, remoteUser.focusTimeMinutes || 0),
        dailyGoal: localUser.dailyGoal || remoteUser.dailyGoal || 5
    };
}

const mergeDailySnapshots = (localSnapshots: any, remoteSnapshots: any): any => {
    const local = localSnapshots || {};
    const remote = remoteSnapshots || {};
    const merged: any = { ...remote };

    for (const key of Object.keys(local)) {
        if (merged[key]) {
            merged[key] = {
                total: Math.max(merged[key].total || 0, local[key].total || 0),
                completed: Math.max(merged[key].completed || 0, local[key].completed || 0)
            };
        } else {
            merged[key] = local[key];
        }
    }
    return merged;
}


let syncTimeout: any;
let lastSyncedGoals: any = null;
let lastSyncedAppointments: any = null;
let lastSyncedNotes: any = null;
let lastSyncedTasks: any = null;
let lastSyncedSnapshots: any = null;
let lastSyncedNotificationsEnabled: string | null = null;
let lastSyncedIsDarkMode: string | null = null;
let lastSyncedPinnedNoteId: string | null = null;

export const syncWidgetData = async (goals?: any[], appointments?: any[], notes?: any[], tasks?: any[], immediate = false) => {
    if (!isNative) return;

    if (syncTimeout) clearTimeout(syncTimeout);

    const performSync = async () => {
        try {
            const state = useStore.getState();

            const currentGoals = goals || state.goals;
            const currentAppointments = appointments || state.appointments;
            const currentNotes = notes || state.notes;
            const currentTasks = tasks || state.tasks;
            const currentSnapshots = state.dailySnapshots;
            const currentNotificationsEnabled = state.notificationsEnabled ? "true" : "false";
            const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false;
            const currentIsDarkMode = isDark ? "true" : "false";
            const currentPinnedNoteId = state.pinnedNoteId;

            const updatePayload: any = {};

            if (currentGoals !== lastSyncedGoals) {
                // Strip large photo strings for native widget data transfers
                const lightweightGoals = (currentGoals || []).map((g: any) => ({ ...g, photos: undefined }));
                updatePayload.goals = JSON.stringify(lightweightGoals);
                lastSyncedGoals = currentGoals;
            }

            if (currentAppointments !== lastSyncedAppointments) {
                updatePayload.appointments = JSON.stringify(currentAppointments || []);
                lastSyncedAppointments = currentAppointments;
            }

            if (currentTasks !== lastSyncedTasks) {
                const lightweightTasks = (currentTasks || []).map((t: any) => ({ ...t, photos: undefined }));
                updatePayload.tasks = JSON.stringify(lightweightTasks);
                lastSyncedTasks = currentTasks;
            }

            if (currentNotes !== lastSyncedNotes) {
                // Keep all note blocks (including image and drawing blocks) for native widget preview
                const lightweightNotes = (currentNotes || []).map((note: any) => ({
                    ...note,
                    blocks: Array.isArray(note.blocks)
                        ? note.blocks.map((b: any) => {
                            if ((b.type === 'image' || b.type === 'drawing') && typeof b.content === 'string' && b.content.length > 500000) {
                                // If an image base64 is exceptionally massive (>500KB), omit to avoid SharedPreferences overflow
                                return { ...b, content: '' };
                            }
                            return b;
                        })
                        : note.blocks
                }));
                updatePayload.notes = JSON.stringify(lightweightNotes);
                lastSyncedNotes = currentNotes;
            }

            if (currentSnapshots !== lastSyncedSnapshots) {
                updatePayload.dailySnapshots = JSON.stringify(currentSnapshots || {});
                lastSyncedSnapshots = currentSnapshots;
            }

            if (currentNotificationsEnabled !== lastSyncedNotificationsEnabled) {
                updatePayload.notificationsEnabled = currentNotificationsEnabled;
                lastSyncedNotificationsEnabled = currentNotificationsEnabled;
            }

            if (currentIsDarkMode !== lastSyncedIsDarkMode) {
                updatePayload.isDarkMode = currentIsDarkMode;
                lastSyncedIsDarkMode = currentIsDarkMode;
            }

            if (currentPinnedNoteId !== lastSyncedPinnedNoteId) {
                updatePayload.pinnedNoteId = currentPinnedNoteId || "";
                lastSyncedPinnedNoteId = currentPinnedNoteId;
            }

            // Only update if there's actually something new
            if (Object.keys(updatePayload).length > 0) {
                await WidgetSync.updateWidgetData(updatePayload);
            }
        } catch (err) {
            console.error("Failed to sync widget data:", err);
        }
    };

    if (immediate) {
        await performSync();
    } else {
        // Debounce by 2000ms to allow UI animations to finish smoothly
        syncTimeout = setTimeout(performSync, 2000);
    }
};

const showNativeHabitNotification = async (tasks: any[]) => {
    // We now use local notifications to schedule them properly
    NotificationManager.scheduleDailyHabitReminders(tasks).catch(console.error);
};

export type EnergyLevel = 'High' | 'Medium' | 'Low'
export type RecurrenceType = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Once'

export interface Task {
    id: string
    title: string
    completed: boolean
    energyLevel: EnergyLevel
    projectId: string
    dueDate?: string // YYYY-MM-DD
    recurrence: RecurrenceType
    completedDates: string[] // ISO Date strings for recurring tasks history
    lastUpdated?: number

    // New Habit Fields
    isHabit?: boolean
    frequency?: number // Times per recurrence period (default 1)
    missed?: number
    streak?: number
    enabled?: boolean // New: enable/disable habit
    shortcutKey?: number // 1-9
    photos: string[] // Base64 or local paths
    completionTimes: string[] // ISO timestamps for all completions
    activeDays?: number[] // Days of week (0-6, 0=Sun) when habit is active
    icon?: string // Lucide icon name
    habitType?: 'good' | 'bad'
}

export type ProjectStatus = 'Active' | 'Someday' | 'Completed'

export interface Project {
    id: string
    title: string
    color: string
    progress: number // 0-100
    status: ProjectStatus // New field
    startDate?: string // New field for Someday feature
    milestones: { id: string, title: string, date: string, completed: boolean }[]
}

export type BlockType = 'text' | 'task-list' | 'table' | 'image' | 'drawing' | 'separator' | 'file' | 'video'

export interface NoteBlock {
    id: string
    type: BlockType
    content: any
    driveFileId?: string
    isDownloading?: boolean
    thumbnailPath?: string
    durationSeconds?: number
}

export interface Note {
    id: string
    title: string
    blocks: NoteBlock[]
    createdAt: string
    tags: string[]
    lastUpdated?: number
}

export type GoalType = 'general' | 'checklist' | 'numeric' | 'weight' | 'budget';

export interface GoalObjective {
    id: string;
    title: string;
    completed: boolean;
    image?: string;
}
export interface GoalReport {
    id: string;
    date: string;
    note: string;
}
export interface Goal {
    id: string
    title: string
    description: string
    targetDate: string
    progress: number
    photos: string[]
    createdAt: string
    type?: GoalType
    objectives?: GoalObjective[]
    targetValue?: number
    currentValue?: number
    startValue?: number
    unit?: string
    reports?: GoalReport[]
    pinned?: boolean
}

export type ExpenseNote = {
    id: string;
    title: string;
    description: string;
    amount: number;
    imageBlock?: {
        localPath?: string;
        driveFileId?: string;
        thumbnailPath?: string;
    };
    createdAt: number;
    lastUpdated?: number;
};


export interface Transaction {
    id: string
    date: string // YYYY-MM-DD
    description: string
    amount: number
    type: 'income' | 'expense'
    currency?: string // '$' | '€' | '¥' | 'Pesos'
    recoveryDate?: string // YYYY-MM-DD
    conservationGoalDate?: string // YYYY-MM-DD
    conservationStartBalance?: number
    lastUpdated?: number
}

export interface Appointment {
    id: string
    title: string
    date: string // YYYY-MM-DD
    time?: string
    notes?: string
    description?: string
    status?: 'pending' | 'completed' | 'failed' | 'attendance' | 'absence' | 'tardiness'
    color?: string
    lastUpdated?: number
}

export interface TaskGroupTask {
    id: string;
    title: string;
    completed: boolean;
}

export interface TaskGroup {
    id: string;
    title: string;
    tasks: TaskGroupTask[];
    color: string;
    createdAt: string;
    isPinned?: boolean;
}

export interface UserState {
    xp: number
    level: number
    streak: number
    focusTimeMinutes: number
    dailyGoal: number // Number of tasks to complete daily
}

export interface GoogleUser {
    name: string;
    email: string;
    imageUrl: string;
    accessToken?: string;
    isDemo?: boolean;
}

interface AppState {
    tasks: Task[]
    projects: Project[]
    notes: Note[]
    appointments: Appointment[]
    goals: Goal[]
    transactions: Transaction[]
    expenseNotes: ExpenseNote[]
    user: UserState
    language: Language
    pinnedNoteId: string | null
    lastPinnedGoalId: string | null
    appOpenCount: number
    notificationPromptStatus: 'pending' | 'rejected' | 'accepted'
    notificationPromptLastRejected?: number
    googleUser: GoogleUser | null
    googleSessionExpired?: boolean
    isHydrated: boolean
    deletedItems?: Record<string, number>
    isSyncingCloud: boolean
    syncError: string | null
    lastCloudSync?: string
    lastUpdated?: number
    restoreProgress?: string | null
    toast: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null
    showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
    clearToast: () => void

    // Sync conflict resolution
    syncConflict: {
        localData: any,
        remoteData: any,
        fileId: string,
        localTimestamp: number,
        remoteTimestamp: number,
    } | null
    resolveSyncConflict: (keepLocal: boolean) => Promise<void>

    isCloudSyncDirty: boolean
    scheduleSyncDebounced: () => void

    hasMigratedBase64?: boolean
    migrateBase64Images: () => Promise<void>

    areNotesLoaded: boolean
    areTasksLoaded: boolean

    loadAllNotes: () => Promise<void>
    unloadNotes: () => Promise<void>
    loadAllTasks: () => Promise<void>
    unloadTasks: () => Promise<void>
    loadAllTasksDirectly?: () => Promise<void> // Helper if needed
    unloadTasksDirectly?: () => Promise<void> // Helper if needed
    
    // Actions
    setGoogleUser: (user: GoogleUser | null) => void
    syncWithGoogleDrive: () => Promise<boolean>
    restoreFromGoogleDrive: () => Promise<boolean>
    autoSyncGoogleDrive: () => Promise<boolean>
    downloadAttachment: (noteId: string, blockId: string) => Promise<boolean>
    inAppNotificationDates: number[]
    notificationsEnabled: boolean
    dailySnapshots: Record<string, { total: number, completed: number }> // Key: YYYY-MM-DD
    lastProcessedDate?: string // YYYY-MM-DD to avoid multi-processing day resets
    taskGroups: TaskGroup[]
    celebration: { groupId: string, title: string } | null
    focusEffectEnabled: boolean
    completedOnceHabits?: { id: string; title: string; completedAt: string }[]
    timer: {
        timeLeft: number,
        isActive: boolean,
        targetTimestamp?: number,
        isFloating: boolean,
        position: { x: number, y: number },
        size: { width: number, height: number }
    }
    tourStep: number | null
    tourCompleted: boolean
    isTourManuallyStarted: boolean
    startTour: () => void
    startTourManually: () => void
    nextTourStep: () => void
    endTour: () => void

    // Actions
    setLanguage: (lang: Language) => void
    setPinnedNoteId: (id: string | null) => void
    setTimer: (timer: Partial<{
        timeLeft: number,
        isActive: boolean,
        targetTimestamp: number | null,
        isFloating: boolean,
        position: { x: number, y: number },
        size: { width: number, height: number }
    }>) => void
    addTask: (task: Omit<Task, 'id' | 'completed' | 'completedDates' | 'missed' | 'streak'>) => void
    toggleTask: (taskId: string) => void
    deleteTask: (taskId: string) => void
    updateTask: (taskId: string, updates: Partial<Task>) => void
    addProject: (project: Omit<Project, 'id' | 'progress' | 'milestones'>) => void
    addXP: (amount: number) => void
    incrementFocusTime: (minutes: number) => void
    addNote: (note: Omit<Note, 'id' | 'createdAt' | 'lastUpdated'>) => Note
    updateNote: (id: string, title: string, blocks: NoteBlock[]) => void
    updateNoteBlockContent: (noteId: string, blockId: string, content: string) => void
    setBlockDownloading: (noteId: string, blockId: string, isDownloading: boolean) => void
    deleteNote: (id: string) => void
    addAppointment: (apt: Omit<Appointment, 'id'>) => void
    updateAppointment: (id: string, updates: Partial<Appointment>) => void
    deleteAppointment: (id: string) => void

    addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'progress'>) => void
    updateGoal: (id: string, updates: Partial<Goal>) => void
    deleteGoal: (id: string) => void
    addGoalPhoto: (id: string, photo: string) => void
    addTaskPhoto: (id: string, photo: string) => void

    addTaskGroup: (title: string, color: string) => void
    addTaskToGroup: (groupId: string, taskTitle: string) => void
    toggleTaskInGroup: (groupId: string, taskId: string) => void
    deleteTaskGroup: (groupId: string) => void
    deleteTaskFromGroup: (groupId: string, taskId: string) => void
    toggleTaskGroupPin: (groupId: string) => void
    clearCelebration: () => void

    setTaskShortcut: (taskId: string, key: number | undefined) => void
    checkHabitStreaks: () => void
    resetHabitStats: (taskId: string) => void
    setHabitEnabled: (taskId: string, enabled: boolean) => void
    startTaskGroupReminder: () => void
    stopTaskGroupReminder: () => void
    syncHabitsNotification: () => void
    pullOfflineCompletedTasks: () => Promise<void>
    pullOfflineNotes: () => Promise<void>
    pullOfflineAppointments: () => Promise<void>
    incrementAppOpenCount: () => void
    handleNotificationPromptResponse: (response: 'accepted' | 'rejected') => void
    addInAppNotificationDate: () => void
    setNotificationsEnabled: (enabled: boolean) => void
    setFocusEffectEnabled: (enabled: boolean) => void

    addTransaction: (tx: Omit<Transaction, 'id' | 'lastUpdated'>) => void
    deleteTransaction: (id: string) => void
    clearAllTransactions: () => void

    addExpenseNote: (note: ExpenseNote) => void
    updateExpenseNote: (id: string, noteData: Partial<ExpenseNote>) => void
    deleteExpenseNote: (id: string) => void
    savingsGoal: number
    setSavingsGoal: (goal: number) => void
    recoverImagesFromDriveRevisions?: () => Promise<{ recovered: number; failed: number; message: string }>
}

let lastLocalTasksUpdate = 0;
let lastLocalNotesUpdate = 0;

async function fetchWithTimeout(resource: string, options: any = {}, timeout = 60000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort('Timeout reached'), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// Helper to strip massive base64 payloads to reduce JSON size
export const stripLargePayloads = (notes: Note[]): Note[] => {
    return notes.map(note => ({
        ...note,
        blocks: note.blocks.map(block => {
            if (['image', 'video', 'file'].includes(block.type) && block.driveFileId && block.content?.url) {
                if (block.content.url.startsWith('data:') || block.content.url.length > 500) {
                    return {
                        ...block,
                        content: {
                            ...block.content,
                            url: `drive://${block.driveFileId}`
                        }
                    };
                }
            }
            return block;
        })
    }));
};

// Helper to upload attachments that don't have a driveFileId yet
export const uploadMissingAttachments = async (token: string, notes: Note[]): Promise<Note[]> => {
    let hasChanges = false;
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        for (let j = 0; j < note.blocks.length; j++) {
            const block = note.blocks[j];
            if (['image', 'video', 'file'].includes(block.type) && !block.driveFileId && block.content?.url && block.content.url.startsWith('data:')) {
                try {
                    console.log(`[Sync] Subiendo archivo faltante de bloque ${block.id}...`);
                    const base64Data = block.content.url;
                    const fileName = block.content.name || `file_${Date.now()}`;
                    const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
                    const byteCharacters = atob(pureBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let k = 0; k < byteCharacters.length; k++) {
                        byteNumbers[k] = byteCharacters.charCodeAt(k);
                    }
                    const fileBlob = new Blob([new Uint8Array(byteNumbers)]);
                    const metadata = { name: fileName };
                    const boundary = 'mynotes_upload_boundary';
                    const multipartBody =
                        `--${boundary}\r\n` +
                        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
                        `${JSON.stringify(metadata)}\r\n` +
                        `--${boundary}\r\n` +
                        `Content-Type: application/octet-stream\r\n\r\n`;
                    const closing = `\r\n--${boundary}--`;
                    const fullBody = new Blob([multipartBody, fileBlob, closing]);

                    const uploadRes = await fetch(
                        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                        {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': `multipart/related; boundary=${boundary}`,
                            },
                            body: fullBody,
                        }
                    );
                    
                    if (uploadRes.ok) {
                        const data = await uploadRes.json();
                        if (data.id) {
                            block.driveFileId = data.id;
                            hasChanges = true;
                            console.log(`[Sync] Archivo subido exitosamente: ${data.id}`);
                        }
                    }
                } catch (e) {
                    console.error('[Sync] Error subiendo archivo faltante:', e);
                }
            }
        }
    }
    
    if (hasChanges) {
        const storeModule = await import('./store');
        await storeModule.saveAllNotesToDisk(notes);
    }
    
    return notes;
}

export let isCloudSyncDirty = false;
let cloudSyncDebounceTimeout: any = null;

export const markCloudSyncDirty = () => {
    isCloudSyncDirty = true;
    if (cloudSyncDebounceTimeout) clearTimeout(cloudSyncDebounceTimeout);
    cloudSyncDebounceTimeout = setTimeout(() => {
        triggerBackgroundSync();
    }, 2500);
};

export const triggerBackgroundSync = async () => {
    if (!isCloudSyncDirty) return;
    
    // Obtenemos los datos actuales desde Zustand de forma segura (sin hooks)
    const state = useStore.getState();
    const user = state.googleUser;
    
    if (!user || state.googleSessionExpired) return;
    
    // Llamar al WorkManager Nativo para hacer la subida
    if (isNative) {
        console.log("[Background Sync] Triggering native WorkManager sync...");
        try {
            const { readAllNotesFromDisk, readAllTasksFromDisk } = await import('./store');
            const fullNotes = await readAllNotesFromDisk(state.notes);
            const fullTasks = await readAllTasksFromDisk(state.tasks);
            const dataToSync = {
                notes: stripLargePayloads(fullNotes),
                tasks: fullTasks,
                goals: state.goals,
                appointments: state.appointments,
                projects: state.projects,
                taskGroups: state.taskGroups,
                completedOnceHabits: state.completedOnceHabits || [],
                transactions: state.transactions || [],
                savingsGoal: state.savingsGoal || 400,
                dailySnapshots: state.dailySnapshots,
                user: state.user,
                deletedItems: state.deletedItems || {},
                lastUpdated: state.lastUpdated || 0
            };
            const jsonStr = JSON.stringify(dataToSync);
            
            await WidgetSync.enqueueCloudSync({
                token: user.accessToken || "",
                payload: jsonStr
            });
            console.log("[Background Sync] Enqueued in WorkManager successfully.");
        } catch (err) {
            console.error("[Background Sync] Failed to enqueue native sync", err);
        }
    } else {
        // En web, hacemos la subida normal si no está en progreso
        console.log("[Background Sync] Triggering web auto sync...");
        state.autoSyncGoogleDrive().catch(console.error);
    }
    
    // Asumimos exito inmediato para el flag (el reintento lo maneja el Worker o la próxima acción)
    isCloudSyncDirty = false;
};

/**
 * Intenta renovar el accessToken de Google de forma silenciosa (sin interacción del usuario).
 * Usa GoogleAuth.refresh() para obtener un nuevo token cuando el actual expira (cada ~1 hora).
 * Actualiza el store con el nuevo token y devuelve el token renovado, o null si falla.
 */
export const silentRefreshGoogleToken = async (): Promise<string | null> => {
    try {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        const result = await GoogleAuth.refresh();
        if (!result || !result.accessToken) return null;

        const newToken = result.accessToken;

        // Actualizar el store con el token renovado (sin disparar cloud sync)
        const currentUser = useStore.getState().googleUser;
        if (currentUser) {
            useStore.setState({
                googleUser: { ...currentUser, accessToken: newToken },
                googleSessionExpired: false
            });
        }
        console.log('[Auth] Token renovado silenciosamente con éxito.');
        return newToken;
    } catch (err) {
        console.warn('[Auth] No se pudo renovar el token silenciosamente:', err);
        return null;
    }
};

export const useStore = create<AppState>()(
    persist(
        (originalSet, get) => {
            const set: typeof originalSet = (nextStateOrUpdater, replace) => {
                if (typeof nextStateOrUpdater === 'function') {
                    (originalSet as any)((state: any) => {
                        const partialState = (nextStateOrUpdater as any)(state);
                        if (partialState) {
                            const keys = Object.keys(partialState);
                            const isTimerOnly = keys.length === 1 && keys[0] === 'timer';
                            const isSyncOnly = keys.every(k => k === 'isSyncingCloud' || k === 'lastCloudSync' || k === 'timer' || k === 'googleUser' || k === 'googleSessionExpired' || k === 'toast');
                            if (!isTimerOnly && !isSyncOnly) {
                                markCloudSyncDirty();
                                return { ...partialState, lastUpdated: Date.now() };
                            }
                        }
                        return partialState;
                    }, replace);
                } else {
                    const partialState = nextStateOrUpdater;
                    if (partialState) {
                        const keys = Object.keys(partialState);
                        const isTimerOnly = keys.length === 1 && keys[0] === 'timer';
                        const isSyncOnly = keys.every(k => k === 'isSyncingCloud' || k === 'lastCloudSync' || k === 'timer' || k === 'googleUser' || k === 'googleSessionExpired' || k === 'toast');
                        if (!isTimerOnly && !isSyncOnly) {
                            markCloudSyncDirty();
                            (originalSet as any)({ ...partialState, lastUpdated: Date.now() }, replace);
                            return;
                        }
                    }
                    (originalSet as any)(partialState, replace);
                }
            };

            return {
                tasks: [],
                projects: [],
                notes: [],
                appointments: [],
                goals: [],
                transactions: [],
                expenseNotes: [],
                savingsGoal: 400,
                completedOnceHabits: [],
                user: {
                    xp: 0,
                    level: 1,
                    streak: 0,
                    focusTimeMinutes: 0,
                    dailyGoal: 5
                },
                language: getInitialLanguage(),
                pinnedNoteId: null,
                lastPinnedGoalId: null,
                appOpenCount: 0,
                notificationPromptStatus: 'pending',
                inAppNotificationDates: [],
                notificationsEnabled: true,
                dailySnapshots: {},
                lastProcessedDate: undefined,
                taskGroups: [],
                celebration: null,
                focusEffectEnabled: true,
                isHydrated: false,
                googleUser: null,
                googleSessionExpired: false,
                deletedItems: {},
                isSyncingCloud: false,
                syncError: null,
                lastCloudSync: undefined,
                lastUpdated: 0,
                restoreProgress: null,
                toast: null,
                showToast: (message, type = 'info') => set({ toast: { message, type } }),
                clearToast: () => set({ toast: null }),
                syncConflict: null,
                isCloudSyncDirty: false,
                scheduleSyncDebounced: () => {},

                areNotesLoaded: false,
                areTasksLoaded: false,

                migrateBase64Images: async () => {
                    const state = get();
                    if (state.hasMigratedBase64 || typeof window === 'undefined') return;

                    let changed = false;
                    try {
                        const { saveBase64ImageToFile } = await import('./image-utils');

                        // 1. Migrate Notes
                        const newNotes = await Promise.all(state.notes.map(async (note) => {
                            let noteChanged = false;
                            const newBlocks = await Promise.all(note.blocks.map(async (block) => {
                                if ((block.type === 'image' || block.type === 'drawing') && typeof block.content === 'string' && block.content.startsWith('data:image')) {
                                    const uri = await saveBase64ImageToFile(block.content);
                                    if (uri) {
                                        noteChanged = true;
                                        changed = true;
                                        return { ...block, content: uri };
                                    }
                                }
                                return block;
                            }));
                            return noteChanged ? { ...note, blocks: newBlocks, lastUpdated: Date.now() } : note;
                        }));

                        // 2. Migrate Tasks
                        const newTasks = await Promise.all(state.tasks.map(async (task) => {
                            if (!task.photos || task.photos.length === 0) return task;
                            let taskChanged = false;
                            const newPhotos = await Promise.all(task.photos.map(async (photo) => {
                                if (photo.startsWith('data:image')) {
                                    const uri = await saveBase64ImageToFile(photo);
                                    if (uri) {
                                        taskChanged = true;
                                        changed = true;
                                        return uri;
                                    }
                                }
                                return photo;
                            }));
                            return taskChanged ? { ...task, photos: newPhotos, lastUpdated: Date.now() } : task;
                        }));

                        // 3. Migrate Goals
                        const newGoals = await Promise.all(state.goals.map(async (goal) => {
                            if (!goal.photos || goal.photos.length === 0) return goal;
                            let goalChanged = false;
                            const newPhotos = await Promise.all(goal.photos.map(async (photo) => {
                                if (photo.startsWith('data:image')) {
                                    const uri = await saveBase64ImageToFile(photo);
                                    if (uri) {
                                        goalChanged = true;
                                        changed = true;
                                        return uri;
                                    }
                                }
                                return photo;
                            }));
                            return goalChanged ? { ...goal, photos: newPhotos, lastUpdated: Date.now() } : goal;
                        }));

                        if (changed) {
                            console.log("[Migration] Successfully migrated Base64 images to Filesystem");
                            originalSet({
                                notes: newNotes,
                                tasks: newTasks,
                                goals: newGoals,
                                hasMigratedBase64: true,
                                lastUpdated: Date.now()
                            });
                        } else {
                            originalSet({ hasMigratedBase64: true });
                        }
                    } catch (e) {
                        console.error("[Migration] Error migrating base64 images:", e);
                    }
                },


                loadAllNotes: async () => {
                    const fullNotes = await readAllNotesFromDisk(get().notes);
                    originalSet({ notes: fullNotes, areNotesLoaded: true });
                },

                unloadNotes: async () => {
                    const currentNotes = get().notes;
                    await saveAllNotesToDisk(currentNotes);
                    originalSet({ notes: currentNotes, areNotesLoaded: true });
                },

                loadAllTasks: async () => {
                    const fullTasks = await readAllTasksFromDisk(get().tasks);
                    originalSet({ tasks: fullTasks, areTasksLoaded: true });
                },

                unloadTasks: async () => {
                    const currentTasks = get().tasks;
                    await saveAllTasksToDisk(currentTasks);
                    originalSet({ tasks: currentTasks, areTasksLoaded: true });
                },
                timer: {
                    timeLeft: 25 * 60,
                    isActive: false,
                    targetTimestamp: undefined,
                    isFloating: false,
                    position: { x: 0, y: 0 },
                    size: { width: 180, height: 180 }
                },

                tourStep: null,
                tourCompleted: false,
                isTourManuallyStarted: false,
                startTour: () => set({ tourStep: 0, tourCompleted: false, isTourManuallyStarted: false }),
                startTourManually: () => set({ tourStep: 0, tourCompleted: false, isTourManuallyStarted: true }),
                nextTourStep: () => set((state) => ({ tourStep: state.tourStep !== null ? state.tourStep + 1 : null })),
                endTour: () => {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('mynotes_tour_completed', 'true');
                    }
                    set({ tourStep: null, tourCompleted: true, isTourManuallyStarted: false });
                },

                setPinnedNoteId: (id) => set({ pinnedNoteId: id }),

                setLanguage: (lang) => set((state) => {
                    const newState = { language: lang };
                    setTimeout(() => {
                        const latestState = useStore.getState();
                        syncWidgetData(latestState.goals, latestState.appointments, latestState.notes, latestState.tasks).catch(console.error);
                    }, 0);
                    return newState;
                }),

                setTimer: (timerUpdate) => set((state) => {
                    // Guaranteed default structure
                    const defaultTimer = {
                        timeLeft: 25 * 60,
                        isActive: false,
                        isFloating: false,
                        position: { x: 0, y: 0 },
                        size: { width: 180, height: 180 }
                    }

                    // Initial state safety
                    const currentTimer = { ...defaultTimer, ...(state.timer || {}) }

                    // Merge with update, being careful with nested objects (size, position)
                    const newTimer = {
                        ...currentTimer,
                        ...timerUpdate,
                        size: timerUpdate.size
                            ? { ...currentTimer.size, ...timerUpdate.size }
                            : currentTimer.size,
                        position: timerUpdate.position
                            ? { ...currentTimer.position, ...timerUpdate.position }
                            : currentTimer.position
                    }

                    // If timer is becoming active and doesn't have a targetTimestamp, calculate it
                    if (timerUpdate.isActive === true && !newTimer.targetTimestamp) {
                        newTimer.targetTimestamp = Date.now() + (newTimer.timeLeft * 1000)
                    }
                    // If timer is becoming inactive, clear targetTimestamp
                    else if (timerUpdate.isActive === false) {
                        newTimer.targetTimestamp = undefined
                    }

                    return { timer: newTimer as any }
                }),

                addTask: (task: Omit<Task, 'id' | 'completed' | 'completedDates' | 'missed' | 'streak'>) => {
                    lastLocalTasksUpdate = Date.now();
                    const newTask: Task = {
                        id: Math.random().toString(36).substring(7),
                        completed: false,
                        completedDates: [],
                        missed: 0,
                        streak: 0,
                        photos: [],
                        completionTimes: [],
                        subtasks: [],
                        projectId: task.projectId || 'p1',
                        isHabit: true, // Default to true if called from habits page
                        enabled: true,
                        lastUpdated: Date.now(),
                        ...task as any
                    };

                    readAllTasksFromDisk(get().tasks).then(allTasks => {
                        const newTasks = [...allTasks, newTask];
                        saveAllTasksToDisk(newTasks);
                    });

                    set((state) => {
                        const currentTasks = Array.isArray(state.tasks) ? state.tasks : [];
                        const newTasks = [...currentTasks, newTask];
                        syncWidgetData(state.goals, state.appointments, state.notes, newTasks);
                        return { tasks: newTasks };
                    });
                },

                addProject: (project) => set((state) => ({
                    projects: [...state.projects, {
                        ...project,
                        id: Math.random().toString(36).substring(7),
                        progress: 0,
                        milestones: []
                    }]
                })),

                toggleTask: (taskId) => {
                    lastLocalTasksUpdate = Date.now();
                    let syncedTasks: Task[] | null = null;
                    let taskToSync: any = undefined;

                    readAllTasksFromDisk(get().tasks).then(allTasks => {
                        const task = allTasks.find(t => t.id === taskId);
                        if (!task) return;

                        const today = getLocalDateString();
                        const isRecurring = task.recurrence !== 'None';
                        const completedDates = task.completedDates || [];
                        const isCompletedToday = isRecurring ? completedDates.includes(today) : task.completed;
                        const willBeCompleted = !isCompletedToday;

                        if (isRecurring) {
                            if (willBeCompleted) {
                                if (!task.completedDates.includes(today)) {
                                    task.completedDates.push(today);
                                    if (!task.completionTimes) task.completionTimes = [];
                                    task.completionTimes.push(new Date().toISOString());
                                    task.streak = (task.streak || 0) + 1;
                                }
                            } else {
                                task.completedDates = task.completedDates.filter(d => d !== today);
                                task.completionTimes = (task.completionTimes || []).filter(t => !t.startsWith(today));
                                task.streak = Math.max(0, (task.streak || 0) - 1);
                            }
                        } else {
                            task.completed = !task.completed;
                            if (task.completed) {
                                if (!task.completionTimes) task.completionTimes = [];
                                task.completionTimes.push(new Date().toISOString());
                            } else {
                                task.completionTimes = (task.completionTimes || []).filter(t => !t.startsWith(today));
                            }
                        }
                        task.lastUpdated = Date.now();

                        const finalTasks = (task.recurrence === 'Once' && willBeCompleted)
                            ? allTasks.filter(t => t.id !== taskId)
                            : allTasks;

                        saveAllTasksToDisk(finalTasks);
                    });

                    set((state) => {
                        const task = state.tasks.find(t => t.id === taskId)
                        if (!task) return {}
                        taskToSync = task;

                        const today = getLocalDateString()
                        const isRecurring = task.recurrence !== 'None'

                        const completedDates = task.completedDates || []
                        const isCompletedToday = isRecurring ? completedDates.includes(today) : task.completed
                        const willBeCompleted = !isCompletedToday

                        let newCompleted = task.completed
                        let newCompletedDates = Array.isArray(task.completedDates) ? [...task.completedDates] : []
                        let newCompletionTimes = Array.isArray(task.completionTimes) ? [...task.completionTimes] : []
                        let xpGain = 0
                        let newStreak = task.streak || 0

                        if (isRecurring) {
                            if (willBeCompleted) {
                                if (!newCompletedDates.includes(today)) {
                                    newCompletedDates.push(today)
                                    newCompletionTimes.push(new Date().toISOString())
                                    xpGain = task.energyLevel === 'High' ? 50 : task.energyLevel === 'Medium' ? 30 : 10
                                    newStreak += 1
                                }
                            } else {
                                newCompletedDates = newCompletedDates.filter(d => d !== today)
                                newCompletionTimes = newCompletionTimes.filter(t => !t.startsWith(today))
                                xpGain = -10
                                newStreak = Math.max(0, newStreak - 1)
                            }
                        } else {
                            newCompleted = !task.completed
                            if (newCompleted) {
                                newCompletionTimes.push(new Date().toISOString())
                                xpGain = task.energyLevel === 'High' ? 50 : task.energyLevel === 'Medium' ? 30 : 10
                            } else {
                                newCompletionTimes = newCompletionTimes.filter(t => !t.startsWith(today))
                                xpGain = -10
                            }
                        }

                        const newTasks = state.tasks.map((t) =>
                            t.id === taskId ? { ...t, completed: newCompleted, completedDates: newCompletedDates, completionTimes: newCompletionTimes, streak: newStreak, lastUpdated: Date.now() } : t
                        )

                        const finalTasks = (task.recurrence === 'Once' && willBeCompleted)
                            ? newTasks.filter(t => t.id !== taskId)
                            : newTasks;

                        let newCompletedOnceHabits = Array.isArray(state.completedOnceHabits) ? [...state.completedOnceHabits] : [];
                        let deletedItems = state.deletedItems || {};
                        if (task.recurrence === 'Once' && willBeCompleted) {
                            newCompletedOnceHabits.push({
                                id: task.id,
                                title: task.title,
                                completedAt: new Date().toISOString()
                            });

                            // Keep only completions in the last 8 days to prevent state bloat
                            const limitTime = Date.now() - 8 * 24 * 60 * 60 * 1000;
                            newCompletedOnceHabits = newCompletedOnceHabits.filter(h => new Date(h.completedAt).getTime() > limitTime);

                            deletedItems = { ...deletedItems, [taskId]: Date.now() };
                        }

                        // Update snapshots
                        const getDayOfWeek = (dateStr: string) => {
                            const parts = dateStr.split('-');
                            const year = parseInt(parts[0], 10);
                            const month = parseInt(parts[1], 10) - 1;
                            const day = parseInt(parts[2], 10);
                            const dateObj = new Date(year, month, day);
                            return dateObj.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
                        };
                        const dayOfWeek = getDayOfWeek(today);

                        const completedCount = newTasks.filter(t => {
                            if (t.recurrence !== 'None') {
                                const isCompleted = (t.completedDates || []).includes(today);
                                const isInactive = t.recurrence !== 'Once' && t.activeDays && !t.activeDays.includes(dayOfWeek);
                                return isCompleted || isInactive;
                            }
                            return t.completed;
                        }).length;

                        const totalCount = newTasks.filter(t => {
                            if (t.recurrence !== 'None') {
                                return true;
                            }
                            return t.dueDate === today || (t.completed && (t.completedDates || []).includes(today));
                        }).length;

                        syncedTasks = finalTasks;

                        return {
                            tasks: finalTasks,
                            completedOnceHabits: newCompletedOnceHabits,
                            user: {
                                ...state.user,
                                xp: Math.max(0, state.user.xp + xpGain)
                            },
                            dailySnapshots: {
                                ...state.dailySnapshots,
                                [today]: { total: totalCount, completed: completedCount }
                            },
                            deletedItems
                        }
                    })

                    if (syncedTasks) {
                        if (taskToSync && taskToSync.recurrence === 'Daily') {
                            showNativeHabitNotification(syncedTasks).catch(console.error);
                        }
                        const state = get();
                        syncWidgetData(state.goals, state.appointments, state.notes, syncedTasks).catch(console.error);
                    }
                },

                deleteTask: (taskId) => {
                    lastLocalTasksUpdate = Date.now();
                    readAllTasksFromDisk(get().tasks).then(allTasks => {
                        const finalTasks = allTasks.filter(t => t.id !== taskId);
                        saveAllTasksToDisk(finalTasks);
                    });
                    set((state) => {
                        const newTasks = state.tasks.filter(t => t.id !== taskId)
                        const today = getLocalDateString()
                        const deletedItems = { ...(state.deletedItems || {}), [taskId]: Date.now() };

                        // Update Snapshot for today after deletion
                        const getDayOfWeek = (dateStr: string) => {
                            const parts = dateStr.split('-');
                            const year = parseInt(parts[0], 10);
                            const month = parseInt(parts[1], 10) - 1;
                            const day = parseInt(parts[2], 10);
                            const dateObj = new Date(year, month, day);
                            return dateObj.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
                        };
                        const dayOfWeek = getDayOfWeek(today);

                        const completedCount = newTasks.filter(t => {
                            if (t.recurrence !== 'None') {
                                const isCompleted = (t.completedDates || []).includes(today);
                                const isInactive = t.recurrence !== 'Once' && t.activeDays && !t.activeDays.includes(dayOfWeek);
                                return isCompleted || isInactive;
                            }
                            return t.completed;
                        }).length;

                        const totalCount = newTasks.filter(t => {
                            if (t.recurrence !== 'None') {
                                return true;
                            }
                            return t.dueDate === today || (t.completed && (t.completedDates || []).includes(today));
                        }).length;

                        syncWidgetData(state.goals, state.appointments, state.notes, newTasks);

                        return {
                            tasks: newTasks,
                            dailySnapshots: {
                                ...state.dailySnapshots,
                                [today]: { total: totalCount, completed: completedCount }
                            },
                            deletedItems
                        };
                    });
                },

                addXP: (amount) => set((state) => ({
                    user: { ...state.user, xp: state.user.xp + amount }
                })),

                incrementFocusTime: (minutes) => set((state) => ({
                    user: { ...state.user, focusTimeMinutes: state.user.focusTimeMinutes + minutes }
                })),

                addNote: (note) => {
                    lastLocalNotesUpdate = Date.now();
                    const newNote = { ...note, id: Math.random().toString(36).substring(7), createdAt: new Date().toISOString(), lastUpdated: Date.now() }
                    
                    set((state) => {
                        const newNotes = [...state.notes, newNote]
                        syncWidgetData(state.goals, state.appointments, newNotes)
                        return { notes: newNotes }
                    });

                    (async () => {
                        try {
                            const allNotes = await readAllNotesFromDisk(get().notes);
                            const finalNotes = [...allNotes, newNote];
                            await saveAllNotesToDisk(finalNotes);
                        } catch (e) {
                            console.error("Async disk save failed", e);
                        }
                    })();

                    return newNote
                },

                updateNote: async (id, title, blocks) => {
                    const now = Date.now();
                    lastLocalNotesUpdate = now;
                    
                    const allNotes = await readAllNotesFromDisk(get().notes);
                    const finalNotes = allNotes.map(n => n.id === id ? { ...n, title, blocks, lastUpdated: now } : n);
                    await saveAllNotesToDisk(finalNotes);

                    set((state) => {
                        const newNotes = state.notes.map(n => n.id === id ? { ...n, title, blocks, lastUpdated: now } : n)
                        syncWidgetData(state.goals, state.appointments, newNotes)
                        return { notes: newNotes }
                    });
                },

                updateNoteBlockContent: async (noteId, blockId, content) => {
                    const now = Date.now();
                    lastLocalNotesUpdate = now;

                    const allNotes = await readAllNotesFromDisk(get().notes);
                    const finalNotes = allNotes.map(n => n.id === noteId ? {
                        ...n,
                        lastUpdated: now,
                        blocks: n.blocks.map(b => b.id === blockId ? { ...b, content, isDownloading: false } : b)
                    } : n);
                    await saveAllNotesToDisk(finalNotes);

                    set((state) => {
                        const newNotes = state.notes.map(n => n.id === noteId ? {
                            ...n,
                            lastUpdated: now,
                            blocks: n.blocks.map(b => b.id === blockId ? { ...b, content, isDownloading: false } : b)
                        } : n)
                        syncWidgetData(state.goals, state.appointments, newNotes)
                        return { notes: newNotes }
                    });
                },

                setBlockDownloading: (noteId, blockId, isDownloading) => {
                    set((state) => ({
                        notes: state.notes.map(n => n.id === noteId ? {
                            ...n,
                            blocks: n.blocks.map(b => b.id === blockId ? { ...b, isDownloading } : b)
                        } : n)
                    }))
                },

                deleteNote: async (id) => {
                    lastLocalNotesUpdate = Date.now();
                    
                    const allNotes = await readAllNotesFromDisk(get().notes);
                    const finalNotes = allNotes.filter(n => n.id !== id);
                    await saveAllNotesToDisk(finalNotes);

                    set((state) => {
                        const newNotes = state.notes.filter(n => n.id !== id)
                        const deletedItems = { ...(state.deletedItems || {}), [id]: Date.now() };
                        syncWidgetData(state.goals, state.appointments, newNotes)
                        return { notes: newNotes, deletedItems }
                    });
                },

                addAppointment: (apt) => set((state) => {
                    const newAppointments = [...state.appointments, {
                        ...apt,
                        id: Math.random().toString(36).substring(7),
                        status: apt.status || 'pending',
                        lastUpdated: Date.now()
                    }]
                    syncWidgetData(state.goals, newAppointments)
                    return { appointments: newAppointments }
                }),

                updateAppointment: (id: string, updates: Partial<Appointment>) => set((state) => {
                    const newAppointments = state.appointments.map(a => a.id === id ? { ...a, ...updates, lastUpdated: Date.now() } : a)
                    syncWidgetData(state.goals, newAppointments)
                    return { appointments: newAppointments }
                }),

                deleteAppointment: (id: string) => set((state) => {
                    const newAppointments = state.appointments.filter(a => a.id !== id)
                    const deletedItems = { ...(state.deletedItems || {}), [id]: Date.now() };
                    syncWidgetData(state.goals, newAppointments)
                    return { appointments: newAppointments, deletedItems }
                }),

                addGoal: (goal) => set((state) => {
                    let initialProgress = 0;

                    // Calculate initial progress based on type
                    if (goal.type === 'checklist') {
                        if (goal.objectives && goal.objectives.length > 0) {
                            const completed = goal.objectives.filter(o => o.completed).length;
                            initialProgress = Math.round((completed / goal.objectives.length) * 100);
                        } else {
                            initialProgress = 0;
                        }
                    } else if ((goal.type === 'numeric' || goal.type === 'weight') && goal.targetValue !== undefined && goal.currentValue !== undefined) {
                        if (goal.type === 'weight' && goal.startValue !== undefined) {
                            // Formula: (start - current) / (start - target) * 100
                            const totalToLose = goal.startValue - goal.targetValue;
                            const lostSoFar = goal.startValue - goal.currentValue;
                            if (totalToLose > 0) {
                                // Handle edge cases where current goes below target or above start
                                const rawProgress = (lostSoFar / totalToLose) * 100;
                                initialProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
                            } else if (totalToLose < 0) {
                                // Weight gain goal
                                const totalToGain = goal.targetValue - goal.startValue;
                                const gainedSoFar = goal.currentValue - goal.startValue;
                                const rawProgress = (gainedSoFar / totalToGain) * 100;
                                initialProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
                            }
                        } else if (goal.targetValue > 0) {
                            const rawProgress = (goal.currentValue / goal.targetValue) * 100;
                            initialProgress = Math.min(100, Math.max(0, Math.round(rawProgress)));
                        }
                    }

                    const newGoal = {
                        ...goal,
                        id: Math.random().toString(36).substring(7),
                        createdAt: new Date().toISOString(),
                        progress: initialProgress,
                        type: goal.type || 'general',
                        objectives: goal.objectives || [],
                        photos: goal.photos || [],
                        reports: goal.reports || [],
                        lastUpdated: Date.now()
                    }
                    const newGoals = [...state.goals, newGoal]
                    syncWidgetData(newGoals)
                    return { goals: newGoals }
                }),

                updateGoal: (id, updates) => set((state) => {
                    const isPinning = updates.pinned === true;
                    const newGoals = state.goals.map(g => {
                        if (g.id !== id) {
                            return isPinning ? { ...g, pinned: false } : g;
                        }

                        const updatedGoal = { ...g, ...updates, lastUpdated: Date.now() };

                        // Recalculate progress if modifying relevant fields
                        if (updatedGoal.type === 'checklist') {
                            if (updatedGoal.objectives && updatedGoal.objectives.length > 0) {
                                const completed = updatedGoal.objectives.filter(o => o.completed).length;
                                updatedGoal.progress = Math.round((completed / updatedGoal.objectives.length) * 100);
                            } else {
                                updatedGoal.progress = 0;
                            }
                        } else if (updatedGoal.type === 'numeric' && updatedGoal.targetValue && updatedGoal.targetValue > 0) {
                            const val = updatedGoal.currentValue || 0;
                            const rawProgress = (val / updatedGoal.targetValue) * 100;
                            updatedGoal.progress = Math.min(100, Math.max(0, Math.round(rawProgress)));
                        } else if (updatedGoal.type === 'weight' && updatedGoal.startValue !== undefined && updatedGoal.targetValue !== undefined && updatedGoal.currentValue !== undefined) {
                            const totalDifference = updatedGoal.targetValue - updatedGoal.startValue;

                            if (totalDifference !== 0) {
                                const currentDifference = updatedGoal.currentValue - updatedGoal.startValue;
                                // Progress is ratio of current difference to total desired difference
                                const rawProgress = (currentDifference / totalDifference) * 100;
                                updatedGoal.progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
                            }
                        }

                        return updatedGoal;
                    })
                    syncWidgetData(newGoals)
                    return {
                        goals: newGoals,
                        ...(isPinning ? { lastPinnedGoalId: id } : {})
                    }
                }),

                deleteGoal: (id) => set((state) => {
                    const newGoals = state.goals.filter(g => g.id !== id)
                    const deletedItems = { ...(state.deletedItems || {}), [id]: Date.now() };
                    syncWidgetData(newGoals)
                    return {
                        goals: newGoals,
                        deletedItems,
                        ...(state.lastPinnedGoalId === id ? { lastPinnedGoalId: null } : {})
                    }
                }),

                addGoalPhoto: (id, photo) => set((state) => ({
                    goals: state.goals.map(g => g.id === id ? { ...g, photos: [...g.photos, photo], lastUpdated: Date.now() } : g)
                })),

                addTaskPhoto: (id, photo) => {
                    readAllTasksFromDisk(get().tasks).then(allTasks => {
                        const finalTasks = allTasks.map(t => t.id === id ? { ...t, photos: [...(t.photos || []), photo], lastUpdated: Date.now() } : t);
                        saveAllTasksToDisk(finalTasks);
                    });
                    set((state) => ({
                        tasks: state.tasks.map(t => t.id === id ? { ...t, photos: [...t.photos, photo], lastUpdated: Date.now() } : t)
                    }));
                },

                setTaskShortcut: (taskId, key) => {
                    readAllTasksFromDisk(get().tasks).then(allTasks => {
                        const finalTasks = allTasks.map(t => {
                            if (key && t.shortcutKey === key) return { ...t, shortcutKey: undefined, lastUpdated: Date.now() }
                            if (t.id === taskId) return { ...t, shortcutKey: key, lastUpdated: Date.now() }
                            return t
                        });
                        saveAllTasksToDisk(finalTasks);
                    });
                    set((state) => ({
                        tasks: state.tasks.map(t => {
                            // Clear same shortcut from other tasks if assigned
                            if (key && t.shortcutKey === key) return { ...t, shortcutKey: undefined, lastUpdated: Date.now() }
                            if (t.id === taskId) return { ...t, shortcutKey: key, lastUpdated: Date.now() }
                            return t
                        })
                    }));
                },

                checkHabitStreaks: () => set((state) => {
                    const today = getLocalDateString()
                    const yesterdayDate = new Date()
                    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
                    const yesterday = getLocalDateString(yesterdayDate)

                    // Avoid running multiple times per day
                    if (state.lastProcessedDate === today) return {}

                    // If lastProcessedDate is missing, default to yesterday to avoid counting all historical days
                    const lastProcessedDate = state.lastProcessedDate
                        ? (() => {
                            const parts = state.lastProcessedDate.split('-');
                            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                        })()
                        : yesterdayDate

                    // Calculate days passed since last process (up to yesterday)
                    const daysToCheck: Date[] = []
                    const currentCheckDate = new Date(lastProcessedDate)
                    currentCheckDate.setDate(currentCheckDate.getDate() + 1)

                    while (currentCheckDate <= yesterdayDate) {
                        daysToCheck.push(new Date(currentCheckDate))
                        currentCheckDate.setDate(currentCheckDate.getDate() + 1)
                    }

                    let totalXpLoss = 0;

                    const newTasks = state.tasks.map(task => {
                        if (task.recurrence === 'None' || task.enabled === false) return task

                        const completedDates = task.completedDates || []
                        let newMissed = task.missed || 0
                        let newStreak = task.streak || 0

                        if (task.recurrence === 'Daily') {
                            daysToCheck.forEach(checkDate => {
                                const checkDateString = getLocalDateString(checkDate)
                                const checkDayOfWeek = checkDate.getDay() // 0 is Sunday
                                const isActiveDay = !task.activeDays || task.activeDays.includes(checkDayOfWeek)
                                const completedThisDate = completedDates.includes(checkDateString)

                                if (!completedThisDate && isActiveDay) {
                                    newMissed += 1
                                    newStreak = 0
                                    if (task.habitType === 'bad') {
                                        const xpLoss = task.energyLevel === 'High' ? 50 : task.energyLevel === 'Medium' ? 30 : 10;
                                        totalXpLoss += xpLoss;
                                    }
                                }
                            })
                        }

                        return { ...task, completedDates, missed: newMissed, streak: newStreak }
                    })

                    syncWidgetData(state.goals, state.appointments, state.notes, newTasks);

                    return {
                        tasks: newTasks,
                        user: {
                            ...state.user,
                            xp: Math.max(0, state.user.xp - totalXpLoss)
                        },
                        lastProcessedDate: today
                    }
                }),

                resetHabitStats: (taskId) => {
                    lastLocalTasksUpdate = Date.now();
                    readAllTasksFromDisk(get().tasks).then(allTasks => {
                        const finalTasks = allTasks.map(t => t.id === taskId ? { ...t, missed: 0, streak: 0, lastUpdated: Date.now() } : t);
                        saveAllTasksToDisk(finalTasks);
                    });
                    set((state) => {
                        const newTasks = state.tasks.map(t => t.id === taskId ? { ...t, missed: 0, streak: 0, lastUpdated: Date.now() } : t)
                        syncWidgetData(state.goals, state.appointments, state.notes, newTasks);
                        return { tasks: newTasks }
                    });
                },

                setHabitEnabled: (taskId, enabled) => {
                    lastLocalTasksUpdate = Date.now();
                    readAllTasksFromDisk(get().tasks).then(allTasks => {
                        const finalTasks = allTasks.map(t => t.id === taskId ? { ...t, enabled, lastUpdated: Date.now() } : t);
                        saveAllTasksToDisk(finalTasks);
                    });
                    set((state) => {
                        const newTasks = state.tasks.map(t => t.id === taskId ? { ...t, enabled, lastUpdated: Date.now() } : t)
                        showNativeHabitNotification(newTasks)
                        syncWidgetData(state.goals, state.appointments, state.notes, newTasks);
                        return { tasks: newTasks }
                    });
                },

                addExpenseNote: (note) => {
                    set((state) => {
                        const newNotes = [...(state.expenseNotes || []), note];
                        WidgetSync.enqueueCloudSync({
                            token: state.googleUser?.accessToken || '',
                            payload: JSON.stringify({ expenseNotes: newNotes })
                        }).catch(() => {});
                        return { expenseNotes: newNotes };
                    });
                },

                updateExpenseNote: (id, noteData) => {
                    set((state) => {
                        const newNotes = (state.expenseNotes || []).map(n => 
                            n.id === id ? { ...n, ...noteData, lastUpdated: Date.now() } : n
                        );
                        WidgetSync.enqueueCloudSync({
                            token: state.googleUser?.accessToken || '',
                            payload: JSON.stringify({ expenseNotes: newNotes })
                        }).catch(() => {});
                        return { expenseNotes: newNotes };
                    });
                },

                deleteExpenseNote: (id) => {
                    set((state) => {
                        const newNotes = (state.expenseNotes || []).filter(n => n.id !== id);
                        WidgetSync.enqueueCloudSync({
                            token: state.googleUser?.accessToken || '',
                            payload: JSON.stringify({ expenseNotes: newNotes })
                        }).catch(() => {});
                        
                        const deletedItems = { ...(state.deletedItems || {}) };
                        deletedItems[`expenseNote_${id}`] = Date.now();
                        
                        return { expenseNotes: newNotes, deletedItems };
                    });
                },

                setSavingsGoal: (goal) => set({ savingsGoal: goal }),

                addTransaction: (tx) => {
                    set((state) => {
                        const newTx: Transaction = {
                            ...tx,
                            id: Math.random().toString(36).substring(7),
                            lastUpdated: Date.now()
                        };
                        const newTransactions = [newTx, ...(state.transactions || [])];
                        if (tx.conservationGoalDate) {
                            const newBalance = newTransactions.reduce((sum, t) => {
                                const amt = Number(t.amount) || 0;
                                const delta = t.type === 'expense' ? -amt : amt;
                                return sum + delta;
                            }, 0);
                            newTx.conservationStartBalance = Math.round(newBalance * 100) / 100;
                        }

                        const newAppointments = [...state.appointments];
                        if (tx.recoveryDate) {
                            newAppointments.push({
                                id: Math.random().toString(36).substring(7),
                                title: state.language === 'es'
                                    ? `Recuperar capital: ${tx.amount}${tx.currency || '$'} (${tx.description})`
                                    : `Recover capital: ${tx.amount}${tx.currency || '$'} (${tx.description})`,
                                date: tx.recoveryDate,
                                notes: `recovery_reminder:${newTx.id}`,
                                description: tx.description,
                                status: 'pending',
                                color: '#ef4444',
                                lastUpdated: Date.now()
                            });
                        }
                        if (tx.conservationGoalDate) {
                            newAppointments.push({
                                id: Math.random().toString(36).substring(7),
                                title: state.language === 'es'
                                    ? `Meta de conservación: ${tx.amount}${tx.currency || '$'} (${tx.description})`
                                    : `Conservation Goal: ${tx.amount}${tx.currency || '$'} (${tx.description})`,
                                date: tx.conservationGoalDate,
                                notes: `conservation_goal:${newTx.id}`,
                                description: tx.description,
                                status: 'pending',
                                color: '#8b5cf6',
                                lastUpdated: Date.now()
                            });
                        }

                        return {
                            transactions: newTransactions,
                            appointments: newAppointments
                        };
                    });
                    flushStorage().catch(console.error);
                },

                deleteTransaction: (id) => {
                    set((state) => {
                        const txToDelete = (state.transactions || []).find(t => t.id === id);
                        if (!txToDelete) return {};
                        const newTransactions = (state.transactions || []).filter(t => t.id !== id);

                        const newAppointments = state.appointments.filter(a =>
                            a.notes !== `recovery_reminder:${id}` &&
                            a.notes !== `conservation_goal:${id}`
                        );

                        const deletedItems = { ...(state.deletedItems || {}), [id]: Date.now() };
                        return {
                            transactions: newTransactions,
                            appointments: newAppointments,
                            deletedItems
                        };
                    });
                    flushStorage().catch(console.error);
                },

                clearAllTransactions: () => {
                    set((state) => {
                        const newAppointments = state.appointments.filter(a =>
                            !a.notes?.startsWith('recovery_reminder:') &&
                            !a.notes?.startsWith('conservation_goal:')
                        );
                        const newDeletedItems = { ...(state.deletedItems || {}) };
                        (state.transactions || []).forEach(tx => {
                            newDeletedItems[tx.id] = Date.now();
                        });
                        return {
                            transactions: [],
                            appointments: newAppointments,
                            deletedItems: newDeletedItems
                        };
                    });
                    flushStorage().catch(console.error);
                },

                syncHabitsNotification: () => {
                    showNativeHabitNotification(get().tasks)
                },

                syncWidget: () => {
                    syncWidgetData(get().goals, get().appointments, get().notes, get().tasks)
                },

                pullOfflineAppointments: async () => {
                    if (!isNative) return;
                    try {
                        const result = await WidgetSync.getAppointments();
                        if (result && result.appointments) {
                            const nativeAppts: any[] = JSON.parse(result.appointments);
                            const state = get();
                            let hasChanges = false;

                            const newAppts = state.appointments.map(storeApt => {
                                const nativeApt = nativeAppts.find(a => a.id === storeApt.id);
                                if (nativeApt && nativeApt.status !== storeApt.status) {
                                    hasChanges = true;
                                    return { ...storeApt, status: nativeApt.status };
                                }
                                return storeApt;
                            });

                            if (hasChanges) {
                                console.log("Syncing appointment changes from native notification/widget to app store");
                                set({ appointments: newAppts });
                                syncWidgetData(state.goals, newAppts, state.notes, state.tasks).catch(console.error);
                            }
                        }
                    } catch (err) {
                        console.error("Failed to pull offline appointments:", err);
                    }
                },

                pullOfflineCompletedTasks: async () => {
                    if (!isNative) return;
                    if (Date.now() - lastLocalTasksUpdate < 2500) {
                        console.log("Skipping pullOfflineCompletedTasks: recently updated tasks locally.");
                        return;
                    }
                    try {
                        const result = await WidgetSync.getTasks();
                        if (result && result.tasks) {
                            const nativeTasks: any[] = JSON.parse(result.tasks);
                            const state = get();
                            let hasChanges = false;

                            nativeTasks.forEach((nativeTask) => {
                                const storeTask = state.tasks.find(t => t.id === nativeTask.id || t.title === nativeTask.title);
                                if (storeTask) {
                                    const today = getLocalDateString();
                                    const isRecurring = storeTask.recurrence !== 'None';
                                    const storeCompleted = isRecurring
                                        ? (storeTask.completedDates || []).includes(today)
                                        : storeTask.completed;

                                    const nativeCompleted = isRecurring
                                        ? (nativeTask.completedDates || []).includes(today)
                                        : nativeTask.completed;

                                    // Only sync if native is completed and store is not completed
                                    // Widgets/notifications only allow completing tasks, never uncompleting them
                                    if (nativeCompleted && !storeCompleted) {
                                        console.log(`Syncing task completion: ${storeTask.title} (native: true, store: false)`);
                                        state.toggleTask(storeTask.id);
                                        hasChanges = true;
                                    }
                                }
                            });

                            if (hasChanges) {
                                // After toggling all, the state is already updated via 'set' in toggleTask
                                // No need to set again here
                            }
                        }
                    } catch (err) {
                        console.error("Failed to pull offline tasks:", err);
                    }
                },

                pullOfflineNotes: async (force = false) => {
                    if (!isNative) return;
                    if (!force && Date.now() - lastLocalNotesUpdate < 1500) {
                        console.log("Skipping pullOfflineNotes: recently updated notes locally.");
                        return;
                    }
                    try {
                        const result = await WidgetSync.getNotes();
                        if (result && result.notes) {
                            const nativeNotes: any[] = JSON.parse(result.notes);
                            const state = get();
                            let hasChanges = false;

                            const newNotes = state.notes.map((storeNote) => {
                                const nativeNote = nativeNotes.find(n => n.id === storeNote.id);
                                if (!nativeNote) return storeNote;

                                let noteChanged = false;
                                const newBlocks = storeNote.blocks.map((storeBlock) => {
                                    if (storeBlock.type !== 'task-list') return storeBlock;

                                    const nativeBlock = nativeNote.blocks?.find((b: any) => b.id === storeBlock.id);
                                    if (!nativeBlock || nativeBlock.type !== 'task-list') return storeBlock;

                                    const nativeContent = nativeBlock.content;
                                    const nativeItems = Array.isArray(nativeContent)
                                        ? nativeContent
                                        : (nativeContent && typeof nativeContent === 'object' && Array.isArray(nativeContent.items) ? nativeContent.items : []);

                                    const storeContent = storeBlock.content;
                                    const storeItems = Array.isArray(storeContent)
                                        ? storeContent
                                        : (storeContent && typeof storeContent === 'object' && Array.isArray(storeContent.items) ? storeContent.items : []);

                                    let itemsChanged = false;
                                    const newItems = storeItems.map((storeItem: any) => {
                                        if (!storeItem || typeof storeItem !== 'object') return storeItem;
                                        const nativeItem = storeItem.id ? nativeItems.find((ni: any) => ni && typeof ni === 'object' && ni.id === storeItem.id) : null;
                                        if (nativeItem && nativeItem.checked !== storeItem.checked) {
                                            noteChanged = true;
                                            itemsChanged = true;
                                            hasChanges = true;
                                            return { ...storeItem, checked: nativeItem.checked };
                                        }
                                        return storeItem;
                                    });

                                    if (itemsChanged) {
                                        if (Array.isArray(storeContent)) {
                                            return { ...storeBlock, content: newItems };
                                        } else {
                                            return { ...storeBlock, content: { ...storeContent, items: newItems } };
                                        }
                                    }
                                    return storeBlock;
                                });

                                return noteChanged ? { ...storeNote, blocks: newBlocks, lastUpdated: Date.now() } : storeNote;
                            });

                            if (hasChanges) {
                                console.log("Syncing checklist item changes from widget to app store and saving to disk");
                                set({ notes: newNotes });
                                saveAllNotesToDisk(newNotes).catch(console.error);
                                syncWidgetData(state.goals, state.appointments, newNotes, state.tasks).catch(console.error);
                            }
                        }
                    } catch (err) {
                        console.error("Failed to pull offline notes:", err);
                    }
                },

                incrementAppOpenCount: () => set((state) => ({
                    appOpenCount: (state.appOpenCount || 0) + 1
                })),

                handleNotificationPromptResponse: (response) => set(() => {
                    if (response === 'rejected') {
                        return { notificationPromptStatus: 'rejected', notificationPromptLastRejected: Date.now() }
                    }
                    return { notificationPromptStatus: 'accepted' }
                }),

                addInAppNotificationDate: () => set((state) => {
                    const now = Date.now();
                    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
                    // Keep only dates from the last 7 days and add the new one
                    const recentDates = (state.inAppNotificationDates || []).filter(d => d > oneWeekAgo);
                    return { inAppNotificationDates: [...recentDates, now] };
                }),

                updateTask: (taskId, updates) => {
                    lastLocalTasksUpdate = Date.now();
                    readAllTasksFromDisk(get().tasks).then(allTasks => {
                        const finalTasks = allTasks.map(t => t.id === taskId ? { ...t, ...updates, lastUpdated: Date.now() } : t);
                        saveAllTasksToDisk(finalTasks);
                    });
                    set((state) => {
                        const newTasks = state.tasks.map(t => t.id === taskId ? { ...t, ...updates, lastUpdated: Date.now() } : t)
                        syncWidgetData(state.goals, state.appointments, state.notes, newTasks);
                        return { tasks: newTasks }
                    });
                },

                addTaskGroup: (title, color) => set((state) => ({
                    taskGroups: [...(state.taskGroups || []), {
                        id: Math.random().toString(36).substring(7),
                        title,
                        color,
                        tasks: [],
                        createdAt: new Date().toISOString(),
                        lastUpdated: Date.now()
                    }]
                })),

                addTaskToGroup: (groupId, taskTitle) => set((state) => ({
                    taskGroups: (state.taskGroups || []).map(g => g.id === groupId ? {
                        ...g,
                        tasks: [...g.tasks, { id: Math.random().toString(36).substring(7), title: taskTitle, completed: false }],
                        lastUpdated: Date.now()
                    } : g)
                })),

                toggleTaskInGroup: (groupId, taskId) => set((state) => {
                    let celebrationToSet: { groupId: string, title: string } | null = null;
                    let autoDeleteGroup = false;
                    let taskTitle = "";
                    let wasChecked = false;

                    const group = (state.taskGroups || []).find(g => g.id === groupId);
                    if (!group) return {};

                    const task = group.tasks.find(t => t.id === taskId);
                    if (!task) return {};

                    const nextCompleted = !task.completed;
                    wasChecked = nextCompleted;
                    taskTitle = task.title;

                    let newCompletedOnceHabits = Array.isArray(state.completedOnceHabits) ? [...state.completedOnceHabits] : [];
                    if (wasChecked) {
                        newCompletedOnceHabits.push({
                            id: task.id,
                            title: taskTitle,
                            completedAt: new Date().toISOString()
                        });
                        const limitTime = Date.now() - 8 * 24 * 60 * 60 * 1000;
                        newCompletedOnceHabits = newCompletedOnceHabits.filter(h => new Date(h.completedAt).getTime() > limitTime);
                    }

                    let newGroups = (state.taskGroups || []).map(g => {
                        if (g.id !== groupId) return g;

                        if (g.isPinned) {
                            // If pinned and task is completed, delete the task immediately
                            const filteredTasks = wasChecked
                                ? g.tasks.filter(t => t.id !== taskId)
                                : g.tasks.map(t => t.id === taskId ? { ...t, completed: nextCompleted } : t);
                            return { ...g, tasks: filteredTasks, lastUpdated: Date.now() };
                        } else {
                            // If not pinned, toggle normally
                            const updatedTasks = g.tasks.map(t => t.id === taskId ? { ...t, completed: nextCompleted } : t);
                            const allCompleted = updatedTasks.length > 0 && updatedTasks.every(t => t.completed);

                            if (allCompleted) {
                                autoDeleteGroup = true;
                                celebrationToSet = { groupId: g.id, title: g.title };
                            }
                            return { ...g, tasks: updatedTasks, lastUpdated: Date.now() };
                        }
                    });

                    let deletedItems = state.deletedItems || {};
                    if (autoDeleteGroup) {
                        newGroups = newGroups.filter(g => g.id !== groupId);
                        deletedItems = { ...deletedItems, [groupId]: Date.now() };
                    }

                    return {
                        taskGroups: newGroups,
                        completedOnceHabits: newCompletedOnceHabits,
                        celebration: celebrationToSet,
                        deletedItems
                    };
                }),

                toggleTaskGroupPin: (groupId) => set((state) => ({
                    taskGroups: (state.taskGroups || []).map(g => g.id === groupId ? {
                        ...g,
                        isPinned: !g.isPinned,
                        lastUpdated: Date.now()
                    } : g)
                })),

                clearCelebration: () => set({ celebration: null }),

                deleteTaskGroup: (groupId) => set((state) => {
                    const newGroups = (state.taskGroups || []).filter(g => g.id !== groupId)
                    const deletedItems = { ...(state.deletedItems || {}), [groupId]: Date.now() };
                    return { taskGroups: newGroups, deletedItems }
                }),

                deleteTaskFromGroup: (groupId, taskId) => set((state) => ({
                    taskGroups: (state.taskGroups || []).map(g => g.id === groupId ? {
                        ...g,
                        tasks: g.tasks.filter(t => t.id !== taskId),
                        lastUpdated: Date.now()
                    } : g)
                })),

                setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
                setFocusEffectEnabled: (enabled) => set({ focusEffectEnabled: enabled }),

                startTaskGroupReminder: () => {
                    if (isNative) WidgetSync.startTaskGroupReminder().catch(console.error);
                },

                stopTaskGroupReminder: () => {
                    if (isNative) WidgetSync.stopTaskGroupReminder().catch(console.error);
                },

                setGoogleUser: (user) => set({ googleUser: user, googleSessionExpired: false }),

                downloadAttachment: async (noteId: string, blockId: string) => {
                    if (!isNative) return false;
                    const state = get();
                    const user = state.googleUser;
                    if (!user || !user.accessToken) return false;

                    const note = state.notes.find(n => n.id === noteId);
                    if (!note) return false;
                    const block = note.blocks.find(b => b.id === blockId);
                    if (!block || !block.driveFileId) return false;

                    let fileName = 'attachment';
                    if ((block.type === 'file' || block.type === 'video') && block.content?.name) fileName = block.content.name;
                    else if (block.type === 'image') fileName = 'image.png';

                    try {
                        const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
                        const localFileName = `attachment_${block.driveFileId}_${safeFileName}`;
                        
                        const result = await Filesystem.downloadFile({
                            url: `https://www.googleapis.com/drive/v3/files/${block.driveFileId}?alt=media`,
                            path: localFileName,
                            directory: Directory.Data,
                            headers: {
                                Authorization: `Bearer ${user.accessToken}`
                            }
                        });

                        if (result.path) {
                            let fileUri = result.path;
                            if (!fileUri.startsWith('file://') && !fileUri.startsWith('/')) {
                                // Sometimes it returns a relative path, get full uri
                                const uriRes = await Filesystem.getUri({ path: localFileName, directory: Directory.Data });
                                fileUri = uriRes.uri;
                            } else if (fileUri.startsWith('/')) {
                                fileUri = 'file://' + fileUri;
                            }

                            const now = Date.now();
                            const currentState = get();
                            const newNotes = currentState.notes.map(n => {
                                if (n.id === noteId) {
                                    return {
                                        ...n,
                                        lastUpdated: now,
                                        blocks: n.blocks.map(b => {
                                            if (b.id === blockId) {
                                                if (b.type === 'file' || b.type === 'video') {
                                                    return { ...b, content: { ...b.content, url: fileUri } };
                                                } else {
                                                    return { ...b, content: fileUri };
                                                }
                                            }
                                            return b;
                                        })
                                    };
                                }
                                return n;
                            });
                            
                            // Fix: Wait for persistence to finish before updating UI state (Single Source of Truth)
                            const allNotes = await readAllNotesFromDisk(currentState.notes);
                            const finalNotes = allNotes.map(n => {
                                if (n.id === noteId) {
                                    return {
                                        ...n,
                                        lastUpdated: now,
                                        blocks: n.blocks.map(b => {
                                            if (b.id === blockId) {
                                                if (b.type === 'file' || b.type === 'video') {
                                                    return { ...b, content: { ...b.content, url: fileUri } };
                                                } else {
                                                    return { ...b, content: fileUri };
                                                }
                                            }
                                            return b;
                                        })
                                    };
                                }
                                return n;
                            });
                            await saveAllNotesToDisk(finalNotes);

                            set((s) => {
                                const stateNotes = s.notes.map(n => {
                                    if (n.id === noteId) {
                                        return {
                                            ...n,
                                            lastUpdated: now,
                                            blocks: n.blocks.map(b => {
                                                if (b.id === blockId) {
                                                    if (b.type === 'file' || b.type === 'video') {
                                                        return { ...b, content: { ...b.content, url: fileUri } };
                                                    } else {
                                                        return { ...b, content: fileUri };
                                                    }
                                                }
                                                return b;
                                            })
                                        };
                                    }
                                    return n;
                                });
                                return { notes: stateNotes };
                            });
                            return true;
                        }
                    } catch (e) {
                        console.error('downloadAttachment error:', e);
                    }
                    return false;
                },

                resolveSyncConflict: async (keepLocal: boolean) => {
                    const conflict = get().syncConflict;
                    if (!conflict) return;

                    const user = get().googleUser;
                    if (!user || !user.accessToken) {
                        set({ syncConflict: null });
                        return;
                    }

                    set({ isSyncingCloud: true, syncConflict: null });

                    try {
                        const chosenData = keepLocal ? conflict.localData : conflict.remoteData;
                        const newTimestamp = Date.now();
                        const chosenNotes = chosenData.notes ? stripLargePayloads(chosenData.notes) : [];
                        const dataToUpload = { ...chosenData, notes: chosenNotes, lastUpdated: newTimestamp };

                        // Apply chosen data to local state
                        await saveAllNotesToDisk(chosenData.notes || []);
                        await saveAllTasksToDisk(chosenData.tasks || []);

                        originalSet({
                            notes: chosenData.notes || [],
                            tasks: chosenData.tasks || [],
                            goals: chosenData.goals || [],
                            appointments: chosenData.appointments || [],
                            projects: chosenData.projects || [],
                            taskGroups: chosenData.taskGroups || [],
                            completedOnceHabits: chosenData.completedOnceHabits || [],
                            transactions: chosenData.transactions || [],
                            savingsGoal: chosenData.savingsGoal ?? 400,
                            dailySnapshots: chosenData.dailySnapshots || {},
                            user: chosenData.user || get().user,
                            deletedItems: chosenData.deletedItems || {},
                            lastUpdated: newTimestamp,
                            areNotesLoaded: true,
                            areTasksLoaded: true
                        });

                        // Upload chosen version to Drive
                        const updateRes = await fetchWithTimeout(
                            `https://www.googleapis.com/upload/drive/v3/files/${conflict.fileId}?uploadType=media`,
                            {
                                method: 'PATCH',
                                headers: {
                                    Authorization: `Bearer ${user.accessToken}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(dataToUpload)
                            }
                        );

                        if (!updateRes.ok) {
                            const errBody = await updateRes.text().catch(() => 'Unknown error');
                            throw new Error(`Conflict resolve upload failed (${updateRes.status}): ${errBody}`);
                        }

                        set({
                            isSyncingCloud: false,
                            lastCloudSync: new Date().toLocaleString()
                        });

                        setTimeout(() => {
                            const s = get();
                            syncWidgetData(s.goals, s.appointments, s.notes, s.tasks).catch(console.error);
                        }, 0);

                        get().showToast(
                            get().language === 'es' ? 'Conflicto resuelto con éxito ✓' : 'Conflict resolved successfully ✓',
                            'success'
                        );
                    } catch (err: any) {
                        console.error('resolveSyncConflict error', err);
                        set({ isSyncingCloud: false, syncError: err?.message || String(err) });
                    }
                },

                syncWithGoogleDrive: async () => {
                    if (syncInProgress) {
                        console.log("[Sync] Ya hay una sincronización en curso, se omite esta llamada");
                        return false;
                    }
                    syncInProgress = true;
                    try {
                        if (get().isSyncingCloud) {
                            console.log("Cloud sync already in progress, skipping syncWithGoogleDrive.");
                            return false;
                        }
                    const user = get().googleUser;
                    if (!user) return false;

                    set({ isSyncingCloud: true, syncError: null });

                    if (user.isDemo) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        set({ isSyncingCloud: false, lastCloudSync: new Date().toLocaleString() });
                        return true;
                    }

                    try {
                        const token = user.accessToken;
                        if (!token) throw new Error("No access token");
                        await uploadMissingAttachments(token, get().notes);

                        const fullNotes = await readAllNotesFromDisk(get().notes);
                        const fullTasks = await readAllTasksFromDisk(get().tasks);

                        const searchRes = await fetchWithTimeout(
                            `https://www.googleapis.com/drive/v3/files?q=name='mynotes_backup.json' and trashed=false`,
                            {
                                headers: { Authorization: `Bearer ${token}` }
                            }
                        );
                        if (!searchRes.ok) {
                            const errBody = await searchRes.text().catch(() => "Unknown error");
                            throw new Error(`Search failed (${searchRes.status}): ${errBody}`);
                        }
                        const searchData = await searchRes.json();
                        const existingFile = searchData.files?.[0];

                        let dataToSync: any = null;

                        if (existingFile) {
                            // Fetch remote data first to merge it
                            const downloadRes = await fetchWithTimeout(
                                `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
                                {
                                    headers: { Authorization: `Bearer ${token}` }
                                }
                            );
                            if (!downloadRes.ok) {
                                const errBody = await downloadRes.text().catch(() => "Unknown error");
                                throw new Error(`Download before sync failed (${downloadRes.status}): ${errBody}`);
                            }

                            const driveData = await downloadRes.json();
                            const state = get();

                            const mergedDeletedItems = mergeDeletedItems(state.deletedItems, driveData.deletedItems);

                            const mergedNotes = mergeNotesLists(fullNotes, driveData.notes, true, mergedDeletedItems);
                            const mergedTasks = mergeLists(fullTasks, driveData.tasks, true, mergedDeletedItems);
                            const mergedGoals = mergeLists(state.goals, driveData.goals, true, mergedDeletedItems);
                            const mergedAppointments = mergeLists(state.appointments, driveData.appointments, true, mergedDeletedItems);
                            const mergedProjects = mergeLists(state.projects, driveData.projects, true, mergedDeletedItems);
                            const mergedTaskGroups = mergeLists(state.taskGroups, driveData.taskGroups, true, mergedDeletedItems);
                            const mergedCompletedOnceHabits = mergeLists(state.completedOnceHabits || [], driveData.completedOnceHabits || [], true, mergedDeletedItems);
                            const mergedTransactions = mergeLists(state.transactions || [], driveData.transactions || [], true, mergedDeletedItems);
                            const mergedSavingsGoal = driveData.lastUpdated && state.lastUpdated && state.lastUpdated > driveData.lastUpdated ? (state.savingsGoal ?? 400) : (driveData.savingsGoal ?? 400);
                            const mergedSnapshots = mergeDailySnapshots(state.dailySnapshots, driveData.dailySnapshots);
                            const mergedUser = mergeUser(state.user, driveData.user);
                            const newTimestamp = Date.now();

                            await saveAllNotesToDisk(mergedNotes);
                            await saveAllTasksToDisk(mergedTasks);

                            // Use originalSet to bypass lastUpdated wrapper override
                            originalSet({
                                notes: mergedNotes,
                                tasks: mergedTasks,
                                goals: mergedGoals,
                                appointments: mergedAppointments,
                                projects: mergedProjects,
                                taskGroups: mergedTaskGroups,
                                completedOnceHabits: mergedCompletedOnceHabits,
                                transactions: mergedTransactions,
                                savingsGoal: mergedSavingsGoal,
                                dailySnapshots: mergedSnapshots,
                                user: mergedUser,
                                deletedItems: mergedDeletedItems,
                                lastUpdated: newTimestamp,
                                areNotesLoaded: true,
                                areTasksLoaded: true
                            });

                            setTimeout(() => {
                                syncWidgetData(mergedGoals, mergedAppointments, mergedNotes, mergedTasks).catch(console.error);
                            }, 0);

                            dataToSync = {
                                notes: stripLargePayloads(mergedNotes),
                                tasks: mergedTasks,
                                goals: mergedGoals,
                                appointments: mergedAppointments,
                                projects: mergedProjects,
                                taskGroups: mergedTaskGroups,
                                completedOnceHabits: mergedCompletedOnceHabits,
                                transactions: mergedTransactions,
                                savingsGoal: mergedSavingsGoal,
                                dailySnapshots: mergedSnapshots,
                                user: mergedUser,
                                deletedItems: mergedDeletedItems,
                                lastUpdated: newTimestamp
                            };

                            const fileId = existingFile.id;
                            const updateRes = await fetchWithTimeout(
                                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
                                {
                                    method: 'PATCH',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(dataToSync)
                                }
                            );
                            if (!updateRes.ok) {
                                const errBody = await updateRes.text().catch(() => "Unknown error");
                                throw new Error(`Update failed (${updateRes.status}): ${errBody}`);
                            }
                        } else {
                            const state = get();
                            dataToSync = {
                                notes: stripLargePayloads(fullNotes),
                                tasks: fullTasks,
                                goals: state.goals,
                                appointments: state.appointments,
                                projects: state.projects,
                                taskGroups: state.taskGroups,
                                completedOnceHabits: state.completedOnceHabits || [],
                                transactions: state.transactions || [],
                                savingsGoal: state.savingsGoal || 400,
                                dailySnapshots: state.dailySnapshots,
                                user: state.user,
                                deletedItems: state.deletedItems || {},
                                lastUpdated: state.lastUpdated || Date.now()
                            };

                            const metadata = {
                                name: 'mynotes_backup.json',
                                mimeType: 'application/json'
                            };
                            const boundary = 'foo_bar_baz';
                            const body = [
                                `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`,
                                `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(dataToSync)}`,
                                `\r\n--${boundary}--`
                            ].join('');

                            const createRes = await fetchWithTimeout(
                                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                                {
                                    method: 'POST',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': `multipart/related; boundary=${boundary}`
                                    },
                                    body
                                }
                            );
                            if (!createRes.ok) {
                                const errBody = await createRes.text().catch(() => "Unknown error");
                                throw new Error(`Create failed (${createRes.status}): ${errBody}`);
                            }
                        }

                        set({ isSyncingCloud: false, lastCloudSync: new Date().toLocaleString() });
                        return true;
                    } catch (err: any) {
                        console.error("Google Drive sync error", err);
                        const msg = String(err).toLowerCase();
                        const isAuthError = msg.includes("401") || msg.includes("unauthenticated") || msg.includes("invalid credentials") || msg.includes("autherror") || msg.includes("auth_error");
                        if (isAuthError) {
                            // Intentar renovar el token silenciosamente antes de mostrar error al usuario
                            const newToken = await silentRefreshGoogleToken();
                            if (newToken) {
                                // Token renovado: reintentar sync una vez
                                set({ isSyncingCloud: false });
                                return get().syncWithGoogleDrive();
                            }
                            const errMsg = get().language === 'es'
                                ? "Sesión de Google expirada. Por favor, inicia sesión nuevamente."
                                : "Google session expired. Please sign in again.";
                            set({ googleSessionExpired: true, isSyncingCloud: false, syncError: errMsg });
                            get().showToast(get().language === 'es' ? "Debe reconectar su cuenta" : "Please reconnect your account", "error");
                        } else {
                            set({ isSyncingCloud: false, syncError: err?.message || String(err) });
                        }
                        return false;
                    }
                    } finally {
                        syncInProgress = false;
                    }
                },

                restoreFromGoogleDrive: async () => {
                    if (syncInProgress) {
                        console.log("[Sync] Ya hay una sincronización en curso, se omite esta llamada");
                        return false;
                    }
                    syncInProgress = true;
                    try {
                        if (get().isSyncingCloud) {
                            console.log("Cloud sync already in progress, skipping restoreFromGoogleDrive.");
                            return false;
                        }
                    const user = get().googleUser;
                    if (!user) return false;

                    set({ isSyncingCloud: true, syncError: null });

                    if (user.isDemo) {
                        await new Promise(resolve => setTimeout(resolve, 1500));

                        const today = getLocalDateString();
                        set((state) => {
                            const demoTask = {
                                id: 'demo-task-1',
                                title: 'Sincronización completada ☁️',
                                completed: false,
                                energyLevel: 'Low' as const,
                                projectId: 'p1',
                                dueDate: today,
                                recurrence: 'None' as const,
                                completedDates: [],
                                photos: [],
                                completionTimes: [],
                            };

                            const demoNote = {
                                id: 'demo-note-1',
                                title: '☁️ Bienvenido a MyNotes Cloud',
                                createdAt: new Date().toISOString(),
                                tags: ['Cloud'],
                                blocks: [
                                    { id: 'b1', type: 'text' as const, content: 'Tus datos se sincronizaron con éxito. Esta es una nota de demostración cargada desde la nube de forma segura.' }
                                ]
                            };

                            const cleanTasks = state.tasks.filter(t => t.id !== 'demo-task-1');
                            const cleanNotes = state.notes.filter(n => n.id !== 'demo-note-1');

                            const newTasks = [...cleanTasks, demoTask];
                            const newNotes = [...cleanNotes, demoNote];

                            setTimeout(() => {
                                syncWidgetData(state.goals, state.appointments, newNotes, newTasks).catch(console.error);
                            }, 0);

                            return {
                                tasks: newTasks,
                                notes: newNotes,
                                isSyncingCloud: false,
                                lastCloudSync: new Date().toLocaleString()
                            };
                        });
                        return true;
                    }

                    try {
                        const token = user.accessToken;
                        if (!token) throw new Error("No access token");
                        await uploadMissingAttachments(token, get().notes);

                        const searchRes = await fetchWithTimeout(
                            `https://www.googleapis.com/drive/v3/files?q=name='mynotes_backup.json' and trashed=false`,
                            {
                                headers: { Authorization: `Bearer ${token}` }
                            }
                        );
                        if (!searchRes.ok) {
                            const errBody = await searchRes.text().catch(() => "Unknown error");
                            throw new Error(`Search failed (${searchRes.status}): ${errBody}`);
                        }
                        const searchData = await searchRes.json();
                        const existingFile = searchData.files?.[0];
                        if (!existingFile) {
                            set({ isSyncingCloud: false });
                            return false;
                        }

                        const downloadRes = await fetchWithTimeout(
                            `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
                            {
                                headers: { Authorization: `Bearer ${token}` }
                            }
                        );
                        if (!downloadRes.ok) {
                            const errBody = await downloadRes.text().catch(() => "Unknown error");
                            throw new Error(`Download failed (${downloadRes.status}): ${errBody}`);
                        }

                        const data = await downloadRes.json();
                        if (data && typeof data === 'object') {
                            const state = get();
                            const fullNotes = await readAllNotesFromDisk(state.notes);
                            const fullTasks = await readAllTasksFromDisk(state.tasks);

                            const mergedDeletedItems = mergeDeletedItems(state.deletedItems, data.deletedItems);
                            const mergedNotes = mergeNotesLists(fullNotes, data.notes, false, mergedDeletedItems);
                            const mergedTasks = mergeLists(fullTasks, data.tasks, false, mergedDeletedItems);
                            const mergedGoals = mergeLists(state.goals, data.goals, false, mergedDeletedItems);
                            const mergedAppointments = mergeLists(state.appointments, data.appointments, false, mergedDeletedItems);
                            const mergedProjects = mergeLists(state.projects, data.projects, false, mergedDeletedItems);
                            const mergedTaskGroups = mergeLists(state.taskGroups, data.taskGroups, false, mergedDeletedItems);
                            const mergedCompletedOnceHabits = mergeLists(state.completedOnceHabits || [], data.completedOnceHabits || [], false, mergedDeletedItems);
                            const mergedTransactions = mergeLists(state.transactions || [], data.transactions || [], false, mergedDeletedItems);
                            const mergedSavingsGoal = data.savingsGoal ?? 400;
                            const mergedSnapshots = mergeDailySnapshots(state.dailySnapshots, data.dailySnapshots);
                            const mergedUser = mergeUser(state.user, data.user);

                            // Identify missing attachments
                            const missingAttachments: { noteId: string, blockId: string, driveFileId: string, fileName: string }[] = [];
                            if (isNative) {
                                for (const note of mergedNotes) {
                                    for (const block of note.blocks) {
                                        if ((block.type === 'image' || block.type === 'drawing' || block.type === 'file') && block.driveFileId) {
                                            let localPath = '';
                                            let fileName = 'attachment';
                                            if (block.type === 'file' && block.content) {
                                                localPath = block.content.url;
                                                fileName = block.content.name || 'file';
                                            } else if (typeof block.content === 'string') {
                                                localPath = block.content;
                                                fileName = 'image.png';
                                            }
                                            
                                            let needsDownload = false;
                                            if (!localPath || !localPath.startsWith('file://')) {
                                                needsDownload = true;
                                            } else {
                                                try {
                                                    const res = await Filesystem.stat({ path: localPath.replace('file://', '') });
                                                    if (!res || res.type === 'directory') needsDownload = true;
                                                } catch(e) {
                                                    needsDownload = true;
                                                }
                                            }
                                            
                                            if (needsDownload) {
                                                missingAttachments.push({ noteId: note.id, blockId: block.id, driveFileId: block.driveFileId, fileName });
                                            }
                                        }
                                    }
                                }
                            }

                            // Download missing attachments sequentially with progress
                            let downloadedCount = 0;
                            const totalToDownload = missingAttachments.length;
                            for (const attachment of missingAttachments) {
                                downloadedCount++;
                                const lang = get().language;
                                const progressMsg = lang === 'es' 
                                    ? `Restaurando adjuntos... ${downloadedCount}/${totalToDownload}`
                                    : `Restoring attachments... ${downloadedCount}/${totalToDownload}`;
                                set({ restoreProgress: progressMsg });
                                
                                try {
                                    const safeFileName = attachment.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
                                    const localFileName = `attachment_${attachment.driveFileId}_${safeFileName}`;
                                    
                                    const dlResult = await Filesystem.downloadFile({
                                        url: `https://www.googleapis.com/drive/v3/files/${attachment.driveFileId}?alt=media`,
                                        path: localFileName,
                                        directory: Directory.Data,
                                        headers: {
                                            Authorization: `Bearer ${token}`
                                        }
                                    });

                                    if (dlResult.path) {
                                        let fileUri = dlResult.path;
                                        if (!fileUri.startsWith('file://') && !fileUri.startsWith('/')) {
                                            const uriRes = await Filesystem.getUri({ path: localFileName, directory: Directory.Data });
                                            fileUri = uriRes.uri;
                                        } else if (fileUri.startsWith('/')) {
                                            fileUri = 'file://' + fileUri;
                                        }

                                        // Update block content in mergedNotes
                                        const noteToUpdate = mergedNotes.find(n => n.id === attachment.noteId);
                                        if (noteToUpdate) {
                                            const blockToUpdate = noteToUpdate.blocks.find(b => b.id === attachment.blockId);
                                            if (blockToUpdate) {
                                                if (blockToUpdate.type === 'file') {
                                                    blockToUpdate.content = { ...blockToUpdate.content, url: fileUri };
                                                } else {
                                                    blockToUpdate.content = fileUri;
                                                }
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.error('Failed to download attachment during restore:', e);
                                }
                            }
                            if (totalToDownload > 0) {
                                set({ restoreProgress: null });
                            }

                            await saveAllNotesToDisk(mergedNotes);
                            await saveAllTasksToDisk(mergedTasks);

                            setTimeout(() => {
                                syncWidgetData(mergedGoals, mergedAppointments, mergedNotes, mergedTasks).catch(console.error);
                            }, 0);

                            // Use originalSet to bypass lastUpdated wrapper override
                            originalSet({
                                notes: mergedNotes,
                                tasks: mergedTasks,
                                goals: mergedGoals,
                                appointments: mergedAppointments,
                                projects: mergedProjects,
                                taskGroups: mergedTaskGroups,
                                completedOnceHabits: mergedCompletedOnceHabits,
                                transactions: mergedTransactions,
                                savingsGoal: mergedSavingsGoal,
                                dailySnapshots: mergedSnapshots,
                                user: mergedUser,
                                deletedItems: mergedDeletedItems,
                                isSyncingCloud: false,
                                lastCloudSync: new Date().toLocaleString(),
                                lastUpdated: data.lastUpdated || Date.now(),
                                areNotesLoaded: true,
                                areTasksLoaded: true
                            });
                            return true;
                        }
                        set({ isSyncingCloud: false });
                        return false;
                    } catch (err: any) {
                        console.error("Google Drive restore error", err);
                        const msg = String(err).toLowerCase();
                        const isAuthError = msg.includes("401") || msg.includes("unauthenticated") || msg.includes("invalid credentials") || msg.includes("autherror") || msg.includes("auth_error");
                        if (isAuthError) {
                            // Intentar renovar el token silenciosamente antes de mostrar error al usuario
                            const newToken = await silentRefreshGoogleToken();
                            if (newToken) {
                                set({ isSyncingCloud: false });
                                return get().restoreFromGoogleDrive();
                            }
                            const errMsg = get().language === 'es'
                                ? "Sesión de Google expirada. Por favor, inicia sesión nuevamente."
                                : "Google session expired. Please sign in again.";
                            set({ googleSessionExpired: true, isSyncingCloud: false, syncError: errMsg });
                            get().showToast(get().language === 'es' ? "Debe reconectar su cuenta" : "Please reconnect your account", "error");
                        } else {
                            set({ isSyncingCloud: false, syncError: err?.message || String(err) });
                        }
                        return false;
                    }
                    } finally {
                        syncInProgress = false;
                    }
                },

                autoSyncGoogleDrive: async () => {
                    if (syncInProgress) {
                        console.log("[Sync] Ya hay una sincronización en curso, se omite esta llamada");
                        return false;
                    }
                    syncInProgress = true;
                    try {
                        if (get().isSyncingCloud) {
                            console.log("Cloud sync already in progress, skipping autoSyncGoogleDrive.");
                            return false;
                        }
                    const user = get().googleUser;
                    if (!user) return false;

                    set({ isSyncingCloud: true, syncError: null });

                    if (user.isDemo) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        set({ isSyncingCloud: false, lastCloudSync: new Date().toLocaleString() });
                        return true;
                    }

                    try {
                        const token = user.accessToken;
                        if (!token) throw new Error("No access token");
                        await uploadMissingAttachments(token, get().notes);

                        const searchRes = await fetchWithTimeout(
                            `https://www.googleapis.com/drive/v3/files?q=name='mynotes_backup.json' and trashed=false`,
                            {
                                headers: { Authorization: `Bearer ${token}` }
                            }
                        );
                        if (!searchRes.ok) {
                            const errBody = await searchRes.text().catch(() => "Unknown error");
                            throw new Error(`Search failed (${searchRes.status}): ${errBody}`);
                        }
                        const searchData = await searchRes.json();
                        const existingFile = searchData.files?.[0];

                        if (!existingFile) {
                            console.log("No backup file found in Drive. Uploading local state as first sync...");
                            const freshState = get();
                            const fullNotes = await readAllNotesFromDisk(freshState.notes);
                            const fullTasks = await readAllTasksFromDisk(freshState.tasks);
                            const localLastUpdated = freshState.lastUpdated || 0;
                            const dataToSync = {
                                notes: stripLargePayloads(fullNotes),
                                tasks: fullTasks,
                                goals: freshState.goals,
                                appointments: freshState.appointments,
                                projects: freshState.projects,
                                taskGroups: freshState.taskGroups,
                                completedOnceHabits: freshState.completedOnceHabits || [],
                                transactions: freshState.transactions || [],
                                savingsGoal: freshState.savingsGoal || 400,
                                dailySnapshots: freshState.dailySnapshots,
                                user: freshState.user,
                                deletedItems: freshState.deletedItems || {},
                                lastUpdated: localLastUpdated
                            };
                            const jsonStr = JSON.stringify(dataToSync);

                            const metadata = {
                                name: 'mynotes_backup.json',
                                mimeType: 'application/json'
                            };
                            const boundary = 'foo_bar_baz';
                            const body = [
                                `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`,
                                `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${jsonStr}`,
                                `\r\n--${boundary}--`
                            ].join('');

                            const createRes = await fetchWithTimeout(
                                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                                {
                                    method: 'POST',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': `multipart/related; boundary=${boundary}`
                                    },
                                    body
                                }
                            );
                            if (!createRes.ok) {
                                const errBody = await createRes.text().catch(() => "Unknown error");
                                throw new Error(`Create failed (${createRes.status}): ${errBody}`);
                            }

                            set({ isSyncingCloud: false, lastCloudSync: new Date().toLocaleString() });
                            return true;
                        }

                        console.log("Backup file found in Drive. Downloading to compare timestamps...");
                        const downloadRes = await fetchWithTimeout(
                            `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
                            {
                                headers: { Authorization: `Bearer ${token}` }
                            }
                        );
                        if (!downloadRes.ok) {
                            const errBody = await downloadRes.text().catch(() => "Unknown error");
                            throw new Error(`Download failed (${downloadRes.status}): ${errBody}`);
                        }

                        const driveData = await downloadRes.json();
                        const driveLastUpdated = (driveData && driveData.lastUpdated) || 0;

                        const freshState = get();
                        const localLastUpdated = freshState.lastUpdated || 0;

                        console.log(`[Sync] Timestamps — Local: ${localLastUpdated}, Drive: ${driveLastUpdated}`);

                        // ── Helper to count real items with content ──────────────────────────
                        const driveHasData = [
                            driveData.notes, driveData.tasks, driveData.goals, driveData.appointments
                        ].some(arr => Array.isArray(arr) && arr.length > 0);

                        // ── Read disk data to ensure in-memory state didn't miss anything ──────
                        // The in-memory state might be empty if notes/tasks weren't loaded yet,
                        // but the disk (via readAllNotesFromDisk) always has the full dataset.
                        const diskNotes = await readAllNotesFromDisk(freshState.notes);
                        const diskTasks = await readAllTasksFromDisk(freshState.tasks);

                        const localHasData = [
                            diskNotes, diskTasks, freshState.goals, freshState.appointments
                        ].some(arr => Array.isArray(arr) && arr.length > 0);

                        // ── Case 1: Local is fresh/empty, Drive has real data → pull from Drive ─
                        if (!localHasData && driveHasData) {
                            console.log('[Sync] Local has no data but Drive does → pulling from Drive.');
                            const mergedDeletedItems = mergeDeletedItems(freshState.deletedItems, driveData.deletedItems);

                            await saveAllNotesToDisk(driveData.notes || []);
                            await saveAllTasksToDisk(driveData.tasks || []);

                            originalSet({
                                notes: driveData.notes || [],
                                tasks: driveData.tasks || [],
                                goals: driveData.goals || [],
                                appointments: driveData.appointments || [],
                                projects: driveData.projects || [],
                                taskGroups: driveData.taskGroups || [],
                                completedOnceHabits: driveData.completedOnceHabits || [],
                                transactions: driveData.transactions || [],
                                savingsGoal: driveData.savingsGoal ?? 400,
                                dailySnapshots: driveData.dailySnapshots || {},
                                user: mergeUser(freshState.user, driveData.user),
                                deletedItems: mergedDeletedItems,
                                lastUpdated: driveLastUpdated,
                                isSyncingCloud: false,
                                lastCloudSync: new Date().toLocaleString(),
                                areNotesLoaded: true,
                                areTasksLoaded: true
                            });

                            setTimeout(() => {
                                const s = get();
                                syncWidgetData(s.goals, s.appointments, s.notes, s.tasks).catch(console.error);
                            }, 0);
                            return true;
                        }

                        // ── Case 2: Drive is empty but Local has data → push to Drive ──────────
                        if (localHasData && !driveHasData) {
                            console.log('[Sync] Local has data but Drive does not → pushing to Drive.');
                            // Re-use diskNotes/diskTasks already read above (avoids double disk read)
                            const fullNotes = diskNotes;
                            const fullTasks = diskTasks;
                            const newTimestamp = Date.now();
                            const dataToUpload = {
                                notes: stripLargePayloads(fullNotes),
                                tasks: fullTasks,
                                goals: freshState.goals,
                                appointments: freshState.appointments,
                                projects: freshState.projects,
                                taskGroups: freshState.taskGroups,
                                completedOnceHabits: freshState.completedOnceHabits || [],
                                transactions: freshState.transactions || [],
                                savingsGoal: freshState.savingsGoal ?? 400,
                                dailySnapshots: freshState.dailySnapshots,
                                user: freshState.user,
                                deletedItems: freshState.deletedItems || {},
                                lastUpdated: newTimestamp
                            };

                            const uploadRes = await fetchWithTimeout(
                                `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
                                {
                                    method: 'PATCH',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(dataToUpload)
                                }
                            );
                            if (!uploadRes.ok) {
                                const errBody = await uploadRes.text().catch(() => 'Unknown error');
                                throw new Error(`Upload failed (${uploadRes.status}): ${errBody}`);
                            }

                            originalSet({ lastUpdated: newTimestamp, isSyncingCloud: false, lastCloudSync: new Date().toLocaleString() });
                            return true;
                        }

                        // ── Case 3: Timestamps differ → merge (existing logic) ─────────────────
                        if (localLastUpdated !== driveLastUpdated) {
                            const useLocalForConflicts = localLastUpdated > driveLastUpdated;
                            console.log(`[Sync] Timestamps differ. Merging. Local is newer: ${useLocalForConflicts}`);

                            // Re-use diskNotes/diskTasks already read above (avoids double disk read)
                            const fullNotes = diskNotes;
                            const fullTasks = diskTasks;

                            const mergedDeletedItems = mergeDeletedItems(freshState.deletedItems, driveData.deletedItems);
                            const mergedNotes = mergeNotesLists(fullNotes, driveData.notes, useLocalForConflicts, mergedDeletedItems);
                            const mergedTasks = mergeLists(fullTasks, driveData.tasks, useLocalForConflicts, mergedDeletedItems);
                            const mergedGoals = mergeLists(freshState.goals, driveData.goals, useLocalForConflicts, mergedDeletedItems);
                            const mergedAppointments = mergeLists(freshState.appointments, driveData.appointments, useLocalForConflicts, mergedDeletedItems);
                            const mergedProjects = mergeLists(freshState.projects, driveData.projects, useLocalForConflicts, mergedDeletedItems);
                            const mergedTaskGroups = mergeLists(freshState.taskGroups, driveData.taskGroups, useLocalForConflicts, mergedDeletedItems);
                            const mergedCompletedOnceHabits = mergeLists(freshState.completedOnceHabits || [], driveData.completedOnceHabits || [], useLocalForConflicts, mergedDeletedItems);
                            const mergedTransactions = mergeLists(freshState.transactions || [], driveData.transactions || [], useLocalForConflicts, mergedDeletedItems);
                            const mergedSavingsGoal = useLocalForConflicts ? (freshState.savingsGoal ?? 400) : (driveData.savingsGoal ?? 400);
                            const mergedSnapshots = mergeDailySnapshots(freshState.dailySnapshots, driveData.dailySnapshots);
                            const mergedUser = mergeUser(freshState.user, driveData.user);
                            const newTimestamp = Math.max(localLastUpdated, driveLastUpdated);

                            await saveAllNotesToDisk(mergedNotes);
                            await saveAllTasksToDisk(mergedTasks);

                            originalSet({
                                notes: mergedNotes,
                                tasks: mergedTasks,
                                goals: mergedGoals,
                                appointments: mergedAppointments,
                                projects: mergedProjects,
                                taskGroups: mergedTaskGroups,
                                completedOnceHabits: mergedCompletedOnceHabits,
                                transactions: mergedTransactions,
                                savingsGoal: mergedSavingsGoal,
                                dailySnapshots: mergedSnapshots,
                                user: mergedUser,
                                deletedItems: mergedDeletedItems,
                                lastUpdated: newTimestamp,
                                isSyncingCloud: false,
                                lastCloudSync: new Date().toLocaleString(),
                                areNotesLoaded: true,
                                areTasksLoaded: true
                            });

                            setTimeout(() => {
                                syncWidgetData(mergedGoals, mergedAppointments, mergedNotes, mergedTasks).catch(console.error);
                            }, 0);

                            const dataToUpload = {
                                notes: stripLargePayloads(mergedNotes),
                                tasks: mergedTasks,
                                goals: mergedGoals,
                                appointments: mergedAppointments,
                                projects: mergedProjects,
                                taskGroups: mergedTaskGroups,
                                completedOnceHabits: mergedCompletedOnceHabits,
                                transactions: mergedTransactions,
                                savingsGoal: mergedSavingsGoal,
                                dailySnapshots: mergedSnapshots,
                                user: mergedUser,
                                deletedItems: mergedDeletedItems,
                                lastUpdated: newTimestamp
                            };

                            const fileId = existingFile.id;
                            const updateRes = await fetchWithTimeout(
                                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
                                {
                                    method: 'PATCH',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(dataToUpload)
                                }
                            );
                            if (!updateRes.ok) {
                                const errBody = await updateRes.text().catch(() => "Unknown error");
                                throw new Error(`Update failed (${updateRes.status}): ${errBody}`);
                            }
                            return true;
                        }

                        // ── Case 4: Same timestamps AND both have data → check for real differences ──
                        // If content actually differs, ask the user which version to keep.
                        console.log('[Sync] Same timestamp and both have data. Checking for content differences...');

                        const localNoteIds = new Set((freshState.notes || []).map((n: any) => n.id));
                        const driveNoteIds = new Set((driveData.notes || []).map((n: any) => n.id));
                        const noteCountDiffers = localNoteIds.size !== driveNoteIds.size;
                        const localTaskCount = (freshState.tasks || []).length;
                        const driveTaskCount = (driveData.tasks || []).length;

                        if (noteCountDiffers || localTaskCount !== driveTaskCount) {
                            // Real differences found — trigger conflict dialog
                            console.log('[Sync] Real content differences detected with same timestamp → showing conflict dialog.');
                            const fullNotes = await readAllNotesFromDisk(freshState.notes);
                            const fullTasks = await readAllTasksFromDisk(freshState.tasks);

                            const localSnapshot = {
                                notes: fullNotes,
                                tasks: fullTasks,
                                goals: freshState.goals,
                                appointments: freshState.appointments,
                                projects: freshState.projects,
                                taskGroups: freshState.taskGroups,
                                completedOnceHabits: freshState.completedOnceHabits || [],
                                transactions: freshState.transactions || [],
                                savingsGoal: freshState.savingsGoal ?? 400,
                                dailySnapshots: freshState.dailySnapshots,
                                user: freshState.user,
                                deletedItems: freshState.deletedItems || {},
                            };

                            set({
                                isSyncingCloud: false,
                                syncConflict: {
                                    localData: localSnapshot,
                                    remoteData: driveData,
                                    fileId: existingFile.id,
                                    localTimestamp: localLastUpdated,
                                    remoteTimestamp: driveLastUpdated,
                                }
                            });
                            return false; // Awaiting user resolution
                        }

                        // Truly identical — no action needed
                        console.log('[Sync] Identical timestamps and content. No action needed.');
                        set({ isSyncingCloud: false });
                        return true;

                    } catch (err: any) {
                        console.error("Google Drive autoSync error", err);
                        const msg = String(err).toLowerCase();
                        const isAuthError = msg.includes("401") || msg.includes("unauthenticated") || msg.includes("invalid credentials") || msg.includes("autherror") || msg.includes("auth_error");
                        if (isAuthError) {
                            // Intentar renovar el token silenciosamente antes de mostrar error al usuario
                            const newToken = await silentRefreshGoogleToken();
                            if (newToken) {
                                set({ isSyncingCloud: false });
                                return get().autoSyncGoogleDrive();
                            }
                            const errMsg = get().language === 'es'
                                ? "Sesión de Google expirada. Por favor, inicia sesión nuevamente."
                                : "Google session expired. Please sign in again.";
                            set({ googleSessionExpired: true, isSyncingCloud: false, syncError: errMsg });
                            get().showToast(get().language === 'es' ? "Debe reconectar su cuenta" : "Please reconnect your account", "error");
                        } else {
                            set({ isSyncingCloud: false, syncError: err?.message || String(err) });
                        }
                        return false;
                    }
                    } finally {
                        syncInProgress = false;
                    }
                }
            };
        },
        {
            name: 'mynotes-storage-v1',
            storage: {
                getItem: async (name: string) => {
                    const str = await capacitorStorage.getItem(name);
                    if (!str) return null;
                    try {
                        return JSON.parse(str);
                    } catch (e) {
                        console.error('Failed to parse state', e);
                        return null;
                    }
                },
                setItem: async (name: string, value: any) => {
                    if (!syncWorker) {
                        await capacitorStorage.setItem(name, JSON.stringify(value));
                        return;
                    }
                    return new Promise<void>((resolve) => {
                        const handleMessage = (e: MessageEvent) => {
                            if (e.data.name === name) {
                                syncWorker!.removeEventListener('message', handleMessage);
                                if (e.data.error) {
                                    console.error('Worker serialization failed', e.data.error);
                                    capacitorStorage.setItem(name, JSON.stringify(value)).then(resolve);
                                } else {
                                    capacitorStorage.setItem(name, e.data.serialized).then(resolve);
                                }
                            }
                        };
                        syncWorker!.addEventListener('message', handleMessage);
                        syncWorker!.postMessage({ name, state: value });
                    });
                },
                removeItem: async (name: string) => {
                    await capacitorStorage.removeItem(name);
                }
            },
            onRehydrateStorage: (state) => {
                return (rehydratedState, error) => {
                    if (error) {
                        console.error("Hydration error:", error);
                    }
                    // Set isHydrated to true when hydration finishes
                    useStore.setState({ isHydrated: true });
                };
            },
            partialize: (state) => {
                const serializableState: any = {};
                for (const key in state) {
                    if (typeof state[key as keyof AppState] !== 'function') {
                        serializableState[key] = state[key as keyof AppState];
                    }
                }
                const { isSyncingCloud, syncError, tourStep, isTourManuallyStarted, ...rest } = serializableState;
                return {
                    ...rest,
                    areNotesLoaded: true,
                    areTasksLoaded: true
                };
            }
        }
    )
)

if (isNative) {
    App.addListener('appStateChange', async (state) => {
        if (!state.isActive) {
            // Flush widget sync immediately
            try {
                await syncWidgetData(undefined, undefined, undefined, undefined, true);
            } catch (err) {
                console.error("Flush widget sync on pause error", err);
            }

            // App is going to background, flush all pending writes immediately to prevent data loss
            for (const name of Object.keys(pendingWrites)) {
                if (writeDebounces[name]) {
                    clearTimeout(writeDebounces[name]);
                    delete writeDebounces[name];
                }
                const dataToWrite = pendingWrites[name];
                if (dataToWrite && dataToWrite !== '{}') {
                    try {
                        // 1. Backup the current file before overwriting
                        try {
                            const existing = await Filesystem.readFile({
                                path: `${name}.json`,
                                directory: Directory.Data,
                                encoding: Encoding.UTF8,
                            });
                            if (existing.data) {
                                await Filesystem.writeFile({
                                    path: `${name}.bak.json`,
                                    data: existing.data,
                                    directory: Directory.Data,
                                    encoding: Encoding.UTF8,
                                });
                            }
                        } catch (e) { }

                        // 2. Write the new data
                        await Filesystem.writeFile({
                            path: `${name}.json`,
                            data: dataToWrite,
                            directory: Directory.Data,
                            encoding: Encoding.UTF8,
                        });
                    } catch (e) {
                        console.error('Flush on pause error', e);
                    }
                }
            }
        }
    });
}

export const checkAndEnqueueMissingImages = async () => {
    if (!isNative) return;
    const state = useStore.getState();
    const token = state.googleUser?.accessToken;
    if (!token) return;

    for (const note of state.notes) {
        if (!note.blocks) continue;
        for (const block of note.blocks) {
            if ((block.type === 'image' || block.type === 'drawing' || block.type === 'file') && block.driveFileId && !block.isDownloading) {
                let needsDownload = false;
                let fileUri = '';

                if (block.type === 'file') {
                    if (!block.content || !block.content.url) needsDownload = true;
                    else fileUri = block.content.url;
                } else {
                    if (!block.content) needsDownload = true;
                    else if (typeof block.content === 'string') fileUri = block.content;
                }

                if (fileUri && fileUri.startsWith('file://')) {
                    try {
                        const localSrc = Capacitor.convertFileSrc(fileUri);
                        const res = await fetch(localSrc, { method: 'HEAD' });
                        if (!res.ok) needsDownload = true;
                    } catch (e) {
                        needsDownload = true;
                    }
                }

                if (needsDownload) {
                    state.setBlockDownloading(note.id, block.id, true);
                    let fileNameStr = '';
                    if (block.type === 'file' && block.content && block.content.name) {
                        fileNameStr = block.content.name;
                    }
                    WidgetSync.enqueueImageDownload({
                        token,
                        driveFileId: block.driveFileId,
                        noteId: note.id,
                        blockId: block.id,
                        fileName: fileNameStr
                    } as any).catch(console.error);
                }
            }
        }
    }
};

useStore.subscribe((state, prevState) => {
    if (state.lastCloudSync !== prevState.lastCloudSync && state.lastCloudSync) {
        setTimeout(() => checkAndEnqueueMissingImages().catch(console.error), 1000);
    }
});

/**
 * Scans the revision history of mynotes_backup.json in Google Drive looking for
 * revisions that contain base64 image data for blocks whose current content is broken
 * (empty string or a non-existent file path).
 *
 * For each recovered block it:
 *   1. Saves the base64 as a local file (native) or keeps it as base64 (web)
 *   2. Updates the block content in the current Zustand state
 *   3. Triggers an autosave
 *
 * Returns a summary of { recovered, failed, message }.
 */
export const recoverImagesFromDriveRevisions = async (): Promise<{ recovered: number; failed: number; message: string }> => {
    const state = useStore.getState();
    const token = state.googleUser?.accessToken;

    if (!token) {
        return { recovered: 0, failed: 0, message: 'No Google session active. Please sign in first.' };
    }

    // 1. Find the backup file in Drive
    console.log('[Recovery] Searching for mynotes_backup.json in Drive...');
    let fileId: string | null = null;
    try {
        const searchRes = await fetchWithTimeout(
            `https://www.googleapis.com/drive/v3/files?q=name='mynotes_backup.json' and trashed=false&fields=files(id,name)`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!searchRes.ok) throw new Error(`Drive search failed: ${searchRes.status}`);
        const searchData = await searchRes.json();
        fileId = searchData.files?.[0]?.id ?? null;
    } catch (e) {
        console.error('[Recovery] Could not find backup file:', e);
        return { recovered: 0, failed: 0, message: `Could not reach Drive: ${String(e)}` };
    }

    if (!fileId) {
        return { recovered: 0, failed: 0, message: 'No backup file found in Drive. Sync at least once first.' };
    }

    // 2. List revisions (newest first)
    console.log(`[Recovery] Listing revisions for file ${fileId}...`);
    let revisions: any[] = [];
    try {
        const revRes = await fetchWithTimeout(
            `https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,modifiedTime)`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!revRes.ok) throw new Error(`Revisions fetch failed: ${revRes.status}`);
        const revData = await revRes.json();
        // Reverse so we iterate from most recent to oldest
        revisions = (revData.revisions || []).slice().reverse();
    } catch (e) {
        console.error('[Recovery] Could not list revisions:', e);
        return { recovered: 0, failed: 0, message: `Could not list Drive revisions: ${String(e)}` };
    }

    if (revisions.length === 0) {
        return { recovered: 0, failed: 0, message: 'Drive has no revision history for the backup file.' };
    }

    console.log(`[Recovery] Found ${revisions.length} revisions. Scanning for lost base64 images...`);

    // 3. Identify blocks that need recovery (empty or non-file content in image blocks)
    const brokenBlocks: Array<{ noteId: string; blockId: string }> = [];
    for (const note of state.notes) {
        if (!note.blocks) continue;
        for (const block of note.blocks) {
            if (block.type !== 'image' && block.type !== 'drawing') continue;
            const content = typeof block.content === 'string' ? block.content : '';
            // Broken = empty, or a file:// path that might no longer exist
            const isBroken = !content || (content.startsWith('file://') && !content.startsWith('data:'));
            if (isBroken) {
                brokenBlocks.push({ noteId: note.id, blockId: block.id });
            }
        }
    }

    if (brokenBlocks.length === 0) {
        return { recovered: 0, failed: 0, message: 'No broken image blocks detected. All images look healthy!' };
    }

    console.log(`[Recovery] ${brokenBlocks.length} broken block(s) to recover:`, brokenBlocks);

    let recovered = 0;
    let failed = 0;
    // Track which blocks we already recovered so we stop scanning older revisions for them
    const recoveredSet = new Set<string>();

    // 4. For each revision, download the JSON and try to fill broken blocks
    for (const revision of revisions) {
        // Stop early if everything is recovered
        const remaining = brokenBlocks.filter(b => !recoveredSet.has(`${b.noteId}/${b.blockId}`));
        if (remaining.length === 0) break;

        console.log(`[Recovery] Checking revision ${revision.id} (${revision.modifiedTime})...`);
        let revisionData: any = null;

        try {
            const dlRes = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revision.id}?alt=media`,
                { headers: { Authorization: `Bearer ${token}` } },
                30000 // Larger timeout for potentially big files
            );
            if (!dlRes.ok) {
                console.warn(`[Recovery] Revision ${revision.id} download failed: ${dlRes.status}`);
                continue;
            }
            revisionData = await dlRes.json();
        } catch (e) {
            console.warn(`[Recovery] Revision ${revision.id} error:`, e);
            continue;
        }

        if (!revisionData?.notes || !Array.isArray(revisionData.notes)) continue;

        // 5. Look for each broken block in this revision's notes
        for (const { noteId, blockId } of remaining) {
            const key = `${noteId}/${blockId}`;
            const revNote = revisionData.notes.find((n: any) => n.id === noteId);
            if (!revNote?.blocks) continue;

            const revBlock = revNote.blocks.find((b: any) => b.id === blockId);
            if (!revBlock) continue;

            const content = typeof revBlock.content === 'string' ? revBlock.content : '';
            if (!content.startsWith('data:image')) continue; // Not base64, skip

            console.log(`[Recovery] Found base64 for block ${blockId} in note ${noteId} (revision ${revision.id}). Restoring...`);

            try {
                const { saveBase64ImageToFile } = await import('./image-utils');
                const uri = await saveBase64ImageToFile(content);
                const finalContent = uri || content; // uri on native, base64 on web

                console.log(`[Recovery] Saved as: ${finalContent.substring(0, 80)}...`);
                state.updateNoteBlockContent(noteId, blockId, finalContent);
                recoveredSet.add(key);
                recovered++;
            } catch (e) {
                console.error(`[Recovery] Failed to save block ${blockId}:`, e);
                failed++;
            }
        }
    }

    // 6. Persist recovered state
    if (recovered > 0) {
        const latestState = useStore.getState();
        await latestState.autoSyncGoogleDrive();
    }

    const message = recovered > 0
        ? `Recovered ${recovered} image(s) from Drive history${failed > 0 ? `, ${failed} could not be restored` : ''}.`
        : `No base64 found in ${revisions.length} revision(s). Images may be permanently lost.`;

    console.log(`[Recovery] Done. ${message}`);
    return { recovered, failed, message };
};

// Also expose the recovery function through the store for component access
useStore.setState(s => ({ ...s, recoverImagesFromDriveRevisions }));
