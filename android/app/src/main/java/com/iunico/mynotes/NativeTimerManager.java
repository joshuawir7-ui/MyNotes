package com.iunico.mynotes;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;

public class NativeTimerManager {
    private static final String TAG = "NativeTimerManager";
    private static final String PREFS_NAME = "mynotes_native_timer_state";
    private static final String KEY_STATUS = "status";
    private static final String KEY_DURATION_MS = "durationMs";
    private static final String KEY_END_AT = "endAt";
    private static final String KEY_REMAINING_MS = "remainingMs";
    private static final String KEY_PRESET = "preset";
    private static final String KEY_VERSION = "version";
    private static final String KEY_FINISHED_AT = "finishedAt";

    public static final String ACTION_TIMER_ALARM = "com.iunico.mynotes.ACTION_TIMER_ALARM";
    public static final String CHANNEL_ID = "mynotes_timer_channel";
    private static final int TIMER_REQUEST_CODE = 9921;
    private static final int NOTIFICATION_ID = 9922;

    private static NativeTimerManager instance;
    private final Context context;
    private final SharedPreferences prefs;

    public interface StateChangeListener {
        void onTimerStateChanged(JSObject state);
    }

    private StateChangeListener stateChangeListener;

    public static synchronized NativeTimerManager getInstance(Context context) {
        if (instance == null) {
            instance = new NativeTimerManager(context.getApplicationContext());
        }
        return instance;
    }

    private NativeTimerManager(Context context) {
        this.context = context;
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        createNotificationChannel();
    }

    public void setStateChangeListener(StateChangeListener listener) {
        this.stateChangeListener = listener;
    }

    public synchronized JSObject getState() {
        JSObject obj = new JSObject();
        obj.put("status", prefs.getString(KEY_STATUS, "idle"));
        obj.put("durationMs", prefs.getLong(KEY_DURATION_MS, 25 * 60 * 1000L));
        long endAt = prefs.getLong(KEY_END_AT, 0L);
        obj.put("endAt", endAt > 0 ? endAt : null);
        obj.put("remainingMs", prefs.getLong(KEY_REMAINING_MS, 25 * 60 * 1000L));
        obj.put("preset", prefs.getInt(KEY_PRESET, 25));
        obj.put("version", prefs.getLong(KEY_VERSION, 1L));
        long finishedAt = prefs.getLong(KEY_FINISHED_AT, 0L);
        obj.put("finishedAt", finishedAt > 0 ? finishedAt : null);
        return obj;
    }

    public synchronized void start(long durationMs, int preset) {
        long p = preset > 0 ? preset : 25;
        long d = durationMs > 0 ? durationMs : (p * 60 * 1000L);
        long now = System.currentTimeMillis();
        long endAt = now + d;
        long newVersion = prefs.getLong(KEY_VERSION, 1L) + 1;

        prefs.edit()
            .putString(KEY_STATUS, "running")
            .putLong(KEY_DURATION_MS, d)
            .putLong(KEY_END_AT, endAt)
            .putLong(KEY_REMAINING_MS, d)
            .putInt(KEY_PRESET, (int) p)
            .putLong(KEY_VERSION, newVersion)
            .putLong(KEY_FINISHED_AT, 0L)
            .apply();

        scheduleAlarm(endAt);
        notifyStateChanged();
        Log.d(TAG, "Timer started: duration=" + d + "ms, endAt=" + endAt + ", version=" + newVersion);
    }

    public synchronized void pause() {
        String status = prefs.getString(KEY_STATUS, "idle");
        if (!"running".equals(status)) return;

        long endAt = prefs.getLong(KEY_END_AT, 0L);
        long now = System.currentTimeMillis();
        long remaining = Math.max(0, endAt - now);
        long newVersion = prefs.getLong(KEY_VERSION, 1L) + 1;

        prefs.edit()
            .putString(KEY_STATUS, "paused")
            .putLong(KEY_REMAINING_MS, remaining)
            .putLong(KEY_END_AT, 0L)
            .putLong(KEY_VERSION, newVersion)
            .apply();

        cancelAlarm();
        notifyStateChanged();
        Log.d(TAG, "Timer paused: remaining=" + remaining + "ms, version=" + newVersion);
    }

