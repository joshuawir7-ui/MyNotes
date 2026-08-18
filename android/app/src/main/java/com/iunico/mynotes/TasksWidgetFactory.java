package com.iunico.mynotes;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class TasksWidgetFactory implements RemoteViewsService.RemoteViewsFactory {

    private Context context;
    private int appWidgetId;
    private volatile List<JSONObject> taskList = new ArrayList<>();

    public TasksWidgetFactory(Context context, Intent intent) {
        this.context = context;
        this.appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
    }

    @Override
    public void onCreate() {
        loadTasks();
    }

    @Override
    public void onDataSetChanged() {
        loadTasks();
    }

    private void loadTasks() {
        List<JSONObject> newTaskList = new ArrayList<>();
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String tasksJson = prefs.getString("tasks", "[]");
        try {
            JSONArray arr = new JSONArray(tasksJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject task = arr.getJSONObject(i);
                if (task.optBoolean("enabled", true)) {
                    newTaskList.add(task);
                }
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        taskList = newTaskList;
    }

    @Override
    public void onDestroy() {
        taskList = new ArrayList<>();
    }

    @Override
    public int getCount() {
        return taskList.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        List<JSONObject> localList = taskList;
        if (position >= localList.size()) return null;

        JSONObject task = localList.get(position);
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_task_item);
        
        String title = task.optString("title", "Unknown Task");
        String id = task.optString("id", "");
        
        boolean isCompleted = false;
        String recurrence = task.optString("recurrence", "None");
        if (!"None".equals(recurrence)) {
            JSONArray completedDates = task.optJSONArray("completedDates");
            if (completedDates != null) {
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
                // Use device local timezone (not UTC) so completed habits show correctly
                sdf.setTimeZone(java.util.TimeZone.getDefault());
                String today = sdf.format(new java.util.Date());
                for (int i = 0; i < completedDates.length(); i++) {
                    if (today.equals(completedDates.optString(i))) {
                        isCompleted = true;
                        break;
                    }
                }
            }
        } else {
            isCompleted = task.optBoolean("completed", false);
        }

        rv.setTextViewText(R.id.widget_task_title, title);
        
        if (isCompleted) {
            rv.setImageViewResource(R.id.widget_task_checkbox, R.drawable.ic_check_green);
        } else {
            rv.setImageViewResource(R.id.widget_task_checkbox, R.drawable.ic_checkbox_empty);
        }

        Intent fillInIntent = new Intent();
        fillInIntent.putExtra(TasksWidgetProvider.EXTRA_TASK_ID, id);
        rv.setOnClickFillInIntent(R.id.widget_task_checkbox, fillInIntent);
        rv.setOnClickFillInIntent(R.id.widget_task_title, fillInIntent);

        return rv;
    }

    @Override
    public RemoteViews getLoadingView() {
        return null;
    }

    @Override
    public int getViewTypeCount() {
        return 1;
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public boolean hasStableIds() {
        return true;
    }
}
