package com.iunico.mynotes;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Transparent activity used as a host for the "enter amount" AlertDialog
 * that appears when the user taps GANÉ or GASTÉ on the Balance Widget.
 *
 * Android widgets cannot show UI directly, so we launch this lightweight
 * transparent activity, which immediately shows an AlertDialog and then
 * finishes itself.
 */
public class BalanceWidgetInputActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Make the activity completely transparent
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);

        String txType      = getIntent().getStringExtra("txType");
        int    appWidgetId = getIntent().getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        );

        SharedPreferences prefs = getSharedPreferences("WidgetData", MODE_PRIVATE);
        String lang = prefs.getString("language", "es");

        boolean isIncome = "income".equals(txType);

        // ── Dialog title ───────────────────────────────────────────────
        String title = isIncome
            ? ("es".equals(lang) ? "¿Cuánto ganaste?" : "How much did you earn?")
            : ("es".equals(lang) ? "¿Cuánto gastaste?" : "How much did you spend?");

        String hint = "es".equals(lang) ? "Ej: 50  o  -20" : "E.g.: 50  or  -20";
        String note = "es".equals(lang)
            ? "Si pones un valor negativo se registra como gasto."
            : "Negative values are always recorded as an expense.";

        // ── Build dialog layout ───────────────────────────────────────
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        layout.setPadding(pad, pad / 2, pad, pad / 2);

        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER
            | InputType.TYPE_NUMBER_FLAG_DECIMAL
            | InputType.TYPE_NUMBER_FLAG_SIGNED);
        input.setHint(hint);
        input.setGravity(Gravity.CENTER);
        input.setTextSize(20);
        layout.addView(input);

        TextView noteView = new TextView(this);
        noteView.setText(note);
        noteView.setTextSize(11);
        noteView.setTextColor(Color.parseColor("#9CA3AF"));
        noteView.setGravity(Gravity.CENTER);
        noteView.setPadding(0, dp(8), 0, 0);
        layout.addView(noteView);

        // ── Build dialog ──────────────────────────────────────────────
        String confirmLabel = isIncome
            ? ("es".equals(lang) ? "GANÉ"   : "EARNED")
            : ("es".equals(lang) ? "GASTÉ"  : "SPENT");
        String cancelLabel  = "es".equals(lang) ? "Cancelar" : "Cancel";

        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(title);
        builder.setView(layout);

        final String finalTxType = txType;
        final int    finalWidgetId = appWidgetId;

        builder.setPositiveButton(confirmLabel, (dialog, which) -> {
            String raw = input.getText().toString().trim();
            try {
                double amount = Double.parseDouble(raw);
                if (amount == 0) {
                    finish();
                    return;
                }
                BalanceActionReceiver.commitTransaction(this, finalTxType, amount, finalWidgetId);
            } catch (NumberFormatException e) {
                // ignore, just close
            }
            finish();
        });

        builder.setNegativeButton(cancelLabel, (dialog, which) -> finish());
        builder.setOnCancelListener(dialog -> finish());

        AlertDialog dialog = builder.create();
        dialog.show();
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }
}
