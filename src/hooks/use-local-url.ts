import { useState, useEffect } from 'react';
import { getLocalImageSrc } from '@/lib/image-utils';
import { createObjectURLFromIndexedDB } from '@/lib/blob-storage';

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

        // Fast path for normal URLs / Base64 / Native file paths
        const syncUrl = getLocalImageSrc(uriOrBase64);
        
        if (syncUrl.startsWith('indexeddb://')) {
            let active = true;
            let objectUrl: string | null = null;
            
            createObjectURLFromIndexedDB(syncUrl).then(url => {
                if (active && url) {
                    objectUrl = url;
                    setResolvedUrl(url);
                }
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
