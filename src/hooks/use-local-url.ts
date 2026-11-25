import { useState, useEffect } from 'react';
import { getLocalImageSrc } from '@/lib/image-utils';
import { createObjectURLFromIndexedDB } from '@/lib/blob-storage';
import { Capacitor } from '@capacitor/core';

function getInitialSyncUrl(uriOrBase64: string | null | undefined): string {
    if (!uriOrBase64) return '';
    if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
        if (uriOrBase64.startsWith('file://') || uriOrBase64.startsWith('/data/') || uriOrBase64.startsWith('content://')) {
            return '';
        }
    }
    if (uriOrBase64.startsWith('drive://') || uriOrBase64.startsWith('indexeddb://')) {
        return '';
    }
    return getLocalImageSrc(uriOrBase64);
}

/**
 * Hook to asynchronously resolve a local file path, IndexedDB URI, or Google Drive `drive://<id>` URI
 * into a browser-usable URL (e.g., blob: or Capacitor file src).
 * Automatically downloads missing `drive://<id>` images once into the local cache and cleans up blob URLs on unmount.
 */
export function useLocalUrl(uriOrBase64: string | null | undefined): string {
    const [resolvedUrl, setResolvedUrl] = useState<string>(() => getInitialSyncUrl(uriOrBase64));

    useEffect(() => {
        if (!uriOrBase64) {
            setResolvedUrl('');
            return;
        }

        // On Web, native device file:// or /data/ paths cannot be loaded by browser security rules
        if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
            if (uriOrBase64.startsWith('file://') || uriOrBase64.startsWith('/data/') || uriOrBase64.startsWith('content://')) {
                setResolvedUrl('');
                return;
            }
        }

        // Resolve drive://<id> from local cache first; if not cached yet on this device, download once via ensureAttachment
        if (uriOrBase64.startsWith('drive://')) {
            const driveFileId = uriOrBase64.replace('drive://', '').trim();
            if (!driveFileId) {
                setResolvedUrl('');
                return;
            }
            let active = true;
            let objectUrl: string | null = null;
            let unsubscribe: (() => void) | null = null;

            const applyCachedUri = async (cachedUri: string | null | undefined): Promise<boolean> => {
                if (!active || !cachedUri) return false;
                if (cachedUri.startsWith('indexeddb://')) {
                    const url = await createObjectURLFromIndexedDB(cachedUri);
                    if (!active) {
                        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
                        return false;
                    }
                    if (url) {
                        if (objectUrl && objectUrl.startsWith('blob:') && objectUrl !== url) {
                            URL.revokeObjectURL(objectUrl);
                        }
                        objectUrl = url;
                        setResolvedUrl(url);
                        return true;
                    }
                    return false;
                } else {
                    const localSrc = getLocalImageSrc(cachedUri);
                    if (active && localSrc) {
                        setResolvedUrl(localSrc);
                        return true;
                    }
                    return false;
                }
            };

            import('@/lib/attachment-store')
                .then(async ({ getCachedUri, ensureAttachment, subscribeAttachmentStatus }) => {
                    if (!active) return;

                    // 1. Fast local cache check (zero network if already downloaded or uploaded here)
                    const cached = await getCachedUri(driveFileId);
                    if (!active) return;
                    if (cached && await applyCachedUri(cached)) {
                        return;
                    }

                    // 2. Listen in case background preloader finishes it concurrently
                    unsubscribe = subscribeAttachmentStatus(driveFileId, (st) => {
                        if (st.state === 'idle' && active) {
                            getCachedUri(driveFileId).then((u) => {
                                if (u) applyCachedUri(u);
                            }).catch(() => {});
                        }
                    });

                    // 3. Download once on demand and persist in local attachment cache
                    const res = await ensureAttachment({ driveFileId, type: 'image' });
                    if (!active) return;
                    if (res.ok && res.uri) {
                        await applyCachedUri(res.uri);
                    } else {
                        setResolvedUrl('');
                    }
                })
                .catch(() => {
                    if (active) setResolvedUrl('');
                });

            return () => {
                active = false;
                if (unsubscribe) unsubscribe();
                if (objectUrl && objectUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(objectUrl);
                }
            };
        }

        // Fast path for normal URLs / Base64 / Native file paths
        const syncUrl = getLocalImageSrc(uriOrBase64);

        if (syncUrl.startsWith('indexeddb://')) {
            let active = true;
            let objectUrl: string | null = null;

            createObjectURLFromIndexedDB(syncUrl).then(url => {
                if (active && url) {
                    objectUrl = url;
                    setResolvedUrl(url);
                } else if (active) {
                    setResolvedUrl('');
                }
            }).catch(() => {
                if (active) setResolvedUrl('');
            });

            return () => {
                active = false;
                if (objectUrl && objectUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(objectUrl);
                }
            };
        } else {
            setResolvedUrl(syncUrl);
            return () => {};
        }
    }, [uriOrBase64]);

    return resolvedUrl;
}
