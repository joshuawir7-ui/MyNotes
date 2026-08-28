import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/**
 * Saves a base64 image string to the device filesystem.
 * Returns the file path URI if successful, or null if it fails.
 */
export async function saveBase64ImageToFile(base64Data: string, fileName?: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    if (!Capacitor.isNativePlatform()) return null; // Fallback to base64 on Web/Desktop
    // However, to unify the API, we can use Filesystem plugin which falls back to IndexedDB on web
    try {
        const name = fileName || `img_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        
        // Ensure base64 string doesn't have the data URL prefix if it's there
        let pureBase64 = base64Data;
        if (base64Data.includes(',')) {
            pureBase64 = base64Data.split(',')[1];
        }

        const savedFile = await Filesystem.writeFile({
            path: name,
            data: pureBase64,
            directory: Directory.Data,
            // DO NOT specify encoding for base64 saving in Capacitor unless we know it's needed, 
            // but Capacitor expects data to be base64 string when we omit encoding or when writing binary?
            // Wait, actually Capacitor docs say: If you don't provide encoding, data must be base64 string.
        });

        // URI that points to the file on the device
        return savedFile.uri;
    } catch (err) {
        console.error("Failed to save image to filesystem:", err);
        return null;
    }
}

/**
 * Converts a file URI (from Filesystem) to a usable web source (e.g. blob:// or local server URL).
 * If it's a web platform and it's already a base64 or blob, returns it as is.
 */
export function getLocalImageSrc(uriOrBase64: string): string {
    if (!uriOrBase64) return '';
    
    // If it's already a base64 or http URL, just return it
    if (uriOrBase64.startsWith('data:') || uriOrBase64.startsWith('http')) {
        return uriOrBase64;
    }

    // Attempt to use convertFileSrc if we are in a browser environment with Capacitor
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        let path = uriOrBase64;
        if (path.startsWith('/')) {
            path = 'file://' + path;
        }
        return Capacitor.convertFileSrc(path);
    }
    
    // Fallback if isNativePlatform fails but window.Capacitor exists
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.convertFileSrc) {
        let path = uriOrBase64;
        if (path.startsWith('/')) {
            path = 'file://' + path;
        }
        return window.Capacitor.convertFileSrc(path);
    }

    return uriOrBase64;
}

/**
 * Async function to read a file from path (useful for web or when convertFileSrc isn't enough)
 */
export async function readImageFile(path: string): Promise<string | null> {
    try {
        const result = await Filesystem.readFile({
            path,
            directory: Directory.Data,
        });
        
        return `data:image/jpeg;base64,${result.data}`;
    } catch (err) {
        console.error("Failed to read image file:", err);
        return null;
    }
}

/**
 * Gets or creates a cached thumbnail for a given image path.
 */
export async function getOrCreateThumbnail(originalPathOrBase64: string): Promise<string> {
    if (!originalPathOrBase64) return '';
    
    // If it's already a base64 or http URL, just return it
    if (originalPathOrBase64.startsWith('data:') || originalPathOrBase64.startsWith('http')) {
        return originalPathOrBase64;
    }

    try {
        const fileName = originalPathOrBase64.split('/').pop();
        if (!fileName) return getLocalImageSrc(originalPathOrBase64);

        const thumbName = `thumb_${fileName}`;
        
        // Check if thumbnail exists
        try {
            await Filesystem.stat({
                path: thumbName,
                directory: Directory.Data
            });
            return getLocalImageSrc(thumbName);
        } catch (e) {
            // Thumbnail does not exist, we need to create it
        }

        // Read original image
        const originalData = await Filesystem.readFile({
            path: fileName,
            directory: Directory.Data
        });

        const base64Data = `data:image/jpeg;base64,${originalData.data}`;
        
        // Generate thumbnail using a canvas
        return new Promise<string>((resolve) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 150;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const thumbBase64 = canvas.toDataURL('image/jpeg', 0.6);
                    const pureBase64 = thumbBase64.split(',')[1];

                    try {
                        await Filesystem.writeFile({
                            path: thumbName,
                            data: pureBase64,
                            directory: Directory.Data
                        });
                        resolve(getLocalImageSrc(thumbName));
                    } catch (e) {
                        console.error("Failed to save thumbnail", e);
                        resolve(getLocalImageSrc(originalPathOrBase64));
                    }
                } else {
                    resolve(getLocalImageSrc(originalPathOrBase64));
                }
            };
            img.onerror = () => {
                resolve(getLocalImageSrc(originalPathOrBase64));
            };
            img.src = base64Data;
        });

    } catch (e) {
        console.error("Failed to create thumbnail", e);
        return getLocalImageSrc(originalPathOrBase64);
    }
}

/**
 * Saves a base64 file string to the device filesystem.
 * Returns the file path URI if successful, or null if it fails.
 */
export async function saveBase64File(base64Data: string, originalName: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    if (!Capacitor.isNativePlatform()) return null; // Fallback to base64 on Web
    try {
        const ext = originalName.split('.').pop() || 'file';
        const name = `file_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        
        let pureBase64 = base64Data;
        if (base64Data.includes(',')) {
            pureBase64 = base64Data.split(',')[1];
        }

        const savedFile = await Filesystem.writeFile({
            path: name,
            data: pureBase64,
            directory: Directory.Data,
        });
        return savedFile.uri;
    } catch (err) {
        console.error("Failed to save file to filesystem:", err);
        return null;
    }
}

export async function generateVideoThumbnail(videoUri: string): Promise<string | null> {
    if (typeof document === 'undefined') return null;
    return new Promise((resolve) => {
        try {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.playsInline = true;
            
            // Allow Web to load Capacitor file src if needed
            video.src = videoUri.startsWith('file://') ? Capacitor.convertFileSrc(videoUri) : videoUri;
            
            video.onloadeddata = () => {
                video.currentTime = 0.1; // Seek to 0.1s to ensure we get a frame
            };
            
            video.onseeked = async () => {
                try {
                    const maxDim = 480;
                    let w = video.videoWidth;
                    let h = video.videoHeight;
                    if (w > h && w > maxDim) {
                        h = Math.floor(h * (maxDim / w));
                        w = maxDim;
                    } else if (h > maxDim) {
                        w = Math.floor(w * (maxDim / h));
                        h = maxDim;
                    }
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(video, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    
                    // Devuelve base64 directamente (escalado ~10KB) para que se incluya en el JSON 
                    // y cumpla con la descarga liviana en el restore automáticamente.
                    resolve(dataUrl);
                } catch (e) {
                    console.error('Failed to generate thumbnail', e);
                    resolve(null);
                }
            };
            
            video.onerror = (e) => {
                console.error('Error loading video for thumbnail', e);
                resolve(null);
            };
        } catch (e) {
            console.error('Exception generating thumbnail', e);
            resolve(null);
        }
    });
}
