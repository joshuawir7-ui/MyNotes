"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { Settings, Bell, X, Download, Upload, Zap, Cloud, LogOut, RefreshCw, Loader2, Sparkles } from "lucide-react"
import { useStore, readAllNotesFromDisk, readAllTasksFromDisk } from "@/lib/store"
import { translations } from "@/lib/translations"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { LanguageToggle } from "@/components/ui/language-toggle"
import { Capacitor } from "@capacitor/core"
import { NotificationDialog } from "@/components/ui/notification-dialog"
import { useRouter } from "next/navigation"

export function SettingsDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const language = useStore(state => state.language)
    const setLanguage = useStore(state => state.setLanguage)
    const notificationsEnabled = useStore(state => state.notificationsEnabled)
    const setNotificationsEnabled = useStore(state => state.setNotificationsEnabled)
    const focusEffectEnabled = useStore(state => state.focusEffectEnabled)
    const setFocusEffectEnabled = useStore(state => state.setFocusEffectEnabled)
    const googleUser = useStore(state => state.googleUser)
    const setGoogleUser = useStore(state => state.setGoogleUser)
    const googleSessionExpired = useStore(state => state.googleSessionExpired)
    const isSyncingCloud = useStore(state => state.isSyncingCloud)
    const syncError = useStore(state => state.syncError)
    const lastCloudSync = useStore(state => state.lastCloudSync)
    const syncWithGoogleDrive = useStore(state => state.syncWithGoogleDrive)
    const restoreFromGoogleDrive = useStore(state => state.restoreFromGoogleDrive)
    const autoSyncGoogleDrive = useStore(state => state.autoSyncGoogleDrive)
    const showToast = useStore(state => state.showToast)
    const startTourManually = useStore(state => state.startTourManually)
    const t = translations[language] as any

    const [notifState, setNotifState] = useState<{
        isOpen: boolean
        title: string
        message: string
        type: "success" | "error" | "warning" | "info"
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info"
    })

    const [localSyncing, setLocalSyncing] = useState(false)
    const [localRestoring, setLocalRestoring] = useState(false)
    const [isRecovering, setIsRecovering] = useState(false)
    const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)

    // Micro-animation triggers
    const [bellAnimate, setBellAnimate] = useState(false)
    const [zapAnimate, setZapAnimate] = useState(false)
    const [exportAnimate, setExportAnimate] = useState(false)
    const [importAnimate, setImportAnimate] = useState(false)
    const [smartImportAnimate, setSmartImportAnimate] = useState(false)
    const [downloadBackupAnimate, setDownloadBackupAnimate] = useState(false)

    // Framer Motion icon micro-animations
    const bellVariants: Variants = {
        normal: { rotate: 0, scale: 1 },
        hover: { 
            rotate: [0, -15, 15, -12, 12, -8, 8, -4, 4, 0],
            scale: 1.15,
            transition: { duration: 0.65, ease: "easeInOut" } 
        },
        active: {
            scale: [1, 1.25, 0.9, 1.1, 1],
            rotate: [0, -25, 25, -15, 15, 0],
            transition: { duration: 0.6, ease: "easeInOut" }
        },
        inactive: {
            scale: [1, 0.85, 1],
            rotate: [0, 10, -10, 0],
            transition: { duration: 0.4, ease: "easeInOut" }
        }
    }

    const zapVariants: Variants = {
        normal: { scale: 1, rotate: 0, y: 0 },
        hover: { 
            scale: 1.25,
            rotate: [0, -15, 20, -15, 10, -5, 0],
            y: -3,
            transition: { duration: 0.55, ease: "easeInOut" } 
        },
        active: {
            scale: [1, 1.35, 0.85, 1.15, 1],
            rotate: [0, 20, -20, 0],
            transition: { duration: 0.55, ease: "easeInOut" }
        },
        inactive: {
            scale: [1, 0.85, 1],
            rotate: [0, -10, 10, 0],
            transition: { duration: 0.4, ease: "easeInOut" }
        }
    }

    const exportVariants: Variants = {
        normal: { y: 0, scaleY: 1 },
        hover: { 
            y: [0, 3, -1, 1, 0],
            scaleY: [1, 0.9, 1.05, 0.98, 1],
            transition: { duration: 0.5 } 
        },
        tap: { scale: 0.9, y: 3 }
    }

    const importVariants: Variants = {
        normal: { y: 0, scaleY: 1 },
        hover: { 
            y: [0, -3, 1, -1, 0],
            scaleY: [1, 0.9, 1.05, 0.98, 1],
            transition: { duration: 0.5 } 
        },
        tap: { scale: 0.9, y: -3 }
    }

    const smartImportVariants: Variants = {
        normal: { rotate: 0, scale: 1 },
        hover: { 
            rotate: 180, 
            scale: 1.15,
            transition: { type: "spring", stiffness: 200, damping: 12 }
        },
        tap: { rotate: -90, scale: 0.85 }
    }

    const downloadBackupVariants: Variants = {
        normal: { y: 0, scaleY: 1 },
        hover: { 
            y: [0, 2, -1, 1, 0],
            scaleY: [1, 0.95, 1.02, 0.99, 1],
            transition: { duration: 0.4 } 
        },
        tap: { scale: 0.95, y: 2 }
    }

    const showNotif = (title: string, message: string, type: "success" | "error" | "warning" | "info") => {
        setNotifState({
            isOpen: true,
            title,
            message,
            type
        })
    }

    useEffect(() => {
        if (isOpen) {
            useStore.setState({ isSyncingCloud: false });
        }
    }, [isOpen])

    // Listen for the event fired by CloudPrompt when the user taps "Sign in" / "Reconnect"
    useEffect(() => {
        const handleOpenCloud = () => {
            setIsOpen(true);
            // Short delay so the dialog renders before we call the sign-in flow
            setTimeout(() => {
                handleGoogleLogin();
            }, 400);
        };
        window.addEventListener("mynotes:open-settings-cloud", handleOpenCloud);
        return () => window.removeEventListener("mynotes:open-settings-cloud", handleOpenCloud);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setMounted(true)
        // Force reset syncing state on mount to prevent stuck greyed-out buttons
        useStore.setState({ isSyncingCloud: false });

        // Only initialize capacitor-google-auth on native platforms
        // On web we use Google Identity Services (GSI) directly
        if (Capacitor.isNativePlatform()) {
            import('@codetrix-studio/capacitor-google-auth').then(({ GoogleAuth }) => {
                if (typeof window !== 'undefined') {
                    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '309899943436-gp6o1oaqpij5qq6sal77f6dr15lh61fp.apps.googleusercontent.com';
                    GoogleAuth.initialize({
                        clientId,
                        scopes: [
                            'https://www.googleapis.com/auth/userinfo.profile',
                            'https://www.googleapis.com/auth/userinfo.email',
                            'https://www.googleapis.com/auth/drive.file'
                        ],
                        grantOfflineAccess: true
                    });
                }
            });
        }
    }, [])

    // ──────────────────────────────────────────────────────
    // WEB LOGIN: uses Google Identity Services (GSI) directly
    // Avoids the Capacitor native plugin on browsers
    // ──────────────────────────────────────────────────────
    const handleGoogleLoginWeb = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '309899943436-gp6o1oaqpij5qq6sal77f6dr15lh61fp.apps.googleusercontent.com';
            const gsi = (window as any).google?.accounts?.oauth2;
            if (!gsi) {
                reject(new Error('Google Identity Services not loaded'));
                return;
            }
            const client = gsi.initTokenClient({
                client_id: clientId,
                scope: [
                    'https://www.googleapis.com/auth/userinfo.profile',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/drive.file'
                ].join(' '),
                callback: async (tokenResponse: any) => {
                    if (tokenResponse.error) {
                        reject(new Error(tokenResponse.error));
                        return;
                    }
                    try {
                        // Fetch user profile with the access token
                        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                        });
                        const profile = await profileRes.json();
                        setGoogleUser({
                            name: profile.name || '',
                            email: profile.email || '',
                            imageUrl: profile.picture || '',
                            accessToken: tokenResponse.access_token,
                            isDemo: false
                        });
                        showNotif(
                            language === 'es' ? "Sesión Iniciada" : "Logged In",
                            language === 'es' ? `Bienvenido, ${profile.name}` : `Welcome, ${profile.name}`,
                            "success"
                        );
                        setTimeout(() => {
                            import('@/lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
                        }, 500);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                },
                // Force account chooser every time
                prompt: 'select_account',
            });
            client.requestAccessToken();
        });
    };

    // ──────────────────────────────────────────────────────
    // MOBILE LOGIN: uses capacitor-google-auth (native SDK)
    // ──────────────────────────────────────────────────────
    const handleGoogleLoginNative = async () => {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        // Sign out first to always show the account chooser
        await GoogleAuth.signOut().catch(() => { });
        console.log("Calling GoogleAuth.signIn (native)");
        const result = await GoogleAuth.signIn();
        if (result) {
            const accessToken = ((result as any).authentication?.accessToken || (result as any).accessToken) || undefined;
            setGoogleUser({
                name: result.displayName || '',
                email: result.email || '',
                imageUrl: result.imageUrl || '',
                accessToken,
                isDemo: false
            });
            if (result.serverAuthCode) {
                try {
                    const { registerPlugin } = await import('@capacitor/core');
                    const CloudAuth = registerPlugin('CloudAuth');
                    await (CloudAuth as any).exchangeAndSaveTokens({ authCode: result.serverAuthCode });
                    console.log("Tokens exchanged and saved securely via native plugin.");
                } catch (err) {
                    console.error("Failed to exchange serverAuthCode natively", err);
                }
            }
            showNotif(
                language === 'es' ? "Sesión Iniciada" : "Logged In",
                language === 'es' ? `Bienvenido, ${result.displayName}` : `Welcome, ${result.displayName}`,
                "success"
            );
            setTimeout(() => {
                import('@/lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
            }, 500);
        }
    };

    // ──────────────────────────────────────────────────────
    // ENTRY POINT: routes to the correct login flow
    // ──────────────────────────────────────────────────────
    const handleGoogleLogin = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                await handleGoogleLoginNative();
            } else {
                await handleGoogleLoginWeb();
            }
        } catch (err: any) {
            console.error("Google login failed", err);
            showNotif(
                language === 'es' ? "Error de Login" : "Login Error",
                language === 'es' ? "No se pudo iniciar sesión con Google." : "Could not sign in with Google.",
                "error"
            );
        }
    };

    const handleDemoLogin = () => {
        setGoogleUser({
            name: "Alex Dev (Demo)",
            email: "alex.dev@demo.com",
            imageUrl: "https://lh3.googleusercontent.com/a/default-user=s96-c",
            accessToken: "demo-token",
            isDemo: true
        });
        showNotif(
            language === 'es' ? "Sesión Demo" : "Demo Session",
            language === 'es' ? "Iniciaste sesión con un perfil de prueba." : "Logged in with a test profile.",
            "success"
        );
        setTimeout(() => {
            import('@/lib/store').then(({ triggerBackgroundSync }) => triggerBackgroundSync());
        }, 500);
    };

    const handleGoogleLogout = async () => {
        // 1. Flush all pending writes to disk BEFORE clearing the account,
        //    so data is never lost if the app closes right after logout.
        try {
            const {
                flushStorage,
                readAllNotesFromDisk,
                readAllTasksFromDisk,
                saveAllNotesToDisk,
                saveAllTasksToDisk
            } = await import('@/lib/store');
            const state = useStore.getState();
            // Ensure full notes/tasks are persisted to disk immediately
            const fullNotes = await readAllNotesFromDisk(state.notes);
            const fullTasks = await readAllTasksFromDisk(state.tasks);
            await saveAllNotesToDisk(fullNotes);
            await saveAllTasksToDisk(fullTasks);
            await flushStorage();
        } catch (e) {
            console.warn('[Logout] Could not flush storage before logout:', e);
        }

        // 2. Sign out from Google SDK
        try {
            const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
            await GoogleAuth.signOut().catch(() => { });
        } catch (e) { }

        // 3. Clear only the Google account from state (data stays in local storage)
        setGoogleUser(null);
        showNotif(
            language === 'es' ? "Sesión Cerrada" : "Logged Out",
            language === 'es' ? "Sesión de Google cerrada. Tus datos se conservan localmente." : "Google session closed. Your data is kept locally.",
            "info"
        );
    };

    const handleCloudSync = async () => {
        setLocalSyncing(true);
        try {
            const success = await syncWithGoogleDrive();
            if (success) {
                showToast(language === 'es' ? "Sincronización completada" : "Sync completed", "success");
            } else {
                const errorMsg = useStore.getState().syncError || "";
                showNotif(
                    language === 'es' ? "Error" : "Error",
                    language === 'es' 
                        ? `Error al sincronizar con Google Drive: ${errorMsg}` 
                        : `Error syncing with Google Drive: ${errorMsg}`,
                    "error"
                );
            }
        } catch (err) {
            console.error("handleCloudSync error", err);
        } finally {
            setLocalSyncing(false);
        }
    };

    const handleCloudRestore = async () => {
        setLocalRestoring(true);
        try {
            const success = await restoreFromGoogleDrive();
            if (success) {
                showToast(language === 'es' ? "Elementos de la nube restaurados" : "Cloud elements restored", "success");
            } else {
                const errorMsg = useStore.getState().syncError || "";
                showNotif(
                    language === 'es' ? "Error" : "Error",
                    language === 'es' 
                        ? `No se encontró respaldo o hubo un error al restaurar: ${errorMsg}` 
                        : `No backup found or error restoring: ${errorMsg}`,
                    "error"
                );
            }
        } catch (err) {
            console.error("handleCloudRestore error", err);
        } finally {
            setLocalRestoring(false);
        }
    };

    const handleRecoverImages = async () => {
        setIsRecovering(true);
        setRecoveryMessage(null);
        try {
            const { recoverImagesFromDriveRevisions } = await import('@/lib/store');
            const result = await recoverImagesFromDriveRevisions();
            setRecoveryMessage(result.message);
            if (result.recovered > 0) {
                showToast(
                    language === 'es'
                        ? `${result.recovered} imagen(es) recuperadas`
                        : `${result.recovered} image(s) recovered`,
                    'success'
                );
            } else {
                showNotif(
                    language === 'es' ? 'Recuperación de imágenes' : 'Image Recovery',
                    result.message,
                    result.recovered === 0 && result.failed === 0 ? 'info' : 'warning'
                );
            }
        } catch (err) {
            console.error('handleRecoverImages error', err);
            setRecoveryMessage(String(err));
        } finally {
            setIsRecovering(false);
        }
    };

    const handleExport = async () => {
        const state = useStore.getState();
        const fullNotes = await readAllNotesFromDisk(state.notes);
        const fullTasks = await readAllTasksFromDisk(state.tasks);
        const dataToExport = {
            notes: fullNotes,
            tasks: fullTasks,
            goals: state.goals,
            appointments: state.appointments,
            projects: state.projects,
            taskGroups: state.taskGroups,
            dailySnapshots: state.dailySnapshots,
            user: state.user
        };
        const jsonStr = JSON.stringify(dataToExport, null, 2);
        const fileName = `mynotes_backup_${new Date().toISOString().split('T')[0]}.json`;

        if (Capacitor.isNativePlatform()) {
            try {
                const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
                const { Share } = await import('@capacitor/share');

                const fileResult = await Filesystem.writeFile({
                    path: fileName,
                    data: jsonStr,
                    directory: Directory.Cache,
                    encoding: Encoding.UTF8
                });

                await Share.share({
                    title: language === 'es' ? "Exportar copia de seguridad" : "Export backup",
                    url: fileResult.uri,
                    dialogTitle: language === 'es' ? "Compartir o guardar copia de seguridad" : "Share or save backup"
                });
                return;
            } catch (e) {
                console.error("Capacitor export failed", e);
                showNotif(
                    language === 'es' ? "Error" : "Error",
                    language === 'es' ? "Error al exportar localmente." : "Error exporting locally.",
                    "error"
                );
            }
        }

        // Web fallback
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSaveToDocuments = async () => {
        const state = useStore.getState();
        const fullNotes = await readAllNotesFromDisk(state.notes);
        const fullTasks = await readAllTasksFromDisk(state.tasks);
        const dataToExport = {
            notes: fullNotes,
            tasks: fullTasks,
            goals: state.goals,
            appointments: state.appointments,
            projects: state.projects,
            taskGroups: state.taskGroups,
            dailySnapshots: state.dailySnapshots,
            user: state.user
        };
        const jsonStr = JSON.stringify(dataToExport, null, 2);
        const fileName = `mynotes_backup_${new Date().toISOString().split('T')[0]}.json`;

        if (Capacitor.isNativePlatform()) {
            try {
                const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
                
                try {
                    await Filesystem.mkdir({
                        path: 'MyNotesData',
                        directory: Directory.Documents,
                        recursive: true
                    });
                } catch (e) {
                    // Ignore if directory already exists
                }

                await Filesystem.writeFile({
                    path: `MyNotesData/${fileName}`,
                    data: jsonStr,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });

                showNotif(
                    language === 'es' ? "Respaldo Guardado" : "Backup Saved",
                    language === 'es'
                        ? `Copia de seguridad guardada directamente en Documentos/MyNotesData/${fileName}`
                        : `Backup saved directly to Documents/MyNotesData/${fileName}`,
                    "success"
                );
                return;
            } catch (e) {
                console.error("Capacitor save to Documents failed", e);
                showNotif(
                    language === 'es' ? "Error" : "Error",
                    language === 'es' ? "Error al descargar en la carpeta Documentos." : "Error downloading to Documents folder.",
                    "error"
                );
            }
        } else {
            // Web fallback
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotif(
                language === 'es' ? "Descarga Iniciada" : "Download Started",
                language === 'es' ? "Copia de seguridad descargada correctamente." : "Backup downloaded successfully.",
                "success"
            );
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data && typeof data === 'object') {
                    useStore.setState((state) => ({
                        ...state,
                        notes: data.notes || state.notes,
                        tasks: data.tasks || state.tasks,
                        goals: data.goals || state.goals,
                        appointments: data.appointments || state.appointments,
                        projects: data.projects || state.projects,
                        taskGroups: data.taskGroups || state.taskGroups,
                        dailySnapshots: data.dailySnapshots || state.dailySnapshots,
                        user: data.user || state.user,
                        lastUpdated: Date.now()
                    }));
                    showToast(
                        language === 'es' ? "Datos locales cargados" : "Local data loaded",
                        "success"
                    );

                    // Auto-sync after import if Google account is connected
                    const updatedStore = useStore.getState();
                    if (updatedStore.googleUser && !updatedStore.googleSessionExpired) {
                        updatedStore.syncWithGoogleDrive().catch(console.error);
                    }
                }
            } catch (err) {
                console.error("Failed to parse import data", err);
                showNotif(
                    language === 'es' ? "Error" : "Error",
                    language === 'es' ? "Error al importar datos" : "Error importing data",
                    "error"
                );
            }
        };
        reader.readAsText(file);
        // Reset file input value so onChange will fire even for the same file
        e.target.value = "";
    };

    const handleSmartImport = async () => {
        if (!Capacitor.isNativePlatform()) {
            showNotif(
                language === 'es' ? "No Disponible" : "Unavailable",
                language === 'es'
                    ? "El Importe Inteligente solo está disponible en la versión móvil (APK) por motivos de seguridad del navegador."
                    : "Smart Import is only available on the mobile version (APK) due to browser security restrictions.",
                "info"
            );
            return;
        }

        try {
            const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');

            // Read files in root Documents
            let rootFiles: any[] = [];
            try {
                const readdirResult = await Filesystem.readdir({
                    path: '',
                    directory: Directory.Documents
                });
                rootFiles = readdirResult.files.map(f => {
                    const name = typeof f === 'string' ? f : f.name;
                    return { name, path: name };
                });
            } catch (e) {
                console.log("Could not read root Documents directory", e);
            }

            // Read files in Documents/MyNotesData
            let subfolderFiles: any[] = [];
            try {
                const readdirResultSub = await Filesystem.readdir({
                    path: 'MyNotesData',
                    directory: Directory.Documents
                });
                subfolderFiles = readdirResultSub.files.map(f => {
                    const name = typeof f === 'string' ? f : f.name;
                    return { name, path: `MyNotesData/${name}` };
                });
            } catch (e) {
                console.log("Could not read MyNotesData subdirectory", e);
            }

            const combinedFiles = [...rootFiles, ...subfolderFiles];
            const jsonFiles = combinedFiles.filter(file =>
                file.name &&
                file.name.endsWith('.json') &&
                (file.name.startsWith('mynotes_') || file.name.includes('backup'))
            );

            if (jsonFiles.length === 0) {
                showNotif(
                    language === 'es' ? "Sin Copias de Seguridad" : "No Backups Found",
                    language === 'es'
                        ? "No se encontraron archivos de copia de seguridad (.json) en la carpeta Documentos o MyNotesData."
                        : "No backup files (.json) found in the Documents or MyNotesData folder.",
                    "warning"
                );
                return;
            }

            // Sort descending by name (since they contain the ISO date, e.g. mynotes_backup_2026-05-28.json)
            jsonFiles.sort((a, b) => b.name.localeCompare(a.name));

            const targetFile = jsonFiles[0];

            const fileResult = await Filesystem.readFile({
                path: targetFile.path,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });

            const data = JSON.parse(fileResult.data as string);
            if (data && typeof data === 'object') {
                useStore.setState((state) => ({
                    ...state,
                    notes: data.notes || state.notes,
                    tasks: data.tasks || state.tasks,
                    goals: data.goals || state.goals,
                    appointments: data.appointments || state.appointments,
                    projects: data.projects || state.projects,
                    taskGroups: data.taskGroups || state.taskGroups,
                    dailySnapshots: data.dailySnapshots || state.dailySnapshots,
                    user: data.user || state.user,
                    lastUpdated: Date.now()
                }));
                showToast(
                    language === 'es' ? "Datos locales cargados" : "Local data loaded",
                    "success"
                );

                // Auto-sync after smart import if Google account is connected
                const updatedStore = useStore.getState();
                if (updatedStore.googleUser && !updatedStore.googleSessionExpired) {
                    updatedStore.syncWithGoogleDrive().catch(console.error);
                }
            } else {
                throw new Error("Invalid format");
            }
        } catch (err) {
            console.error("Smart import failed", err);
            showNotif(
                language === 'es' ? "Error" : "Error",
                language === 'es'
                    ? "Error en el importe inteligente. Asegúrate de tener copias de seguridad en la carpeta Documentos o MyNotesData."
                    : "Smart import failed. Make sure you have backup files in the Documents or MyNotesData folder.",
                "error"
            );
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center justify-center p-2 rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-all duration-300"
                title={mounted ? (t.settings || "Settings") : "Settings"}
            >
                <Settings className="w-5 h-5" />
            </button>

            {mounted && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-sm md:max-w-3xl bg-white dark:bg-zinc-900 rounded-[2rem] p-6 md:p-8 shadow-2xl border border-black/10 dark:border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar"
                            >
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="mb-6 flex justify-center w-full">
                                    <Settings 
                                        className="w-8 h-8 text-primary animate-spin" 
                                        style={{ animationDuration: '10s' }}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    {/* Left Column: General & Data Management */}
                                    <div className="space-y-4">
                                        <motion.div 
                                            onClick={() => {
                                                setNotificationsEnabled(!notificationsEnabled);
                                            }}
                                            whileHover="hover"
                                            whileTap="tap"
                                            className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-3">
                                                <motion.div 
                                                    variants={bellVariants}
                                                    animate={notificationsEnabled ? "active" : "inactive"}
                                                    whileHover="hover"
                                                    className={`p-2 rounded-xl transition-colors duration-300 ${
                                                        notificationsEnabled 
                                                            ? "bg-primary/20 text-primary dark:bg-primary/30" 
                                                            : "bg-black/5 dark:bg-white/10 text-zinc-500 dark:text-zinc-400"
                                                    }`}
                                                >
                                                    <Bell className="w-5 h-5" />
                                                </motion.div>
                                                <div>
                                                    <h3 className="font-semibold text-sm">{t.notifications || "Notifications"}</h3>
                                                    <p className="text-xs text-muted-foreground">{t.notificationsDesc || "Reminders and habits"}</p>
                                                </div>
                                            </div>

                                            <button
                                                tabIndex={-1}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 pointer-events-none ${notificationsEnabled ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                            </button>
                                        </motion.div>

                                        {/* Focus Effect Toggle */}
                                        <motion.div 
                                            onClick={() => {
                                                setFocusEffectEnabled(!focusEffectEnabled);
                                            }}
                                            whileHover="hover"
                                            whileTap="tap"
                                            className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-3">
                                                <motion.div 
                                                    variants={zapVariants}
                                                    animate={focusEffectEnabled ? "active" : "inactive"}
                                                    whileHover="hover"
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
                                                        focusEffectEnabled 
                                                            ? "bg-yellow-500/25 text-yellow-500 dark:text-yellow-400" 
                                                            : "bg-black/5 dark:bg-white/10 text-zinc-500 dark:text-zinc-400"
                                                    }`}
                                                >
                                                    <Zap className="w-5 h-5" />
                                                </motion.div>
                                                <div>
                                                    <p className="font-bold text-sm">{language === 'es' ? "Efecto de Enfoque" : "Focus Effect"}</p>
                                                    <p className="text-xs text-muted-foreground">{language === 'es' ? "Efecto visual al completar tareas" : "Visual effect on completing tasks"}</p>
                                                </div>
                                            </div>

                                            <button
                                                tabIndex={-1}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 pointer-events-none ${focusEffectEnabled ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${focusEffectEnabled ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                            </button>
                                        </motion.div>

                                        {/* Welcome Notes Test Button */}
                                        <motion.div 
                                            onClick={() => {
                                                window.dispatchEvent(new Event('openWelcomeNotesModal'));
                                                setIsOpen(false);
                                            }}
                                            whileHover="hover"
                                            whileTap="tap"
                                            className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-3">
                                                <motion.div 
                                                    className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/25 text-blue-500 dark:text-blue-400"
                                                >
                                                    <Zap className="w-5 h-5" />
                                                </motion.div>
                                                <div>
                                                    <p className="font-bold text-sm">Test Mensaje Bienvenida Notas</p>
                                                    <p className="text-xs text-muted-foreground">Probar modal de MyNotes</p>
                                                </div>
                                            </div>
                                        </motion.div>

                                        {/* Theme & Language Toggles */}
                                        <div className="flex items-center justify-between gap-4 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                                            <div className="flex-1 flex flex-col justify-center items-center gap-2 border-r border-black/10 dark:border-white/10 pr-4">
                                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t.theme || "Theme"}</p>
                                                <div className="scale-125">
                                                    <ModeToggle />
                                                </div>
                                            </div>
                                            <div className="flex-1 flex flex-col justify-center items-center gap-2 pl-4">
                                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t.language || "Language"}</p>
                                                <div className="scale-110">
                                                    <LanguageToggle />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Guided Onboarding Replay */}
                                        <div className="flex flex-col gap-2 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                                                {language === 'es' ? "Guía de bienvenida" : "Welcome Guide"}
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    router.push('/');
                                                    startTourManually();
                                                }}
                                                className="w-full flex items-center justify-center gap-2 p-3 bg-primary text-primary-foreground rounded-xl font-bold transition-all text-sm hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 cursor-pointer"
                                            >
                                                <Sparkles className="w-4 h-4 text-primary-foreground animate-pulse" />
                                                {language === 'es' ? "Iniciar guía interactiva" : "Start interactive guide"}
                                            </button>
                                        </div>

                                        {/* Data Management */}
                                        <div className="flex flex-col gap-2 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                                                {language === 'es' ? "Gestión de Datos" : "Data Management"}
                                            </p>
                                            <div className="flex flex-col gap-2 w-full">
                                                <div className="flex gap-3 w-full">
                                                    <motion.button
                                                        onClick={() => {
                                                            setExportAnimate(true);
                                                            setTimeout(() => setExportAnimate(false), 500);
                                                            handleExport();
                                                        }}
                                                        whileHover="hover"
                                                        whileTap="tap"
                                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold transition-all text-sm"
                                                    >
                                                        <motion.div
                                                            variants={exportVariants}
                                                            animate={exportAnimate ? { y: [0, 8, -4, 2, 0], scaleY: [1, 0.75, 1.15, 0.9, 1] } : "normal"}
                                                            transition={exportAnimate ? { type: "spring", stiffness: 350, damping: 8 } : undefined}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </motion.div>
                                                        {language === 'es' ? "Exportar" : "Export"}
                                                    </motion.button>
                                                    <input 
                                                        type="file" 
                                                        ref={fileInputRef} 
                                                        accept=".json" 
                                                        className="hidden" 
                                                        onChange={handleImport} 
                                                    />
                                                    <motion.button 
                                                        onClick={() => {
                                                            setImportAnimate(true);
                                                            setTimeout(() => setImportAnimate(false), 500);
                                                            fileInputRef.current?.click();
                                                        }}
                                                        whileHover="hover"
                                                        whileTap="tap"
                                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl font-bold transition-all text-sm"
                                                    >
                                                        <motion.div
                                                            variants={importVariants}
                                                            animate={importAnimate ? { y: [0, -8, 4, -2, 0], scaleY: [1, 0.75, 1.15, 0.9, 1] } : "normal"}
                                                            transition={importAnimate ? { type: "spring", stiffness: 350, damping: 8 } : undefined}
                                                        >
                                                            <Upload className="w-4 h-4" />
                                                        </motion.div>
                                                        {language === 'es' ? "Importar" : "Import"}
                                                    </motion.button>
                                                </div>
                                                <motion.button
                                                    onClick={() => {
                                                        setDownloadBackupAnimate(true);
                                                        setTimeout(() => setDownloadBackupAnimate(false), 500);
                                                        handleSaveToDocuments();
                                                    }}
                                                    whileHover="hover"
                                                    whileTap="tap"
                                                    className="w-full flex items-center justify-center gap-2 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold transition-all text-sm"
                                                >
                                                    <motion.div
                                                        variants={downloadBackupVariants}
                                                        animate={downloadBackupAnimate ? { y: [0, 8, -4, 2, 0], scaleY: [1, 0.75, 1.15, 0.9, 1] } : "normal"}
                                                        transition={downloadBackupAnimate ? { type: "spring", stiffness: 350, damping: 8 } : undefined}
                                                    >
                                                        <Download className="w-4 h-4 text-emerald-500" />
                                                    </motion.div>
                                                    {language === 'es' ? "Descargar datos de respaldo" : "Download Backup Data"}
                                                </motion.button>
                                                <motion.button
                                                    onClick={() => {
                                                        setSmartImportAnimate(true);
                                                        setTimeout(() => setSmartImportAnimate(false), 600);
                                                        handleSmartImport();
                                                    }}
                                                    whileHover="hover"
                                                    whileTap="tap"
                                                    className="w-full flex items-center justify-center gap-2 p-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded-xl font-bold transition-all text-sm"
                                                >
                                                    <motion.div
                                                        variants={smartImportVariants}
                                                        animate={smartImportAnimate ? { rotate: [0, 360], scale: [1, 1.4, 0.85, 1.15, 1] } : "normal"}
                                                        transition={smartImportAnimate ? { type: "spring", stiffness: 250, damping: 10 } : undefined}
                                                    >
                                                        <Zap className="w-4 h-4 text-purple-500" />
                                                    </motion.div>
                                                    {language === 'es' ? "Importe Inteligente" : "Smart Import"}
                                                </motion.button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground/70 text-center mt-2 leading-tight">
                                                {language === 'es'
                                                    ? "Exporta tus notas, hábitos y metas para tener un respaldo y recupéralos importando el archivo generado de forma manual o inteligente."
                                                    : "Export your notes, habits and goals for a backup and restore them by importing the generated file manually or smartly."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right Column: Google Cloud Sync */}
                                    <div className="space-y-4">
                                        {/* Cloud Sync with Google */}
                                        <div className="flex flex-col gap-2 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                                    {t.cloudSync || "Cloud Sync"}
                                                </p>
                                                <Cloud className="w-4 h-4 text-primary" />
                                            </div>

                                            {!googleUser ? (
                                                <div className="flex flex-col gap-2 w-full mt-1">
                                                    <motion.button
                                                        onClick={handleGoogleLogin}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="w-full flex items-center justify-center gap-3 p-3 bg-white dark:bg-zinc-800 hover:bg-black/5 dark:hover:bg-white/5 text-foreground rounded-xl border border-black/10 dark:border-white/10 font-bold transition-all text-sm shadow-sm"
                                                    >
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                            <path
                                                                fill="#4285F4"
                                                                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.69c-.29 1.5-.1.14-.9 3.03l2.84 2.2c1.66-1.53 2.61-3.79 2.61-6.06z"
                                                            />
                                                            <path
                                                                fill="#34A853"
                                                                d="M12 24c3.24 0 5.97-1.08 7.96-2.93l-3.84-2.98c-1.07.72-2.44 1.15-4.12 1.15-3.17 0-5.85-2.14-6.81-5.03L2.25 16.4C4.23 20.33 8.3 22.92 12 24z"
                                                            />
                                                            <path
                                                                fill="#FBBC05"
                                                                d="M5.19 14.21c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L2.25 7.55c-.78 1.55-1.22 3.29-1.22 5.09s.44 3.54 1.22 5.09l3.94-3.52z"
                                                            />
                                                            <path
                                                                fill="#EA4335"
                                                                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.96 1.19 15.24 0 12 0 8.3 0 4.23 2.59 2.25 6.52l3.94 3.52c.96-2.89 3.64-5.03 6.81-5.03z"
                                                            />
                                                        </svg>
                                                        {t.googleLogin || "Sign in with Google"}
                                                    </motion.button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3 w-full mt-1">
                                                    <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl">
                                                        <div className="flex items-center gap-3">
                                                            <img
                                                                src={googleUser.imageUrl}
                                                                alt="Profile"
                                                                referrerPolicy="no-referrer"
                                                                className="w-9 h-9 rounded-full"
                                                            />
                                                            <div className="max-w-[160px]">
                                                                <p className="font-bold text-xs truncate leading-tight">{googleUser.name}</p>
                                                                <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">{googleUser.email}</p>
                                                            </div>
                                                        </div>
                                                        <motion.button
                                                            onClick={handleGoogleLogout}
                                                            whileHover={{ scale: 1.1, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                                                            whileTap={{ scale: 0.9 }}
                                                            className="p-2 text-zinc-500 hover:text-red-500 rounded-lg transition-all"
                                                            title={t.googleLogout || "Sign out"}
                                                        >
                                                            <LogOut className="w-4 h-4" />
                                                        </motion.button>
                                                    </div>
                                                    {googleSessionExpired ? (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                                                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                                                    {language === 'es' 
                                                                        ? "Sesión de Google expirada" 
                                                                        : "Google session expired"}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                                                    {language === 'es'
                                                                        ? "Por favor, re-conéctate para reanudar la sincronización en la nube."
                                                                        : "Please re-connect to resume cloud synchronization."}
                                                                </p>
                                                            </div>
                                                            <motion.button
                                                                onClick={handleGoogleLogin}
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                className="w-full flex items-center justify-center gap-2 p-3 bg-primary text-white rounded-xl font-bold transition-all text-xs shadow-lg shadow-primary/20"
                                                            >
                                                                <RefreshCw className="w-3.5 h-3.5" />
                                                                {language === 'es' ? "Re-conectar cuenta" : "Re-connect account"}
                                                            </motion.button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex gap-2">
                                                                <motion.button
                                                                    onClick={handleCloudSync}
                                                                    disabled={isSyncingCloud || localSyncing || localRestoring}
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-primary hover:bg-primary/95 disabled:bg-primary/50 text-white rounded-xl font-bold transition-all text-xs shadow-lg shadow-primary/20"
                                                                >
                                                                    <motion.div
                                                                        animate={localSyncing ? { rotate: 360 } : { rotate: 0 }}
                                                                        transition={localSyncing ? { duration: 1, ease: "linear", repeat: Infinity } : undefined}
                                                                    >
                                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                                    </motion.div>
                                                                    {t.syncNow || "Sync now"}
                                                                </motion.button>
                                                                <motion.button
                                                                    onClick={handleCloudRestore}
                                                                    disabled={isSyncingCloud || localSyncing || localRestoring}
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-foreground rounded-xl font-bold transition-all text-xs"
                                                                >
                                                                    <motion.div
                                                                        animate={localRestoring ? { rotate: 360 } : undefined}
                                                                        transition={localRestoring ? { duration: 1, ease: "linear", repeat: Infinity } : undefined}
                                                                    >
                                                                        {localRestoring ? (
                                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Cloud className="w-3.5 h-3.5" />
                                                                        )}
                                                                    </motion.div>
                                                                    {t.restoreFromCloud || "Restore"}
                                                                </motion.button>
                                                            </div>

                                                            {/* Recover images from Drive revision history */}
                                                            <motion.button
                                                                onClick={handleRecoverImages}
                                                                disabled={isRecovering || isSyncingCloud || !googleUser}
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                className="w-full flex items-center justify-center gap-2 p-3 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-amber-600 dark:text-amber-400 rounded-xl font-bold transition-all text-xs mt-1"
                                                            >
                                                                {isRecovering ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                                )}
                                                                {language === 'es'
                                                                    ? (isRecovering ? 'Buscando en historial...' : 'Recuperar imágenes de Drive')
                                                                    : (isRecovering ? 'Scanning history...' : 'Recover images from Drive')}
                                                            </motion.button>
                                                            {recoveryMessage && (
                                                                <p className="text-[10px] text-muted-foreground text-center mt-1 leading-tight px-1">
                                                                    {recoveryMessage}
                                                                </p>
                                                            )}

                                                            {lastCloudSync && (
                                                                <p className="text-[10px] text-muted-foreground text-center mt-1">
                                                                    {(t.lastSync || "Last backup: {date}").replace('{date}', lastCloudSync)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            <NotificationDialog
                isOpen={notifState.isOpen}
                onClose={() => setNotifState(prev => ({ ...prev, isOpen: false }))}
                title={notifState.title}
                message={notifState.message}
                type={notifState.type}
                confirmLabel={language === 'es' ? "Aceptar" : "OK"}
            />
        </>
    )
}
