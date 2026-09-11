package com.iunico.mynotes;

import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.text.InputType;
import android.widget.EditText;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Handles GANÉ / GASTÉ button presses from the Balance Widget.
 *
 * Flow:
 *  1. User presses a button → this receiver fires.
 *  2. We cannot show UI from a regular BroadcastReceiver, so we launch
 *     BalanceWidgetInputActivity to collect the amount.
 *
 * The actual transaction is written from BalanceWidgetInputActivity once
 * the user confirms.
 */
public class BalanceActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action     = intent.getAction();
        int    appWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        );

        if (BalanceWidgetProvider.ACTION_INCOME.equals(action)
                || BalanceWidgetProvider.ACTION_EXPENSE.equals(action)) {

            String txType = BalanceWidgetProvider.ACTION_INCOME.equals(action) ? "income" : "expense";

            // Launch the transparent input activity so we can show a dialog
            Intent inputIntent = new Intent(context, BalanceWidgetInputActivity.class);
            inputIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            inputIntent.putExtra("txType", txType);
            inputIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            context.startActivity(inputIntent);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Static helpers used by BalanceWidgetInputActivity after confirmation
    // ────────────────────────────────────────────────────────────────────

    /**
     * Appends a new transaction to SharedPreferences and notifies both:
     *  - All Balance widget instances (UI refresh)
     *  - The Capacitor JS layer via WidgetSyncPlugin so the app's own
     *    storage also receives the update.
     */
    public static void commitTransaction(Context context, String txType, double amount, int appWidgetId) {
        SharedPreferences prefs  = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String lang              = prefs.getString("language", "es");

        // If amount is negative, force to expense
        if (amount < 0) {
            txType = "expense";
            amount = Math.abs(amount);
        }

        String todayStr;
        try {
            todayStr = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        } catch (Exception e) {
            todayStr = "2026-01-01";
        }

        String description = "income".equals(txType)
            ? ("es".equals(lang) ? "Ingreso (widget)" : "Income (widget)")
            : ("es".equals(lang) ? "Gasto (widget)"   : "Expense (widget)");

        try {
            // Build new transaction object
            JSONObject tx = new JSONObject();
            tx.put("id",          "w_" + System.currentTimeMillis());
            tx.put("amount",      amount);
            tx.put("type",        txType);
            tx.put("description", description);
            tx.put("date",        todayStr);
            tx.put("currency",    "$");
            tx.put("lastUpdated", System.currentTimeMillis());

            // Append to stored array
            String existingJson = prefs.getString("balance_transactions", "[]");
            JSONArray arr = new JSONArray(existingJson);
            arr.put(tx);
            prefs.edit().putString("balance_transactions", arr.toString()).apply();

            // Notify JS layer (Capacitor plugin listener)
            WidgetSyncPlugin.notifyBalanceTransactionAdded(tx.toString());

        } catch (Exception e) {
            android.util.Log.e("BalanceActionReceiver", "Error committing transaction", e);
        }

        // Refresh all balance widget instances
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
            new ComponentName(context, BalanceWidgetProvider.class)
        );
        for (int id : ids) {
            BalanceWidgetProvider.updateAppWidget(context, manager, id);
        }

        // Toast feedback
        SharedPreferences p = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String l = p.getString("language", "es");
        String msg = "income".equals(txType)
            ? ("es".equals(l) ? "Ingreso registrado ✓" : "Income recorded ✓")
            : ("es".equals(l) ? "Gasto registrado ✓"   : "Expense recorded ✓");
        Toast.makeText(context, msg, Toast.LENGTH_SHORT).show();
    }
}
