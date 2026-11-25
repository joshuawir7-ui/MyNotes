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

public class TaskGroupReminderReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "task_group_reminder_channel";
    private static final int NOTIFICATION_ID = 555;

    @Override
    public void onReceive(Context context, Intent intent) {
        // Capacitor Preferences stores data in a shared preference named "CapacitorStorage"
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String storeJson = prefs.getString("mynotes-storage-v1", null);

        if (storeJson != null) {
            try {
                JSONObject store = new JSONObject(storeJson);
                // Zustand persist structure: { "state": { ... }, "version": 0 }
                JSONObject state = store.optJSONObject("state");
                if (state != null) {
                    JSONArray taskGroups = state.optJSONArray("taskGroups");
                    if (taskGroups != null && taskGroups.length() > 0) {
                        int incompleteGroups = 0;
                        String firstIncompleteTitle = "";

                        for (int i = 0; i < taskGroups.length(); i++) {
                            JSONObject group = taskGroups.getJSONObject(i);
                            JSONArray tasks = group.optJSONArray("tasks");
                            boolean groupHasIncomplete = false;
                            
                            if (tasks != null && tasks.length() > 0) {
                                for (int j = 0; j < tasks.length(); j++) {
                                    if (!tasks.getJSONObject(j).optBoolean("completed", false)) {
                                        groupHasIncomplete = true;
                                        break;
                                    }
                                }
                            }

                            if (groupHasIncomplete) {
                                incompleteGroups++;
                                if (firstIncompleteTitle.isEmpty()) {
                                    firstIncompleteTitle = group.optString("title");
                                }
                            }
                        }

                        if (incompleteGroups > 0) {
                            showReminderNotification(context, incompleteGroups, firstIncompleteTitle);
                        }
                    }
                }
            } catch (Exception e) {
                android.util.Log.e("TaskGroupReminder", "Error parsing store JSON", e);
            }
        }
    }

    private void showReminderNotification(Context context, int count, String title) {
        createNotificationChannel(context);

        android.content.SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String lang = prefs.getString("language", "es");
        String notifTitle = "es".equals(lang) ? "Recordatorio de Tareas" : "zh".equals(lang) ? "任务提醒" : "Task Reminder";
        String message = "es".equals(lang)
            ? (count == 1 ? "Aún tienes tareas pendientes en: " + title : "Tienes " + count + " grupos de tareas pendientes por completar.")
            : "zh".equals(lang)
                ? (count == 1 ? "您仍有未完成的任务组：" + title : "您有 " + count + " 个任务组待完成。")
                : (count == 1 ? "You still have pending tasks in: " + title : "You have " + count + " task groups pending completion.");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                // ic_notification_small: silueta monócroma de la "n" en Dancing Script.
                // Android aplana a blanco; NO usar ic_launcher aquí.
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle(notifTitle)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

        Intent openAppIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openAppIntent != null) {
            android.app.PendingIntent contentIntent = android.app.PendingIntent.getActivity(
                context, 0, openAppIntent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
            );
            builder.setContentIntent(contentIntent);
        }

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Recordatorios de Tareas";
            String description = "Notificaciones para grupos de tareas pendientes";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }
}
