package com.iunico.mynotes;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Implementation of App Widget functionality.
 */
public class GoalsWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager,
            int appWidgetId) {

        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String goalsJson = prefs.getString("goals", "[]");

        StringBuilder content = new StringBuilder();
        try {
            JSONArray goals = new JSONArray(goalsJson);
            for (int i = 0; i < Math.min(goals.length(), 3); i++) {
                JSONObject goal = goals.getJSONObject(i);
                content.append("• ").append(goal.getString("title")).append("\n");
            }
            if (goals.length() == 0) {
                content.append("No goals yet.");
            } else if (goals.length() > 3) {
                content.append("...");
            }
        } catch (Exception e) {
            content.append("Error loading goals.");
        }

        // Construct the RemoteViews object
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_goals);
        views.setTextViewText(R.id.widget_content, content.toString());

        // Instruct the widget manager to update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        // There may be multiple widgets active, so update all of them
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onEnabled(Context context) {
        // Enter relevant functionality for when the first widget is created
    }

    @Override
    public void onDisabled(Context context) {
        // Enter relevant functionality for when the last widget is disabled
    }
}
