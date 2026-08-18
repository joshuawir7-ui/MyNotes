package com.iunico.mynotes;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

public class TasksWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_TASK_COMPLETE = "com.iunico.mynotes.ACTION_TASK_COMPLETE";
    public static final String EXTRA_TASK_ID = "com.iunico.mynotes.EXTRA_TASK_ID";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_tasks);

        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String lang = prefs.getString("language", "es");

        String titleText;
        String emptyText;

        if ("es".equals(lang)) {
            titleText = "Hábitos y Tareas";
            emptyText = "No hay tareas activas";
        } else if ("zh".equals(lang)) {
            titleText = "习惯 / 任务";
            emptyText = "没有活跃的任务";
        } else if ("fr".equals(lang)) {
            titleText = "Habitudes / Tâches";
            emptyText = "Aucune tâche active";
        } else if ("de".equals(lang)) {
            titleText = "Gewohnheiten / Aufgaben";
            emptyText = "Keine aktiven Aufgaben";
        } else if ("pt".equals(lang)) {
            titleText = "Hábitos / Tarefas";
            emptyText = "Nenhuma tarefa ativa";
        } else if ("ar".equals(lang)) {
            titleText = "العادات / المهام";
            emptyText = "لا توجد مهام نشطة";
        } else if ("ja".equals(lang)) {
            titleText = "習慣 / タスク";
            emptyText = "アクティブなタスクはありません";
        } else if ("hi".equals(lang)) {
            titleText = "आदतें / कार्य";
            emptyText = "कोई सक्रिय कार्य नहीं";
        } else {
            titleText = "Habits / Tasks";
            emptyText = "No active tasks";
        }

        views.setTextViewText(R.id.widget_tasks_header, titleText);
        views.setTextViewText(R.id.widget_tasks_empty, emptyText);

        // Set up the intent that starts the TasksWidgetService, which will
        // provide the views for this collection.
        Intent intent = new Intent(context, TasksWidgetService.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        intent.setData(Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME)));
        
        views.setRemoteAdapter(R.id.widget_tasks_list, intent);
        views.setEmptyView(R.id.widget_tasks_list, R.id.widget_tasks_empty);

        // PendingIntent template for task completion clicks
        Intent completeIntent = new Intent(context, TaskActionReceiver.class);
        completeIntent.setAction(ACTION_TASK_COMPLETE);
        PendingIntent completePendingIntent = PendingIntent.getBroadcast(
            context, 0, completeIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        views.setPendingIntentTemplate(R.id.widget_tasks_list, completePendingIntent);

        // Instruct the widget manager to update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_tasks_list);

        // Click on empty state or title opens app
        Intent appIntent = new Intent(context, MainActivity.class);
        PendingIntent appPendingIntent = PendingIntent.getActivity(context, appWidgetId, appIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_tasks_empty, appPendingIntent);
    }
}
