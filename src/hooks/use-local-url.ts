import { useState, useEffect } from 'react';
import { getLocalImageSrc } from '@/lib/image-utils';
import { createObjectURLFromIndexedDB } from '@/lib/blob-storage';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to asynchronously resolve a local file path or IndexedDB URI into a browser-usable URL (e.g., blob:).
 * Automatically cleans up the object URL on unmount or when the source changes.
 */
export function useLocalUrl(uriOrBase64: string | null | undefined): string {
    const [resolvedUrl, setResolvedUrl] = useState<string>('');

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

        // If the block holds a drive://<id> reference, check local cache (IndexedDB on Web / Filesystem on Native) first
        if (uriOrBase64.startsWith('drive://')) {
            const driveFileId = uriOrBase64.replace('drive://', '');
            let active = true;
            let objectUrl: string | null = null;
            import('@/lib/attachment-store').then(({ getCachedUri }) => getCachedUri(driveFileId)).then(async (cachedUri) => {
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
            }).catch(() => {
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
