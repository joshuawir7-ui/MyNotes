package com.iunico.mynotes;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Timer")
public class TimerPlugin extends Plugin implements NativeTimerManager.StateChangeListener {

    private NativeTimerManager timerManager;

    @Override
    public void load() {
        super.load();
        timerManager = NativeTimerManager.getInstance(getContext());
        timerManager.setStateChangeListener(this);
    }

    @Override
    public void onTimerStateChanged(JSObject state) {
        notifyListeners("timerStateChanged", state);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject state = timerManager.getState();
        call.resolve(state);
    }

    @PluginMethod
    public void start(PluginCall call) {
        Long durationMs = call.getLong("durationMs", 0L);
        Integer preset = call.getInt("preset", 25);
        timerManager.start(durationMs != null ? durationMs : 0L, preset != null ? preset : 25);
        call.resolve(timerManager.getState());
    }

    @PluginMethod
    public void pause(PluginCall call) {
        timerManager.pause();
        call.resolve(timerManager.getState());
    }

    @PluginMethod
    public void resume(PluginCall call) {
        timerManager.resume();
        call.resolve(timerManager.getState());
    }

    @PluginMethod
    public void reset(PluginCall call) {
        timerManager.reset();
        call.resolve(timerManager.getState());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        timerManager.stop();
        call.resolve(timerManager.getState());
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        boolean canDraw = TimerBubbleManager.getInstance(getContext()).canDrawOverlays();
        JSObject ret = new JSObject();
        ret.put("granted", canDraw);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
        }
        JSObject ret = new JSObject();
        ret.put("requested", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getBubbleSettings(PluginCall call) {
        TimerBubbleManager manager = TimerBubbleManager.getInstance(getContext());
        JSObject ret = new JSObject();
        ret.put("mode", manager.getMode());
        ret.put("hasPermission", manager.canDrawOverlays());
        ret.put("isSupported", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void setBubbleMode(PluginCall call) {
        String mode = call.getString("mode", TimerBubbleManager.MODE_OUTSIDE);
        TimerBubbleManager manager = TimerBubbleManager.getInstance(getContext());
        manager.setMode(mode);
        JSObject ret = new JSObject();
        ret.put("mode", manager.getMode());
        call.resolve(ret);
    }

    @PluginMethod
    public void showBubble(PluginCall call) {
        TimerBubbleManager.getInstance(getContext()).showBubble();
        call.resolve();
    }

    @PluginMethod
    public void hideBubble(PluginCall call) {
        TimerBubbleManager.getInstance(getContext()).hideBubble();
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open app settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open battery settings: " + e.getMessage());
        }
    }
}
