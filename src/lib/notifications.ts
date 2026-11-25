import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Task } from './store';
import { assignSlot, buildTriggerDate, getNotificationSlots } from './notification-slots';
import { getPhilosophicalQuoteForDate, getLocalizedPhilosophicalQuoteText, shouldSendPhilosophicalQuoteToday } from './philosophical-quotes';
import { pick } from './i18n-inline';

const CHANNEL_ID = 'reminders';
const PRIORITY_CHANNEL_ID = 'priority_reminders';
const PHILOSOPHY_CHANNEL_ID = 'philosophical_quotes';

// Stable notification IDs for the 3 priority reminder slots (must not collide with habit IDs)
const PRIORITY_NOTIF_IDS = [2001, 2002, 2003];
const PHILOSOPHY_NOTIF_ID = 3001;

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

            // Create philosophical discipline quotes channel (Android 8.0+)
            await LocalNotifications.createChannel({
                id: PHILOSOPHY_CHANNEL_ID,
                name: 'Frases de Disciplina',
                description: 'Frases filosóficas ocasionales de disciplina y constancia',
                importance: 3,
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
                // Only schedule notifications for high-priority habits/tasks
                if (task.energyLevel !== 'High') continue;

                // Assign a deterministic slot based on the task's ID.
                // Same ID → same slot always, even after editing the task title/settings.
                const slot = assignSlot(task.id, slots);

                // Build the trigger date with ±5 min jitter to prevent same-second bursts
                // among habits that share the same slot.
                const fireAt = buildTriggerDate(new Date(), slot, 5);

                notificationsToSchedule.push({
                    id: hashStringToInt(task.id),
                    title: pick((await import('./store')).useStore.getState().language, { es: 'Recordatorio de Hábito', en: 'Habit Reminder', zh: '习惯提醒' }),
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

                const title = pick(language, { es: '🎯 Tareas prioritarias', en: '🎯 Priority tasks', zh: '🎯 高优先级任务' });
                const body = pick(language, {
                    es: 'Revisa tus tareas de alta prioridad pendientes',
                    en: 'Check your pending high-priority tasks',
                    zh: '查看您待完成的高优先级任务'
                });

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
    },

    /**
     * Schedule an occasional philosophical discipline quote notification on the next
     * eligible day (not every day).
     */
    async schedulePhilosophicalQuote(enabled: boolean, language: string = 'es') {
        if (!Capacitor.isNativePlatform()) return;

        try {
            try {
                await LocalNotifications.cancel({ notifications: [{ id: PHILOSOPHY_NOTIF_ID }] });
            } catch (_) {
                // ignore if none pending
            }

            if (!enabled) return;

            const now = new Date();
            let targetDate: Date | null = null;

            // Find the next occasional day within the next 7 days
            for (let offset = 0; offset < 7; offset++) {
                const candidate = new Date(now);
                candidate.setDate(now.getDate() + offset);
                candidate.setHours(10, 15, 0, 0);

                if (candidate.getTime() <= Date.now()) continue;
                if (shouldSendPhilosophicalQuoteToday(candidate)) {
                    targetDate = candidate;
                    break;
                }
            }

            if (!targetDate) return;

            const quote = getPhilosophicalQuoteForDate(targetDate);
            const localized = getLocalizedPhilosophicalQuoteText(quote, language);
            const quoteText = localized.text;

            await LocalNotifications.schedule({
                notifications: [{
                    id: PHILOSOPHY_NOTIF_ID,
                    title: pick(language, { es: '✦ Disciplina & Filosofía', en: '✦ Discipline & Philosophy', zh: '✦ 自律与哲理' }),
                    body: `"${quoteText}" — ${localized.author}`,
                    channelId: PHILOSOPHY_CHANNEL_ID,
                    schedule: {
                        at: targetDate,
                        allowWhileIdle: true,
                    },
                    extra: {
                        channelId: PHILOSOPHY_CHANNEL_ID,
                        type: 'philosophical_quote',
                        quote: quoteText,
                        author: localized.author,
                    }
                }]
            });
        } catch (err) {
            console.error('Failed to schedule philosophical quote:', err);
        }
    }
};

