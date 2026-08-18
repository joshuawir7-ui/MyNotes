package com.iunico.mynotes;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class HighPriorityReminderReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "high_priority_reminder_channel";
    private static final int NOTIFICATION_ID = 888;

    @Override
    public void onReceive(Context context, Intent intent) {
        checkAndShowHighPriorityNotification(context);
        rescheduleAlarm(context);
    }

    private void checkAndShowHighPriorityNotification(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        
        // Check if notifications are enabled
        String notificationsEnabled = prefs.getString("notificationsEnabled", "true");
        if (!"true".equals(notificationsEnabled)) {
            android.util.Log.d("HighPriorityReminder", "Notifications are disabled globally in preferences.");
            return;
        }

        String tasksJson = prefs.getString("tasks", "[]");
        String language = prefs.getString("language", "es");

        try {
            JSONArray tasks = new JSONArray(tasksJson);
            List<String> pendingHighPriorityTitles = new ArrayList<>();

            // Determine today's date and day of week
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
            sdf.setTimeZone(java.util.TimeZone.getDefault());
            String today = sdf.format(new java.util.Date());

            java.util.Calendar cal = java.util.Calendar.getInstance();
            int dayOfWeek = cal.get(java.util.Calendar.DAY_OF_WEEK); // 1 = Sunday, ..., 7 = Saturday
            int jsDayOfWeek = dayOfWeek - 1; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.getJSONObject(i);
                
                // Only active tasks
                if (!task.optBoolean("enabled", true)) {
                    continue;
                }

                // Only high priority tasks
                String priority = task.optString("energyLevel", "Medium");
                if (!"High".equals(priority)) {
                    continue;
                }

                // Check active days for habits
                boolean isActiveDay = true;
                JSONArray activeDays = task.optJSONArray("activeDays");
                if (activeDays != null && activeDays.length() > 0) {
                    isActiveDay = false;
                    for (int k = 0; k < activeDays.length(); k++) {
                        if (activeDays.optInt(k) == jsDayOfWeek) {
                            isActiveDay = true;
                            break;
                        }
                    }
                }

                if (!isActiveDay) {
                    continue;
                }

                // Determine if completed
                boolean isCompleted = false;
                String recurrence = task.optString("recurrence", "None");
                if (!"None".equals(recurrence)) {
                    JSONArray completedDates = task.optJSONArray("completedDates");
                    if (completedDates != null) {
                        for (int k = 0; k < completedDates.length(); k++) {
                            if (today.equals(completedDates.optString(k))) {
                                isCompleted = true;
                                break;
                            }
                        }
                    }
                } else {
                    isCompleted = task.optBoolean("completed", false);
                }

                if (!isCompleted) {
                    pendingHighPriorityTitles.add(task.optString("title", "Tarea"));
                }
            }

            if (!pendingHighPriorityTitles.isEmpty()) {
                showNotification(context, pendingHighPriorityTitles, language);
            }

        } catch (Exception e) {
            android.util.Log.e("HighPriorityReminder", "Error checking high priority tasks", e);
        }
    }

    private void showNotification(Context context, List<String> taskTitles, String language) {
        createNotificationChannel(context);

        String title;
        StringBuilder message = new StringBuilder();

        if ("es".equals(language)) {
            title = "Tareas prioritarias pendientes";
            if (taskTitles.size() == 1) {
                message.append("Aún te falta completar: ").append(taskTitles.get(0));
            } else {
                message.append("Aún te faltan completar: ");
                for (int i = 0; i < taskTitles.size(); i++) {
                    message.append(taskTitles.get(i));
                    if (i < taskTitles.size() - 1) {
                        message.append(", ");
                    }
                }
            }
        } else {
            title = "Pending high-priority tasks";
            if (taskTitles.size() == 1) {
                message.append("You still need to complete: ").append(taskTitles.get(0));
            } else {
                message.append("You still need to complete: ");
                for (int i = 0; i < taskTitles.size(); i++) {
                    message.append(taskTitles.get(i));
                    if (i < taskTitles.size() - 1) {
                        message.append(", ");
                    }
                }
            }
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                // ic_notification_small: silueta monócroma de la "n" en Dancing Script.
                // Android aplana a blanco; NO usar ic_launcher aquí.
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle(title)
                .setContentText(message.toString())
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message.toString()))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

        Intent openAppIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openAppIntent != null) {
            android.app.PendingIntent contentIntent = android.app.PendingIntent.getActivity(
                context, 10, openAppIntent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
            );
            builder.setContentIntent(contentIntent);
        }

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
    }

    private void rescheduleAlarm(Context context) {
        android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, HighPriorityReminderReceiver.class);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getBroadcast(
            context, 1, intent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
        );

        java.util.Calendar calendar = java.util.Calendar.getInstance();
        calendar.setTimeInMillis(System.currentTimeMillis());
        // Schedule for tomorrow at 8:00 PM (20:00)
        calendar.add(java.util.Calendar.DAY_OF_YEAR, 1);
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 20);
        calendar.set(java.util.Calendar.MINUTE, 0);
        calendar.set(java.util.Calendar.SECOND, 0);

        if (alarmManager != null) {
            try {
                if (Build.VERSION.SDK_INT >= 31) { // Android 12 S
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
                // Fallback to non-exact scheduling to prevent crashes
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

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Recordatorios Prioritarios";
            String description = "Notificaciones para tareas de alta prioridad pendientes al final del día";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }
}
