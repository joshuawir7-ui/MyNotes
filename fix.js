const fs = require('fs');

const path = 'src/components/ui/settings-dialog.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSync =             } else {
                const errorMsg = useStore.getState().syncError || "";
                showNotif(
                    language === 'es' ? "Error" : "Error",
                    language === 'es' 
                        ? \Error al sincronizar con Google Drive: \\ 
                        : \Error syncing with Google Drive: \\,
                    "error"
                );
            };

const newSync =             } else {
                const errorMsg = useStore.getState().syncError;
                if (errorMsg) {
                    showNotif(
                        language === 'es' ? "Error" : "Error",
                        language === 'es' 
                            ? \Error al sincronizar con Google Drive: \\ 
                            : \Error syncing with Google Drive: \\,
                        "error"
                    );
                } else {
                    showToast(language === 'es' ? "Sincronización ya en curso" : "Sync already in progress", "info");
                }
            };

content = content.replace(oldSync, newSync);

const oldRestore =             } else {
                const errorMsg = useStore.getState().syncError || "";
                showNotif(
                    language === 'es' ? "Error" : "Error",
                    language === 'es' 
                        ? \No se encontró respaldo o hubo un error al restaurar: \\ 
                        : \No backup found or error restoring: \\,
                    "error"
                );
            };

const newRestore =             } else {
                const errorMsg = useStore.getState().syncError;
                if (errorMsg) {
                    showNotif(
                        language === 'es' ? "Error" : "Error",
                        language === 'es' 
                            ? \No se encontró respaldo o hubo un error al restaurar: \\ 
                            : \No backup found or error restoring: \\,
                        "error"
                    );
                } else {
                    showToast(language === 'es' ? "Restauración ya en curso" : "Restore already in progress", "info");
                }
            };

content = content.replace(oldRestore, newRestore);

fs.writeFileSync(path, content, 'utf8');
