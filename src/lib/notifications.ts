import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Task } from './store';
import { assignSlot, buildTriggerDate, getNotificationSlots } from './notification-slots';

const CHANNEL_ID = 'reminders';
const PRIORITY_CHANNEL_ID = 'priority_reminders';

// Stable notification IDs for the 3 priority reminder slots (must not collide with habit IDs)
const PRIORITY_NOTIF_IDS = [2001, 2002, 2003];

/**
 * Hash a string (like a task ID) to a stable 32-bit integer for the notification ID.
 * Uses the same djb2 algorithm as notification-slots.ts to stay consistent.
 */
function hashStringToInt(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

export const NotificationManager = {
    async initialize() {
        if (!Capacitor.isNativePlatform()) return;

        try {
            // Request permissions (Required for Android 13+)
            const permStatus = await LocalNotifications.requestPermissions();
            if (permStatus.display !== 'granted') {
                console.warn('User denied notification permissions');
                return;
            }

            // Create habit reminders channel (Android 8.0+)
            await LocalNotifications.createChannel({
                id: CHANNEL_ID,
                name: 'Recordatorios',
                description: 'Notificaciones de hábitos y tareas',
                importance: 4, // High importance
                visibility: 1, // Public visibility on lockscreen
            });

            // Create priority reminders channel (Android 8.0+)
            await LocalNotifications.createChannel({
                id: PRIORITY_CHANNEL_ID,
                name: 'Tareas Prioritarias',
                description: 'Recordatorios de tareas de alta prioridad',
                importance: 4,
                visibility: 1,
            });
        } catch (err) {
            console.error('Failed to initialize notifications:', err);
        }
    },

    async scheduleDailyHabitReminders(tasks: Task[]) {
        if (!Capacitor.isNativePlatform()) return;

        try {
            // Cancel all previously scheduled habits to avoid duplicates when state changes
            const pending = await LocalNotifications.getPending();
            const habitNotifs = pending.notifications.filter(n => (n as any).channelId === CHANNEL_ID || (n.extra && n.extra.channelId === CHANNEL_ID));
            if (habitNotifs.length > 0) {
                await LocalNotifications.cancel({ notifications: habitNotifs });
            }

            const todayStr = new Date().toISOString().split('T')[0];

            // Read configured slots (from Preferences, falls back to DEFAULT_SLOTS [9:00, 13:00, 18:00])
            // One async read outside the loop — efficient, no repeated I/O per habit.
            const slots = await getNotificationSlots();

            const notificationsToSchedule = [];

            for (const task of tasks) {
                // Skip if not a daily task, or disabled, or already completed today
                if (task.recurrence !== 'Daily' || task.enabled === false) continue;
                if (task.completedDates?.includes(todayStr)) continue;

                // Assign a deterministic slot based on the task's ID.
                // Same ID → same slot always, even after editing the task title/settings.
                const slot = assignSlot(task.id, slots);

                // Build the trigger date with ±5 min jitter to prevent same-second bursts
                // among habits that share the same slot.
                const fireAt = buildTriggerDate(new Date(), slot, 5);

                notificationsToSchedule.push({
                    id: hashStringToInt(task.id),
                    title: 'Recordatorio de Hábito',
                    body: task.title,
                    channelId: CHANNEL_ID,
                    schedule: {
                        at: fireAt,
                        allowWhileIdle: true, // crucial for Doze mode
                    },
                    extra: { channelId: CHANNEL_ID }
                });
            }

            if (notificationsToSchedule.length > 0) {
                await LocalNotifications.schedule({
                    notifications: notificationsToSchedule
                });
            }
        } catch (err) {
            console.error('Failed to schedule daily habits:', err);
        }
    },

    /**
     * Schedule (or cancel) the 3 daily priority task reminder notifications.
     *
     * Called:
     * - On app boot (from initialize flow)
     * - When the user changes a slot time in Settings
     * - When the user toggles enabled on/off in Settings
     *
     * @param settings  The current priorityReminderSettings from the store.
     * @param language  'es' | 'en' for notification text.
     */
    async schedulePriorityReminders(
        settings: { enabled: boolean; slots: string[] },
        language: string = 'es'
    ) {
        if (!Capacitor.isNativePlatform()) return;

        try {
            // Always cancel existing priority reminders first
            const toCancel = PRIORITY_NOTIF_IDS.map(id => ({ id }));
            try {
                await LocalNotifications.cancel({ notifications: toCancel });
            } catch (_) {
                // ignore if none pending
            }

            if (!settings.enabled) {
                console.log('[Notifications] Priority reminders disabled — cancelled.');
                return;
            }

            const now = new Date();
            const notificationsToSchedule = [];

            for (let i = 0; i < Math.min(settings.slots.length, 3); i++) {
                const slotStr = settings.slots[i]; // "HH:mm"
                const [h, m] = slotStr.split(':').map(Number);
                if (isNaN(h) || isNaN(m)) continue;

                // Build trigger date: today at slot time; tomorrow if already past
                const fireAt = new Date(now);
                fireAt.setHours(h, m, 0, 0);
                if (fireAt.getTime() <= Date.now()) {
                    fireAt.setDate(fireAt.getDate() + 1);
                }

                const title = language === 'es' ? '🎯 Tareas prioritarias' : '🎯 Priority tasks';
                const body = language === 'es'
                    ? 'Revisa tus tareas de alta prioridad pendientes'
                    : 'Check your pending high-priority tasks';

                notificationsToSchedule.push({
                    id: PRIORITY_NOTIF_IDS[i],
                    title,
                    body,
                    channelId: PRIORITY_CHANNEL_ID,
                    schedule: {
                        at: fireAt,
                        allowWhileIdle: true,
                        repeats: true,
                        every: 'day' as const,
                    },
                    extra: { channelId: PRIORITY_CHANNEL_ID, slotIndex: i }
                });
            }

            if (notificationsToSchedule.length > 0) {
                await LocalNotifications.schedule({ notifications: notificationsToSchedule });
                console.log(`[Notifications] Scheduled ${notificationsToSchedule.length} priority reminder(s).`);
            }
        } catch (err) {
            console.error('Failed to schedule priority reminders:', err);
        }
    }
};

