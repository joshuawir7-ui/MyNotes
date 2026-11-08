package com.iunico.mynotes;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
    private int lastTopDp = 0;
    private int lastRightDp = 0;
    private int lastBottomDp = 0;
    private int lastLeftDp = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetSyncPlugin.class);
        registerPlugin(CloudAuthPlugin.class);
        registerPlugin(TimerPlugin.class);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        super.onCreate(savedInstanceState);

        // Safe Area insets listener for display cutout & system bars
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );

            float density = getResources().getDisplayMetrics().density;
            lastTopDp = Math.round(insets.top / density);
            lastRightDp = Math.round(insets.right / density);
            lastBottomDp = Math.round(insets.bottom / density);
            lastLeftDp = Math.round(insets.left / density);

            applyInsetsToWebView();
            return windowInsets;
        });

        // Enable pinch-to-zoom controls
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().getSettings().setSupportZoom(true);
            bridge.getWebView().getSettings().setBuiltInZoomControls(true);
            bridge.getWebView().getSettings().setDisplayZoomControls(false);
        }
    }

    private void applyInsetsToWebView() {
        if (bridge != null && bridge.getWebView() != null) {
            String js = "document.documentElement.style.setProperty('--safe-area-inset-top','" + lastTopDp + "px');" +
                "document.documentElement.style.setProperty('--safe-area-inset-right','" + lastRightDp + "px');" +
                "document.documentElement.style.setProperty('--safe-area-inset-bottom','" + lastBottomDp + "px');" +
                "document.documentElement.style.setProperty('--safe-area-inset-left','" + lastLeftDp + "px');";
            bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(js, null));
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        TimerBubbleManager.getInstance(this).onAppForeground();
        handleIntent(getIntent());
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
        applyInsetsToWebView();
    }

    @Override
    public void onPause() {
        super.onPause();
        TimerBubbleManager.getInstance(this).onAppBackground();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null) {
            String noteId = intent.getStringExtra("noteId");
            if (noteId == null) {
                noteId = intent.getStringExtra("open_note_id"); // Fallback for old intents
            }

            if (noteId != null) {
                // Notifica vía evento para cubrir warm starts
                WidgetSyncPlugin.notifyPendingNote(noteId);
                
                intent.removeExtra("noteId");
                intent.removeExtra("open_note_id");
            }
        }
    }
}
