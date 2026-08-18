import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Task } from './store';

const CHANNEL_ID = 'reminders';

/**
 * Hash a string (like a task ID) to a 32-bit integer for the notification ID.
 */
function hashStringToInt(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
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

            // Create explicit channel (Android 8.0+)
            await LocalNotifications.createChannel({
                id: CHANNEL_ID,
                name: 'Recordatorios',
                description: 'Notificaciones de hábitos y tareas',
                importance: 4, // High importance
                visibility: 1, // Public visibility on lockscreen
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
            const habitNotifs = pending.notifications.filter(n => n.channelId === CHANNEL_ID);
            if (habitNotifs.length > 0) {
                await LocalNotifications.cancel({ notifications: habitNotifs });
            }

            // Schedule for today if time hasn't passed, or tomorrow if it has
            // The previous logic triggered immediately for daily tasks. Now we should schedule them
            // correctly. Assuming a default reminder time, e.g., 9:00 AM, or scheduling them daily.

            const notificationsToSchedule = [];
            const todayStr = new Date().toISOString().split('T')[0];

            for (const task of tasks) {
                // Skip if not a daily task, or disabled, or already completed today
                if (task.recurrence !== 'Daily' || task.enabled === false) continue;
                if (task.completedDates?.includes(todayStr)) continue;

                // Fire at 9:00 AM or, if after 9:00 AM, in 10 minutes to remind them today
                let fireAt = new Date();
                fireAt.setHours(9, 0, 0, 0);

                if (fireAt.getTime() < Date.now()) {
                    // It's past 9:00 AM, maybe schedule it for a future time? 
                    // Let's schedule it for 1 hour from now as a fallback for today
                    fireAt = new Date(Date.now() + 60 * 60 * 1000); 
                }

                notificationsToSchedule.push({
                    id: hashStringToInt(task.id),
                    title: 'Recordatorio de Hábito',
                    body: task.title,
                    channelId: CHANNEL_ID,
                    schedule: {
                        at: fireAt,
                        allowWhileIdle: true, // crucial for Doze mode
                    }
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
    }
};
