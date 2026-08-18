package com.iunico.mynotes;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class HabitActionReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID  = "habits_silent_channel";
    private static final int    NOTIFICATION_ID = 2026;

    /**
     * Returns a 6×3 table of resource IDs for the 2-column × 3-row habit grid.
     * Each row: { rowContainerId, checkboxBtnId, labelTextViewId }
     * Positions 0-2 → column 1, positions 3-5 → column 2.
     */
    private static int[][] getSlotIds(Context ctx) {
        android.content.res.Resources r = ctx.getResources();
        String pkg = ctx.getPackageName();
        return new int[][] {
            { r.getIdentifier("habit_c1r1",     "id", pkg),
              r.getIdentifier("habit_c1r1_btn",  "id", pkg),
              r.getIdentifier("habit_c1r1_lbl",  "id", pkg) },
            { r.getIdentifier("habit_c1r2",     "id", pkg),
              r.getIdentifier("habit_c1r2_btn",  "id", pkg),
              r.getIdentifier("habit_c1r2_lbl",  "id", pkg) },
            { r.getIdentifier("habit_c1r3",     "id", pkg),
              r.getIdentifier("habit_c1r3_btn",  "id", pkg),
              r.getIdentifier("habit_c1r3_lbl",  "id", pkg) },
            { r.getIdentifier("habit_c2r1",     "id", pkg),
              r.getIdentifier("habit_c2r1_btn",  "id", pkg),
              r.getIdentifier("habit_c2r1_lbl",  "id", pkg) },
            { r.getIdentifier("habit_c2r2",     "id", pkg),
              r.getIdentifier("habit_c2r2_btn",  "id", pkg),
              r.getIdentifier("habit_c2r2_lbl",  "id", pkg) },
            { r.getIdentifier("habit_c2r3",     "id", pkg),
              r.getIdentifier("habit_c2r3_btn",  "id", pkg),
              r.getIdentifier("habit_c2r3_lbl",  "id", pkg) },
        };
    }

    // ─── BroadcastReceiver entry point ────────────────────────────────────────

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        android.util.Log.d("HabitActionReceiver", "Received action: " + action);
        if (action != null && action.startsWith("TOGGLE_TASK_")) {
            String taskId = action.substring("TOGGLE_TASK_".length());
            toggleTaskStatus(context, taskId);
        }
    }

    // ─── Toggle logic ─────────────────────────────────────────────────────────

    private void toggleTaskStatus(Context context, String taskId) {
        if (taskId == null || taskId.isEmpty()) return;

        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String tasksJson = prefs.getString("tasks", "[]");

        try {
            JSONArray tasks = new JSONArray(tasksJson);
            JSONObject targetTask = null;

            for (int i = 0; i < tasks.length(); i++) {
                JSONObject t = tasks.getJSONObject(i);
                if (taskId.equals(t.optString("id", ""))) {
                    targetTask = t;
                    break;
                }
            }

            if (targetTask != null) {
                java.text.SimpleDateFormat sdf =
                    new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
                sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                String today = sdf.format(new java.util.Date());

                String recurrence = targetTask.optString("recurrence", "None");
                boolean nowCompleted = false;

                if (!"None".equals(recurrence)) {
                    JSONArray completedDates = targetTask.optJSONArray("completedDates");
                    if (completedDates == null) {
                        completedDates = new JSONArray();
                        targetTask.put("completedDates", completedDates);
                    }
                    int foundIndex = -1;
                    for (int j = 0; j < completedDates.length(); j++) {
                        if (today.equals(completedDates.optString(j))) {
                            foundIndex = j;
                            break;
                        }
                    }
                    if (foundIndex != -1) {
                        // Uncheck
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                            completedDates.remove(foundIndex);
                        } else {
                            JSONArray newArr = new JSONArray();
                            for (int k = 0; k < completedDates.length(); k++) {
                                if (k != foundIndex) newArr.put(completedDates.opt(k));
                            }
                            targetTask.put("completedDates", newArr);
                        }
                        nowCompleted = false;
                    } else {
                        // Check
                        completedDates.put(today);
                        nowCompleted = true;
                    }
                } else {
                    nowCompleted = !targetTask.optBoolean("completed", false);
                    targetTask.put("completed", nowCompleted);
                }

                // Recalculate dailySnapshots for today
                int completedCount = 0, totalCount = 0;
                for (int i = 0; i < tasks.length(); i++) {
                    JSONObject t = tasks.getJSONObject(i);
                    if (!t.optBoolean("enabled", true)) continue;
                    String rec = t.optString("recurrence", "None");
                    boolean isCompleted = false;
                    if (!"None".equals(rec)) {
                        JSONArray dates = t.optJSONArray("completedDates");
                        if (dates != null) {
                            for (int k = 0; k < dates.length(); k++) {
                                if (today.equals(dates.optString(k))) { isCompleted = true; break; }
                            }
                        }
                    } else {
                        isCompleted = t.optBoolean("completed", false);
                    }
                    if (isCompleted) completedCount++;
                    if (!"None".equals(rec)) {
                        totalCount++;
                    } else {
                        String due = t.optString("dueDate", "");
                        if (today.equals(due) || isCompleted) totalCount++;
                    }
                }

                String snapshotsStr = prefs.getString("dailySnapshots", "{}");
                JSONObject snapshots = new JSONObject(snapshotsStr);
                JSONObject todaySnap = new JSONObject();
                todaySnap.put("total", totalCount);
                todaySnap.put("completed", completedCount);
                snapshots.put(today, todaySnap);

                prefs.edit()
                    .putString("tasks", tasks.toString())
                    .putString("dailySnapshots", snapshots.toString())
                    .commit();

                WidgetSyncPlugin.notifyTasksChanged();
                android.util.Log.d("HabitActionReceiver", "Toggled " + taskId + " → " + nowCompleted);

                if (nowCompleted) {
                    // ── Step 1: show animated check immediately (AVD plays on render) ──
                    updateNotificationWithAnimation(context, tasks, taskId);

                    // ── Step 2: after 1.5 s, publish the final state (completed row stays
                    //    at the bottom, no animation needed — just the static green square) ──
                    final JSONArray tasksFinal = tasks;
                    new Handler(Looper.getMainLooper()).postDelayed(() ->
                        updateNotification(context, tasksFinal), 1500);
                } else {
                    // Unchecking: update immediately with no animation
                    updateNotification(context, tasks);
                }

                // Notify widgets
                AppWidgetManager awm = AppWidgetManager.getInstance(context);
                ComponentName tasksComp = new ComponentName(context, TasksWidgetProvider.class);
                int[] tasksIds = awm.getAppWidgetIds(tasksComp);
                awm.notifyAppWidgetViewDataChanged(tasksIds, R.id.widget_tasks_list);
                Intent ti = new Intent(context, TasksWidgetProvider.class);
                ti.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                ti.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, tasksIds);
                context.sendBroadcast(ti);

                ComponentName weeklyComp = new ComponentName(context, WeeklyWidgetProvider.class);
                int[] weeklyIds = awm.getAppWidgetIds(weeklyComp);
                if (weeklyIds != null && weeklyIds.length > 0) {
                    Intent wi = new Intent(context, WeeklyWidgetProvider.class);
                    wi.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                    wi.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, weeklyIds);
                    context.sendBroadcast(wi);
                }
            }
        } catch (Exception e) {
            android.util.Log.e("HabitActionReceiver", "Error toggling task", e);
        }
    }

    // ─── Notification: immediate update with AVD animation ────────────────────

    /**
     * Publishes the notification showing the just-completed habit with the
     * AnimatedVectorDrawable (checkbox_check_animated). Android plays the AVD
     * automatically when it renders the RemoteViews (API 24+; falls back to
     * static ic_checkbox_filled_green on older versions).
     *
     * Called only on the transition  pending → completed. After 1.5 s,
     * updateNotification() is called to settle on the final static state.
     */
    private static void updateNotificationWithAnimation(Context context,
                                                        JSONArray tasks,
                                                        String animatedTaskId) {
        JSONArray allHabits = filterAllDailyHabits(tasks);
        if (allHabits.length() == 0) return;

        RemoteViews expanded  = new RemoteViews(context.getPackageName(), R.layout.notification_habits);
        RemoteViews collapsed = new RemoteViews(context.getPackageName(), R.layout.notification_habits_collapsed);

        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
        sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        String today = sdf.format(new java.util.Date());

        int[][] slots = getSlotIds(context);

        try {
            for (int i = 0; i < 6; i++) {
                int[] slot = slots[i];
                int rowId = slot[0], btnId = slot[1], lblId = slot[2];

                if (i < allHabits.length()) {
                    JSONObject task = allHabits.getJSONObject(i);
                    expanded.setViewVisibility(rowId, android.view.View.VISIBLE);

                    boolean completedToday = isCompletedToday(task, today);
                    boolean isTheAnimatedOne = animatedTaskId.equals(task.optString("id", ""));

                    int iconRes;
                    if (isTheAnimatedOne) {
                        // Use AVD on API 24+; static green on older versions
                        iconRes = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
                            ? R.drawable.checkbox_check_animated
                            : R.drawable.ic_checkbox_filled_green;
                    } else {
                        iconRes = completedToday
                            ? R.drawable.ic_checkbox_filled_green
                            : R.drawable.ic_check_box_outline;
                    }
                    expanded.setImageViewResource(btnId, iconRes);

                    String title = task.optString("title", "Habit " + (i + 1));
                    expanded.setTextViewText(lblId, title);
                    expanded.setInt(lblId, "setPaintFlags",
                        completedToday
                            ? android.graphics.Paint.STRIKE_THRU_TEXT_FLAG | android.graphics.Paint.ANTI_ALIAS_FLAG
                            : android.graphics.Paint.ANTI_ALIAS_FLAG);

                    String tid = task.optString("id", "");
                    Intent intent = new Intent(context, HabitActionReceiver.class);
                    intent.setAction("TOGGLE_TASK_" + tid);
                    android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(
                        context, i, intent,
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
                    expanded.setOnClickPendingIntent(btnId, pi);
                } else {
                    expanded.setViewVisibility(rowId, android.view.View.GONE);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        publishNotification(context, expanded, collapsed);
    }

    // ─── Notification: static full update ─────────────────────────────────────

    /**
     * Publishes the notification with the current state of all daily habits.
     * Pending habits appear first (columns fill left-to-right, top-to-bottom),
     * completed ones at the bottom with a static green checkbox + strike-through text.
     */
    public static void updateNotification(Context context, JSONArray tasks) {
        JSONArray allHabits = filterAllDailyHabits(tasks);

        if (allHabits.length() == 0) {
            android.util.Log.d("HabitActionReceiver", "No daily habits. Cancelling notification.");
            NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
            return;
        }

        RemoteViews expanded  = new RemoteViews(context.getPackageName(), R.layout.notification_habits);
        RemoteViews collapsed = new RemoteViews(context.getPackageName(), R.layout.notification_habits_collapsed);

        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
        sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        String today = sdf.format(new java.util.Date());

        int[][] slots = getSlotIds(context);

        try {
            for (int i = 0; i < 6; i++) {
                int[] slot = slots[i];
                int rowId = slot[0], btnId = slot[1], lblId = slot[2];

                if (i < allHabits.length()) {
                    JSONObject task = allHabits.getJSONObject(i);
                    expanded.setViewVisibility(rowId, android.view.View.VISIBLE);

                    boolean completedToday = isCompletedToday(task, today);

                    int iconRes = completedToday
                        ? R.drawable.ic_checkbox_filled_green
                        : R.drawable.ic_check_box_outline;
                    expanded.setImageViewResource(btnId, iconRes);

                    String title = task.optString("title", "Habit " + (i + 1));
                    expanded.setTextViewText(lblId, title);
                    expanded.setInt(lblId, "setPaintFlags",
                        completedToday
                            ? android.graphics.Paint.STRIKE_THRU_TEXT_FLAG | android.graphics.Paint.ANTI_ALIAS_FLAG
                            : android.graphics.Paint.ANTI_ALIAS_FLAG);

                    String tid = task.optString("id", "");
                    Intent intent = new Intent(context, HabitActionReceiver.class);
                    intent.setAction("TOGGLE_TASK_" + tid);
                    android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(
                        context, i, intent,
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
                    expanded.setOnClickPendingIntent(btnId, pi);
                } else {
                    expanded.setViewVisibility(rowId, android.view.View.GONE);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        publishNotification(context, expanded, collapsed);
    }

    // ─── Helper: publish notification ─────────────────────────────────────────

    private static void publishNotification(Context context, RemoteViews expanded, RemoteViews collapsed) {
        createNotificationChannel(context);

        // ── Render the "n" logo using the REAL Dancing Script font via Canvas.
        // RemoteViews cannot apply a custom Typeface directly, so we produce a
        // Bitmap from the actual .ttf file and inject it into both views.
        // If the font fails to load, NotificationLogoHelper logs an explicit error
        // and returns null — the static @drawable/ic_notification_logo PNG (set as
        // android:src in the XML layout) acts as the visible fallback.
        Bitmap logoBitmap = NotificationLogoHelper.renderLogo(context);
        if (logoBitmap != null) {
            expanded.setImageViewBitmap(R.id.notification_logo, logoBitmap);
            collapsed.setImageViewBitmap(R.id.notification_logo, logoBitmap);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            // ic_notification_small: monochromatic vector silueta de la "n" en Dancing Script.
            // Android aplana esto a blanco y aplica el fondo de color del canal.
            // NO usar R.mipmap.ic_launcher aquí (violaría las guías de Android).
            .setSmallIcon(R.drawable.ic_notification_small)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(collapsed)
            .setCustomBigContentView(expanded)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOnlyAlertOnce(true)
            .setOngoing(true);

        Intent openApp = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openApp != null) {
            android.app.PendingIntent ci = android.app.PendingIntent.getActivity(
                context, 0, openApp,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
            builder.setContentIntent(ci);
        }

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
    }

    // ─── Filter helpers ───────────────────────────────────────────────────────

    /**
     * Returns all enabled daily habits with pending ones first, completed ones last.
     * Limits to the first 6 to fit the 2×3 grid.
     */
    private static JSONArray filterAllDailyHabits(JSONArray allTasks) {
        JSONArray pending   = new JSONArray();
        JSONArray completed = new JSONArray();
        try {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            String today = sdf.format(new java.util.Date());

            for (int i = 0; i < allTasks.length(); i++) {
                JSONObject t = allTasks.getJSONObject(i);
                if (!t.optBoolean("enabled", true)) continue;
                if (!"Daily".equals(t.optString("recurrence", ""))) continue;

                if (isCompletedToday(t, today)) {
                    completed.put(t);
                } else {
                    pending.put(t);
                }
            }
            // Merge: pending first, completed at the end — max 6 total
            for (int i = 0; i < completed.length() && (pending.length() < 6); i++) {
                pending.put(completed.get(i));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return pending;
    }

    /** Returns only pending (not-completed-today) daily habits — used for snapshot counts. */
    private static JSONArray filterPendingDailyHabits(JSONArray allTasks) {
        JSONArray pending = new JSONArray();
        try {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            String today = sdf.format(new java.util.Date());

            for (int i = 0; i < allTasks.length(); i++) {
                JSONObject t = allTasks.getJSONObject(i);
                if (!t.optBoolean("enabled", true)) continue;
                if (!"Daily".equals(t.optString("recurrence", ""))) continue;
                if (!isCompletedToday(t, today)) pending.put(t);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return pending;
    }

    /** Returns true if the habit's completedDates array contains today's date string. */
    private static boolean isCompletedToday(JSONObject task, String today) {
        JSONArray dates = task.optJSONArray("completedDates");
        if (dates == null) return false;
        for (int j = 0; j < dates.length(); j++) {
            if (today.equals(dates.optString(j))) return true;
        }
        return false;
    }

    // ─── Notification channel ─────────────────────────────────────────────────

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Habits Updates", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Daily habits reminders and sync");
            channel.setSound(null, null);
            channel.enableVibration(false);
            context.getSystemService(NotificationManager.class)
                   .createNotificationChannel(channel);
        }
    }
}
