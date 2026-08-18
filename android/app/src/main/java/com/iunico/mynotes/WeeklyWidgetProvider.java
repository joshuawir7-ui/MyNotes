package com.iunico.mynotes;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

public class WeeklyWidgetProvider extends AppWidgetProvider {

    private static final String[] SPANISH_DAYS = new String[]{"Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"};
    private static final String[] ENGLISH_DAYS = new String[]{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, android.os.Bundle newOptions) {
        updateAppWidget(context, appWidgetManager, appWidgetId);
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_weekly);

        // Fetch snapshots data from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String snapshotsJsonStr = prefs.getString("dailySnapshots", "{}");

        JSONObject snapshots = new JSONObject();
        try {
            snapshots = new JSONObject(snapshotsJsonStr);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Determine language and setup titles/labels
        String lang = prefs.getString("language", "es");
        
        String titleText;
        if ("es".equals(lang)) {
            titleText = "Desglose de Compromiso\nSemanal";
        } else if ("zh".equals(lang)) {
            titleText = "每周承诺分解";
        } else if ("fr".equals(lang)) {
            titleText = "Engagement Hebdomadaire";
        } else if ("de".equals(lang)) {
            titleText = "Wöchentliche Aufschlüsselung";
        } else if ("pt".equals(lang)) {
            titleText = "Compromisso Semanal";
        } else if ("ar".equals(lang)) {
            titleText = "تحليل الالتزام الأسبوعي";
        } else if ("ja".equals(lang)) {
            titleText = "週間のコミットメント内訳";
        } else if ("hi".equals(lang)) {
            titleText = "साप्ताहिक प्रतिबद्धता विवरण";
        } else {
            titleText = "Weekly Commitment\nBreakdown";
        }

        views.setTextViewText(R.id.widget_weekly_title, titleText);

        // Generate dynamic localized day labels (e.g. Lun, Mar, Mié or Mon, Tue, Wed)
        String[] dayLabels = new String[7];
        try {
            Calendar labelCal = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
            // Set to Monday of this week
            int labelCurrentDay = labelCal.get(Calendar.DAY_OF_WEEK);
            int labelAdjustedDay = (labelCurrentDay == Calendar.SUNDAY) ? 6 : labelCurrentDay - 2;
            labelCal.add(Calendar.DAY_OF_YEAR, -labelAdjustedDay);

            SimpleDateFormat daySdf = new SimpleDateFormat("EEE", new Locale(lang));
            daySdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));

