package com.iunico.mynotes;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.text.Html;
import android.text.SpannableString;
import android.text.style.ForegroundColorSpan;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

public class EventsReminderReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "events_reminder_channel";
    public static final String ACTION_SHOW_EVENT_REMINDERS = "com.iunico.mynotes.ACTION_SHOW_EVENT_REMINDERS";
    public static final String ACTION_SHOW_SINGLE_EVENT    = "com.iunico.mynotes.ACTION_SHOW_SINGLE_EVENT";
    public static final String ACTION_COMPLETE_EVENT       = "com.iunico.mynotes.ACTION_COMPLETE_EVENT";
    public static final String ACTION_DISMISS_EVENT        = "com.iunico.mynotes.ACTION_DISMISS_EVENT";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null || ACTION_SHOW_EVENT_REMINDERS.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            // Full scan: cancel stale notifications and reschedule all per-event alarms
            checkAndShowEventNotifications(context);
            scheduleAllEventAlarms(context);
        } else if (ACTION_SHOW_SINGLE_EVENT.equals(action)) {
            // Per-event alarm: show the notification for one specific event
            String appointmentId = intent.getStringExtra("appointment_id");
            String title         = intent.getStringExtra("appointment_title");
            String date          = intent.getStringExtra("appointment_date");
            String color         = intent.getStringExtra("appointment_color");
            boolean isTomorrow   = intent.getBooleanExtra("is_tomorrow", false);
            int notificationId   = intent.getIntExtra("notification_id", -1);
            if (appointmentId != null && notificationId != -1) {
                // Only show if the event is still pending
                SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
                String notificationsEnabled = prefs.getString("notificationsEnabled", "true");
                if (!"true".equals(notificationsEnabled)) return;
                if (!isEventStillPending(context, appointmentId)) return;

                // Dedup: only one notification per event per day
                SharedPreferences notifPrefs = context.getSharedPreferences("EventNotificationsSent", Context.MODE_PRIVATE);
                String todayStr = getTodayString();
                String alreadySent = notifPrefs.getString(appointmentId, "");
                if (todayStr.equals(alreadySent)) return;

                if (isTomorrow) {
                    showTomorrowNotification(context, title != null ? title : "Evento", color != null ? color : "#7f0df2", notificationId);
                } else {
                    showTodayNotification(context, appointmentId, title != null ? title : "Evento", color != null ? color : "#7f0df2", notificationId);
                }
                notifPrefs.edit().putString(appointmentId, todayStr).apply();
            }
        } else if (ACTION_COMPLETE_EVENT.equals(action)) {
            String appointmentId = intent.getStringExtra("appointment_id");
            int notificationId   = intent.getIntExtra("notification_id", -1);
            completeEvent(context, appointmentId, notificationId);
        } else if (ACTION_DISMISS_EVENT.equals(action)) {
            int notificationId = intent.getIntExtra("notification_id", -1);
            if (notificationId != -1) {
                NotificationManagerCompat.from(context).cancel(notificationId);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Full scan — cancel stale, used as fallback and on boot
    // ─────────────────────────────────────────────────────────────────────────

    public static void checkAndShowEventNotifications(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String notificationsEnabled = prefs.getString("notificationsEnabled", "true");
        if (!"true".equals(notificationsEnabled)) {
            return;
        }

        String appointmentsJson = prefs.getString("appointments", "[]");
        try {
            JSONArray arr = new JSONArray(appointmentsJson);

            // 1. Cancel notifications for events that are no longer pending or no longer exist
            SharedPreferences notificationPrefs = context.getSharedPreferences("EventNotificationsSent", Context.MODE_PRIVATE);
            String sentJsonStr = notificationPrefs.getString("sent", "{}");
            JSONObject sentJson = new JSONObject(sentJsonStr);

            java.util.Set<String> pendingIds = new java.util.HashSet<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject apt = arr.getJSONObject(i);
                String id = apt.optString("id", "");
                String status = apt.optString("status", "pending");
                if ("pending".equals(status)) {
                    pendingIds.add(id);
                }
            }

            java.util.Iterator<String> keys = sentJson.keys();
            List<String> keysToRemove = new ArrayList<>();
            while (keys.hasNext()) {
                String keyId = keys.next();
                if (!pendingIds.contains(keyId)) {
                    int notificationId = keyId.hashCode();
                    NotificationManagerCompat.from(context).cancel(notificationId);
                    keysToRemove.add(keyId);
                }
            }
            for (String keyId : keysToRemove) {
                sentJson.remove(keyId);
            }

            notificationPrefs.edit().putString("sent", sentJson.toString()).apply();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Schedule individual per-event alarms using NotificationSlots
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Replaces the old single 08:00 scan alarm with N individual alarms, one per
     * pending event. Each event fires at its own deterministic slot (from NotificationSlots)
     * so notifications are distributed throughout the day instead of bursting at once.
     */
    public static void scheduleAllEventAlarms(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String notificationsEnabled = prefs.getString("notificationsEnabled", "true");
        if (!"true".equals(notificationsEnabled)) return;

        String appointmentsJson = prefs.getString("appointments", "[]");
        android.app.AlarmManager alarmManager =
                (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        sdf.setTimeZone(TimeZone.getDefault());
        String todayStr    = sdf.format(new Date());
        Calendar cal       = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, 1);
        String tomorrowStr = sdf.format(cal.getTime());

        try {
            JSONArray arr = new JSONArray(appointmentsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject apt = arr.getJSONObject(i);
                String id     = apt.optString("id", "");
                String title  = apt.optString("title", "Evento");
                String date   = apt.optString("date", "");
                String status = apt.optString("status", "pending");
                String color  = apt.optString("color", "#7f0df2");

                if (id.isEmpty() || date.isEmpty()) continue;
                if (!"pending".equals(status)) continue;

                boolean isToday    = date.equals(todayStr);
                boolean isTomorrow = date.equals(tomorrowStr);
                if (!isToday && !isTomorrow) continue;

                // Deterministic slot based on the event's ID (same event → same slot always)
                long triggerMillis = NotificationSlots.buildTriggerMillis(id, 5);

                int notificationId = id.hashCode();

                Intent alarmIntent = new Intent(context, EventsReminderReceiver.class);
                alarmIntent.setAction(ACTION_SHOW_SINGLE_EVENT);
                alarmIntent.putExtra("appointment_id",    id);
                alarmIntent.putExtra("appointment_title", title);
                alarmIntent.putExtra("appointment_date",  date);
                alarmIntent.putExtra("appointment_color", color);
                alarmIntent.putExtra("is_tomorrow",       isTomorrow);
                alarmIntent.putExtra("notification_id",   notificationId);

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }

                // Use the event's hashCode as the unique PendingIntent requestCode
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        context, notificationId, alarmIntent, flags);

                scheduleExactAlarm(alarmManager, triggerMillis, pendingIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Keep rescheduleAlarm for backward-compat (boot receiver, legacy callers)
    // Now it just delegates to scheduleAllEventAlarms.
    // ─────────────────────────────────────────────────────────────────────────

    public static void rescheduleAlarm(Context context) {
        scheduleAllEventAlarms(context);
    }

    public static void cancelAlarm(Context context) {
        // Cancel the legacy single-scan alarm (requestCode 2026) if still present
        android.app.AlarmManager alarmManager =
                (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, EventsReminderReceiver.class);
        intent.setAction(ACTION_SHOW_EVENT_REMINDERS);

        int alarmFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 2026, intent, alarmFlags);
        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Notification builders
    // ─────────────────────────────────────────────────────────────────────────

    private static void showTodayNotification(Context context, String appointmentId, String title, String color, int notificationId) {
        createNotificationChannel(context);

        String textHtml = "Hoy tienes <font color=\"" + color + "\"><b>" + title + "</b></font> ¿ya lo has completado?";
        CharSequence contentText;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            contentText = Html.fromHtml(textHtml, Html.FROM_HTML_MODE_LEGACY);
        } else {
            contentText = Html.fromHtml(textHtml);
        }

        Intent completeIntent = new Intent(context, EventsReminderReceiver.class);
        completeIntent.setAction(ACTION_COMPLETE_EVENT);
        completeIntent.putExtra("appointment_id", appointmentId);
        completeIntent.putExtra("notification_id", notificationId);

        int completeFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            completeFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent completePendingIntent = PendingIntent.getBroadcast(
                context, notificationId * 2, completeIntent, completeFlags);

        SpannableString completeButtonText = new SpannableString("Completado");
        completeButtonText.setSpan(new ForegroundColorSpan(Color.parseColor("#7f0df2")), 0, completeButtonText.length(), 0);

        Intent dismissIntent = new Intent(context, EventsReminderReceiver.class);
        dismissIntent.setAction(ACTION_DISMISS_EVENT);
        dismissIntent.putExtra("notification_id", notificationId);

        int dismissFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            dismissFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                context, notificationId * 2 + 1, dismissIntent, dismissFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle("Recordatorio de Evento")
                .setContentText(contentText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(contentText))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setColor(Color.parseColor("#7f0df2"))
                .addAction(R.drawable.ic_check_box_outline, completeButtonText, completePendingIntent)
                .addAction(0, "Aún no", dismissPendingIntent)
                .setAutoCancel(true);

        Intent openAppIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openAppIntent != null) {
            int openFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                openFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent contentIntent = PendingIntent.getActivity(
                    context, notificationId, openAppIntent, openFlags);
            builder.setContentIntent(contentIntent);
        }

        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }

    private static void showTomorrowNotification(Context context, String title, String color, int notificationId) {
        createNotificationChannel(context);

        String textHtml = "Mañana tienes <font color=\"" + color + "\"><b>" + title + "</b></font> no te olvides";
        CharSequence contentText;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            contentText = Html.fromHtml(textHtml, Html.FROM_HTML_MODE_LEGACY);
        } else {
            contentText = Html.fromHtml(textHtml);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle("Recordatorio de Evento")
                .setContentText(contentText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(contentText))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setColor(Color.parseColor("#7f0df2"))
                .setAutoCancel(true);

        Intent openAppIntent2 = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openAppIntent2 != null) {
            int openFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                openFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent contentIntent = PendingIntent.getActivity(
                    context, notificationId, openAppIntent2, openFlags);
            builder.setContentIntent(contentIntent);
        }

        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Complete event action
    // ─────────────────────────────────────────────────────────────────────────

    private void completeEvent(Context context, String appointmentId, int notificationId) {
        if (appointmentId == null) return;

        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String appointmentsJson = prefs.getString("appointments", "[]");

        try {
            JSONArray arr = new JSONArray(appointmentsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject apt = arr.getJSONObject(i);
                if (appointmentId.equals(apt.optString("id"))) {
                    apt.put("status", "completed");
                    break;
                }
            }

            prefs.edit()
                    .putString("appointments", arr.toString())
                    .commit();

            WidgetSyncPlugin.notifyAppointmentsChanged();

            android.appwidget.AppWidgetManager appWidgetManager = android.appwidget.AppWidgetManager.getInstance(context);
            android.content.ComponentName calendarWidget = new android.content.ComponentName(context, CalendarWidgetProvider.class);
            int[] calendarIds = appWidgetManager.getAppWidgetIds(calendarWidget);
            appWidgetManager.notifyAppWidgetViewDataChanged(calendarIds, R.id.widget_calendar_events_list);

            Intent intent = new Intent(context, CalendarWidgetProvider.class);
            intent.setAction(android.appwidget.AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_IDS, calendarIds);
            context.sendBroadcast(intent);

        } catch (Exception e) {
            e.printStackTrace();
        }

        if (notificationId != -1) {
            NotificationManagerCompat.from(context).cancel(notificationId);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Returns true if the event with the given ID is still pending in WidgetData. */
    private static boolean isEventStillPending(Context context, String appointmentId) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String json = prefs.getString("appointments", "[]");
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject apt = arr.getJSONObject(i);
                if (appointmentId.equals(apt.optString("id"))) {
                    return "pending".equals(apt.optString("status", "pending"));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }

    private static String getTodayString() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        sdf.setTimeZone(TimeZone.getDefault());
        return sdf.format(new Date());
    }

    /**
     * Schedules an exact alarm compatible with all Android API levels (including 12+
     * which requires SCHEDULE_EXACT_ALARM or USE_EXACT_ALARM permission).
     */
    private static void scheduleExactAlarm(android.app.AlarmManager alarmManager,
                                            long triggerMillis,
                                            PendingIntent pendingIntent) {
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(
                            android.app.AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(
                            android.app.AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                        android.app.AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
            } else {
                alarmManager.setExact(
                        android.app.AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
            }
        } catch (SecurityException se) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(
                        android.app.AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
            } else {
                alarmManager.set(
                        android.app.AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
            }
        }
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Recordatorios de Eventos";
            String description = "Notificaciones para eventos de hoy y mañana";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }
}
