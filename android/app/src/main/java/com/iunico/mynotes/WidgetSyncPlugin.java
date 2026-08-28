package com.iunico.mynotes;

import android.appwidget.AppWidgetManager;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import android.Manifest;
import android.os.Build;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationManagerCompat;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;

@CapacitorPlugin(
    name = "WidgetSync",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class WidgetSyncPlugin extends Plugin {

    private static WidgetSyncPlugin instance;
    private static String pendingOpenNoteId = null;

    private BroadcastReceiver imageDownloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.iunico.mynotes.IMAGE_DOWNLOADED".equals(intent.getAction())) {
                JSObject data = new JSObject();
                data.put("driveFileId", intent.getStringExtra("driveFileId"));
                data.put("noteId", intent.getStringExtra("noteId"));
                data.put("blockId", intent.getStringExtra("blockId"));
                data.put("localUri", intent.getStringExtra("localUri"));
                notifyListeners("imageDownloaded", data);
            }
        }
    };

    @Override
    public void load() {
        super.load();
        instance = this;
        ContextCompat.registerReceiver(
            getContext(),
            imageDownloadReceiver,
            new IntentFilter("com.iunico.mynotes.IMAGE_DOWNLOADED"),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            getContext().unregisterReceiver(imageDownloadReceiver);
        } catch (IllegalArgumentException e) {
            // Ignored, receiver not registered
        }
    }

    public static void notifyPendingNote(String noteId) {
        JSObject data = new JSObject();
        data.put("noteId", noteId);
        if (instance != null) {
            instance.notifyListeners("noteOpenRequested", data);
        }
    }

    public static void notifyTasksChanged() {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("timestamp", System.currentTimeMillis());
            instance.notifyListeners("tasksUpdated", data);
        }
    }

    public static void notifyAppointmentsChanged() {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("timestamp", System.currentTimeMillis());
            instance.notifyListeners("appointmentsUpdated", data);
        }
    }

    public static void notifyNotesChanged() {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("timestamp", System.currentTimeMillis());
            instance.notifyListeners("notesUpdated", data);
        }
    }

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        String goalsJson = call.getString("goals");
        String appointmentsJson = call.getString("appointments");
        String notesJson = call.getString("notes");
        String tasksJson = call.getString("tasks");
        String snapshotsJson = call.getString("dailySnapshots");
        String language = call.getString("language");
        String notificationsEnabled = call.getString("notificationsEnabled");
        String isDarkMode = call.getString("isDarkMode");
        String pinnedNoteId = call.getString("pinnedNoteId");

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        
        if (goalsJson != null) editor.putString("goals", goalsJson);
        if (appointmentsJson != null) editor.putString("appointments", appointmentsJson);
        if (notesJson != null) editor.putString("notes", notesJson);
        if (tasksJson != null) editor.putString("tasks", tasksJson);
        if (snapshotsJson != null) editor.putString("dailySnapshots", snapshotsJson);
        if (language != null) editor.putString("language", language);
        if (notificationsEnabled != null) editor.putString("notificationsEnabled", notificationsEnabled);
        if (isDarkMode != null) editor.putString("isDarkMode", isDarkMode);
        if (pinnedNoteId != null) editor.putString("pinnedNoteId", pinnedNoteId);
        
        editor.apply();

        if (appointmentsJson != null) {
            EventsReminderReceiver.checkAndShowEventNotifications(context);
        }

        if (tasksJson != null && !"false".equals(notificationsEnabled)) {
            try {
                JSONArray tasksArr = new JSONArray(tasksJson);
                HabitActionReceiver.updateNotification(context, tasksArr);
            } catch (Exception ignored) {}
        }

        broadcastWidgetUpdate();

        call.resolve();
    }

    private void broadcastWidgetUpdate() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                Context context = getContext();
                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);

                // Notify Tasks widget
                int[] tasksIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, TasksWidgetProvider.class));
                if (tasksIds != null && tasksIds.length > 0) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(tasksIds, R.id.widget_tasks_list);
                    
                    Intent intent = new Intent(context, TasksWidgetProvider.class);
                    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, tasksIds);
                    context.sendBroadcast(intent);
                }

                // Notify Notes widget
                int[] notesIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, NotesWidgetProvider.class));
                if (notesIds != null && notesIds.length > 0) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(notesIds, R.id.widget_note_content_list);

                    Intent intent = new Intent(context, NotesWidgetProvider.class);
                    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, notesIds);
                    context.sendBroadcast(intent);
                }

                // Notify Quotes widget
                int[] quotesIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, QuotesWidgetProvider.class));
                if (quotesIds != null && quotesIds.length > 0) {
                    Intent intent = new Intent(context, QuotesWidgetProvider.class);
                    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, quotesIds);
                    context.sendBroadcast(intent);
                }

                // Notify Weekly widget
                int[] weeklyIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, WeeklyWidgetProvider.class));
                if (weeklyIds != null && weeklyIds.length > 0) {
                    Intent intent = new Intent(context, WeeklyWidgetProvider.class);
                    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, weeklyIds);
                    context.sendBroadcast(intent);
                }

                // Notify Calendar widget
                int[] calendarIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, CalendarWidgetProvider.class));
                if (calendarIds != null && calendarIds.length > 0) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(calendarIds, R.id.widget_calendar_events_list);

                    Intent intent = new Intent(context, CalendarWidgetProvider.class);
                    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, calendarIds);
                    context.sendBroadcast(intent);
                }
            }
        }).start();
    }

    @PluginMethod
    public void showHabitNotification(PluginCall call) {
        String tasksJson = call.getString("tasks");
        if (tasksJson == null) {
            call.reject("Must provide tasks JSON");
            return;
        }

        try {
            JSONArray tasks = new JSONArray(tasksJson);
            HabitActionReceiver.updateNotification(getContext(), tasks);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to show notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open battery settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openMiuiAutostart(PluginCall call) {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // Fallback for other OEMs or if activity doesn't exist
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + getContext().getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception err) {
                call.reject("Failed to open autostart: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void getTasks(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String tasksJson = prefs.getString("tasks", "[]");
        JSObject ret = new JSObject();
        ret.put("tasks", tasksJson);
        call.resolve(ret);
    }

    @PluginMethod
    public void getNotes(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String notesJson = prefs.getString("notes", "[]");
        JSObject ret = new JSObject();
        ret.put("notes", notesJson);
        call.resolve(ret);
    }

    @PluginMethod
    public void getPendingOpenNote(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String noteId = prefs.getString("pending_open_note_id", null);
        JSObject ret = new JSObject();
        if (noteId != null) {
            ret.put("noteId", noteId);
            prefs.edit().remove("pending_open_note_id").apply();
        } else {
            ret.put("noteId", JSObject.NULL);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void getAppointments(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String appointmentsJson = prefs.getString("appointments", "[]");
        JSObject ret = new JSObject();
        ret.put("appointments", appointmentsJson);
        call.resolve(ret);
    }

    @PluginMethod
    public void enqueueCloudSync(PluginCall call) {
        String token = call.getString("token");
        String payload = call.getString("payload");
        
        if (token == null || payload == null) {
            call.reject("Token and payload are required");
            return;
        }
        
        try {
            // Save payload to a file since it can be large
            java.io.File file = new java.io.File(getContext().getFilesDir(), "cloud_sync_payload.json");
            java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
            fos.write(payload.getBytes("UTF-8"));
            fos.close();
            
            // Save token
            SharedPreferences prefs = getContext().getSharedPreferences("CloudSync", Context.MODE_PRIVATE);
            prefs.edit().putString("googleToken", token).apply();
            
            // Enqueue Worker
            androidx.work.OneTimeWorkRequest syncRequest = new androidx.work.OneTimeWorkRequest.Builder(NoteSyncWorker.class)
                .setConstraints(new androidx.work.Constraints.Builder()
                    .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                    .build())
                .build();
                
            androidx.work.WorkManager.getInstance(getContext())
                .enqueueUniqueWork("GoogleDriveCloudSync", androidx.work.ExistingWorkPolicy.REPLACE, syncRequest);
                
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to enqueue sync: " + e.getMessage());
        }
    }

    @PluginMethod
    public void enqueueImageDownload(PluginCall call) {
        String token = call.getString("token");
        String driveFileId = call.getString("driveFileId");
        String noteId = call.getString("noteId");
        String blockId = call.getString("blockId");
        String fileName = call.getString("fileName");

        if (token == null || driveFileId == null || noteId == null || blockId == null) {
            call.reject("token, driveFileId, noteId, blockId are required");
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences("CloudSync", Context.MODE_PRIVATE);
            prefs.edit().putString("googleToken", token).apply();

            androidx.work.Data inputData = new androidx.work.Data.Builder()
                .putString("driveFileId", driveFileId)
                .putString("noteId", noteId)
                .putString("blockId", blockId)
                .putString("fileName", fileName)
                .build();

            androidx.work.OneTimeWorkRequest downloadRequest = new androidx.work.OneTimeWorkRequest.Builder(ImageDownloadWorker.class)
                .setInputData(inputData)
                .setConstraints(new androidx.work.Constraints.Builder()
                    .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                    .build())
                .build();

            androidx.work.WorkManager.getInstance(getContext())
                .enqueueUniqueWork("ImageDownload_" + driveFileId, androidx.work.ExistingWorkPolicy.REPLACE, downloadRequest);

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to enqueue image download: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startTaskGroupReminder(PluginCall call) {
        Context context = getContext();
        startTaskGroupReminderInternal(context);
        call.resolve();
    }

    private void startTaskGroupReminderInternal(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, TaskGroupReminderReceiver.class);
        
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Schedule every 5 hours (5 * 60 * 60 * 1000 ms)
        long interval = 5 * 60 * 60 * 1000;
        long triggerAt = System.currentTimeMillis() + interval;

        if (alarmManager != null) {
            alarmManager.setInexactRepeating(
                AlarmManager.RTC_WAKEUP, triggerAt, interval, pendingIntent
            );
        }

        // Schedule daily high-priority tasks reminder at 8:00 PM
        scheduleHighPriorityReminder(context);

        // Schedule daily events reminder at 8:00 AM
        EventsReminderReceiver.rescheduleAlarm(context);
    }

    @PluginMethod
    public void stopTaskGroupReminder(PluginCall call) {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, TaskGroupReminderReceiver.class);
        
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }

        // Cancel daily high-priority reminder
        cancelHighPriorityReminder(context);

        // Cancel daily events reminder
        EventsReminderReceiver.cancelAlarm(context);

        call.resolve();
    }

    private void scheduleHighPriorityReminder(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, HighPriorityReminderReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        java.util.Calendar calendar = java.util.Calendar.getInstance();
        calendar.setTimeInMillis(System.currentTimeMillis());
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 20); // 8:00 PM
        calendar.set(java.util.Calendar.MINUTE, 0);
        calendar.set(java.util.Calendar.SECOND, 0);

        if (calendar.getTimeInMillis() <= System.currentTimeMillis()) {
            calendar.add(java.util.Calendar.DAY_OF_YEAR, 1);
        }

        if (alarmManager != null) {
            try {
                if (Build.VERSION.SDK_INT >= 31) { // Android 12 S
                    if (alarmManager.canScheduleExactAlarms()) {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            calendar.getTimeInMillis(),
                            pendingIntent
                        );
                    } else {
                        alarmManager.setAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            calendar.getTimeInMillis(),
                            pendingIntent
                        );
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                } else {
                    alarmManager.setExact(
                        AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                }
            } catch (SecurityException se) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                } else {
                    alarmManager.set(
                        AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                }
            }
        }
    }

    private void cancelHighPriorityReminder(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, HighPriorityReminderReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationPermsCallback");
                return;
            }
        }
        
        triggerNotificationRefresh();

        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PermissionCallback
    private void notificationPermsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED;
        ret.put("granted", granted);

        if (granted) {
            triggerNotificationRefresh();
        }

        call.resolve(ret);
    }

    private void triggerNotificationRefresh() {
        // ── REGLA EXPLÍCITA: la notificación de HÁBITOS se dispara inmediatamente,
        //    sin ningún delay. No pasa por la lógica de escalonado.
        //    Las demás se escalonan con incrementos de 2 minutos para que lleguen
        //    "poco a poco" en vez de en ráfaga al iniciar/refrescar.
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
            String tasksJson = prefs.getString("tasks", "[]");
            JSONArray tasks = new JSONArray(tasksJson);

            // t = 0: HÁBITOS — inmediato, sin modificar su lógica de disparo.
            HabitActionReceiver.updateNotification(context, tasks);
            android.util.Log.d("WidgetSyncPlugin", "[stagger] t=0   → HabitActionReceiver (inmediato, sin delay)");

            final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
            final long STAGGER_MS = 2L * 60L * 1000L; // 2 minutos

            // t = +2 min: Eventos
            handler.postDelayed(() -> {
                try {
                    android.util.Log.d("WidgetSyncPlugin", "[stagger] t=+2min → EventsReminderReceiver");
                    EventsReminderReceiver.checkAndShowEventNotifications(getContext());
                } catch (Exception e) {
                    android.util.Log.e("WidgetSyncPlugin", "Error in staggered events notification", e);
                }
            }, STAGGER_MS);

            // t = +4 min: Alta prioridad + programación de alarmas recurrentes
            handler.postDelayed(() -> {
                try {
                    android.util.Log.d("WidgetSyncPlugin", "[stagger] t=+4min → HighPriority + alarmas recurrentes");
                    startTaskGroupReminderInternal(getContext());
                } catch (Exception e) {
                    android.util.Log.e("WidgetSyncPlugin", "Error in staggered high-priority setup", e);
                }
            }, STAGGER_MS * 2);

        } catch (Exception e) {
            android.util.Log.e("WidgetSyncPlugin", "Error in triggerNotificationRefresh", e);
        }
    }

    @PluginMethod
    public void generateVideoThumbnailNative(PluginCall call) {
        String videoPath = call.getString("videoPath");
        if (videoPath == null) {
            call.reject("Missing videoPath");
            return;
        }

        try {
            String resolvedPath = videoPath.replace("file://", "");
            if (resolvedPath.startsWith("http://localhost/_capacitor_file_")) {
                resolvedPath = resolvedPath.replace("http://localhost/_capacitor_file_", "");
            }
            
            android.media.MediaMetadataRetriever retriever = new android.media.MediaMetadataRetriever();
            retriever.setDataSource(resolvedPath);
            android.graphics.Bitmap bitmap = retriever.getFrameAtTime(1000000); // 1 second
            
            if (bitmap != null) {
                int maxDim = 480;
                int w = bitmap.getWidth();
                int h = bitmap.getHeight();
                if (w > h && w > maxDim) {
                    h = (int) (h * ((float) maxDim / w));
                    w = maxDim;
                } else if (h > maxDim) {
                    w = (int) (w * ((float) maxDim / h));
                    h = maxDim;
                }
                android.graphics.Bitmap scaledBitmap = android.graphics.Bitmap.createScaledBitmap(bitmap, w, h, true);
                
                java.io.ByteArrayOutputStream byteStream = new java.io.ByteArrayOutputStream();
                scaledBitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 70, byteStream);
                byte[] bytes = byteStream.toByteArray();
                String base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
                
                retriever.release();
                
                JSObject ret = new JSObject();
                ret.put("base64", "data:image/jpeg;base64," + base64);
                call.resolve(ret);
            } else {
                retriever.release();
                call.reject("Could not generate frame from video");
            }
        } catch (Exception e) {
            android.util.Log.e("WidgetSyncPlugin", "Error generating native video thumbnail", e);
            call.reject("Error generating video thumbnail: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        String url = call.getString("url");
        String mimeType = call.getString("mimeType", "*/*");
        if (url == null) {
            android.util.Log.e("AttachmentOpen", "url is null");
            call.reject("url is required");
            return;
        }
        
        android.util.Log.d("AttachmentOpen", "Iniciando apertura de " + url + " (mimeType=" + mimeType + ")");
        
        try {
            Context context = getContext();
            String path = url.replace("file://", "");
            java.io.File file = new java.io.File(path);
            if (!file.exists()) {
                android.util.Log.e("AttachmentOpen", "No existe copia local en la ruta: " + path);
                call.reject("File does not exist: " + path);
                return;
            }
            
            android.util.Log.d("AttachmentOpen", "Archivo local confirmado: " + file.getAbsolutePath());
            
            Uri contentUri;
            try {
                contentUri = androidx.core.content.FileProvider.getUriForFile(
                    context, 
                    context.getPackageName() + ".fileprovider", 
                    file
                );
            } catch (Exception e) {
                android.util.Log.e("AttachmentOpen", "FALLÓ generar URI de FileProvider", e);
                call.reject("FileProvider error: " + e.getMessage());
                return;
            }
            
            android.util.Log.d("AttachmentOpen", "URI generada: " + contentUri);
            
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            
            // Explicitly grant permission to all apps that can handle this intent
            java.util.List<android.content.pm.ResolveInfo> resInfoList = context.getPackageManager().queryIntentActivities(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
            if (resInfoList.isEmpty()) {
                android.util.Log.w("AttachmentOpen", "No hay apps instaladas que manejen el intent ACTION_VIEW para " + mimeType);
            } else {
                android.util.Log.d("AttachmentOpen", "Encontradas " + resInfoList.size() + " apps compatibles.");
            }
            
            for (android.content.pm.ResolveInfo resolveInfo : resInfoList) {
                String packageName = resolveInfo.activityInfo.packageName;
                context.grantUriPermission(packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            }
            
            try {
                Intent chooser = Intent.createChooser(intent, "Abrir con...");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(chooser);
                android.util.Log.d("AttachmentOpen", "Intent de apertura (chooser) lanzado correctamente");
                call.resolve();
            } catch (Exception e) {
                android.util.Log.e("AttachmentOpen", "FALLÓ lanzar el intent de apertura", e);
                call.reject("Failed to launch intent: " + e.getMessage());
            }
        } catch (Exception e) {
            android.util.Log.e("AttachmentOpen", "Excepción general en openFile", e);
            call.reject("Failed to open file: " + e.getMessage());
        }
    }
}
