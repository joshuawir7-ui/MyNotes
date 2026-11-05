package com.iunico.mynotes;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;

import java.util.Locale;

/**
 * Foreground Service for MyNotes Focus Timer.
 * Displays a live countdown notification with Pause/Resume/Reset actions
 * and tap-to-open functionality. Compliant with targetSdk 36 and Android 14+ specialUse FGS.
 */
public class TimerForegroundService extends Service {
    private static final String TAG = "TimerForegroundService";

    public static final String CHANNEL_ID_COUNTDOWN = "mynotes_timer_countdown_channel";
    public static final int NOTIFICATION_ID_COUNTDOWN = 9925;

    public static final String ACTION_START = "com.iunico.mynotes.TIMER_SERVICE_START";
    public static final String ACTION_UPDATE = "com.iunico.mynotes.TIMER_SERVICE_UPDATE";
    public static final String ACTION_STOP = "com.iunico.mynotes.TIMER_SERVICE_STOP";

    @Override
    public void onCreate() {
        super.onCreate();
        createCountdownNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        Log.d(TAG, "onStartCommand action=" + action);

        if (ACTION_STOP.equals(action)) {
            stopForegroundService();
            return START_NOT_STICKY;
        }

        updateNotification();
        try {
            TimerBubbleManager.getInstance(this).evaluateVisibility();
        } catch (Exception ignored) {}
        return START_STICKY;
    }

    private void updateNotification() {
        NativeTimerManager manager = NativeTimerManager.getInstance(this);
        JSObject state = manager.getState();
        String status = state.getString("status", "idle");

        if ("idle".equals(status) || "finished".equals(status)) {
            stopForegroundService();
            return;
        }

        Notification notification = buildNotification(state);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int fgsType = 0;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    // API 34+ / targetSdk 36 specialUse foregroundServiceType
                    fgsType = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
                }
                startForeground(NOTIFICATION_ID_COUNTDOWN, notification, fgsType);
            } else {
                startForeground(NOTIFICATION_ID_COUNTDOWN, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground notification", e);
            // Fallback notify
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID_COUNTDOWN, notification);
            }
        }
    }

    private Notification buildNotification(JSObject state) {
        String status = state.getString("status", "idle");
        boolean isRunning = "running".equals(status);
        long endAt = state.optLong("endAt", 0L);
        long remainingMs = state.optLong("remainingMs", 0L);

        // 1. Content Intent (Tap notification to open app)
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(this, 1001, openIntent, piFlags);

        // 2. Action Intents
        PendingIntent pauseIntent = createActionPendingIntent(TimerServiceActionReceiver.ACTION_TIMER_PAUSE, 1002);
        PendingIntent resumeIntent = createActionPendingIntent(TimerServiceActionReceiver.ACTION_TIMER_RESUME, 1003);
        PendingIntent resetIntent = createActionPendingIntent(TimerServiceActionReceiver.ACTION_TIMER_RESET, 1004);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID_COUNTDOWN)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        if (isRunning && endAt > System.currentTimeMillis()) {
            builder.setContentTitle("MyNotes - Enfoque Activo")
                    .setContentText("Temporizador en cuenta atrás")
                    .setUsesChronometer(true)
                    .setChronometerCountDown(true)
                    .setWhen(endAt)
                    .addAction(android.R.drawable.ic_media_pause, "Pausar", pauseIntent)
                    .addAction(android.R.drawable.ic_menu_rotate, "Reiniciar", resetIntent);
        } else {
            // Paused or static
            String formattedTime = formatRemainingTime(remainingMs);
            builder.setContentTitle("MyNotes - Enfoque Pausado")
                    .setContentText("Tiempo restante: " + formattedTime)
                    .setUsesChronometer(false)
                    .addAction(android.R.drawable.ic_media_play, "Reanudar", resumeIntent)
                    .addAction(android.R.drawable.ic_menu_rotate, "Reiniciar", resetIntent);
        }

        return builder.build();
    }

    private PendingIntent createActionPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, TimerServiceActionReceiver.class);
        intent.setAction(action);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(this, requestCode, intent, piFlags);
    }

    private void stopForegroundService() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping foreground", e);
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID_COUNTDOWN);
        }
        stopSelf();
    }

    private void createCountdownNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID_COUNTDOWN,
                    "Temporizador de Enfoque Activo",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Notificación persistente con controles de cuenta atrás para el temporizador");
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);

            nm.createNotificationChannel(channel);
        }
    }

    private String formatRemainingTime(long ms) {
        if (ms < 0) ms = 0;
        long totalSeconds = ms / 1000;
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;
        return String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

