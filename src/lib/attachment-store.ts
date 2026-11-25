import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { saveBlobToIndexedDB, getBlobFromIndexedDB } from './blob-storage';
import { hudRecordEnsureAttachment } from './perf-debug';

export type AttachmentFailReason =
    | 'no-session'
    | 'session-expired'
    | 'no-access'
    | 'not-found'
    | 'network'
    | 'invalid'
    | 'too-large';

export type EnsureAttachmentResult =
    | { ok: true; uri: string; reason?: undefined }
    | { ok: false; reason: AttachmentFailReason; uri?: undefined };

export type AttachmentStatus =
    | { state: 'idle' }
    | { state: 'downloading' }
    | { state: 'error'; reason: AttachmentFailReason };

export interface EnsureAttachmentParams {
    driveFileId: string;
    noteId?: string;
    blockId?: string;
    type: 'image' | 'video' | 'file' | 'drawing';
    name?: string;
    fileName?: string;
    mimeType?: string;
    driveSize?: number;
    confirmLarge?: boolean;
}

const WEB_MANIFEST_PREFIX = 'mynotes_web_att_v1_';
const MAX_CONCURRENCY = 3;
const LARGE_FILE_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_BACKOFF_MS = [1000, 3000, 9000];

const statusMap = new Map<string, AttachmentStatus>();
const statusListeners = new Map<string, Set<(status: AttachmentStatus) => void>>();
const inFlightMap = new Map<string, Promise<EnsureAttachmentResult>>();
const memoryUriCache = new Map<string, string>();

let activeDownloads = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
    if (activeDownloads < MAX_CONCURRENCY) {
        activeDownloads++;
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
        waitQueue.push(() => {
            activeDownloads++;
            resolve();
        });
    });
}

function releaseSlot(): void {
    activeDownloads = Math.max(0, activeDownloads - 1);
    const next = waitQueue.shift();
    if (next) next();
}

function setStatus(driveFileId: string, status: AttachmentStatus): void {
    statusMap.set(driveFileId, status);
    const set = statusListeners.get(driveFileId);
    if (set) {
        set.forEach((fn) => {
            try { fn(status); } catch {}
        });
    }
}

export function getAttachmentStatus(driveFileId: string): AttachmentStatus {
    return statusMap.get(driveFileId) || { state: 'idle' };
}

export function subscribeAttachmentStatus(
    driveFileId: string,
    listener: (status: AttachmentStatus) => void
): () => void {
    let set = statusListeners.get(driveFileId);
    if (!set) {
        set = new Set();
        statusListeners.set(driveFileId, set);
    }
    set.add(listener);
    return () => {
        set!.delete(listener);
        if (set!.size === 0) statusListeners.delete(driveFileId);
    };
}

// ─── Dependency injection hooks for unit testing against real code ────────────
export interface AttachmentStoreDeps {
    isNative: () => boolean;
    getAccessToken: () => Promise<string | null> | string | null;
    refreshAccessToken: () => Promise<string | null>;
    markSessionExpired: () => void;
    applyBlockUri: (noteId: string, blockId: string, driveFileId: string, uri: string) => Promise<void>;
    fetchFn: typeof fetch;
    saveWebBlob: (blob: Blob, ext: string) => Promise<string>;
    getWebCachedUri: (driveFileId: string) => Promise<string | null>;
    setWebCachedUri: (driveFileId: string, uri: string) => Promise<void>;
    getNativeCachedUri: (driveFileId: string) => Promise<string | null>;
    downloadNativeFile: (driveFileId: string, token: string, fileName: string, noteId?: string, blockId?: string, type?: string) => Promise<{ status: number; uri?: string; sizeBytes?: number }>;
    backoffMs: number[];
}

export interface AttachmentStoreBridge {
    getAccessToken: () => string | null;
    refreshAccessToken: () => Promise<string | null>;
    markSessionExpired: () => void;
    applyBlockUri: (noteId: string, blockId: string, driveFileId: string, uri: string) => Promise<void>;
    getAttachmentManifest: () => Promise<Record<string, { localPath: string; sizeBytes?: number }>>;
    upsertManifestEntry: (entry: {
        driveFileId: string;
        noteId: string;
        blockId: string;
        type: 'video' | 'image' | 'file';
        localPath: string;
        sizeBytes: number;
        lastSyncedAt: number;
    }) => Promise<void>;
}

