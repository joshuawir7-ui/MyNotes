/**
 * web-notifications.ts
 * 
 * Manages web browser notifications for MyNotes (Vercel/web version).
 * - Registers the Service Worker
 * - Requests Notification permission
 * - Schedules reminders for tasks with dueDate (today/tomorrow) and today's appointments
 * - Runs a polling loop every minute to fire timely reminders
 * 
 * Only active on non-native platforms (browser).
 */

import { Capacitor } from '@capacitor/core';
import type { Task, Appointment } from './store';

const SW_PATH = '/sw.js';
let swRegistration: ServiceWorkerRegistration | null = null;

// Track already-notified IDs in this session to avoid duplicate firing
const notifiedIds = new Set<string>();

// ─────────────────────────────────────────────────
// Registration & Permission
// ─────────────────────────────────────────────────

export async function registerWebNotifications(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) return false;
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.warn('[WebNotif] Service Workers or Notifications not supported.');
        return false;
    }

    try {
        // Register the service worker
        swRegistration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
        console.log('[WebNotif] Service Worker registered:', swRegistration.scope);

        // Request permission if not already granted
        if (Notification.permission === 'default') {
            const result = await Notification.requestPermission();
            console.log('[WebNotif] Permission result:', result);
            return result === 'granted';
        }

        return Notification.permission === 'granted';
    } catch (err) {
        console.error('[WebNotif] Failed to register service worker:', err);
        return false;
    }
}

// ─────────────────────────────────────────────────
// Send a notification via the Service Worker
// ─────────────────────────────────────────────────

function sendNotification(title: string, body: string, tag: string) {
    if (Notification.permission !== 'granted') return;

    if (swRegistration && swRegistration.active) {
        swRegistration.active.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag });
    } else {
        // Fallback: direct Notification API (works when tab is open)
        new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
    }
}

// ─────────────────────────────────────────────────
// Check Tasks: fire reminders for tasks due today
// ─────────────────────────────────────────────────

function checkTaskReminders(tasks: Task[], language: string) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (const task of tasks) {
        if (task.completed) continue;
        if (!task.dueDate) continue;

        const key = `task-${task.id}-${todayStr}`;
        if (notifiedIds.has(key)) continue;

        // Fire if task is due today and it hasn't been completed today
        if (task.dueDate === todayStr) {
            const completedToday = task.completedDates?.includes(todayStr);
            if (!completedToday) {
                const title = language === 'es' ? '📋 Tarea pendiente' : '📋 Pending task';
                const body = task.title;
                sendNotification(title, body, key);
                notifiedIds.add(key);
            }
        }

        // Also fire for overdue tasks (past due date, not completed)
        if (task.dueDate < todayStr && !task.completed) {
            const overdueKey = `task-overdue-${task.id}`;
            if (!notifiedIds.has(overdueKey)) {
                const title = language === 'es' ? '⚠️ Tarea vencida' : '⚠️ Overdue task';
                const body = language === 'es'
                    ? `${task.title} — venció el ${task.dueDate}`
                    : `${task.title} — was due on ${task.dueDate}`;
                sendNotification(title, body, overdueKey);
                notifiedIds.add(overdueKey);
            }
        }
    }
}

// ─────────────────────────────────────────────────
// Check Daily Habits: remind if not completed today at 9 AM
// ─────────────────────────────────────────────────

function checkHabitReminders(tasks: Task[], language: string) {
    const now = new Date();
    const hour = now.getHours();
    // Only remind for habits between 9:00 and 22:00
    if (hour < 9 || hour >= 22) return;

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (const task of tasks) {
        if (!task.isHabit) continue;
        if (task.enabled === false) continue;
        if (task.recurrence !== 'Daily') continue;

        const completedToday = task.completedDates?.includes(todayStr);
        if (completedToday) continue;

        // Only fire once per day per habit (keyed to day)
        const key = `habit-${task.id}-${todayStr}-h${hour}`;
        // Fire at 9 AM, 14 PM, and 19 PM (remind 3 times max per day)
        const reminderHours = [9, 14, 19];
        const hourKey = `habit-${task.id}-${todayStr}-${reminderHours.find(h => h === hour)}`;
        if (!reminderHours.includes(hour)) continue;
        if (notifiedIds.has(hourKey)) continue;

        const title = language === 'es' ? '🔁 Recordatorio de hábito' : '🔁 Habit reminder';
        sendNotification(title, task.title, hourKey);
        notifiedIds.add(hourKey);
    }
}

// ─────────────────────────────────────────────────
// Check Appointments: remind 30 min and 10 min before
// ─────────────────────────────────────────────────

function checkAppointmentReminders(appointments: Appointment[], language: string) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const apt of appointments) {
        if (apt.date !== todayStr) continue;
        if (!apt.time) continue;
        if (apt.status === 'completed' || apt.status === 'failed') continue;

        const [aptHour, aptMin] = apt.time.split(':').map(Number);
        const aptMinutes = aptHour * 60 + aptMin;
        const minutesBefore = aptMinutes - nowMinutes;

        // 30 minutes before
        if (minutesBefore >= 28 && minutesBefore <= 32) {
            const key = `apt-30min-${apt.id}-${todayStr}`;
            if (!notifiedIds.has(key)) {
                const title = language === 'es' ? '📅 En 30 minutos' : '📅 In 30 minutes';
                const body = language === 'es'
                    ? `${apt.title} a las ${apt.time}`
                    : `${apt.title} at ${apt.time}`;
                sendNotification(title, body, key);
                notifiedIds.add(key);
            }
        }

        // 10 minutes before
        if (minutesBefore >= 8 && minutesBefore <= 12) {
            const key = `apt-10min-${apt.id}-${todayStr}`;
            if (!notifiedIds.has(key)) {
                const title = language === 'es' ? '⏰ En 10 minutos' : '⏰ In 10 minutes';
                const body = language === 'es'
                    ? `${apt.title} a las ${apt.time}`
                    : `${apt.title} at ${apt.time}`;
                sendNotification(title, body, key);
                notifiedIds.add(key);
            }
        }

        // At the time of the appointment
        if (minutesBefore >= -2 && minutesBefore <= 2) {
            const key = `apt-now-${apt.id}-${todayStr}`;
            if (!notifiedIds.has(key)) {
                const title = language === 'es' ? '🚨 ¡Es ahora!' : '🚨 Starting now!';
                const body = apt.title;
                sendNotification(title, body, key);
                notifiedIds.add(key);
            }
        }
    }
}

// ─────────────────────────────────────────────────
// Main polling loop: run every 60 seconds
// ─────────────────────────────────────────────────

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startWebNotificationPolling(
    getTasks: () => Task[],
    getAppointments: () => Appointment[],
    getLanguage: () => string,
    notificationsEnabled: () => boolean,
) {
    if (Capacitor.isNativePlatform()) return;
    if (pollingInterval) clearInterval(pollingInterval);

    const run = () => {
        if (!notificationsEnabled()) return;
        if (Notification.permission !== 'granted') return;

        const tasks = getTasks();
        const appointments = getAppointments();
        const language = getLanguage();

        checkTaskReminders(tasks, language);
        checkHabitReminders(tasks, language);
        checkAppointmentReminders(appointments, language);
    };

    // Run immediately on start, then every 60s
    run();
    pollingInterval = setInterval(run, 60 * 1000);
}

export function stopWebNotificationPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}
