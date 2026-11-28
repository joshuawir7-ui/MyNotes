package com.iunico.mynotes;

import android.content.Context;
import android.content.res.Resources;
import android.os.Build;
import android.provider.Settings;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

@CapacitorPlugin(name = "SafeInsets")
public class SafeInsetsPlugin extends Plugin {

    private static volatile boolean overrideZero = false;
    private static volatile JSObject lastMetrics = new JSObject();
    private static volatile int lastPublishedEffectiveDp = -1;

    public static String detectNavigationMode(Context context) {
        if (context == null) return "unknown";
        try {
            int mode = Settings.Secure.getInt(context.getContentResolver(), "navigation_mode", -1);
            if (mode == 0) return "3-button";
            if (mode == 1) return "2-button";
            if (mode == 2) return "gesture";
        } catch (Throwable ignored) {
        }
        try {
            Resources res = context.getResources();
            int id = res.getIdentifier("config_navBarInteractionMode", "integer", "android");
            if (id > 0) {
                int mode = res.getInteger(id);
                if (mode == 0) return "3-button";
                if (mode == 1) return "2-button";
                if (mode == 2) return "gesture";
            }
        } catch (Throwable ignored) {
        }
        return "unknown";
    }

    /**
     * Computes effective bottom overlap between the WebView and Android's navigation bar
     * using ViewCompat.getRootWindowInsets(webView) (without replacing Capacitor's
     * setOnApplyWindowInsetsListener) and publishes --app-inset-bottom to the WebView.
     */
    public static JSObject computeAndPublish(Context context, View decorView, WebView webView, boolean forceJsUpdate) {
        JSObject m = new JSObject();
        if (context == null || webView == null) {
            return m;
        }

        float density = context.getResources().getDisplayMetrics().density;
        if (density <= 0f) density = 1f;

        int windowHeightPx = decorView != null && decorView.getHeight() > 0
            ? decorView.getHeight()
            : webView.getRootView().getHeight();

        int[] loc = new int[2];
        webView.getLocationInWindow(loc);
        int webViewTopPx = loc[1];
        int webViewHeightPx = webView.getHeight();
        int webViewBottomPx = webViewTopPx + webViewHeightPx;

        WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(webView);
        Insets navInsets = rootInsets != null
            ? rootInsets.getInsets(WindowInsetsCompat.Type.navigationBars())
            : Insets.NONE;
        Insets sysAndCutout = rootInsets != null
            ? rootInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout())
            : Insets.NONE;
        Insets imeInsets = rootInsets != null
            ? rootInsets.getInsets(WindowInsetsCompat.Type.ime())
            : Insets.NONE;
        boolean imeVisible = rootInsets != null && rootInsets.isVisible(WindowInsetsCompat.Type.ime());

        int navTopPx = windowHeightPx - navInsets.bottom;
        int rawOverlapPx = Math.max(0, webViewBottomPx - navTopPx);
        int overlapPx = imeVisible ? 0 : rawOverlapPx;
        int overlapDp = Math.round(overlapPx / density);
        int effectiveDp = overrideZero ? 0 : overlapDp;

        int topDp = Math.round(sysAndCutout.top / density);
        int rightDp = Math.round(sysAndCutout.right / density);
        int leftDp = Math.round(sysAndCutout.left / density);

        m.put("sdkInt", Build.VERSION.SDK_INT);
        m.put("density", Math.round(density * 100f) / 100.0);
        m.put("navMode", detectNavigationMode(context));
        m.put("windowHeightPx", windowHeightPx);
        m.put("windowHeightDp", Math.round(windowHeightPx / density));
        m.put("webViewTopPx", webViewTopPx);
        m.put("webViewHeightPx", webViewHeightPx);
        m.put("webViewBottomPx", webViewBottomPx);
        m.put("navBarBottomPx", navInsets.bottom);
        m.put("navBarBottomDp", Math.round(navInsets.bottom / density));
        m.put("imeBottomPx", imeInsets.bottom);
        m.put("imeBottomDp", Math.round(imeInsets.bottom / density));
        m.put("imeVisible", imeVisible);
        m.put("navTopPx", navTopPx);
        m.put("overlapPx", overlapPx);
        m.put("overlapDp", overlapDp);
        m.put("effectiveBottomDp", effectiveDp);
        m.put("overrideZero", overrideZero);
        lastMetrics = m;

        if (forceJsUpdate || effectiveDp != lastPublishedEffectiveDp) {
            lastPublishedEffectiveDp = effectiveDp;
            final String js = String.format(
                Locale.US,
                "try{" +
                "var r=document.documentElement.style;" +
                "r.setProperty('--app-inset-bottom','%dpx');" +
                "r.setProperty('--safe-area-inset-top','%dpx');" +
                "r.setProperty('--safe-area-inset-right','%dpx');" +
                "r.setProperty('--safe-area-inset-left','%dpx');" +
                "}catch(e){}",
                effectiveDp, topDp, rightDp, leftDp
            );
            webView.post(() -> webView.evaluateJavascript(js, null));
        }

        return m;
    }

    @PluginMethod
    public void getMetrics(PluginCall call) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                JSObject m = computeAndPublish(
                    getContext(),
                    getActivity().getWindow().getDecorView(),
                    webView,
                    false
                );
                call.resolve(m);
            });
        } else {
            call.resolve(lastMetrics);
        }
    }

    @PluginMethod
    public void syncNow(PluginCall call) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                JSObject m = computeAndPublish(
                    getContext(),
                    getActivity().getWindow().getDecorView(),
                    webView,
                    true
                );
                call.resolve(m);
            });
        } else {
            call.resolve(lastMetrics);
        }
    }

    @PluginMethod
    public void setOverrideZero(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        overrideZero = enabled;
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                JSObject m = computeAndPublish(
                    getContext(),
                    getActivity().getWindow().getDecorView(),
                    webView,
                    true
                );
                call.resolve(m);
            });
        } else {
            call.resolve(lastMetrics);
        }
    }
}
