/**
 * notification-slots.ts
 *
 * Utilidad central para distribuir notificaciones en franjas horarias fijas.
 *
 * Problema que resuelve: cuando todos los hábitos/tareas se programan para el
 * mismo momento, se disparan en ráfaga. Esta utilidad asigna a cada ítem una
 * franja determinística (basada en el hash de su ID) para que los recordatorios
 * lleguen repartidos a lo largo del día.
 *
 * Las franjas son persistibles en @capacitor/preferences para que en el futuro
 * el usuario pueda personalizarlas desde ajustes.
 */

import { Preferences } from '@capacitor/preferences';

// ─────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────

export interface TimeSlot {
    hour: number;   // 0-23
    minute: number; // 0-59
}

// ─────────────────────────────────────────────────
// Configuración por defecto
// ─────────────────────────────────────────────────

/**
 * Franjas horarias predeterminadas: mañana, mediodía y tarde.
 * Editables por el usuario en el futuro (ver saveNotificationSlots).
 */
export const DEFAULT_SLOTS: TimeSlot[] = [
    { hour: 9,  minute: 0 },
    { hour: 13, minute: 0 },
    { hour: 18, minute: 0 },
];

const PREFS_KEY = 'notification-slots';

// ─────────────────────────────────────────────────
// Hash determinístico (djb2)
// ─────────────────────────────────────────────────

/**
 * Convierte un string en un entero de 32 bits usando el algoritmo djb2.
 * Siempre devuelve un número no negativo.
 *
 * El mismo ID siempre produce el mismo hash, garantizando que el ítem
 * quede en la misma franja aunque se reprograme o edite.
 */
export function hashStringToInt(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        // hash * 33 + charCode  (equivalente a (hash << 5) + hash + c)
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0; // fuerza entero de 32 bits con signo
    }
    return Math.abs(hash);
}

// ─────────────────────────────────────────────────
// Asignación de franjas
// ─────────────────────────────────────────────────

/**
 * Devuelve el índice de franja (0-based) para el itemId dado.
 * Es determinístico: el mismo ID siempre produce el mismo índice.
 */
export function assignSlotIndex(itemId: string, slots: TimeSlot[] = DEFAULT_SLOTS): number {
    return hashStringToInt(itemId) % slots.length;
}

/**
 * Devuelve la franja `TimeSlot` asignada a itemId dentro del array de slots.
 */
export function assignSlot(itemId: string, slots: TimeSlot[] = DEFAULT_SLOTS): TimeSlot {
    return slots[assignSlotIndex(itemId, slots)];
}

// ─────────────────────────────────────────────────
// Construcción de la fecha de disparo
// ─────────────────────────────────────────────────

/**
 * Construye un Date con la hora/minuto de la franja asignada, basado en `baseDate`.
 *
 * - Si la hora calculada ya pasó hoy, se devuelve para mañana.
 * - `jitterMinutes` añade un desplazamiento aleatorio de ±jitterMinutes para
 *   que ítems del mismo slot no disparen en el mismo segundo exacto.
 *
 * @param baseDate     Fecha de referencia (normalmente `new Date()`).
 * @param slot         Franja horaria asignada.
 * @param jitterMinutes Máximo desfase aleatorio en minutos (por defecto 5).
 */
export function buildTriggerDate(
    baseDate: Date,
    slot: TimeSlot,
    jitterMinutes = 5,
): Date {
    const trigger = new Date(baseDate);
    trigger.setHours(slot.hour, slot.minute, 0, 0);

    // Aplicar jitter ±jitterMinutes
    if (jitterMinutes > 0) {
        const jitterMs = (Math.random() * 2 - 1) * jitterMinutes * 60 * 1000;
        trigger.setTime(trigger.getTime() + jitterMs);
    }

    // Si la hora ya pasó hoy, mover a mañana
    if (trigger.getTime() <= Date.now()) {
        trigger.setDate(trigger.getDate() + 1);
        // Re-establecer hora/minuto para no arrastrar el jitter al día siguiente
        trigger.setHours(slot.hour, slot.minute, 0, 0);
        if (jitterMinutes > 0) {
            const jitterMs = (Math.random() * 2 - 1) * jitterMinutes * 60 * 1000;
            trigger.setTime(trigger.getTime() + jitterMs);
        }
    }

    return trigger;
}

// ─────────────────────────────────────────────────
// Persistencia de franjas en @capacitor/preferences
// ─────────────────────────────────────────────────

/**
 * Lee las franjas guardadas por el usuario en Preferences.
 * Si no hay ninguna guardada (primera ejecución), devuelve DEFAULT_SLOTS.
 */
export async function getNotificationSlots(): Promise<TimeSlot[]> {
    try {
        const { value } = await Preferences.get({ key: PREFS_KEY });
        if (value) {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed as TimeSlot[];
            }
        }
    } catch (e) {
        console.warn('[NotificationSlots] Failed to read slots from preferences:', e);
    }
    return DEFAULT_SLOTS;
}

/**
 * Persiste las franjas elegidas por el usuario en Preferences.
 * Debe llamarse cuando el usuario guarda sus preferencias de horario.
 */
export async function saveNotificationSlots(slots: TimeSlot[]): Promise<void> {
    try {
        await Preferences.set({ key: PREFS_KEY, value: JSON.stringify(slots) });
    } catch (e) {
        console.warn('[NotificationSlots] Failed to save slots to preferences:', e);
    }
}
