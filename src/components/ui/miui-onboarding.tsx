import { motion, AnimatePresence } from "framer-motion"
import { ShieldAlert, Battery, Rocket, X, Settings } from "lucide-react"
import { WidgetSync, useStore } from "@/lib/store"
import { useState, useEffect } from "react"
import { Capacitor } from "@capacitor/core"

export function MIUIOnboardingDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const language = useStore(state => state.language)

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        
        // Ensure this only shows once on Android
        const hasShownMiuiOnboarding = localStorage.getItem('mynotes_miui_onboarding');
        if (!hasShownMiuiOnboarding) {
            // We could check Device info to see if it's Xiaomi, but since other Chinese ROMs 
            // also use aggressive battery management, it's safe to show this to Android users 
            // or we just show it to everyone on Android. Let's show it to everyone once.
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 5000); // Show 5 seconds after startup to not block immediate interactions
            return () => clearTimeout(timer);
        }
    }, [])

    const handleClose = () => {
        localStorage.setItem('mynotes_miui_onboarding', 'true')
        setIsOpen(false)
    }

    if (!isOpen) return null;

    const t = {
        es: {
            title: "Configuración de Notificaciones (Xiaomi / Android)",
            desc: "Para asegurar que las alarmas y recordatorios de MyNotes suenen exactamente a la hora programada (incluso cuando la app está cerrada), por favor configura lo siguiente:",
            autostart: "1. Inicio Automático",
            autostartDesc: "Permite que MyNotes programe notificaciones al reiniciar el teléfono.",
            battery: "2. Optimización de Batería",
            batteryDesc: "Configura como 'Sin restricciones' para que el sistema no mate los recordatorios.",
            appSettings: "3. Ajustes de Aplicación",
            appSettingsDesc: "Desactiva 'Pausar actividad si no se usa' para evitar que se revoquen permisos con el tiempo.",
            btnAutostart: "Abrir Autostart",
            btnBattery: "Abrir Batería",
            btnSettings: "Abrir Ajustes",
            gotIt: "Entendido, ya lo configuré",
            skip: "Omitir"
        },
        en: {
            title: "Notification Settings (Xiaomi / Android)",
            desc: "To ensure that MyNotes alarms and reminders sound exactly at the scheduled time (even when the app is closed), please configure the following:",
            autostart: "1. Autostart",
            autostartDesc: "Allows MyNotes to schedule notifications when restarting the phone.",
            battery: "2. Battery Optimization",
            batteryDesc: "Set to 'No restrictions' so the system doesn't kill reminders.",
            appSettings: "3. App Settings",
            appSettingsDesc: "Disable 'Pause app activity if unused' to prevent permissions from being revoked.",
            btnAutostart: "Open Autostart",
            btnBattery: "Open Battery",
            btnSettings: "Open Settings",
            gotIt: "Got it, I configured it",
            skip: "Skip"
        }
    }

    const text = t[language as keyof typeof t] || t.en

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-zinc-950 border border-white/10 rounded-2xl p-6 shadow-2xl max-w-md w-full relative max-h-[90vh] overflow-y-auto"
                >
                    <button
                        onClick={handleClose}
                        className="absolute right-4 top-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>

                    <div className="flex items-center gap-3 mb-4 text-amber-500">
                        <ShieldAlert className="w-8 h-8" />
                        <h2 className="text-xl font-bold leading-tight">{text.title}</h2>
                    </div>

                    <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
                        {text.desc}
                    </p>

                    <div className="space-y-4 mb-8">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 font-semibold text-zinc-100">
                                    <Rocket className="w-4 h-4 text-blue-400" />
                                    {text.autostart}
                                </div>
                            </div>
                            <p className="text-xs text-zinc-400 mb-3">{text.autostartDesc}</p>
                            <button
                                onClick={() => WidgetSync.openMiuiAutostart().catch(console.error)}
                                className="w-full py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-sm font-medium transition-colors"
                            >
                                {text.btnAutostart}
                            </button>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 font-semibold text-zinc-100">
                                    <Battery className="w-4 h-4 text-green-400" />
                                    {text.battery}
                                </div>
                            </div>
                            <p className="text-xs text-zinc-400 mb-3">{text.batteryDesc}</p>
                            <button
                                onClick={() => WidgetSync.openBatteryOptimizationSettings().catch(console.error)}
                                className="w-full py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-sm font-medium transition-colors"
                            >
                                {text.btnBattery}
                            </button>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 font-semibold text-zinc-100">
                                    <Settings className="w-4 h-4 text-purple-400" />
                                    {text.appSettings}
                                </div>
                            </div>
                            <p className="text-xs text-zinc-400 mb-3">{text.appSettingsDesc}</p>
                            <button
                                onClick={() => WidgetSync.openAppSettings().catch(console.error)}
                                className="w-full py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg text-sm font-medium transition-colors"
                            >
                                {text.btnSettings}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                        >
                            {text.skip}
                        </button>
                        <button
                            onClick={handleClose}
                            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-black rounded-xl font-bold transition-colors"
                        >
                            {text.gotIt}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