    public synchronized void resume() {
        String status = prefs.getString(KEY_STATUS, "idle");
        if (!"paused".equals(status)) return;

        long remaining = prefs.getLong(KEY_REMAINING_MS, 0L);
        if (remaining <= 0) return;

        long now = System.currentTimeMillis();
        long endAt = now + remaining;
        long newVersion = prefs.getLong(KEY_VERSION, 1L) + 1;

        prefs.edit()
            .putString(KEY_STATUS, "running")
            .putLong(KEY_END_AT, endAt)
            .putLong(KEY_VERSION, newVersion)
            .apply();

        scheduleAlarm(endAt);
        notifyStateChanged();
        Log.d(TAG, "Timer resumed: endAt=" + endAt + ", version=" + newVersion);
    }

    public synchronized void reset() {
        int preset = prefs.getInt(KEY_PRESET, 25);
        long durationMs = preset * 60 * 1000L;
        long newVersion = prefs.getLong(KEY_VERSION, 1L) + 1;

        prefs.edit()
            .putString(KEY_STATUS, "idle")
            .putLong(KEY_DURATION_MS, durationMs)
            .putLong(KEY_REMAINING_MS, durationMs)
            .putLong(KEY_END_AT, 0L)
            .putLong(KEY_FINISHED_AT, 0L)
            .putLong(KEY_VERSION, newVersion)
            .apply();

        cancelAlarm();
        notifyStateChanged();
        Log.d(TAG, "Timer reset: version=" + newVersion);
    }

    public synchronized void stop() {
        reset();
    }

    public synchronized void onAlarmFired() {
        String status = prefs.getString(KEY_STATUS, "idle");
        if ("finished".equals(status)) return; // Idempotent check

        long now = System.currentTimeMillis();
        long newVersion = prefs.getLong(KEY_VERSION, 1L) + 1;

        prefs.edit()
            .putString(KEY_STATUS, "finished")
            .putLong(KEY_REMAINING_MS, 0L)
            .putLong(KEY_END_AT, 0L)
            .putLong(KEY_FINISHED_AT, now)
            .putLong(KEY_VERSION, newVersion)
            .apply();

        cancelAlarm();
        showFinishedNotification();
        notifyStateChanged();
        Log.d(TAG, "Timer alarm fired and marked finished at " + now);
    }

    public synchronized void onBootCompleted() {
        String status = prefs.getString(KEY_STATUS, "idle");
        if ("running".equals(status)) {
            long endAt = prefs.getLong(KEY_END_AT, 0L);
            long now = System.currentTimeMillis();
            if (now >= endAt) {
                Log.d(TAG, "Device booted after timer expired. Firing alarm now.");
                onAlarmFired();
            } else {
                Log.d(TAG, "Device booted while timer still running. Rescheduling exact alarm for " + endAt);
                scheduleAlarm(endAt);
            }
        }
    }

    private void scheduleAlarm(long triggerAtMillis) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        PendingIntent pi = getAlarmPendingIntent();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                Log.w(TAG, "Exact alarms not allowed. Falling back to setAndAllowWhileIdle.");
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
        }
    }

    private void cancelAlarm() {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = getAlarmPendingIntent();
        am.cancel(pi);
    }

    private PendingIntent getAlarmPendingIntent() {
        Intent intent = new Intent(context, TimerAlarmReceiver.class);
        intent.setAction(ACTION_TIMER_ALARM);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, TIMER_REQUEST_CODE, intent, flags);
    }

    private void notifyStateChanged() {
        if (stateChangeListener != null) {
            try {
                stateChangeListener.onTimerStateChanged(getState());
            } catch (Exception e) {
                Log.e(TAG, "Error notifying state change listener", e);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Temporizador de Enfoque",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificaciones y alarmas al finalizar el temporizador");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 800, 300, 800, 300, 800, 300, 800, 300, 800});

            Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (alarmSound == null) {
                alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            }
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            channel.setSound(alarmSound, audioAttributes);

            nm.createNotificationChannel(channel);
        }
    }

    private void showFinishedNotification() {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(context, 0, openIntent, flags);

        long[] vibratePattern = new long[]{0, 800, 300, 800, 300, 800, 300, 800, 300, 800};

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("MyNotes - Enfoque Finalizado")
            .setContentText("⏰ ¡Tu sesión de enfoque ha terminado!")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .setVibrate(vibratePattern);

        nm.notify(NOTIFICATION_ID, builder.build());

        // Play alarm ringtone for 5 seconds
        try {
            Uri alert = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alert == null) {
                alert = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alert != null) {
                final android.media.Ringtone ringtone = RingtoneManager.getRingtone(context, alert);
                if (ringtone != null) {
                    ringtone.play();
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                if (ringtone.isPlaying()) {
                                    ringtone.stop();
                                }
                            } catch (Exception ignored) {}
                        }
                    }, 5000);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing 5s alarm ringtone", e);
        }
    }
}

