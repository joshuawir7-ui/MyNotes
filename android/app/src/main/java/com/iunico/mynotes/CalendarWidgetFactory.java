package com.iunico.mynotes;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

public class CalendarWidgetFactory implements RemoteViewsService.RemoteViewsFactory {

    private Context context;
    private int appWidgetId;
    
    private static class EventItem implements Comparable<EventItem> {
        String id;
        String title;
        String dateStr; // YYYY-MM-DD
        String timeStr; // e.g. "14:05 - 15:05"
        String color;
        long dateMs;
        boolean isFirstOfDay;

        @Override
        public int compareTo(EventItem o) {
            int cmp = Long.compare(this.dateMs, o.dateMs);
            if (cmp != 0) return cmp;
            
            if (this.timeStr != null && o.timeStr != null) {
                return this.timeStr.compareTo(o.timeStr);
            }
            return 0;
        }
    }

    private volatile List<EventItem> eventList = new ArrayList<>();
    private final SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);

    public CalendarWidgetFactory(Context context, Intent intent) {
        this.context = context;
        this.appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    @Override
    public void onCreate() {
        loadEvents();
    }

    @Override
    public void onDataSetChanged() {
        loadEvents();
    }

    private void loadEvents() {
        List<EventItem> newEventList = new ArrayList<>();
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String appointmentsJson = prefs.getString("appointments", "[]");

        try {
            JSONArray arr = new JSONArray(appointmentsJson);
            
            // Calculate UTC range for [Today, Today + 15 days]
            Calendar todayCal = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            todayCal.set(Calendar.HOUR_OF_DAY, 0);
            todayCal.set(Calendar.MINUTE, 0);
            todayCal.set(Calendar.SECOND, 0);
            todayCal.set(Calendar.MILLISECOND, 0);
            long startMs = todayCal.getTimeInMillis();

            Calendar endCal = (Calendar) todayCal.clone();
            endCal.add(Calendar.DAY_OF_YEAR, 15);
            long endMs = endCal.getTimeInMillis();

            for (int i = 0; i < arr.length(); i++) {
                JSONObject apt = arr.getJSONObject(i);
                String dateStr = apt.optString("date", "");
                if (dateStr.isEmpty()) continue;

                Date parsedDate = sdf.parse(dateStr);
                if (parsedDate == null) continue;

                long eventMs = parsedDate.getTime();
                // Check if event is in the 15-day range
                if (eventMs >= startMs && eventMs <= endMs) {
                    EventItem item = new EventItem();
                    item.id = apt.optString("id", "");
                    item.title = apt.optString("title", "Untitled Event");
                    item.dateStr = dateStr;
                    item.timeStr = apt.optString("time", "");
                    item.color = apt.optString("color", "");
                    item.dateMs = eventMs;
                    
                    newEventList.add(item);
                }
            }

            // Sort chronologically
            Collections.sort(newEventList);

            // Set isFirstOfDay flags
            String lastDate = "";
            for (int i = 0; i < newEventList.size(); i++) {
                EventItem item = newEventList.get(i);
                if (!item.dateStr.equals(lastDate)) {
                    item.isFirstOfDay = true;
                    lastDate = item.dateStr;
                } else {
                    item.isFirstOfDay = false;
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
        eventList = newEventList;
    }

    @Override
    public void onDestroy() {
        eventList = new ArrayList<>();
    }

    @Override
    public int getCount() {
        return eventList.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        List<EventItem> localList = eventList;
        if (position >= localList.size()) return null;

        EventItem item = localList.get(position);
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_calendar_item);

        // Bind title & time
        rv.setTextViewText(R.id.widget_event_title, item.title);
        if (item.timeStr != null && !item.timeStr.isEmpty()) {
            rv.setTextViewText(R.id.widget_event_time, item.timeStr);
            rv.setViewVisibility(R.id.widget_event_time, View.VISIBLE);
        } else {
            rv.setViewVisibility(R.id.widget_event_time, View.GONE);
        }

        // Set color dot tint
        int colorVal = Color.parseColor("#06B6D4"); // Teal default color
        if (item.color != null && !item.color.isEmpty()) {
            try {
                colorVal = Color.parseColor(item.color);
            } catch (Exception e) {
                // Ignore parsing issues, default color remains
            }
        }
        rv.setInt(R.id.widget_event_color_dot, "setColorFilter", colorVal);

        // Date header group visibility
        if (item.isFirstOfDay) {
            try {
                Date parsedDate = sdf.parse(item.dateStr);
                SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
                String lang = prefs.getString("language", "es");
                Locale locale = new Locale(lang);

                SimpleDateFormat headerSdf = new SimpleDateFormat("EEEE, d MMMM", locale);
                headerSdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                String headerText = headerSdf.format(parsedDate).toUpperCase(locale);
                rv.setTextViewText(R.id.widget_event_date_header, headerText);
            } catch (Exception e) {
                rv.setTextViewText(R.id.widget_event_date_header, item.dateStr);
            }
            rv.setViewVisibility(R.id.widget_event_date_header, View.VISIBLE);
        } else {
            rv.setViewVisibility(R.id.widget_event_date_header, View.GONE);
        }

        // Click fill-in intent (opens MainActivity)
        Intent fillInIntent = new Intent();
        fillInIntent.putExtra("appointment_id", item.id);
        rv.setOnClickFillInIntent(R.id.widget_event_title, fillInIntent);

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
