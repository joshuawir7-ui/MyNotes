/**
 * drive-folder-manager.ts
 * Administrador de la jerarquía de carpetas organizadas en Google Drive para MyNotes:
 * 
 * Mi unidad /
 * └── MyNotes Backup/
 *     ├── mynotes_backup.json
 *     ├── Images/
 *     ├── Videos/
 *     ├── Audio/
 *     └── Documents/
 * 
 * Utiliza el scope oficial 'drive.file' sin requerir permisos adicionales en Google Console.
 * Gestiona el caché de IDs para no realizar consultas innecesarias de red.
 */

export interface DriveFolders {
    backupFolderId: string;
    imagesFolderId: string;
    videosFolderId: string;
    audioFolderId: string;
    documentsFolderId: string;
}

export type AttachmentCategory = 'images' | 'videos' | 'audio' | 'documents';

// Caché en memoria para evitar llamadas redundantes a la API de Drive
let cachedFolders: DriveFolders | null = null;
let folderPromise: Promise<DriveFolders> | null = null;

export const clearDriveFolderCache = () => {
    cachedFolders = null;
    folderPromise = null;
};

/**
 * Clasifica un archivo en una de las 4 categorías según su tipo de bloque, nombre y MIME type.
 */
export const classifyAttachmentCategory = (
    blockType: string = '',
    fileName: string = '',
    mimeType: string = ''
): AttachmentCategory => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mime = (mimeType || '').toLowerCase();

    if (blockType === 'drawing') return 'images';
    if (blockType === 'image' || mime.startsWith('image/')) return 'images';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic', 'heif', 'bmp', 'ico'].includes(ext)) return 'images';

    if (blockType === 'video' || mime.startsWith('video/')) return 'videos';
    if (['mp4', 'webm', 'mov', 'mkv', 'avi', '3gp', 'wmv', 'flv'].includes(ext)) return 'videos';

    if (mime.startsWith('audio/')) return 'audio';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma', 'alac', 'aiff'].includes(ext)) return 'audio';

    return 'documents';
};

/**
 * Obtiene el ID de la subcarpeta correspondiente a un archivo específico.
 */
export const getTargetSubfolderId = (
    folders: DriveFolders,
    blockType: string = '',
    fileName: string = '',
    mimeType: string = ''
): string => {
    const category = classifyAttachmentCategory(blockType, fileName, mimeType);
    switch (category) {
        case 'images': return folders.imagesFolderId;
        case 'videos': return folders.videosFolderId;
        case 'audio': return folders.audioFolderId;
        case 'documents': return folders.documentsFolderId;
        default: return folders.documentsFolderId;
    }
};

/**
 * Helper interno para buscar una carpeta por nombre y padre en Google Drive.
 */
async function findFolder(token: string, name: string, parentId?: string): Promise<string | null> {
    const qParts = [
        `name = '${name.replace(/'/g, "\\'")}'`,
        `mimeType = 'application/vnd.google-apps.folder'`,
        `trashed = false`
    ];
    if (parentId) {
        qParts.push(`'${parentId}' in parents`);
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qParts.join(' and '))}&fields=files(id,name)&spaces=drive`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
        console.warn(`[DriveFolders] Error buscando carpeta '${name}': ${res.status}`);
        return null;
    }

    const data = await res.json();
    return data.files?.[0]?.id || null;
}

/**
 * Helper interno para crear una carpeta en Google Drive.
 */
async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
    const metadata: { name: string; mimeType: string; parents?: string[] } = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) {
        metadata.parents = [parentId];
    }

    const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`[DriveFolders] Error creando carpeta '${name}' (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.id;
}

/**
 * Asegura la existencia de una carpeta (la busca o la crea si no existe).
 */
async function ensureFolder(token: string, name: string, parentId?: string): Promise<string> {
    const existingId = await findFolder(token, name, parentId);
    if (existingId) return existingId;
    return await createFolder(token, name, parentId);
}

/**
 * Inicializa y devuelve la estructura completa de carpetas organizadas en Google Drive:
 * MyNotes Backup -> Images, Videos, Audio, Documents.
 * Utiliza promesas concurrentes y caché en memoria para máxima velocidad.
 */
