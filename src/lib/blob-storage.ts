import { get, set, del } from 'idb-keyval';

/**
 * Prefix used for local IndexedDB URIs
 */
export const INDEXEDDB_PREFIX = 'indexeddb://';

/**
 * Saves a base64 string or Blob to IndexedDB and returns its URI.
 * @param base64OrBlob The file content to save.
 * @param extension Optional file extension to include in the ID.
 * @returns The URI string formatted as `indexeddb://<id>`.
 */
export async function saveBlobToIndexedDB(base64OrBlob: string | Blob, extension: string = 'bin'): Promise<string> {
    const id = `blob_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    
    // If it's a base64 data URI, convert it to a Blob before saving to save memory.
    // (IndexedDB handles Blobs much more efficiently than massive Base64 strings).
    let dataToSave = base64OrBlob;
    
    if (typeof base64OrBlob === 'string' && base64OrBlob.startsWith('data:')) {
        try {
            const arr = base64OrBlob.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            dataToSave = new Blob([u8arr], { type: mime });
        } catch (e) {
            console.warn('Failed to convert base64 to Blob for IndexedDB, saving as string', e);
        }
    }

    await set(id, dataToSave);
    return `${INDEXEDDB_PREFIX}${id}`;
}

/**
 * Retrieves a Blob or Base64 string from IndexedDB given its URI or ID.
 * @param uriOrId The `indexeddb://<id>` URI or just the `<id>`.
 * @returns The stored Blob/String or undefined if not found.
 */
export async function getBlobFromIndexedDB(uriOrId: string): Promise<string | Blob | undefined> {
    const id = uriOrId.replace(INDEXEDDB_PREFIX, '');
    return await get(id);
}

/**
 * Deletes a Blob from IndexedDB.
 * @param uriOrId The `indexeddb://<id>` URI or just the `<id>`.
 */
export async function deleteBlobFromIndexedDB(uriOrId: string): Promise<void> {
    if (!uriOrId) return;
    const id = uriOrId.replace(INDEXEDDB_PREFIX, '');
    await del(id);
}

/**
 * Converts a stored IndexedDB Blob/String into a temporary object URL for DOM use.
 * Remember to call URL.revokeObjectURL() when done if it's a blob.
 */
export async function createObjectURLFromIndexedDB(uri: string): Promise<string | null> {
    try {
        const data = await getBlobFromIndexedDB(uri);
        if (!data) return null;
        
        if (data instanceof Blob) {
            return URL.createObjectURL(data);
        } else if (typeof data === 'string') {
            return data; // Already a string (e.g. base64)
        }
    } catch (e) {
        console.error('Failed to create Object URL from IndexedDB:', e);
    }
    return null;
}
