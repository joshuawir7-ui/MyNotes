package com.iunico.mynotes;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private View.OnLayoutChangeListener webViewLayoutListener;
    private ViewTreeObserver.OnGlobalLayoutListener webViewGlobalLayoutListener;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetSyncPlugin.class);
        registerPlugin(CloudAuthPlugin.class);
        registerPlugin(TimerPlugin.class);
        registerPlugin(TextZoomPlugin.class);
        registerPlugin(SafeInsetsPlugin.class);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        super.onCreate(savedInstanceState);

        // Enable pinch-to-zoom controls, apply persisted textZoom, and attach layout-only
        // inset measurement (WITHOUT setOnApplyWindowInsetsListener so Capacitor SystemBars keeps working).
        if (bridge != null && bridge.getWebView() != null) {
            WebView webView = bridge.getWebView();
            webView.getSettings().setSupportZoom(true);
            webView.getSettings().setBuiltInZoomControls(true);
            webView.getSettings().setDisplayZoomControls(false);
            TextZoomPlugin.applySavedTextZoom(this, webView);

            webViewLayoutListener = (v, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
                SafeInsetsPlugin.computeAndPublish(this, getWindow().getDecorView(), webView, false);
            };
            webView.addOnLayoutChangeListener(webViewLayoutListener);

            webViewGlobalLayoutListener = () -> {
                SafeInsetsPlugin.computeAndPublish(this, getWindow().getDecorView(), webView, false);
            };
            webView.getViewTreeObserver().addOnGlobalLayoutListener(webViewGlobalLayoutListener);
        }
    }

    private void syncEffectiveInsets(boolean force) {
        if (bridge != null && bridge.getWebView() != null) {
            SafeInsetsPlugin.computeAndPublish(this, getWindow().getDecorView(), bridge.getWebView(), force);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        TimerBubbleManager.getInstance(this).onAppForeground();
        handleIntent(getIntent());
        syncEffectiveInsets(true);
        if (bridge != null && bridge.getWebView() != null) {
            TextZoomPlugin.applySavedTextZoom(this, bridge.getWebView());
        }
    }

    @Override
    public void onDestroy() {
        if (bridge != null && bridge.getWebView() != null) {
            WebView webView = bridge.getWebView();
            if (webViewLayoutListener != null) {
                webView.removeOnLayoutChangeListener(webViewLayoutListener);
            }
            if (webViewGlobalLayoutListener != null) {
                webView.getViewTreeObserver().removeOnGlobalLayoutListener(webViewGlobalLayoutListener);
            }
        }
        super.onDestroy();
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
