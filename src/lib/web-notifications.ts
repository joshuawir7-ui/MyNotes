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
import { assignSlot, DEFAULT_SLOTS } from './notification-slots';
import { getPhilosophicalQuoteForDate, shouldSendPhilosophicalQuoteToday } from './philosophical-quotes';

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
        // Only notify for high-priority tasks
        if (task.energyLevel !== 'High') continue;
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
// Check Daily Habits: remind at each item's assigned slot
// ─────────────────────────────────────────────────

/**
 * Tolerance window in minutes around the assigned slot hour.
 * The polling runs every 60 s, so ±30 min ensures we never miss a slot.
 */
const SLOT_WINDOW_MINUTES = 30;

function checkHabitReminders(tasks: Task[], language: string) {
    const now = new Date();
    const hour = now.getHours();
    // Only remind between 8:00 and 22:00
    if (hour < 8 || hour >= 22) return;

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMinutes = hour * 60 + now.getMinutes();

    for (const task of tasks) {
        // Only notify for high-priority habits
        if (task.energyLevel !== 'High') continue;
        if (!task.isHabit) continue;
        if (task.enabled === false) continue;
        if (task.recurrence !== 'Daily') continue;

        const completedToday = task.completedDates?.includes(todayStr);
        if (completedToday) continue;

        // Each habit gets its own deterministic slot based on its ID.
        // Same habit → same slot on every polling run, so the deduplication key is stable.
        const slot = assignSlot(task.id, DEFAULT_SLOTS);
        const slotTotalMinutes = slot.hour * 60 + slot.minute;

        // Fire if we are within ±SLOT_WINDOW_MINUTES of the habit's assigned slot
        if (Math.abs(nowMinutes - slotTotalMinutes) > SLOT_WINDOW_MINUTES) continue;

        // Deduplication key: tied to the specific slot hour of this habit on this day.
        // Different habits assigned to the same slot get different keys because the ID is in the key.
        const slotKey = `habit-${task.id}-${todayStr}-slot${slot.hour}`;
        if (notifiedIds.has(slotKey)) continue;

        const title = language === 'es' ? '🔁 Recordatorio de hábito' : '🔁 Habit reminder';
        sendNotification(title, task.title, slotKey);
        notifiedIds.add(slotKey);
    }
}

// ─────────────────────────────────────────────────
// Check Appointments: notify for today's and tomorrow's pending events
// ─────────────────────────────────────────────────

const WEB_EVENT_NOTIF_STORAGE_KEY = 'mynotes_web_event_notifs_v1';

function hasWebEventBeenNotified(key: string): boolean {
    if (notifiedIds.has(key)) return true;
    if (typeof window === 'undefined') return false;
    try {
        const raw = localStorage.getItem(WEB_EVENT_NOTIF_STORAGE_KEY);
        if (!raw) return false;
        const map = JSON.parse(raw);
        return Boolean(map && map[key]);
    } catch {
        return false;
    }
}

function markWebEventNotified(key: string, todayStr: string) {
    notifiedIds.add(key);
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(WEB_EVENT_NOTIF_STORAGE_KEY);
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        // Prune keys from older days
        for (const k of Object.keys(map)) {
            if (map[k] !== todayStr) {
                delete map[k];
            }
        }
        map[key] = todayStr;
        localStorage.setItem(WEB_EVENT_NOTIF_STORAGE_KEY, JSON.stringify(map));
    } catch {
        // ignore storage errors
    }
}

export function checkAppointmentReminders(appointments: Appointment[], language: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    for (const apt of appointments) {
        if (!apt || !apt.id || !apt.date) continue;
        // Only notify for pending events
        if (apt.status && apt.status !== 'pending') continue;

        if (apt.date === todayStr) {
            const key = `apt-today-${apt.id}-${todayStr}`;
            if (!hasWebEventBeenNotified(key)) {
                const title = language === 'es' ? '📅 Recordatorio de Evento' : '📅 Event Reminder';
                const body = language === 'es'
                    ? `Hoy tienes "${apt.title}" ¿ya lo has completado?`
                    : `Today you have "${apt.title}". Have you completed it?`;
                sendNotification(title, body, key);
                markWebEventNotified(key, todayStr);
            }
        } else if (apt.date === tomorrowStr) {
            const key = `apt-tomorrow-${apt.id}-${todayStr}`;
            if (!hasWebEventBeenNotified(key)) {
                const title = language === 'es' ? '🗓️ Recordatorio de Evento' : '🗓️ Event Reminder';
                const body = language === 'es'
                    ? `Mañana tienes "${apt.title}", no te olvides`
                    : `Tomorrow you have "${apt.title}", don't forget`;
                sendNotification(title, body, key);
                markWebEventNotified(key, todayStr);
            }
        }
    }
}


