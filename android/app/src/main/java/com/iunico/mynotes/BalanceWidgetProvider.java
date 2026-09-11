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
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

/**
 * Balance Widget — displays the balance donut chart, amount, 0.00 $ pill input,
 * and AGREGAR / GASTÉ buttons matching the design mockup strictly adhering to RemoteViews API rules.
 */
public class BalanceWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_INCOME  = "com.iunico.mynotes.BALANCE_ACTION_INCOME";
    public static final String ACTION_EXPENSE = "com.iunico.mynotes.BALANCE_ACTION_EXPENSE";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager,
                                          int appWidgetId, Bundle newOptions) {
        updateAppWidget(context, appWidgetManager, appWidgetId);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);

            // ── Read language preference ──────────────────────────────────────
            SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
            String lang = prefs.getString("language", "es");

            // ── Compute current balance from stored transactions JSON ─────────
            double balance = computeBalance(prefs);
            boolean isNegative = balance < 0;

            String formattedBalance = formatBalance(balance);
            views.setTextViewText(R.id.widget_balance_amount, formattedBalance);
            views.setTextColor(R.id.widget_balance_amount, isNegative ? Color.parseColor("#DC2626") : Color.parseColor("#111827"));

            // ── Render Donut Chart Bitmap ────────────────────────────────────
            Bitmap chartBitmap = createDonutChartBitmap(balance);
            if (chartBitmap != null) {
                views.setImageViewBitmap(R.id.widget_balance_chart, chartBitmap);
            }

            // ── Localised labels ─────────────────────────────────────────────
            String titleText  = "es".equals(lang) ? "Balance" : "Balance";
            String btnIncome  = "es".equals(lang) ? "AGREGAR" : "ADD";
            String btnExpense = "es".equals(lang) ? "GASTÉ"   : "SPENT";

            views.setTextViewText(R.id.widget_balance_title, titleText);
            views.setTextViewText(R.id.widget_balance_btn_income,  btnIncome);
            views.setTextViewText(R.id.widget_balance_btn_expense, btnExpense);

            // ── AGREGAR PendingIntent ────────────────────────────────────────
            Intent incomeIntent = new Intent(context, BalanceActionReceiver.class);
            incomeIntent.setAction(ACTION_INCOME);
            incomeIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            PendingIntent incomePi = PendingIntent.getBroadcast(
                context,
                appWidgetId * 10,
                incomeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_balance_btn_income, incomePi);

            // ── GASTÉ PendingIntent ──────────────────────────────────────────
            Intent expenseIntent = new Intent(context, BalanceActionReceiver.class);
            expenseIntent.setAction(ACTION_EXPENSE);
            expenseIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            PendingIntent expensePi = PendingIntent.getBroadcast(
                context,
                appWidgetId * 10 + 1,
                expenseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_balance_btn_expense, expensePi);

            // ── 0.00 $ Pill PendingIntent → launch input dialog ─────────────
            views.setOnClickPendingIntent(R.id.widget_balance_input_pill, incomePi);

            // ── Tap on balance chart or title → open main app ───────────────
            Intent appIntent = new Intent(context, MainActivity.class);
            PendingIntent appPi = PendingIntent.getActivity(
                context,
                appWidgetId * 10 + 2,
                appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_balance_amount, appPi);
            views.setOnClickPendingIntent(R.id.widget_balance_title,  appPi);
            views.setOnClickPendingIntent(R.id.widget_balance_chart,  appPi);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            android.util.Log.e("BalanceWidget", "Error updating app widget", e);
        }
    }

    /**
     * Draws a donut chart bitmap with thin exterior grey track and
     * top-starting progress arc (black for positive, intense red counter-clockwise for negative).
     */
    private static Bitmap createDonutChartBitmap(double balance) {
        try {
            int width = 220;
            int height = 220;
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            float cx = width / 2f;
            float cy = height / 2f;

            // Thin outer grey track
            float radiusGrey = 92f;
            Paint greyPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            greyPaint.setStyle(Paint.Style.STROKE);
            greyPaint.setStrokeWidth(5f);
            greyPaint.setColor(Color.parseColor("#E5E7EB"));
            canvas.drawCircle(cx, cy, radiusGrey, greyPaint);

            // Progress arc
            if (balance != 0) {
                float radiusArc = 80f;
                float strokeArc = 20f;

                Paint arcPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                arcPaint.setStyle(Paint.Style.STROKE);
                arcPaint.setStrokeWidth(strokeArc);
                arcPaint.setStrokeCap(Paint.Cap.ROUND);

                boolean isNegative = balance < 0;
                if (isNegative) {
                    arcPaint.setColor(Color.parseColor("#DC2626")); // intense red
                } else {
                    arcPaint.setColor(Color.parseColor("#18181B")); // zinc-900 / black
                }

                double absVal = Math.abs(balance);
                float pct = (float) Math.min(Math.max((absVal / 100.0) * 360.0, 40.0), 355.0);

                RectF oval = new RectF(cx - radiusArc, cy - radiusArc, cx + radiusArc, cy + radiusArc);
                float startAngle = -90f; // 12 o'clock top
                float actualSweep = isNegative ? -pct : pct;

                canvas.drawArc(oval, startAngle, actualSweep, false, arcPaint);
            }

            return bitmap;
        } catch (Exception e) {
            android.util.Log.e("BalanceWidget", "Error creating donut bitmap", e);
            return null;
        }
    }

    /**
     * Sums all transactions stored under "balance_transactions" to get
     * the current running balance.
     */
    static double computeBalance(SharedPreferences prefs) {
        String json = prefs.getString("balance_transactions", "[]");
        double total = 0.0;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject tx = arr.getJSONObject(i);
                double amount = tx.optDouble("amount", 0);
                String type   = tx.optString("type", "income");
                if ("income".equals(type)) {
                    total += amount;
                } else {
                    total -= amount;
                }
            }
        } catch (Exception e) {
            android.util.Log.e("BalanceWidget", "Error computing balance", e);
        }
        return total;
    }

    private static String formatBalance(double balance) {
        if (balance == (long) balance) {
            return "$" + String.format(Locale.US, "%d", (long) balance);
        } else {
            return "$" + String.format(Locale.US, "%.2f", balance);
        }
    }
}