            for (int i = 0; i < 7; i++) {
                String label = daySdf.format(labelCal.getTime());
                if (label.length() > 0) {
                    // Capitalize the first letter
                    label = label.substring(0, 1).toUpperCase(new Locale(lang)) + (label.length() > 1 ? label.substring(1) : "");
                }
                dayLabels[i] = label;
                labelCal.add(Calendar.DAY_OF_YEAR, 1);
            }
        } catch (Exception e) {
            e.printStackTrace();
            // Fallback to Spanish or English if dynamic fails
            dayLabels = "es".equals(lang) ? SPANISH_DAYS : ENGLISH_DAYS;
        }

        // Get calendar calculations in UTC timezone to match Zustand store dates
        Calendar cal = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
        int currentDay = cal.get(Calendar.DAY_OF_WEEK); // 1 = Sunday, 2 = Monday, ...
        int adjustedDay = (currentDay == Calendar.SUNDAY) ? 6 : currentDay - 2;

        // Set calendar to Monday of this week
        cal.add(Calendar.DAY_OF_YEAR, -adjustedDay);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));

        // Get widget dimensions in pixels to fit nicely and look sharp (2x scale)
        android.os.Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
        boolean isPortrait = context.getResources().getConfiguration().orientation == android.content.res.Configuration.ORIENTATION_PORTRAIT;
        int widthDp = isPortrait ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250) : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 250);
        int heightDp = isPortrait ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110) : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
        if (widthDp < 100) widthDp = 250;
        if (heightDp < 50) heightDp = 110;

        float density = context.getResources().getDisplayMetrics().density;
        int widthPx = (int) (widthDp * density * 2f);
        int heightPx = (int) (heightDp * density * 2f);

        int titleHeightPx = (int) (64f * density * 2f);
        int chartWidth = widthPx - (int) (32f * density * 2f);
        int chartHeight = heightPx - titleHeightPx;

        if (chartWidth < 100) chartWidth = 200;
        if (chartHeight < 50) chartHeight = 100;

        // Draw chart bitmap
        Bitmap chartBitmap = drawWeeklyChart(context, snapshots, adjustedDay, dayLabels, sdf, cal, chartWidth, chartHeight);
        if (chartBitmap != null) {
            views.setImageViewBitmap(R.id.widget_weekly_chart, chartBitmap);
        }

        // Clicking the widget opens the main activity
        Intent appIntent = new Intent(context, MainActivity.class);
        PendingIntent appPendingIntent = PendingIntent.getActivity(
            context, appWidgetId, appIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_weekly_chart, appPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_weekly_title, appPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_weekly_clock, appPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap drawWeeklyChart(Context context, JSONObject snapshots, int adjustedDay, String[] dayLabels, SimpleDateFormat sdf, Calendar startOfWeek, int width, int height) {
        try {
            float density = context.getResources().getDisplayMetrics().density;
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            // Left padding: accommodates "100%", "50%", etc.
            float xStart = width * 0.12f;
            float xEnd = width * 0.93f;
            float yStart = height * 0.12f;
            float yEnd = height * 0.80f;
            float chartHeight = yEnd - yStart;
            float chartWidth = xEnd - xStart;

            // Grid lines paint
            Paint gridPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            gridPaint.setStyle(Paint.Style.STROKE);
            gridPaint.setStrokeWidth(0.8f * density * 2f);
            gridPaint.setColor(Color.parseColor("#E5E7EB"));
            gridPaint.setPathEffect(new DashPathEffect(new float[]{6f * density, 6f * density}, 0f));

            // Dynamic text sizes scaled with density and height
            float minTextSize = 7f * density * 2f;
            float maxTextSize = 13f * density * 2f;
            float textSize = height * 0.08f;
            if (textSize < minTextSize) textSize = minTextSize;
            if (textSize > maxTextSize) textSize = maxTextSize;

            // Text paint
            Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            textPaint.setColor(Color.parseColor("#9CA3AF"));
            textPaint.setTextSize(textSize);

            // Today text paint
            Paint todayPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            todayPaint.setColor(Color.parseColor("#EC4899"));
            todayPaint.setTextSize(textSize);
            todayPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

            // Draw horizontal dashed lines
            // 100% Line
            canvas.drawLine(xStart, yStart, xEnd, yStart, gridPaint);
            canvas.drawText("100%", width * 0.01f, yStart + textSize * 0.35f, textPaint);

            // 50% Line
            float y50 = yStart + 0.5f * chartHeight;
            canvas.drawLine(xStart, y50, xEnd, y50, gridPaint);
            canvas.drawText("50%", width * 0.02f, y50 + textSize * 0.35f, textPaint);

            // 25% Line
            float y25 = yEnd - 0.25f * chartHeight;
            canvas.drawLine(xStart, y25, xEnd, y25, gridPaint);
            canvas.drawText("25%", width * 0.02f, y25 + textSize * 0.35f, textPaint);

            // 0% Line
            canvas.drawLine(xStart, yEnd, xEnd, yEnd, gridPaint);
            canvas.drawText("0%", width * 0.04f, yEnd + textSize * 0.35f, textPaint);

            // Fetch progress data points
            float[] progress = new float[7];
            boolean[] hasData = new boolean[7];

            for (int i = 0; i < 7; i++) {
                Calendar dayCal = (Calendar) startOfWeek.clone();
                dayCal.add(Calendar.DAY_OF_YEAR, i);
                String dateStr = sdf.format(dayCal.getTime());

                if (i <= adjustedDay) {
                    hasData[i] = true;
                    JSONObject snapshot = snapshots.optJSONObject(dateStr);
                    if (snapshot != null) {
                        int total = snapshot.optInt("total", 0);
                        int completed = snapshot.optInt("completed", 0);
                        progress[i] = total > 0 ? (completed * 100f / total) : 0f;
                    } else {
                        progress[i] = 0f;
                    }
                } else {
                    hasData[i] = false;
                }
            }

            // Draw line connecting data points
            Path path = new Path();
            boolean first = true;
            for (int i = 0; i < 7; i++) {
                if (!hasData[i]) continue;
                float x = xStart + i * (chartWidth / 6f);
                float y = yEnd - (progress[i] / 100f) * chartHeight;
                if (first) {
                    path.moveTo(x, y);
                    first = false;
                } else {
                    path.lineTo(x, y);
                }
            }

            Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            linePaint.setStyle(Paint.Style.STROKE);
            linePaint.setStrokeWidth(2.5f * density * 2f);
            linePaint.setColor(Color.parseColor("#EC4899"));
            if (!first) {
                canvas.drawPath(path, linePaint);
            }

            // Draw markers on each data point (white filled circle with pink contour)
            Paint markerStrokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            markerStrokePaint.setStyle(Paint.Style.STROKE);
            markerStrokePaint.setStrokeWidth(1.5f * density * 2f);
            markerStrokePaint.setColor(Color.parseColor("#EC4899"));

            Paint markerFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            markerFillPaint.setStyle(Paint.Style.FILL);
            markerFillPaint.setColor(Color.WHITE);

            float markerRadius = 3.5f * density * 2f;
            for (int i = 0; i < 7; i++) {
                if (!hasData[i]) continue;
                float x = xStart + i * (chartWidth / 6f);
                float y = yEnd - (progress[i] / 100f) * chartHeight;

                canvas.drawCircle(x, y, markerRadius, markerFillPaint);
                canvas.drawCircle(x, y, markerRadius, markerStrokePaint);
            }

            // Draw X-axis labels (days of the week)
            for (int i = 0; i < 7; i++) {
                float x = xStart + i * (chartWidth / 6f);
                String label = dayLabels[i];

                float textWidth;
                float textX;

                if (i == adjustedDay) {
                    textWidth = todayPaint.measureText(label);
                    textX = x - textWidth / 2f;
                    canvas.drawText(label, textX, yEnd + textSize * 1.4f, todayPaint);
                    // Draw small indicator dot underneath the text
                    canvas.drawCircle(x, yEnd + textSize * 2.1f, textSize * 0.18f, todayPaint);
                } else {
                    textWidth = textPaint.measureText(label);
                    textX = x - textWidth / 2f;
                    canvas.drawText(label, textX, yEnd + textSize * 1.4f, textPaint);
                }
            }

            return bitmap;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