let registeredBridge: AttachmentStoreBridge | null = null;

export function registerAttachmentStoreBridge(bridge: AttachmentStoreBridge): void {
    registeredBridge = bridge;
}

export async function cacheUploadedAttachmentUri(
    driveFileId: string,
    localUri: string,
    meta?: { noteId?: string; blockId?: string; type?: 'image' | 'video' | 'file' | 'drawing'; sizeBytes?: number }
): Promise<void> {
    if (!driveFileId || !localUri || localUri.startsWith('drive://')) return;
    if (Capacitor.isNativePlatform()) {
        if (localUri.startsWith('file://') || localUri.startsWith('/')) {
            const normalizedPath = localUri.startsWith('/') ? `file://${localUri}` : localUri;
            memoryUriCache.set(driveFileId, normalizedPath);
            try {
                if (registeredBridge) {
                    await registeredBridge.upsertManifestEntry({
                        driveFileId,
                        noteId: meta?.noteId || '',
                        blockId: meta?.blockId || '',
                        type: (meta?.type === 'video' || meta?.type === 'file' ? meta.type : 'image'),
                        localPath: normalizedPath,
                        sizeBytes: meta?.sizeBytes || 1,
                        lastSyncedAt: Date.now()
                    });
                } else {
                    const { upsertManifestEntry } = await import('./store');
                    await upsertManifestEntry({
                        driveFileId,
                        noteId: meta?.noteId || '',
                        blockId: meta?.blockId || '',
                        type: (meta?.type === 'video' || meta?.type === 'file' ? meta.type : 'image'),
                        localPath: normalizedPath,
                        sizeBytes: meta?.sizeBytes || 1,
                        lastSyncedAt: Date.now()
                    });
                }
            } catch {}
        }
    } else if (localUri.startsWith('indexeddb://')) {
        memoryUriCache.set(driveFileId, localUri);
        try {
            await idbSet(`${WEB_MANIFEST_PREFIX}${driveFileId}`, localUri);
        } catch {}
    }
}

