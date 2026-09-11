package com.iunico.mynotes;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Balance Widget — lets the user record income/expense directly from the home screen.
 *
 * Data flow:
 *  1. WidgetSyncPlugin.updateWidgetData() stores the current balance JSON under
 *     SharedPreferences("WidgetData") → key "balance_transactions".
 *  2. BalanceWidgetProvider reads that JSON to display the running total.
 *  3. When the user taps GANÉ / GASTÉ, BalanceActionReceiver is called.
 *     It appends a new transaction to "balance_transactions" and fires
 *     notifyListeners("balanceTransactionAdded", ...) so the JS layer can
 *     pick it up and persist it into the app's real storage.
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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);

        // ── Read language preference ──────────────────────────────────────
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String lang = prefs.getString("language", "es");

        // ── Compute current balance from stored transactions JSON ─────────
        double balance = computeBalance(prefs);
        String formattedBalance = formatBalance(balance, lang);
        views.setTextViewText(R.id.widget_balance_amount, formattedBalance);

        // ── Localised labels ─────────────────────────────────────────────
        String titleText   = "es".equals(lang) ? "Balance" : "Balance";
        String btnIncome   = "es".equals(lang) ? "GANÉ"   : "EARNED";
        String btnExpense  = "es".equals(lang) ? "GASTÉ"  : "SPENT";
        String hintText    = "es".equals(lang) ? "0.00"   : "0.00";

        views.setTextViewText(R.id.widget_balance_title, titleText);
        views.setTextViewText(R.id.widget_balance_btn_income,  btnIncome);
        views.setTextViewText(R.id.widget_balance_btn_expense, btnExpense);

        // ── GANÉ PendingIntent ────────────────────────────────────────────
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

        // ── GASTÉ PendingIntent ───────────────────────────────────────────
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

        // ── Tap on balance amount → open app ──────────────────────────────
        Intent appIntent = new Intent(context, MainActivity.class);
        PendingIntent appPi = PendingIntent.getActivity(
            context,
            appWidgetId * 10 + 2,
            appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_balance_amount, appPi);
        views.setOnClickPendingIntent(R.id.widget_balance_title,  appPi);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

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

    private static String formatBalance(double balance, String lang) {
        String sign = balance >= 0 ? "+" : "";
        // Two decimal places
        String formatted = String.format("%.2f", balance);
        return "$" + (balance >= 0 ? sign : "") + formatted;
    }
}
