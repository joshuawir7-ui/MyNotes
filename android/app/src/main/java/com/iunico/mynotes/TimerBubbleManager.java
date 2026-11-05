package com.iunico.mynotes;

import android.animation.ValueAnimator;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.ImageButton;
import android.widget.TextView;

import com.getcapacitor.JSObject;

import java.util.Locale;

/**
 * Manages the floating overlay pill bubble (TYPE_APPLICATION_OVERLAY) for Android.
 * Features:
 * - Does not steal focus (keyboard works in any background app).
 * - Draggable with edge snapping and position persistence.
 * - Live countdown timer with play/pause and dismiss controls.
 * - Modes: "outside" (default, shown outside app), "always", "never".
 */
public class TimerBubbleManager {
    private static final String TAG = "TimerBubbleManager";
    private static final String PREFS_NAME = "mynotes_bubble_prefs";
    private static final String KEY_MODE = "bubble_mode"; // "outside" | "always" | "never"
    private static final String KEY_POS_X = "bubble_x";
    private static final String KEY_POS_Y = "bubble_y";

    public static final String MODE_ALWAYS = "always";
    public static final String MODE_OUTSIDE = "outside";
    public static final String MODE_NEVER = "never";

    private static TimerBubbleManager instance;
    private final Context context;
    private final SharedPreferences prefs;
    private final WindowManager windowManager;
    private final Handler mainHandler;

    private View bubbleView;
    private WindowManager.LayoutParams layoutParams;
    private boolean isBubbleAttached = false;
    private boolean isUserDismissed = false;
    private boolean isAppInForeground = false;

    private TextView timeTextView;
    private ImageButton playPauseButton;
    private ImageButton closeButton;

    private final Runnable tickRunnable = new Runnable() {
        @Override
        public void run() {
            updateTick();
            if (isBubbleAttached) {
                mainHandler.postDelayed(this, 500);
            }
        }
    };

    public static synchronized TimerBubbleManager getInstance(Context context) {
        if (instance == null) {
            instance = new TimerBubbleManager(context.getApplicationContext());
        }
        return instance;
    }

