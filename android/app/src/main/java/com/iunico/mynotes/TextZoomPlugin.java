package com.iunico.mynotes;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TextZoom")
public class TextZoomPlugin extends Plugin {

    public static final String PREFS_NAME = "mynotes_text_zoom_prefs";
    public static final String KEY_MODE = "mode";
    public static final String KEY_CUSTOM_PERCENT = "custom_percent";

    public static final String MODE_STANDARD = "standard";
    public static final String MODE_SYSTEM = "system";
    public static final String MODE_CUSTOM = "custom";

    public static final float MAX_SYSTEM_FONT_SCALE = 1.3f;
    public static final int DEFAULT_PERCENT = 100;
    public static final int MIN_CUSTOM_PERCENT = 85;
    public static final int MAX_CUSTOM_PERCENT = 140;

    private static int clampCustomPercent(int percent) {
        if (percent < MIN_CUSTOM_PERCENT) return MIN_CUSTOM_PERCENT;
        if (percent > MAX_CUSTOM_PERCENT) return MAX_CUSTOM_PERCENT;
        return percent;
    }

    private static String normalizeMode(String rawMode) {
        if (MODE_SYSTEM.equals(rawMode)) return MODE_SYSTEM;
        if (MODE_CUSTOM.equals(rawMode)) return MODE_CUSTOM;
        return MODE_STANDARD;
    }

    public static int computeTargetZoom(Context context, String mode, int customPercent) {
        String normalized = normalizeMode(mode);
        if (MODE_SYSTEM.equals(normalized)) {
            float sysScale = context.getResources().getConfiguration().fontScale;
            if (sysScale <= 0f) sysScale = 1.0f;
            float clamped = Math.min(sysScale, MAX_SYSTEM_FONT_SCALE);
            return Math.round(clamped * 100f);
        }
        if (MODE_CUSTOM.equals(normalized)) {
            return clampCustomPercent(customPercent);
        }
        return DEFAULT_PERCENT;
    }

    /**
     * Applies the persisted textZoom directly to the WebView before UI is shown
     * (called from MainActivity.onCreate and onResume) to prevent startup flicker.
     */
    public static void applySavedTextZoom(Context context, WebView webView) {
        if (context == null || webView == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String mode = normalizeMode(prefs.getString(KEY_MODE, MODE_STANDARD));
        int customPercent = clampCustomPercent(prefs.getInt(KEY_CUSTOM_PERCENT, DEFAULT_PERCENT));
        int targetZoom = computeTargetZoom(context, mode, customPercent);

        WebSettings settings = webView.getSettings();
        if (settings.getTextZoom() != targetZoom) {
            settings.setTextZoom(targetZoom);
        }
    }

    private JSObject buildStateObject(Context context, WebView webView) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String mode = normalizeMode(prefs.getString(KEY_MODE, MODE_STANDARD));
        int customPercent = clampCustomPercent(prefs.getInt(KEY_CUSTOM_PERCENT, DEFAULT_PERCENT));
        float sysScale = context.getResources().getConfiguration().fontScale;
        int appliedZoom = webView != null
            ? webView.getSettings().getTextZoom()
            : computeTargetZoom(context, mode, customPercent);

        JSObject ret = new JSObject();
        ret.put("mode", mode);
        ret.put("customPercent", customPercent);
        ret.put("appliedZoom", appliedZoom);
        ret.put("systemFontScale", Math.round(sysScale * 100f) / 100.0);
        ret.put("maxSystemScale", Math.round(MAX_SYSTEM_FONT_SCALE * 100f) / 100.0);
        return ret;
    }

    @PluginMethod
    public void getState(PluginCall call) {
        Context context = getContext();
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && getActivity() != null) {
            getActivity().runOnUiThread(() -> call.resolve(buildStateObject(context, webView)));
        } else {
            call.resolve(buildStateObject(context, null));
        }
    }

    @PluginMethod
    public void setMode(PluginCall call) {
        Context context = getContext();
        String mode = normalizeMode(call.getString("mode", MODE_STANDARD));
        Integer customOpt = call.getInt("customPercent", DEFAULT_PERCENT);
        int customPercent = clampCustomPercent(customOpt != null ? customOpt : DEFAULT_PERCENT);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_MODE, mode)
            .putInt(KEY_CUSTOM_PERCENT, customPercent)
            .apply();

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                int targetZoom = computeTargetZoom(context, mode, customPercent);
                webView.getSettings().setTextZoom(targetZoom);
                call.resolve(buildStateObject(context, webView));
            });
        } else {
            call.resolve(buildStateObject(context, null));
        }
    }
}