export async function getOrCreateBackupFolderStructure(token: string): Promise<DriveFolders> {
    if (cachedFolders) return cachedFolders;
    if (folderPromise) return folderPromise;

    folderPromise = (async () => {
        try {
            // 1. Asegurar carpeta raíz "MyNotes Backup"
            const backupFolderId = await ensureFolder(token, 'MyNotes Backup');

            // 2. Asegurar las 4 subcarpetas en paralelo dentro de "MyNotes Backup"
            const [imagesFolderId, videosFolderId, audioFolderId, documentsFolderId] = await Promise.all([
                ensureFolder(token, 'Images', backupFolderId),
                ensureFolder(token, 'Videos', backupFolderId),
                ensureFolder(token, 'Audio', backupFolderId),
                ensureFolder(token, 'Documents', backupFolderId)
            ]);

            const structure: DriveFolders = {
                backupFolderId,
                imagesFolderId,
                videosFolderId,
                audioFolderId,
                documentsFolderId
            };

            cachedFolders = structure;
            console.log('[DriveFolders] Estructura de carpetas sincronizada en Drive:', structure);
            return structure;
        } finally {
            folderPromise = null;
        }
    })();

    return folderPromise;
}

/**
 * Mueve un archivo existente de Drive a una carpeta destino y lo quita de sus padres anteriores.
 */
export async function moveDriveFile(
    token: string,
    fileId: string,
    targetFolderId: string,
    currentParents?: string[]
): Promise<boolean> {
    try {
        const removeParam = (currentParents && currentParents.length > 0)
            ? currentParents.join(',')
            : 'root';

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${targetFolderId}&removeParents=${removeParam}&fields=id,parents`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            console.warn(`[DriveFolders] No se pudo mover archivo ${fileId}: ${res.status}`);
            return false;
        }
        return true;
    } catch (e) {
        console.warn(`[DriveFolders] Excepción moviendo archivo ${fileId}:`, e);
        return false;
    }
}

/**
 * Detecta y reorganiza automáticamente los archivos que MyNotes haya subido previamente a la raíz ('Mi unidad'),
 * moviéndolos a sus subcarpetas correspondientes sin alterar sus enlaces ni identificadores.
 */
export async function organizeLooseDriveFiles(token: string, folders: DriveFolders): Promise<{ movedCount: number }> {
    try {
        // Consultar archivos accesibles en la raíz creados por la aplicación
        const q = `'root' in parents and trashed = false and name != 'MyNotes Backup'`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,parents)&pageSize=100`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            console.warn('[DriveFolders] No se pudieron consultar archivos sueltos en raíz:', res.status);
            return { movedCount: 0 };
        }

        const data = await res.json();
        const files: Array<{ id: string; name: string; mimeType: string; parents?: string[] }> = data.files || [];

        if (files.length === 0) {
            return { movedCount: 0 };
        }

        console.log(`[DriveFolders] Se encontraron ${files.length} archivos sueltos en la raíz de Drive. Reorganizando...`);
        let movedCount = 0;

        for (const file of files) {
            // Si es el archivo de respaldo JSON -> a la carpeta raíz de MyNotes Backup
            if (file.name === 'mynotes_backup.json') {
                const moved = await moveDriveFile(token, file.id, folders.backupFolderId, file.parents);
                if (moved) movedCount++;
                continue;
            }

            // Si es un adjunto -> a la subcarpeta correspondiente (Images, Videos, Audio, Documents)
            const targetFolderId = getTargetSubfolderId(folders, '', file.name, file.mimeType);
            const moved = await moveDriveFile(token, file.id, targetFolderId, file.parents);
            if (moved) movedCount++;
        }

        console.log(`[DriveFolders] Reorganización finalizada: ${movedCount} archivos movidos a sus carpetas.`);
        return { movedCount };
    } catch (e) {
        console.error('[DriveFolders] Error durante la reorganización de archivos sueltos:', e);
        return { movedCount: 0 };
    }
}

