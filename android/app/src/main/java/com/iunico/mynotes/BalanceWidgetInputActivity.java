package com.iunico.mynotes;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Modern, custom translucent dialog activity that pops up when tapping
 * the Balance Widget (or its input pill/buttons), allowing the user to type
 * an amount and choose either GANÉ (+ income) or GASTÉ (- expense) with a sleek app UI.
 */
public class BalanceWidgetInputActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_balance_widget_input);

        int appWidgetId = getIntent().getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        );

        SharedPreferences prefs = getSharedPreferences("WidgetData", MODE_PRIVATE);
        String lang = prefs.getString("language", "es");

        TextView titleView    = findViewById(R.id.dialog_title);
        TextView subtitleView = findViewById(R.id.dialog_subtitle);
        TextView btnIncome    = findViewById(R.id.btn_action_income);
        TextView btnExpense   = findViewById(R.id.btn_action_expense);
        TextView btnClose     = findViewById(R.id.btn_close_dialog);
        EditText inputAmount  = findViewById(R.id.input_amount);
        View     rootView     = findViewById(R.id.balance_input_root);

        // Apply Dancing Script font to dialog title
        try {
            Typeface tf = Typeface.createFromAsset(getAssets(), "fonts/dancing_script.ttf");
            titleView.setTypeface(tf);
            titleView.setTextSize(26);
        } catch (Exception ignored) {}

        // Localise titles and button labels
        if ("es".equals(lang)) {
            titleView.setText("Registrar Movimiento");
            subtitleView.setText("Ingresa el monto de la transacción");
            btnIncome.setText("+ GANÉ");
            btnExpense.setText("- GASTÉ");
        } else {
            titleView.setText("Record Transaction");
            subtitleView.setText("Enter transaction amount");
            btnIncome.setText("+ EARNED");
            btnExpense.setText("- SPENT");
        }

        // Auto focus input field & open soft keyboard
        inputAmount.requestFocus();
        inputAmount.postDelayed(() -> {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.showSoftInput(inputAmount, InputMethodManager.SHOW_IMPLICIT);
            }
        }, 150);

        // Close when tapping root dark background overlay or close button
        rootView.setOnClickListener(v -> finish());
        btnClose.setOnClickListener(v -> finish());

        // GANÉ button click handler
        btnIncome.setOnClickListener(v -> {
            submitTx("income", inputAmount.getText().toString().trim(), appWidgetId);
        });

        // GASTÉ button click handler
        btnExpense.setOnClickListener(v -> {
            submitTx("expense", inputAmount.getText().toString().trim(), appWidgetId);
        });
    }

    private void submitTx(String txType, String rawAmount, int appWidgetId) {
        if (rawAmount.isEmpty()) {
            Toast.makeText(this, "Por favor ingresa un monto", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            double amount = Double.parseDouble(rawAmount.replace(",", "."));
            if (amount <= 0) {
                Toast.makeText(this, "Ingresa un monto mayor a 0", Toast.LENGTH_SHORT).show();
                return;
            }
            BalanceActionReceiver.commitTransaction(this, txType, amount, appWidgetId);
        } catch (NumberFormatException e) {
            Toast.makeText(this, "Monto inválido", Toast.LENGTH_SHORT).show();
        }
        finish();
    }
}
