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
    public static final String ACTION_COMPLETE_EVENT = "com.iunico.mynotes.ACTION_COMPLETE_EVENT";
    public static final String ACTION_DISMISS_EVENT = "com.iunico.mynotes.ACTION_DISMISS_EVENT";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null || ACTION_SHOW_EVENT_REMINDERS.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            checkAndShowEventNotifications(context);
            if (ACTION_SHOW_EVENT_REMINDERS.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
                rescheduleAlarm(context);
            }
        } else if (ACTION_COMPLETE_EVENT.equals(action)) {
            String appointmentId = intent.getStringExtra("appointment_id");
            int notificationId = intent.getIntExtra("notification_id", -1);
            completeEvent(context, appointmentId, notificationId);
        } else if (ACTION_DISMISS_EVENT.equals(action)) {
            int notificationId = intent.getIntExtra("notification_id", -1);
            if (notificationId != -1) {
                NotificationManagerCompat.from(context).cancel(notificationId);
            }
        }
    }

    public static void checkAndShowEventNotifications(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String notificationsEnabled = prefs.getString("notificationsEnabled", "true");
        if (!"true".equals(notificationsEnabled)) {
            return;
        }

        String appointmentsJson = prefs.getString("appointments", "[]");
        try {
            JSONArray arr = new JSONArray(appointmentsJson);
            
            // Get today and tomorrow date strings
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            sdf.setTimeZone(TimeZone.getDefault());
            String todayStr = sdf.format(new Date());

            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.DAY_OF_YEAR, 1);
            String tomorrowStr = sdf.format(cal.getTime());

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
            
            // 2. Scan and trigger notifications for today and tomorrow
            for (int i = 0; i < arr.length(); i++) {
                JSONObject apt = arr.getJSONObject(i);
                String id = apt.optString("id", "");
                String title = apt.optString("title", "Evento");
                String date = apt.optString("date", "");
                String status = apt.optString("status", "pending");
                String color = apt.optString("color", "#7f0df2"); // Default purple

                if (id.isEmpty() || date.isEmpty()) continue;

                // Only notify if event is pending
                if (!"pending".equals(status)) continue;

                // Avoid sending duplicate notifications for this event today
                String alreadySentToday = sentJson.optString(id, "");
                if (alreadySentToday.equals(todayStr)) {
                    continue; // Already sent a notification for this event today
                }

                int notificationId = id.hashCode();

                if (date.equals(todayStr)) {
                    showTodayNotification(context, id, title, color, notificationId);
                    sentJson.put(id, todayStr);
                } else if (date.equals(tomorrowStr)) {
                    showTomorrowNotification(context, title, color, notificationId);
                    sentJson.put(id, todayStr);
                }
            }

            notificationPrefs.edit().putString("sent", sentJson.toString()).apply();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void showTodayNotification(Context context, String appointmentId, String title, String color, int notificationId) {
        createNotificationChannel(context);

        // Html styled text for "Hoy tienes [Nombre del evento] ¿ya lo haz completado?"
        String textHtml = "Hoy tienes <font color=\"" + color + "\"><b>" + title + "</b></font> ¿ya lo has completado?";
        CharSequence contentText;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            contentText = Html.fromHtml(textHtml, Html.FROM_HTML_MODE_LEGACY);
        } else {
            contentText = Html.fromHtml(textHtml);
        }

        // Action: Completado
        Intent completeIntent = new Intent(context, EventsReminderReceiver.class);
        completeIntent.setAction(ACTION_COMPLETE_EVENT);
        completeIntent.putExtra("appointment_id", appointmentId);
        completeIntent.putExtra("notification_id", notificationId);
        
        int completeFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            completeFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent completePendingIntent = PendingIntent.getBroadcast(
            context, notificationId * 2, completeIntent, completeFlags
        );

        // Purple styled text for "Completado" button
        SpannableString completeButtonText = new SpannableString("Completado");
        completeButtonText.setSpan(new ForegroundColorSpan(Color.parseColor("#7f0df2")), 0, completeButtonText.length(), 0);

        // Action: Aún no
        Intent dismissIntent = new Intent(context, EventsReminderReceiver.class);
        dismissIntent.setAction(ACTION_DISMISS_EVENT);
        dismissIntent.putExtra("notification_id", notificationId);
        
        int dismissFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            dismissFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
            context, notificationId * 2 + 1, dismissIntent, dismissFlags
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                // ic_notification_small: silueta monócroma de la "n" en Dancing Script.
                // Android aplana a blanco; NO usar ic_launcher aquí.
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
                context, notificationId, openAppIntent, openFlags
            );
            builder.setContentIntent(contentIntent);
        }

        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }

    private static void showTomorrowNotification(Context context, String title, String color, int notificationId) {
        createNotificationChannel(context);

        // Html styled text for "Mañana tienes [nombre del evento] no te olvides"
        String textHtml = "Mañana tienes <font color=\"" + color + "\"><b>" + title + "</b></font> no te olvides";
        CharSequence contentText;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            contentText = Html.fromHtml(textHtml, Html.FROM_HTML_MODE_LEGACY);
        } else {
            contentText = Html.fromHtml(textHtml);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                // ic_notification_small: silueta monócroma de la "n" en Dancing Script.
                // Android aplana a blanco; NO usar ic_launcher aquí.
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
                context, notificationId, openAppIntent2, openFlags
            );
            builder.setContentIntent(contentIntent);
        }

        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }

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

            // Notify capacitor frontend
            WidgetSyncPlugin.notifyAppointmentsChanged();

            // Refresh calendar widget
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

    public static void rescheduleAlarm(Context context) {
        android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, EventsReminderReceiver.class);
        intent.setAction(ACTION_SHOW_EVENT_REMINDERS);
        
        int alarmFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 2026, intent, alarmFlags
        );

        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(System.currentTimeMillis());
        // Schedule for today/tomorrow at 8:00 AM (08:00)
        calendar.set(Calendar.HOUR_OF_DAY, 8);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);

        if (calendar.getTimeInMillis() <= System.currentTimeMillis()) {
            calendar.add(Calendar.DAY_OF_YEAR, 1);
        }

        if (alarmManager != null) {
            try {
                if (Build.VERSION.SDK_INT >= 31) {
                    if (alarmManager.canScheduleExactAlarms()) {
                        alarmManager.setExactAndAllowWhileIdle(
                            android.app.AlarmManager.RTC_WAKEUP,
                            calendar.getTimeInMillis(),
                            pendingIntent
                        );
                    } else {
                        alarmManager.setAndAllowWhileIdle(
                            android.app.AlarmManager.RTC_WAKEUP,
                            calendar.getTimeInMillis(),
                            pendingIntent
                        );
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        android.app.AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                } else {
                    alarmManager.setExact(
                        android.app.AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                }
            } catch (SecurityException se) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        android.app.AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                } else {
                    alarmManager.set(
                        android.app.AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                }
            }
        }
    }

    public static void cancelAlarm(Context context) {
        android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, EventsReminderReceiver.class);
        intent.setAction(ACTION_SHOW_EVENT_REMINDERS);
        
        int alarmFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 2026, intent, alarmFlags
        );

        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
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