const defaultDeps: AttachmentStoreDeps = {
    isNative: () => Capacitor.isNativePlatform(),
    getAccessToken: async () => {
        try {
            if (registeredBridge) return registeredBridge.getAccessToken();
            const { useStore } = await import('./store');
            const st = useStore.getState();
            if (st.googleSessionExpired) return null;
            return st.googleUser?.accessToken || null;
        } catch {}
        return null;
    },
    refreshAccessToken: async () => {
        try {
            if (registeredBridge) return await registeredBridge.refreshAccessToken();
            const { silentRefreshGoogleToken } = await import('./store');
            return await silentRefreshGoogleToken();
        } catch {
            return null;
        }
    },
    markSessionExpired: () => {
        try {
            if (registeredBridge) {
                registeredBridge.markSessionExpired();
                return;
            }
            import('./store').then(({ useStore }) => {
                useStore.setState({ googleSessionExpired: true });
            }).catch(() => {});
        } catch {}
    },
    applyBlockUri: async (noteId: string, blockId: string, driveFileId: string, uri: string) => {
        try {
            if (registeredBridge) {
                await registeredBridge.applyBlockUri(noteId, blockId, driveFileId, uri);
                return;
            }
            const { applyDownloadedAttachmentToStore } = await import('./store');
            if (typeof applyDownloadedAttachmentToStore === 'function') {
                await applyDownloadedAttachmentToStore(noteId, blockId, driveFileId, uri);
            }
        } catch (err) {
            console.warn('[AttachmentStore] applyBlockUri warning:', err);
        }
    },
    fetchFn: (...args: Parameters<typeof fetch>) => fetch(...args),
    saveWebBlob: (blob: Blob, ext: string) => saveBlobToIndexedDB(blob, ext),
    getWebCachedUri: async (driveFileId: string) => {
        try {
            const uri = await idbGet(`${WEB_MANIFEST_PREFIX}${driveFileId}`);
            if (typeof uri === 'string' && uri.startsWith('indexeddb://')) {
                const blob = await getBlobFromIndexedDB(uri);
                if (blob) return uri;
            }
        } catch {}
        return null;
    },
    setWebCachedUri: async (driveFileId: string, uri: string) => {
        try {
            await idbSet(`${WEB_MANIFEST_PREFIX}${driveFileId}`, uri);
        } catch {}
    },
    getNativeCachedUri: async (driveFileId: string) => {
        try {
            const manifest = registeredBridge
                ? await registeredBridge.getAttachmentManifest()
                : await (await import('./store')).getAttachmentManifest();
            const entry = manifest?.[driveFileId];
            if (!entry || !entry.localPath) return null;
            const stat = await Filesystem.stat({ path: entry.localPath.replace('file://', '') });
            if (stat && stat.size > 0 && stat.type !== 'directory') {
                return entry.localPath;
            }
        } catch {}
        return null;
    },
    downloadNativeFile: async (driveFileId: string, token: string, fileName: string, noteId?: string, blockId?: string, type?: string) => {
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const localFileName = `attachment_${driveFileId}_${safeFileName}`;
        const url = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;

        try {
            const result = await Filesystem.downloadFile({
                url,
                path: localFileName,
                directory: Directory.Data,
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!result.path) return { status: 500 };
            let fileUri = result.path;
            if (!fileUri.startsWith('file://') && !fileUri.startsWith('/')) {
                const uriRes = await Filesystem.getUri({ path: localFileName, directory: Directory.Data });
                fileUri = uriRes.uri;
            } else if (fileUri.startsWith('/')) {
                fileUri = 'file://' + fileUri;
            }
            let sizeBytes = 0;
            try {
                const st = await Filesystem.stat({ path: fileUri.replace('file://', '') });
                sizeBytes = st.size || 0;
            } catch {}
            if (sizeBytes === 0) return { status: 200, sizeBytes: 0 };

            try {
                const entry = {
                    driveFileId,
                    noteId: noteId || '',
                    blockId: blockId || '',
                    type: (type === 'video' || type === 'file' ? type : 'image') as 'video' | 'image' | 'file',
                    localPath: fileUri,
                    sizeBytes,
                    lastSyncedAt: Date.now()
                };
                if (registeredBridge) {
                    await registeredBridge.upsertManifestEntry(entry);
                } else {
                    const { upsertManifestEntry } = await import('./store');
                    await upsertManifestEntry(entry);
                }
            } catch {}

            return { status: 200, uri: fileUri, sizeBytes };
        } catch (err: any) {
            const msg = String(err?.message || err || '');
            if (msg.includes('401')) return { status: 401 };
            if (msg.includes('403')) return { status: 403 };
            if (msg.includes('404')) return { status: 404 };
            if (msg.includes('429')) return { status: 429 };
            return { status: 0 };
        }
    },
    backoffMs: DEFAULT_BACKOFF_MS
};

let activeDeps: AttachmentStoreDeps = { ...defaultDeps };

export function __setAttachmentStoreTestDeps(overrides: Partial<AttachmentStoreDeps> | null): void {
    if (!overrides) {
        activeDeps = { ...defaultDeps };
        statusMap.clear();
        inFlightMap.clear();
        memoryUriCache.clear();
    } else {
        activeDeps = { ...defaultDeps, ...overrides };
    }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getCachedUri(driveFileId: string): Promise<string | null> {
    if (!driveFileId) return null;
    const memHit = memoryUriCache.get(driveFileId);
    if (memHit) return memHit;
    const uri = activeDeps.isNative()
        ? await activeDeps.getNativeCachedUri(driveFileId)
        : await activeDeps.getWebCachedUri(driveFileId);
    if (uri) {
        memoryUriCache.set(driveFileId, uri);
    }
    return uri;
}

export async function ensureAttachment(params: EnsureAttachmentParams): Promise<EnsureAttachmentResult> {
    hudRecordEnsureAttachment();
    const { driveFileId, noteId, blockId, type, name, fileName: paramFileName, driveSize, confirmLarge } = params;
    const effectiveName = name || paramFileName;
    if (!driveFileId) {
        return { ok: false, reason: 'invalid' };
    }

    // 1. Check local cache first
    const cached = await getCachedUri(driveFileId);
    if (cached) {
        setStatus(driveFileId, { state: 'idle' });
        if (noteId && blockId) {
            await activeDeps.applyBlockUri(noteId, blockId, driveFileId, cached);
        }
        return { ok: true, uri: cached };
    }

    // 2. Check > 50 MB policy on Web for video/file before downloading
    if (!activeDeps.isNative() && (type === 'video' || type === 'file') && !confirmLarge) {
        if (typeof driveSize === 'number' && driveSize > LARGE_FILE_LIMIT_BYTES) {
            const res: EnsureAttachmentResult = { ok: false, reason: 'too-large' };
            setStatus(driveFileId, { state: 'error', reason: 'too-large' });
            return res;
        }
    }

    // 3. Deduplicate in-flight requests by driveFileId
    const existingPromise = inFlightMap.get(driveFileId);
    if (existingPromise) {
        const res = await existingPromise;
        if (res.ok && noteId && blockId) {
            await activeDeps.applyBlockUri(noteId, blockId, driveFileId, res.uri);
        }
        return res;
    }

    const downloadPromise = (async (): Promise<EnsureAttachmentResult> => {
        let token = await activeDeps.getAccessToken();
        if (!token) {
            setStatus(driveFileId, { state: 'error', reason: 'no-session' });
            return { ok: false, reason: 'no-session' };
        }

        await acquireSlot();
        setStatus(driveFileId, { state: 'downloading' });

        try {
            const fileName = effectiveName || (type === 'image' || type === 'drawing' ? 'image.png' : 'attachment.bin');
            const ext = (fileName.split('.').pop() || (type === 'image' || type === 'drawing' ? 'png' : 'bin')).toLowerCase();
            let didRefresh401 = false;
            const backoffs = activeDeps.backoffMs;
            const maxAttempts = backoffs.length + 1;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                if (activeDeps.isNative()) {
                    const natRes = await activeDeps.downloadNativeFile(driveFileId, token, fileName, noteId, blockId, type);
                    if (natRes.status === 200) {
                        if (!natRes.uri || !natRes.sizeBytes || natRes.sizeBytes <= 0) {
                            setStatus(driveFileId, { state: 'error', reason: 'invalid' });
                            return { ok: false, reason: 'invalid' };
                        }
                        if (typeof driveSize === 'number' && driveSize > 0 && natRes.sizeBytes !== driveSize) {
                            setStatus(driveFileId, { state: 'error', reason: 'invalid' });
                            return { ok: false, reason: 'invalid' };
                        }
                        setStatus(driveFileId, { state: 'idle' });
                        return { ok: true, uri: natRes.uri };
                    }
                    if (natRes.status === 401) {
                        if (!didRefresh401) {
                            didRefresh401 = true;
                            const newToken = await activeDeps.refreshAccessToken();
                            if (newToken) {
                                token = newToken;
                                attempt--; // Do not count the 401 refresh against backoff attempts
                                continue;
                            }
                        }
                        activeDeps.markSessionExpired();
                        setStatus(driveFileId, { state: 'error', reason: 'session-expired' });
                        return { ok: false, reason: 'session-expired' };
                    }
                    if (natRes.status === 403) {
                        setStatus(driveFileId, { state: 'error', reason: 'no-access' });
                        return { ok: false, reason: 'no-access' };
                    }
                    if (natRes.status === 404) {
                        setStatus(driveFileId, { state: 'error', reason: 'not-found' });
                        return { ok: false, reason: 'not-found' };
                    }
                    // Network / 5xx / 429 -> backoff
                    if (attempt < backoffs.length) {
                        await sleep(backoffs[attempt]);
                        continue;
                    }
                    setStatus(driveFileId, { state: 'error', reason: 'network' });
                    return { ok: false, reason: 'network' };
                } else {
                    // Web / Desktop
                    let res: Response;
                    try {
                        res = await activeDeps.fetchFn(
                            `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    } catch {
                        if (attempt < backoffs.length) {
                            await sleep(backoffs[attempt]);
                            continue;
                        }
                        setStatus(driveFileId, { state: 'error', reason: 'network' });
                        return { ok: false, reason: 'network' };
                    }

                    if (res.status === 401) {
                        if (!didRefresh401) {
                            didRefresh401 = true;
                            const newToken = await activeDeps.refreshAccessToken();
                            if (newToken) {
                                token = newToken;
                                attempt--;
                                continue;
                            }
                        }
                        activeDeps.markSessionExpired();
                        setStatus(driveFileId, { state: 'error', reason: 'session-expired' });
                        return { ok: false, reason: 'session-expired' };
                    }
                    if (res.status === 403) {
                        setStatus(driveFileId, { state: 'error', reason: 'no-access' });
                        return { ok: false, reason: 'no-access' };
                    }
                    if (res.status === 404) {
                        setStatus(driveFileId, { state: 'error', reason: 'not-found' });
                        return { ok: false, reason: 'not-found' };
                    }
                    if (res.status === 429 || res.status >= 500) {
                        if (attempt < backoffs.length) {
                            await sleep(backoffs[attempt]);
                            continue;
                        }
                        setStatus(driveFileId, { state: 'error', reason: 'network' });
                        return { ok: false, reason: 'network' };
                    }
                    if (!res.ok) {
                        setStatus(driveFileId, { state: 'error', reason: 'network' });
                        return { ok: false, reason: 'network' };
                    }

                    const clHeader = Number(res.headers?.get?.('content-length') || '0');
                    if ((type === 'video' || type === 'file') && !confirmLarge && clHeader > LARGE_FILE_LIMIT_BYTES) {
                        setStatus(driveFileId, { state: 'error', reason: 'too-large' });
                        return { ok: false, reason: 'too-large' };
                    }

                    const blob = await res.blob();
                    if (!blob || blob.size === 0) {
                        setStatus(driveFileId, { state: 'error', reason: 'invalid' });
                        return { ok: false, reason: 'invalid' };
                    }
                    if ((type === 'video' || type === 'file') && !confirmLarge && blob.size > LARGE_FILE_LIMIT_BYTES) {
                        setStatus(driveFileId, { state: 'error', reason: 'too-large' });
                        return { ok: false, reason: 'too-large' };
                    }
                    if (typeof driveSize === 'number' && driveSize > 0 && blob.size !== driveSize) {
                        setStatus(driveFileId, { state: 'error', reason: 'invalid' });
                        return { ok: false, reason: 'invalid' };
                    }

                    const uri = await activeDeps.saveWebBlob(blob, ext);
                    await activeDeps.setWebCachedUri(driveFileId, uri);
                    setStatus(driveFileId, { state: 'idle' });
                    return { ok: true, uri };
                }
            }

            setStatus(driveFileId, { state: 'error', reason: 'network' });
            return { ok: false, reason: 'network' };
        } finally {
            releaseSlot();
        }
    })();

    inFlightMap.set(driveFileId, downloadPromise);
    try {
        const result = await downloadPromise;
        if (result.ok && result.uri) {
            memoryUriCache.set(driveFileId, result.uri);
            if (noteId && blockId) {
                await activeDeps.applyBlockUri(noteId, blockId, driveFileId, result.uri);
            }
        }
        return result;
    } finally {
        inFlightMap.delete(driveFileId);
    }
}

export function getFailureMessage(reason: AttachmentFailReason, language: string = 'es'): { title: string; subtitle: string } {
    const es = language === 'es';
    const zh = language === 'zh';
    switch (reason) {
        case 'no-session':
            return {
                title: es ? 'Sin sesión de Google' : zh ? '未登录 Google' : 'Not signed in to Google',
                subtitle: es ? 'Inicia sesión con tu cuenta de Google en Ajustes para descargar este archivo.' : zh ? '请在设置中登录您的 Google 账号以下载此文件。' : 'Sign in with your Google account in Settings to download this file.'
            };
        case 'session-expired':
            return {
                title: es ? 'Sesión de Google expirada' : zh ? 'Google 会话已过期' : 'Google session expired',
                subtitle: es ? 'Tu sesión caducó. Reconecta tu cuenta de Google en Ajustes y vuelve a intentarlo.' : zh ? '您的会话已过期。请在设置中重新连接 Google 账号后重试。' : 'Your session expired. Reconnect your Google account in Settings and try again.'
            };
        case 'no-access':
            return {
                title: es ? 'Sin permiso para acceder al archivo (403)' : zh ? '无权访问此文件 (403)' : 'No permission to access file (403)',
                subtitle: es ? 'Google Drive rechazó el acceso con la cuenta actual.' : zh ? 'Google 云端硬盘拒绝了当前账号的访问。' : 'Google Drive denied access for the current account.'
            };
        case 'not-found':
            return {
                title: es ? 'Archivo no encontrado en Drive (404)' : zh ? '云端硬盘中未找到文件 (404)' : 'File not found in Drive (404)',
                subtitle: es ? 'El archivo ya no existe en tu Google Drive o fue eliminado.' : zh ? '该文件在您的 Google 云端硬盘中已不存在或已被删除。' : 'The file no longer exists in your Google Drive or was deleted.'
            };
        case 'too-large':
            return {
                title: es ? 'Archivo mayor a 50 MB' : zh ? '文件大于 50 MB' : 'File larger than 50 MB',
                subtitle: es ? 'Toca "Descargar de todos modos" para confirmar la descarga en este dispositivo.' : zh ? '点击“仍然下载”以确认在此设备上下载。' : 'Tap "Download anyway" to confirm downloading on this device.'
            };
        case 'invalid':
            return {
                title: es ? 'Archivo vacío o incompleto' : zh ? '文件为空或不完整' : 'Empty or incomplete file',
                subtitle: es ? 'La descarga no devolvió un archivo válido. Toca para reintentar.' : zh ? '下载未返回有效文件。点击重试。' : 'The download did not return a valid file. Tap to retry.'
            };
        case 'network':
        default:
            return {
                title: es ? 'Error de red al descargar' : zh ? '下载时网络错误' : 'Network error while downloading',
                subtitle: es ? 'Verifica tu conexión a Internet y toca para reintentar.' : zh ? '请检查您的网络连接并点击重试。' : 'Check your internet connection and tap to retry.'
            };
    }
}

/**
 * PASO 0 diagnostic helper — callable from browser console as `window.__mynotesDiagnoseDriveAttachment(driveFileId)`
 * or without arguments to automatically diagnose the first block with driveFileId (e.g. note "AVANZAR").
 */
export async function diagnoseDriveAttachment(targetDriveFileId?: string): Promise<any> {
    const { useStore } = await import('./store');
    const state = useStore.getState();
    const token = state.googleUser?.accessToken;

    let foundNoteTitle = '';
    let foundBlock: any = null;
    for (const note of state.notes || []) {
        for (const b of note.blocks || []) {
            if (b?.driveFileId && (!targetDriveFileId || b.driveFileId === targetDriveFileId || (note.title || '').toUpperCase().includes('AVANZAR'))) {
                foundNoteTitle = note.title;
                foundBlock = { type: b.type, content: b.content, driveFileId: b.driveFileId, driveSize: b.driveSize, driveMd5: b.driveMd5 };
                if (!targetDriveFileId) targetDriveFileId = b.driveFileId;
                break;
            }
        }
        if (foundBlock) break;
    }

    if (!token) {
        const out = { error: 'no-access-token-in-store', foundNoteTitle, foundBlock };
        console.log('[PASO 0 Diagnostic]', JSON.stringify(out, null, 2));
        return out;
    }

    const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${targetDriveFileId}?fields=id,name,mimeType,size,md5Checksum,trashed`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const metaBody = await metaRes.json().catch(() => null);

    let mediaStatus = 0;
    let mediaBlobSize = 0;
    let mediaCorsError: string | null = null;
    try {
        const mediaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${targetDriveFileId}?alt=media`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        mediaStatus = mediaRes.status;
        if (mediaRes.ok) {
            const blob = await mediaRes.blob();
            mediaBlobSize = blob.size;
        }
    } catch (e: any) {
        mediaCorsError = String(e?.message || e);
    }

    let tokenInfo: any = null;
    if (metaRes.status === 403 || metaRes.status === 404) {
        const tiRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
        tokenInfo = await tiRes.json().catch(() => null);
    }

    const report = {
        noteTitle: foundNoteTitle,
        block: foundBlock,
        metadataCheck: { status: metaRes.status, body: metaBody },
        mediaCheck: { status: mediaStatus, blobSize: mediaBlobSize, corsError: mediaCorsError },
        tokenInfo
    };
    console.log('[PASO 0 Diagnostic]', JSON.stringify(report, null, 2));
    return report;
}

if (typeof window !== 'undefined') {
    (window as any).__mynotesDiagnoseDriveAttachment = diagnoseDriveAttachment;
}
