package com.iunico.mynotes;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Handles actions from the notification controls (Pausar, Reanudar, Reiniciar).
 * Dispatches to NativeTimerManager, ensuring atomic native state transition and UI synchronization.
 */
public class TimerServiceActionReceiver extends BroadcastReceiver {
    private static final String TAG = "TimerActionReceiver";

    public static final String ACTION_TIMER_PAUSE = "com.iunico.mynotes.ACTION_TIMER_PAUSE";
    public static final String ACTION_TIMER_RESUME = "com.iunico.mynotes.ACTION_TIMER_RESUME";
    public static final String ACTION_TIMER_RESET = "com.iunico.mynotes.ACTION_TIMER_RESET";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        Log.d(TAG, "Received timer action: " + action);

        NativeTimerManager manager = NativeTimerManager.getInstance(context);

        switch (action) {
            case ACTION_TIMER_PAUSE:
                manager.pause();
                break;
            case ACTION_TIMER_RESUME:
                manager.resume();
                break;
            case ACTION_TIMER_RESET:
                manager.reset();
                break;
            default:
                Log.w(TAG, "Unknown action received: " + action);
                break;
        }
    }
}