    private TimerBubbleManager(Context context) {
        this.context = context;
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    public boolean canDrawOverlays() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(context);
        }
        return true;
    }

    public String getMode() {
        return prefs.getString(KEY_MODE, MODE_OUTSIDE);
    }

    public void setMode(String mode) {
        prefs.edit().putString(KEY_MODE, mode).apply();
        evaluateVisibility();
    }

    public void resetUserDismissed() {
        this.isUserDismissed = false;
    }

    public void onAppForeground() {
        isAppInForeground = true;
        evaluateVisibility();
    }

    public void onAppBackground() {
        isAppInForeground = false;
        evaluateVisibility();
    }

    public void onTimerStateUpdated(JSObject state) {
        mainHandler.post(() -> {
            String status = state.getString("status", "idle");
            if ("idle".equals(status) || "finished".equals(status)) {
                isUserDismissed = false;
                hideBubble();
            } else {
                updateUI(state);
                evaluateVisibility();
            }
        });
    }

    public void evaluateVisibility() {
        mainHandler.post(() -> {
            if (!canDrawOverlays()) {
                hideBubble();
                return;
            }

            NativeTimerManager timer = NativeTimerManager.getInstance(context);
            JSObject state = timer.getState();
            String status = state.getString("status", "idle");

            if ("idle".equals(status) || "finished".equals(status) || isUserDismissed) {
                hideBubble();
                return;
            }

            String mode = getMode();
            if (MODE_NEVER.equals(mode)) {
                hideBubble();
            } else if (MODE_ALWAYS.equals(mode)) {
                showBubble();
            } else {
                // MODE_OUTSIDE: visible only when app is in background
                if (isAppInForeground) {
                    hideBubble();
                } else {
                    showBubble();
                }
            }
        });
    }

    @SuppressLint("ClickableViewAccessibility")
    public void showBubble() {
        if (!canDrawOverlays() || isBubbleAttached) {
            if (isBubbleAttached) {
                updateUI(NativeTimerManager.getInstance(context).getState());
            }
            return;
        }

        try {
            int layoutType;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                layoutType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
            } else {
                layoutType = WindowManager.LayoutParams.TYPE_PHONE;
            }

            int flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;

            DisplayMetrics metrics = context.getResources().getDisplayMetrics();
            int screenWidth = metrics.widthPixels;

            int defaultX = screenWidth - dpToPx(190);
            int defaultY = dpToPx(120);

            int savedX = prefs.getInt(KEY_POS_X, defaultX);
            int savedY = prefs.getInt(KEY_POS_Y, defaultY);

            layoutParams = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    flags,
                    PixelFormat.TRANSLUCENT
            );
            layoutParams.gravity = Gravity.TOP | Gravity.START;
            layoutParams.x = savedX;
            layoutParams.y = savedY;

            LayoutInflater inflater = LayoutInflater.from(context);
            bubbleView = inflater.inflate(R.layout.timer_bubble_pill, null);

            timeTextView = bubbleView.findViewById(R.id.bubble_time_text);
            playPauseButton = bubbleView.findViewById(R.id.bubble_play_pause_btn);
            closeButton = bubbleView.findViewById(R.id.bubble_close_btn);

            setupTouchAndDrag();

            windowManager.addView(bubbleView, layoutParams);
            isBubbleAttached = true;

            updateUI(NativeTimerManager.getInstance(context).getState());
            mainHandler.post(tickRunnable);

            Log.d(TAG, "Floating timer bubble attached to window");
        } catch (Exception e) {
            Log.e(TAG, "Failed to attach bubble view", e);
            isBubbleAttached = false;
        }
    }

    public void hideBubble() {
        mainHandler.removeCallbacks(tickRunnable);
        if (isBubbleAttached && bubbleView != null) {
            try {
                windowManager.removeView(bubbleView);
            } catch (Exception e) {
                Log.w(TAG, "Error removing bubble view", e);
            }
            isBubbleAttached = false;
            bubbleView = null;
            Log.d(TAG, "Floating timer bubble removed from window");
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private void setupTouchAndDrag() {
        if (bubbleView == null) return;

        // Play/Pause button action
        playPauseButton.setOnClickListener(v -> {
            NativeTimerManager timer = NativeTimerManager.getInstance(context);
            JSObject state = timer.getState();
            String status = state.getString("status", "idle");
            if ("running".equals(status)) {
                timer.pause();
            } else if ("paused".equals(status)) {
                timer.resume();
            } else {
                timer.start(0, 25);
            }
        });

        // Close button: dismisses the bubble for this session (timer continues)
        closeButton.setOnClickListener(v -> {
            isUserDismissed = true;
            hideBubble();
        });

        // Dragging and click on the pill body
        bubbleView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float touchDownX, touchDownY;
            private boolean isDragging = false;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;
                        touchDownX = event.getRawX();
                        touchDownY = event.getRawY();
                        isDragging = false;
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - touchDownX;
                        float dy = event.getRawY() - touchDownY;

                        if (Math.hypot(dx, dy) > 12) {
                            isDragging = true;
                        }

                        if (isDragging) {
                            layoutParams.x = (int) (initialX + dx);
                            layoutParams.y = (int) (initialY + dy);
                            try {
                                windowManager.updateViewLayout(bubbleView, layoutParams);
                            } catch (Exception ignored) {}
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                        if (!isDragging) {
                            // Click detected: open app
                            openMainActivity();
                        } else {
                            // Drag ended: snap to left or right edge smoothly
                            snapToNearestEdge();
                        }
                        return true;
                }
                return false;
            }
        });
    }

    private void snapToNearestEdge() {
        if (bubbleView == null || !isBubbleAttached) return;

        DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        int screenWidth = metrics.widthPixels;
        int screenHeight = metrics.heightPixels;

        int pillWidth = bubbleView.getWidth();
        if (pillWidth <= 0) pillWidth = dpToPx(180);
        int margin = dpToPx(14);

        int targetX;
        if (layoutParams.x + (pillWidth / 2) < (screenWidth / 2)) {
            targetX = margin;
        } else {
            targetX = screenWidth - pillWidth - margin;
        }

        // Clamp Y to avoid notch and navigation bar
        int topMin = dpToPx(60);
        int bottomMax = screenHeight - dpToPx(100);
        int targetY = Math.max(topMin, Math.min(bottomMax, layoutParams.y));

        int startX = layoutParams.x;
        ValueAnimator anim = ValueAnimator.ofInt(startX, targetX);
        anim.setDuration(220);
        anim.setInterpolator(new DecelerateInterpolator());
        anim.addUpdateListener(animation -> {
            if (!isBubbleAttached || bubbleView == null) return;
            layoutParams.x = (int) animation.getAnimatedValue();
            layoutParams.y = targetY;
            try {
                windowManager.updateViewLayout(bubbleView, layoutParams);
            } catch (Exception ignored) {}
        });
        anim.start();

        // Persist final position
        prefs.edit()
                .putInt(KEY_POS_X, targetX)
                .putInt(KEY_POS_Y, targetY)
                .apply();
    }

    private void updateUI(JSObject state) {
        if (!isBubbleAttached || timeTextView == null) return;

        String status = state.getString("status", "idle");
        boolean isRunning = "running".equals(status);

        if (playPauseButton != null) {
            playPauseButton.setImageResource(isRunning ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
        }

        updateTick();
    }

    private void updateTick() {
        if (!isBubbleAttached || timeTextView == null) return;

        NativeTimerManager timer = NativeTimerManager.getInstance(context);
        JSObject state = timer.getState();
        String status = state.getString("status", "idle");

        if ("running".equals(status)) {
            long endAt = state.optLong("endAt", 0L);
            long now = System.currentTimeMillis();
            long remaining = Math.max(0, endAt - now);
            timeTextView.setText(formatRemainingTime(remaining));

            if (remaining <= 0) {
                timer.onAlarmFired();
            }
        } else {
            long remaining = state.optLong("remainingMs", 0L);
            timeTextView.setText(formatRemainingTime(remaining));
        }
    }

    private void openMainActivity() {
        try {
            Intent intent = new Intent(context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening MainActivity from bubble", e);
        }
    }

    private String formatRemainingTime(long ms) {
        if (ms < 0) ms = 0;
        long totalSeconds = ms / 1000;
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;
        return String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * context.getResources().getDisplayMetrics().density);
    }
}

