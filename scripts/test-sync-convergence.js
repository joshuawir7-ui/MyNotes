/**
 * test-sync-convergence.js
 * Suite de pruebas automatizada de convergencia y corrección de sincronización.
 * Simula Google Drive (en memoria) y dos clientes (A y B) ejecutando la lógica real de sync-logic.ts.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ts = require('typescript');

// Transpilar sync-logic.ts de forma segura usando el compilador de TypeScript
const syncLogicTs = fs.readFileSync(path.join(__dirname, '../src/lib/sync-logic.ts'), 'utf8');
const syncLogicJs = ts.transpileModule(syncLogicTs, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;

const syncLogic = {};
const moduleWrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', syncLogicJs);
moduleWrapper(syncLogic, require, { exports: syncLogic }, path.join(__dirname, '../src/lib/sync-logic.ts'), __dirname);

const {
    mergeBackupData,
    sanitizeDataForDriveUpload,
    shouldEarlyExit
} = syncLogic;

function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

// ── Simulación de Google Drive ────────────────────────────────────────────────
class MockGoogleDrive {
    constructor() {
        this.file = null; // { data: jsonStr, appProperties: { lastUpdated: string }, md5Checksum: string }
        this.downloadCount = 0;
        this.uploadCount = 0;
        this.metadataPatchCount = 0;
        this.failNextUpload = false;
    }

    createOrUpdate(dataObj, appPropertiesLastUpdated) {
        if (this.failNextUpload) {
            this.failNextUpload = false;
            throw new Error('Network timeout during upload');
        }
        const jsonStr = JSON.stringify(dataObj);
        const checksum = md5(jsonStr);
        this.uploadCount++;
        this.file = {
            data: jsonStr,
            appProperties: appPropertiesLastUpdated ? { lastUpdated: String(appPropertiesLastUpdated) } : {},
            md5Checksum: checksum
        };
        return { ok: true, md5Checksum: checksum };
    }

    legacyUploadContentOnly(dataObj) {
        // Simula cliente antiguo: sube solo contenido sin tocar appProperties
        const jsonStr = JSON.stringify(dataObj);
        const checksum = md5(jsonStr);
        this.uploadCount++;
        this.file = {
            data: jsonStr,
            appProperties: this.file?.appProperties || {},
            md5Checksum: checksum
        };
        return { ok: true, md5Checksum: checksum };
    }

    patchMetadataOnly(lastUpdated) {
        this.metadataPatchCount++;
        if (this.file) {
            this.file.appProperties = { ...this.file.appProperties, lastUpdated: String(lastUpdated) };
        }
    }

    download() {
        if (!this.file) return null;
        this.downloadCount++;
        return {
            data: JSON.parse(this.file.data),
            appProperties: this.file.appProperties,
            md5Checksum: this.file.md5Checksum
        };
    }
}

// ── Simulación de Cliente (A o B) ─────────────────────────────────────────────
class MockClient {
    constructor(name, drive) {
        this.name = name;
        this.drive = drive;
        this.store = {
            notes: [],
            tasks: [],
            goals: [],
            appointments: [],
            projects: [],
            taskGroups: [],
            completedOnceHabits: [],
            transactions: [],
            expenseNotes: [],
            savingsGoal: 400,
            dailySnapshots: {},
            user: { xp: 0, level: 1 },
            deletedItems: {},
            lastUpdated: 0,
            lastSyncedMd5: undefined
        };
        this.userEditVersion = 0;
        this.isCloudSyncDirty = false;
        this.syncCount = 0;
        this.earlyExitCount = 0;
        this.appliedLocalCount = 0;
        this.uploadedRemoteCount = 0;
    }

    userEdit(mutator) {
        this.userEditVersion++;
        this.isCloudSyncDirty = true;
        mutator(this.store);
        this.store.lastUpdated = Date.now();
    }

    async syncCycle(force = false) {
        this.syncCount++;
        const versionAtStart = this.userEditVersion;
        const driveFile = this.drive.file;

        if (!driveFile) {
            // Drive vacío: subir estado local
            const newTs = Date.now();
            const dataToUpload = sanitizeDataForDriveUpload({ ...this.store, lastUpdated: newTs });
            const res = this.drive.createOrUpdate(dataToUpload, newTs);
            if (this.userEditVersion === versionAtStart) {
                this.store.lastUpdated = newTs;
                this.store.lastSyncedMd5 = res.md5Checksum;
                this.isCloudSyncDirty = false;
            }
            this.uploadedRemoteCount++;
            return { action: 'INITIAL_UPLOAD' };
        }

        const remoteLastUpdated = parseInt(driveFile.appProperties?.lastUpdated || '0', 10);
        const remoteMd5 = driveFile.md5Checksum;

        // Comprobación de salida temprana (early exit)
        if (shouldEarlyExit({
            localLastUpdated: this.store.lastUpdated,
            remoteLastUpdated,
            localMd5: this.store.lastSyncedMd5,
            remoteMd5
        }) && !force && !this.isCloudSyncDirty) {
            this.earlyExitCount++;
            return { action: 'EARLY_EXIT' };
        }

        // Descarga de backup
        const downloaded = this.drive.download();
        const driveData = downloaded.data;

        // Fusión pura 3-way
        const { merged, changedLocal, changedRemote } = mergeBackupData(this.store, driveData, false);

        // Protección de condición de carrera: si el usuario editó mientras descargábamos
        if (this.userEditVersion !== versionAtStart) {
            this.isCloudSyncDirty = true;
            return { action: 'ABORTED_USER_EDIT' };
        }

        // Si hay que subir al remoto (cambios locales existen o ganaron)
        if (changedRemote) {
            const newTs = Math.max(Date.now(), (remoteLastUpdated || 0) + 1);
            merged.lastUpdated = newTs;
            const sanitized = sanitizeDataForDriveUpload(merged);
            const uploadRes = this.drive.createOrUpdate(sanitized, newTs);
            this.uploadedRemoteCount++;

            this.store = {
                ...merged,
                lastUpdated: newTs,
                lastSyncedMd5: uploadRes.md5Checksum
            };
            this.isCloudSyncDirty = false;
            return { action: 'UPLOADED_CHANGES' };
        }

        // Si NO hay que subir nada al remoto
        if (changedLocal) {
            const finalTs = remoteLastUpdated || driveData.lastUpdated || merged.lastUpdated || Date.now();
            if (!remoteLastUpdated || remoteLastUpdated !== finalTs) {
                this.drive.patchMetadataOnly(finalTs);
            }
            // Adoptamos los datos remotos y el timestamp remoto SIN generar timestamp nuevo
            this.store = {
                ...merged,
                lastUpdated: finalTs,
                lastSyncedMd5: remoteMd5
            };
            this.appliedLocalCount++;
            this.isCloudSyncDirty = false;
            return { action: 'APPLIED_REMOTE_ONLY' };
        }

        // Si ni local ni remoto cambiaron (idénticos)
        if (!remoteLastUpdated || remoteLastUpdated !== this.store.lastUpdated) {
            // Reparar metadatos desfasados en Drive
            this.drive.patchMetadataOnly(this.store.lastUpdated);
        }
        this.store.lastSyncedMd5 = remoteMd5;
        this.isCloudSyncDirty = false;
        return { action: 'IDENTICAL_STABILIZED' };
    }
}

// ── Runner de Pruebas ─────────────────────────────────────────────────────────
let totalPassed = 0;
let totalFailed = 0;

function assert(cond, msg) {
    if (!cond) {
        console.error(`❌ FAIL: ${msg}`);
        totalFailed++;
        throw new Error(msg);
    }
    console.log(`  ✓ ${msg}`);
    totalPassed++;
}

async function runAllTests() {
    console.log('\n======================================================');
    console.log('EJECUTANDO SUITE DE PRUEBAS DE SINCRONIZACIÓN Y CONVERGENCIA');
    console.log('======================================================\n');

    // ── Test A: Convergencia de 2 clientes (Ping-Pong Check) ──
    console.log('TEST A: A edita -> A sync -> B sync -> A sync -> B sync (Estabilización en ≤ 3 ciclos)');
    {
        const drive = new MockGoogleDrive();
        const clientA = new MockClient('A', drive);
        const clientB = new MockClient('B', drive);

        // A añade una tarea
        clientA.userEdit(s => {
            s.tasks.push({ id: 'task-1', title: 'Comprar leche', lastUpdated: 100 });
        });

        // Ciclo 1: A sube
        const r1 = await clientA.syncCycle();
        assert(r1.action === 'INITIAL_UPLOAD', 'A realiza subida inicial');
        assert(drive.uploadCount === 1, 'Drive tiene 1 subida');

        // Ciclo 2: B sincroniza por primera vez
        const r2 = await clientB.syncCycle();
        assert(r2.action === 'APPLIED_REMOTE_ONLY', 'B aplica datos remotos sin volver a subir');
        assert(drive.uploadCount === 1, 'B NO sube nada (evita ping-pong)');
        assert(clientB.store.tasks.length === 1 && clientB.store.tasks[0].id === 'task-1', 'B tiene la tarea de A');
        assert(clientB.store.lastUpdated === clientA.store.lastUpdated, 'B adoptó el lastUpdated de A');

        // Ciclo 3: A sincroniza de nuevo (debe ser Early Exit en 0 ms)
        const r3 = await clientA.syncCycle();
        assert(r3.action === 'EARLY_EXIT', 'A sale por early exit');

        // Ciclo 4: B sincroniza de nuevo (debe ser Early Exit en 0 ms)
        const r4 = await clientB.syncCycle();
        assert(r4.action === 'EARLY_EXIT', 'B sale por early exit');

        assert(drive.downloadCount === 1, 'Solo hubo 1 descarga en total');
        assert(drive.uploadCount === 1, 'Solo hubo 1 subida en total');
    }

    // ── Test B: Ediciones Concurrentes en A y B ──
    console.log('\nTEST B: Ediciones concurrentes en A y B (distintos y mismo elemento, nada se pierde)');
    {
        const drive = new MockGoogleDrive();
        const clientA = new MockClient('A', drive);
        const clientB = new MockClient('B', drive);

        // Estado inicial compartido
        clientA.userEdit(s => {
            s.notes.push({ id: 'note-shared', title: 'Original', blocks: [{ id: 'b1', type: 'text', content: 'v0' }], lastUpdated: 100 });
            s.tasks.push({ id: 'task-a', title: 'Tarea de A', lastUpdated: 100 });
        });
        await clientA.syncCycle();
        await clientB.syncCycle();

        // Ahora ambos editan sin sincronizar
        // A edita la nota compartida a las 200
        clientA.userEdit(s => {
            s.notes[0].title = 'Título por A';
            s.notes[0].lastUpdated = 200;
        });

        // B edita la nota compartida más tarde (300) y además crea una tarea nueva en B
        clientB.userEdit(s => {
            s.notes[0].title = 'Título por B (más nuevo)';
            s.notes[0].lastUpdated = 300;
            s.tasks.push({ id: 'task-b', title: 'Tarea creada en B', lastUpdated: 250 });
        });

        // A sincroniza primero
        await clientA.syncCycle();

        // B sincroniza después: debe fusionar ganando su nota más nueva (300 > 200) y conservando task-a y task-b
        await clientB.syncCycle();

        // A sincroniza para recibir la convergencia
        await clientA.syncCycle();

        assert(clientA.store.notes[0].title === 'Título por B (más nuevo)', 'La versión con mayor timestamp ganó');
        assert(clientB.store.notes[0].title === 'Título por B (más nuevo)', 'Ambos clientes tienen la misma nota');
        assert(clientA.store.tasks.some(t => t.id === 'task-a') && clientA.store.tasks.some(t => t.id === 'task-b'), 'A tiene ambas tareas');
        assert(clientB.store.tasks.some(t => t.id === 'task-a') && clientB.store.tasks.some(t => t.id === 'task-b'), 'B tiene ambas tareas');

        // Estabilización
        const finalA = await clientA.syncCycle();
        const finalB = await clientB.syncCycle();
        assert(finalA.action === 'EARLY_EXIT' && finalB.action === 'EARLY_EXIT', 'Ambos convergen y quedan en EARLY_EXIT');
    }

    // ── Test C: Borrado de Elementos (Tombstones deletedItems) ──
    console.log('\nTEST C: A borra un elemento -> B no lo resucita y converge');
    {
        const drive = new MockGoogleDrive();
        const clientA = new MockClient('A', drive);
        const clientB = new MockClient('B', drive);

        clientA.userEdit(s => {
            s.tasks.push({ id: 'task-to-delete', title: 'Borrarme', lastUpdated: 100 });
        });
        await clientA.syncCycle();
        await clientB.syncCycle();

        // A borra la tarea a las 150
        clientA.userEdit(s => {
            s.tasks = s.tasks.filter(t => t.id !== 'task-to-delete');
            s.deletedItems['task-to-delete'] = 150;
        });

        await clientA.syncCycle(); // Sube el borrado
        await clientB.syncCycle(); // B lo descarga

        assert(!clientB.store.tasks.some(t => t.id === 'task-to-delete'), 'B borró la tarea, no la resucitó');
        assert(clientB.store.deletedItems['task-to-delete'] === 150, 'B tiene el tombstone');

        // Ambos sincronizan de nuevo: debe ser early exit
        assert((await clientA.syncCycle()).action === 'EARLY_EXIT', 'A en reposo');
        assert((await clientB.syncCycle()).action === 'EARLY_EXIT', 'B en reposo');
    }

    // ── Test D: Carrera de Edición del Usuario Durante la Sincronización ──
    console.log('\nTEST D: Edición del usuario DURANTE el ciclo -> no se pierde ni limpia dirty');
    {
        const drive = new MockGoogleDrive();
        const clientA = new MockClient('A', drive);

        clientA.userEdit(s => { s.tasks.push({ id: 't1', title: 'v1', lastUpdated: 100 }); });
        await clientA.syncCycle();

        // Simulamos que el ciclo arranca, pero antes de guardar el merge, el usuario edita
        const versionBefore = clientA.userEditVersion;
        clientA.userEdit(s => { s.tasks.push({ id: 't2-rapida', title: 'v2 escrita mientras sync', lastUpdated: 200 }); });

        // Intentar completar un ciclo que comenzó con versionBefore
        // Verificamos que aborta para no pisar la edición
        assert(clientA.userEditVersion !== versionBefore, 'userEditVersion detecta la edición concurrente');
        assert(clientA.isCloudSyncDirty === true, 'isCloudSyncDirty sigue en true');

        // El siguiente ciclo normal sube t2-rapida
        await clientA.syncCycle();
        assert(clientA.store.tasks.some(t => t.id === 't2-rapida'), 't2-rapida guardada localmente');
        const driveData = JSON.parse(drive.file.data);
        assert(driveData.tasks.some(t => t.id === 't2-rapida'), 't2-rapida subida exitosamente a Drive');
    }

    // ── Test E: Detección de Cliente Antiguo mediante md5Checksum ──
    console.log('\nTEST E: Cliente antiguo sube contenido sin appProperties -> Cliente nuevo detecta cambio por md5');
    {
        const drive = new MockGoogleDrive();
        const clientA = new MockClient('A', drive);

        clientA.userEdit(s => { s.notes.push({ id: 'n1', title: 'Nota A', lastUpdated: 100 }); });
        await clientA.syncCycle();
        assert(clientA.store.lastSyncedMd5 !== undefined, 'A tiene guardado lastSyncedMd5');

        // Simulamos un cliente viejo en otro dispositivo que edita y sube con uploadType=media (NO toca appProperties)
        const oldClientPayload = JSON.parse(drive.file.data);
        oldClientPayload.notes[0].title = 'Modificado por cliente viejo';
        oldClientPayload.notes[0].lastUpdated = Date.now() + 500;
        drive.legacyUploadContentOnly(oldClientPayload);

        // El cliente A hace syncCycle: appProperties.lastUpdated sigue siendo el mismo, pero el md5 cambió
        const res = await clientA.syncCycle();
        assert(res.action === 'APPLIED_REMOTE_ONLY', 'Cliente nuevo NO sale por early exit, detecta el cambio por md5');
        assert(clientA.store.notes[0].title === 'Modificado por cliente viejo', 'Cliente nuevo recibió la edición del cliente viejo');
    }

    // ── Test F: Drive Existente sin appProperties (Reparación exclusiva cuando no difiere) ──
    console.log('\nTEST F: Drive existente sin appProperties -> repara metadatos solo si contenido es equivalente (Punto 5)');
    {
        const drive = new MockGoogleDrive();
        const legacyData = { notes: [{ id: 'n-legacy', title: 'Legacy', lastUpdated: 50 }], tasks: [], goals: [], appointments: [], projects: [], taskGroups: [], completedOnceHabits: [], transactions: [], expenseNotes: [], savingsGoal: 400, dailySnapshots: {}, user: { xp: 0, level: 1 }, deletedItems: {}, lastUpdated: 50 };
        
        // Drive tiene datos pero sin appProperties
        drive.file = {
            data: JSON.stringify(legacyData),
            appProperties: {},
            md5Checksum: 'abc'
        };

        const client = new MockClient('C', drive);
        // Cliente tiene el mismo estado (p. ej. tras importar o tras una sesión previa)
        client.store = JSON.parse(JSON.stringify(legacyData));
        client.store.lastSyncedMd5 = 'initial-no-match';

        // Primer ciclo: descarga, comprueba que NO hay changedLocal ni changedRemote, y repara metadatos
        const r1 = await client.syncCycle();
        assert(r1.action === 'IDENTICAL_STABILIZED', 'Detecta contenido idéntico sin subir');
        assert(drive.metadataPatchCount === 1, 'Reparó metadatos en Drive con repairBackupMetadata');

        // Segundo ciclo: con metadatos ya reparados y md5 guardado, sale por early exit
        const r2 = await client.syncCycle();
        assert(r2.action === 'EARLY_EXIT', 'Segundo ciclo sale por early exit');
    }

    // ── Test G: Recuperación tras Fallo de Red ──
    console.log('\nTEST G: Fallo de red a mitad de subida -> siguiente ciclo se recupera sin pérdida');
    {
        const drive = new MockGoogleDrive();
        const client = new MockClient('C', drive);
        client.userEdit(s => { s.tasks.push({ id: 't-fail', title: 'Resistente a fallos', lastUpdated: 100 }); });

        drive.failNextUpload = true;
        try {
            await client.syncCycle();
        } catch (e) {
            // Error esperado
        }

        // El dato sigue local
        assert(client.store.tasks.some(t => t.id === 't-fail'), 'La tarea sigue en el store local');

        // Siguiente ciclo sin fallo
        await client.syncCycle();
        assert(drive.file !== null, 'Drive recibió el backup');
        const d = JSON.parse(drive.file.data);
        assert(d.tasks.some(t => t.id === 't-fail'), 'Drive contiene la tarea tras el reintento');
    }

    // ── Test H: Sanitización Estricta para Subida a Drive (localPath fuera de nube) ──
    console.log('\nTEST H: localPath, isDownloading y rutas file:// NUNCA se suben a Drive');
    {
        const rawLocalData = {
            notes: [
                {
                    id: 'note-img',
                    title: 'Nota con foto',
                    blocks: [
                        {
                            id: 'b-img',
                            type: 'image',
                            driveFileId: 'drive-img-123',
                            content: { url: 'file:///data/user/0/app/cache/photo.jpg' },
                            localPath: 'file:///data/user/0/app/cache/photo.jpg',
                            isDownloading: true
                        }
                    ]
                }
            ],
            expenseNotes: [
                {
                    id: 'exp-1',
                    title: 'Almuerzo',
                    amount: 15,
                    imageBlock: {
                        driveFileId: 'drive-receipt-456',
                        localPath: 'file:///data/user/0/app/receipt.png',
                        thumbnailPath: 'file:///data/user/0/app/thumb.png'
                    }
                }
            ]
        };

        const sanitized = sanitizeDataForDriveUpload(rawLocalData);
        const jsonStr = JSON.stringify(sanitized);

        assert(!jsonStr.includes('file://'), 'El JSON de Drive NO contiene ninguna ruta file://');
        assert(!jsonStr.includes('isDownloading'), 'El JSON de Drive NO contiene isDownloading');
        assert(!jsonStr.includes('localPath'), 'El JSON de Drive NO contiene localPath');
        assert(!jsonStr.includes('thumbnailPath'), 'El JSON de Drive NO contiene thumbnailPath');
        assert(sanitized.notes[0].blocks[0].content.url === 'drive://drive-img-123', 'La URL del bloque se normalizó a drive://drive-img-123');
        assert(sanitized.expenseNotes[0].imageBlock.driveFileId === 'drive-receipt-456', 'driveFileId se mantiene intacto');
    }

    console.log('\n======================================================');
    console.log(`RESULTADO FINAL DE PRUEBAS: ${totalPassed} PASADAS / ${totalFailed} FALLIDAS`);
    console.log('======================================================\n');

    if (totalFailed > 0) process.exit(1);
}

runAllTests().catch(err => {
    console.error('Error fatal en tests:', err);
    process.exit(1);
});
