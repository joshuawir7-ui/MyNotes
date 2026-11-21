import { useState, useEffect } from 'react';
import { getLocalImageSrc } from '@/lib/image-utils';
import { createObjectURLFromIndexedDB } from '@/lib/blob-storage';
import { Capacitor } from '@capacitor/core';

function getInitialSyncUrl(uriOrBase64: string | null | undefined): string {
    if (!uriOrBase64) return '';
    if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
        if (uriOrBase64.startsWith('file://') || uriOrBase64.startsWith('/data/')) {
            return '';
        }
    }
    if (uriOrBase64.startsWith('drive://') || uriOrBase64.startsWith('indexeddb://')) {
        return '';
    }
    return getLocalImageSrc(uriOrBase64);
}

/**
 * Hook to asynchronously resolve a local file path or IndexedDB URI into a browser-usable URL (e.g., blob:).
 * Automatically cleans up the object URL on unmount or when the source changes.
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
            if (uriOrBase64.startsWith('file://') || uriOrBase64.startsWith('/data/')) {
                setResolvedUrl('');
                return;
            }
        }

        // If the block holds a drive://<id> reference, check local cache first, and if missing, fetch via ensureAttachment
        if (uriOrBase64.startsWith('drive://')) {
            const driveFileId = uriOrBase64.replace('drive://', '').trim();
            if (!driveFileId) {
                setResolvedUrl('');
                return;
            }
            let active = true;
            let objectUrl: string | null = null;

            const applyCachedUri = async (cachedUri: string | null) => {
                if (!active || !cachedUri) {
                    if (active) setResolvedUrl('');
                    return;
                }
                if (cachedUri.startsWith('indexeddb://')) {
                    const url = await createObjectURLFromIndexedDB(cachedUri);
                    if (active && url) {
                        objectUrl = url;
                        setResolvedUrl(url);
                    } else if (active) {
                        setResolvedUrl('');
                    }
                } else {
                    setResolvedUrl(getLocalImageSrc(cachedUri));
                }
            };

            import('@/lib/attachment-store')
                .then(async ({ getCachedUri, ensureAttachment }) => {
                    const cached = await getCachedUri(driveFileId);
                    if (cached) {
                        await applyCachedUri(cached);
                        return;
                    }
                    const ensured = await ensureAttachment({ driveFileId, type: 'image' });
                    if (ensured.ok && ensured.uri) {
                        await applyCachedUri(ensured.uri);
                    } else if (active) {
                        setResolvedUrl('');
                    }
                })
                .catch(() => {
                    if (active) setResolvedUrl('');
                });

            return () => {
                active = false;
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
