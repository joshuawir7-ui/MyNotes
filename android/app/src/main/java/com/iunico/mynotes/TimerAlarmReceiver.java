package com.iunico.mynotes;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class TimerAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "TimerAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "Broadcast received: " + action);

        NativeTimerManager timerManager = NativeTimerManager.getInstance(context);

        if (NativeTimerManager.ACTION_TIMER_ALARM.equals(action)) {
            timerManager.onAlarmFired();
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                   "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            timerManager.onBootCompleted();
        }
    }
}

