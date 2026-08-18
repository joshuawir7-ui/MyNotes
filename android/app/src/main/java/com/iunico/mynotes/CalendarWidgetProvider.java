package com.iunico.mynotes;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

public class CalendarWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);

        // Fetch current UTC date details for the header
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String lang = prefs.getString("language", "es");
        Locale locale = new Locale(lang);

        SimpleDateFormat dayNumSdf = new SimpleDateFormat("d", locale);
        dayNumSdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        String dayNumStr = dayNumSdf.format(cal.getTime());

        SimpleDateFormat dayNameSdf = new SimpleDateFormat("EEE", locale);
        dayNameSdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        String dayNameStr = dayNameSdf.format(cal.getTime()).toUpperCase(locale);

        SimpleDateFormat monthYearSdf = new SimpleDateFormat("MMMM yyyy", locale);
        monthYearSdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        String monthYearStr = monthYearSdf.format(cal.getTime());
        if (monthYearStr.length() > 0) {
            monthYearStr = monthYearStr.substring(0, 1).toUpperCase(locale) + monthYearStr.substring(1);
        }

        views.setTextViewText(R.id.widget_calendar_day_num, dayNumStr);
        views.setTextViewText(R.id.widget_calendar_day_name, dayNameStr);
        views.setTextViewText(R.id.widget_calendar_month_year, monthYearStr);

        // Setup ListView remote adapter
        Intent intent = new Intent(context, CalendarWidgetService.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        intent.setData(Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.widget_calendar_events_list, intent);
        views.setEmptyView(R.id.widget_calendar_events_list, R.id.widget_calendar_empty);

        // App pending intent template to launch MainActivity
        Intent appIntent = new Intent(context, MainActivity.class);
        PendingIntent appPendingIntent = PendingIntent.getActivity(
            context, appWidgetId, appIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setPendingIntentTemplate(R.id.widget_calendar_events_list, appPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_calendar_header, appPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_calendar_add_btn, appPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_calendar_events_list);
    }
}