// ─────────────────────────────────────────────────
// Check Priority Tasks: fire at configured reminder slots
// ─────────────────────────────────────────────────

function checkPriorityTaskReminders(
    tasks: Task[],
    settings: { enabled: boolean; slots: string[] },
    language: string
) {
    if (!settings.enabled) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Gather pending high-priority tasks
    const pendingHighPriority: Task[] = [];
    const dayOfWeek = now.getDay(); // 0 = Sunday

    for (const task of tasks) {
        // Skip disabled tasks
        if (task.enabled === false) continue;
        // Only high-priority
        if (task.energyLevel !== 'High') continue;

        // Check active days (for habits)
        if (task.activeDays && task.activeDays.length > 0) {
            if (!task.activeDays.includes(dayOfWeek)) continue;
        }

        // Check if completed today
        const recurrence = task.recurrence ?? 'None';
        let isCompleted: boolean;
        if (recurrence !== 'None') {
            isCompleted = task.completedDates?.includes(todayStr) ?? false;
        } else {
            isCompleted = task.completed ?? false;
        }

        if (!isCompleted) {
            pendingHighPriority.push(task);
        }
    }

    if (pendingHighPriority.length === 0) return;

    // Check each configured slot
    for (const slotStr of settings.slots) {
        const [h, m] = slotStr.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) continue;
        const slotMinutes = h * 60 + m;
        const diff = slotMinutes - nowMinutes;

        if (diff >= -2 && diff <= 2) {
            const key = `priority-slot-${h}-${m}-${todayStr}`;
            if (!notifiedIds.has(key)) {
                const title = language === 'es' ? '🎯 Tareas prioritarias pendientes' : '🎯 Priority tasks pending';
                const body = pendingHighPriority.length === 1
                    ? pendingHighPriority[0].title
                    : language === 'es'
                        ? `${pendingHighPriority.length} tareas de alta prioridad pendientes`
                        : `${pendingHighPriority.length} high-priority tasks pending`;
                sendNotification(title, body, key);
                notifiedIds.add(key);
            }
        }
    }
}

function checkPhilosophicalQuoteReminder(enabled: boolean, language: string) {
    if (!enabled) return;
    const now = new Date();
    if (!shouldSendPhilosophicalQuoteToday(now)) return;
    if (now.getHours() < 9) return;

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const key = `philosophy-quote-${todayStr}`;
    if (notifiedIds.has(key)) return;
    if (typeof window !== 'undefined' && localStorage.getItem('mynotes_last_web_quote_date') === todayStr) {
        notifiedIds.add(key);
        return;
    }

    const quote = getPhilosophicalQuoteForDate(now);
    const isEs = language === 'es' || language === 'es-419';
    const title = isEs ? '✦ Disciplina & Filosofía' : '✦ Discipline & Philosophy';
    const body = `"${isEs ? quote.es : quote.en}" — ${quote.author}`;

    sendNotification(title, body, key);
    notifiedIds.add(key);
    if (typeof window !== 'undefined') {
        localStorage.setItem('mynotes_last_web_quote_date', todayStr);
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
    getPriorityReminderSettings?: () => { enabled: boolean; slots: string[] },
    getPhilosophicalQuotesEnabled?: () => boolean,
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

        if (getPriorityReminderSettings) {
            const settings = getPriorityReminderSettings();
            checkPriorityTaskReminders(tasks, settings, language);
        }

        if (getPhilosophicalQuotesEnabled) {
            checkPhilosophicalQuoteReminder(getPhilosophicalQuotesEnabled(), language);
        }
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
