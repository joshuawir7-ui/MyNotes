package com.iunico.mynotes;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class TaskActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (TasksWidgetProvider.ACTION_TASK_COMPLETE.equals(intent.getAction())) {
            String taskId = intent.getStringExtra(TasksWidgetProvider.EXTRA_TASK_ID);
            if (taskId != null) {
                completeTask(context, taskId);
            }
        }
    }

    private void completeTask(Context context, String taskId) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String tasksJson = prefs.getString("tasks", "[]");
        
        try {
            JSONArray arr = new JSONArray(tasksJson);
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            String today = sdf.format(new java.util.Date());

            for (int i = 0; i < arr.length(); i++) {
                JSONObject task = arr.getJSONObject(i);
                if (taskId.equals(task.optString("id"))) {
                    String recurrence = task.optString("recurrence", "None");
                    boolean currentlyCompleted = false;

                    if (!"None".equals(recurrence)) {
                        JSONArray completedDates = task.optJSONArray("completedDates");
                        if (completedDates == null) {
                            completedDates = new JSONArray();
                            task.put("completedDates", completedDates);
                        }
                        int foundIndex = -1;
                        for (int j = 0; j < completedDates.length(); j++) {
                            if (today.equals(completedDates.optString(j))) {
                                foundIndex = j;
                                break;
                            }
                        }
                        if (foundIndex != -1) {
                            // Uncheck it!
                            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
                                completedDates.remove(foundIndex);
                            } else {
                                JSONArray newArray = new JSONArray();
                                for (int k = 0; k < completedDates.length(); k++) {
                                    if (k != foundIndex) {
                                        newArray.put(completedDates.opt(k));
                                    }
                                }
                                task.put("completedDates", newArray);
                            }
                            currentlyCompleted = false;
                        } else {
                            // Check it!
                            completedDates.put(today);
                            currentlyCompleted = true;
                        }
                    } else {
                        currentlyCompleted = task.optBoolean("completed", false);
                        currentlyCompleted = !currentlyCompleted;
                    }
                    task.put("completed", currentlyCompleted);
                    break;
                }
            }

            // Recalculate dailySnapshots for today
            int completedCount = 0;
            int totalCount = 0;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                if (!t.optBoolean("enabled", true)) continue;

                String rec = t.optString("recurrence", "None");
                boolean isCompleted = false;
                if (!"None".equals(rec)) {
                    JSONArray dates = t.optJSONArray("completedDates");
                    if (dates != null) {
                        for (int k = 0; k < dates.length(); k++) {
                            if (today.equals(dates.optString(k))) {
                                isCompleted = true;
                                break;
                            }
                        }
                    }
                } else {
                    isCompleted = t.optBoolean("completed", false);
                }

                if (isCompleted) {
                    completedCount++;
                }

                if (!"None".equals(rec)) {
                    totalCount++;
                } else {
                    String dueDate = t.optString("dueDate", "");
                    if (today.equals(dueDate) || isCompleted) {
                        totalCount++;
                    }
                }
            }

            String snapshotsJsonStr = prefs.getString("dailySnapshots", "{}");
            JSONObject snapshotsJson = new JSONObject(snapshotsJsonStr);
            JSONObject todaySnapshot = new JSONObject();
            todaySnapshot.put("total", totalCount);
            todaySnapshot.put("completed", completedCount);
            snapshotsJson.put(today, todaySnapshot);

            prefs.edit()
                .putString("tasks", arr.toString())
                .putString("dailySnapshots", snapshotsJson.toString())
                .apply();

            // Update widgets
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            
            // Notify Tasks Widget
            ComponentName thisWidget = new ComponentName(context, TasksWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_tasks_list);
            
            // Broadcast task update to Tasks widget
            Intent tasksIntent = new Intent(context, TasksWidgetProvider.class);
            tasksIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            tasksIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
            context.sendBroadcast(tasksIntent);

            // Notify Weekly Widget
            ComponentName weeklyWidget = new ComponentName(context, WeeklyWidgetProvider.class);
            int[] weeklyIds = appWidgetManager.getAppWidgetIds(weeklyWidget);
            if (weeklyIds != null && weeklyIds.length > 0) {
                Intent weeklyIntent = new Intent(context, WeeklyWidgetProvider.class);
                weeklyIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                weeklyIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, weeklyIds);
                context.sendBroadcast(weeklyIntent);
            }
            
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
}
