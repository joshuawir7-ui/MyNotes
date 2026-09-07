package com.iunico.mynotes;

import java.util.Calendar;

/**
 * NotificationSlots
 *
 * Helper Java que replica la lógica de notification-slots.ts para la capa Android nativa.
 * Asigna a cada ítem (evento, hábito, tarea) una franja horaria determinística
 * usando un hash djb2 de su ID, distribuiendo las notificaciones a lo largo del día
 * en lugar de dispararlas todas al mismo tiempo.
 *
 * Franjas predeterminadas: 09:00, 13:00, 18:00 (espejo de DEFAULT_SLOTS en TS).
 */
public final class NotificationSlots {

    // ─────────────────────────────────────────────────────────────────────────
    // Configuración de franjas
    // ─────────────────────────────────────────────────────────────────────────

    /** Horas de las franjas (índice compartido con SLOT_MINUTES). */
    private static final int[] SLOT_HOURS   = { 9, 13, 18 };
    /** Minutos de las franjas. */
    private static final int[] SLOT_MINUTES = { 0,  0,  0 };

    // ─────────────────────────────────────────────────────────────────────────
    // Hash determinístico (djb2) — mismo algoritmo que notification-slots.ts
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Convierte un String en un entero no negativo de 32 bits usando djb2.
     * Produce el mismo resultado que {@code hashStringToInt} en notification-slots.ts.
     */
    public static int hashStringToInt(String str) {
        if (str == null || str.isEmpty()) return 0;
        int hash = 5381;
        for (int i = 0; i < str.length(); i++) {
            // hash * 33 + c  (equivalente a (hash << 5) + hash + c)
            hash = ((hash << 5) + hash) + str.charAt(i);
        }
        return Math.abs(hash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Asignación de franja
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Devuelve el índice de franja (0-based) para el itemId dado.
     * Determinístico: el mismo ID siempre produce el mismo índice.
     */
    public static int assignSlotIndex(String itemId) {
        return hashStringToInt(itemId) % SLOT_HOURS.length;
    }

    /**
     * Devuelve la hora de la franja asignada al itemId (0-23).
     */
    public static int assignSlotHour(String itemId) {
        return SLOT_HOURS[assignSlotIndex(itemId)];
    }

    /**
     * Devuelve el minuto de la franja asignada al itemId (0-59).
     */
    public static int assignSlotMinute(String itemId) {
        return SLOT_MINUTES[assignSlotIndex(itemId)];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Construcción del triggerAtMillis
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calcula el {@code triggerAtMillis} para programar la alarma del ítem.
     *
     * <ul>
     *   <li>Si la franja aún no ha pasado hoy → dispara hoy en esa franja.</li>
     *   <li>Si la franja ya pasó hoy → dispara mañana en esa franja.</li>
     *   <li>Se aplica un jitter aleatorio de ±{@code jitterMinutes} para que
     *       ítems del mismo slot no lleguen en el mismo segundo exacto.</li>
     * </ul>
     *
     * @param itemId        ID del ítem (evento, tarea, hábito).
     * @param jitterMinutes Máximo desfase aleatorio en minutos (usar 5 normalmente).
     * @return              Timestamp en milisegundos para pasar a AlarmManager.
     */
    public static long buildTriggerMillis(String itemId, int jitterMinutes) {
        int slotHour   = assignSlotHour(itemId);
        int slotMinute = assignSlotMinute(itemId);

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, slotHour);
        cal.set(Calendar.MINUTE, slotMinute);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        // Aplicar jitter ±jitterMinutes
        long jitterMs = 0;
        if (jitterMinutes > 0) {
            // Rango [-jitterMinutes, +jitterMinutes] en milisegundos
            jitterMs = (long) ((Math.random() * 2 - 1) * jitterMinutes * 60 * 1000L);
            cal.setTimeInMillis(cal.getTimeInMillis() + jitterMs);
        }

        // Si la hora calculada ya pasó, mover al mismo slot de mañana
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 1);
            // Re-establecer hora/minuto para no arrastrar el jitter al día siguiente
            cal.set(Calendar.HOUR_OF_DAY, slotHour);
            cal.set(Calendar.MINUTE, slotMinute);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            if (jitterMinutes > 0) {
                jitterMs = (long) ((Math.random() * 2 - 1) * jitterMinutes * 60 * 1000L);
                cal.setTimeInMillis(cal.getTimeInMillis() + jitterMs);
            }
        }

        return cal.getTimeInMillis();
    }

    // Constructor privado — clase de utilidad estática
    private NotificationSlots() {}
}
