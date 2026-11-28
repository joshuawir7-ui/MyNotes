package com.iunico.mynotes;

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.PowerManager;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceProfile")
public class DeviceProfilePlugin extends Plugin {

    private BroadcastReceiver powerSaveReceiver;
    private boolean powerSaveRegistered = false;
    private PowerManager.OnThermalStatusChangedListener thermalListener;
    private boolean thermalRegistered = false;

    private JSObject collectProfile() {
        Context ctx = getContext();
        JSObject obj = new JSObject();
        if (ctx == null) return obj;

        obj.put("sdkInt", Build.VERSION.SDK_INT);
        obj.put("model", Build.MODEL != null ? Build.MODEL : "");
        obj.put("manufacturer", Build.MANUFACTURER != null ? Build.MANUFACTURER : "");
        obj.put("hardware", Build.HARDWARE != null ? Build.HARDWARE : "");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            obj.put("socModel", Build.SOC_MODEL != null ? Build.SOC_MODEL : "");
            obj.put("socManufacturer", Build.SOC_MANUFACTURER != null ? Build.SOC_MANUFACTURER : "");
        } else {
            obj.put("socModel", "");
            obj.put("socManufacturer", "");
        }

        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        if (am != null) {
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            obj.put("totalMemBytes", mi.totalMem);
            obj.put("isLowRamDevice", am.isLowRamDevice());
        } else {
            obj.put("totalMemBytes", 0L);
            obj.put("isLowRamDevice", false);
        }

        obj.put("availableProcessors", Runtime.getRuntime().availableProcessors());

        DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
        obj.put("densityDpi", dm.densityDpi);

        float refreshRate = 60f;
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm != null) {
                Display d = wm.getDefaultDisplay();
                if (d != null) refreshRate = d.getRefreshRate();
            }
        } catch (Throwable ignored) {}
        obj.put("refreshRate", Math.round(refreshRate * 10f) / 10.0);

        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        boolean powerSave = pm != null && pm.isPowerSaveMode();
        obj.put("isPowerSaveMode", powerSave);

        int thermalStatus = 0;
        if (pm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                thermalStatus = pm.getCurrentThermalStatus();
            } catch (Throwable ignored) {}
        }
        obj.put("thermalStatus", thermalStatus);

        return obj;
    }

    @PluginMethod
    public void getProfile(PluginCall call) {
        call.resolve(collectProfile());
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        registerSystemListeners();
    }

    @Override
    protected void handleOnStop() {
        unregisterSystemListeners();
        super.handleOnStop();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterSystemListeners();
        super.handleOnDestroy();
    }

    private void registerSystemListeners() {
        Context ctx = getContext();
        if (ctx == null) return;

        if (!powerSaveRegistered) {
            powerSaveReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (PowerManager.ACTION_POWER_SAVE_MODE_CHANGED.equals(intent.getAction())) {
                        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                        JSObject data = new JSObject();
                        data.put("isPowerSaveMode", pm != null && pm.isPowerSaveMode());
                        notifyListeners("powerSaveChanged", data);
                    }
                }
            };
            try {
                ContextCompat.registerReceiver(
                    ctx,
                    powerSaveReceiver,
                    new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED),
                    ContextCompat.RECEIVER_NOT_EXPORTED
                );
                powerSaveRegistered = true;
            } catch (Throwable ignored) {}
        }

        if (!thermalRegistered && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                thermalListener = status -> {
                    JSObject data = new JSObject();
                    data.put("thermalStatus", status);
                    notifyListeners("thermalStatusChanged", data);
                };
                try {
                    pm.addThermalStatusListener(ContextCompat.getMainExecutor(ctx), thermalListener);
                    thermalRegistered = true;
                } catch (Throwable ignored) {}
            }
        }
    }

    private void unregisterSystemListeners() {
        Context ctx = getContext();
        if (ctx != null && powerSaveRegistered && powerSaveReceiver != null) {
            try {
                ctx.unregisterReceiver(powerSaveReceiver);
            } catch (Throwable ignored) {}
            powerSaveRegistered = false;
            powerSaveReceiver = null;
        }
        if (ctx != null && thermalRegistered && thermalListener != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                try {
                    pm.removeThermalStatusListener(thermalListener);
                } catch (Throwable ignored) {}
            }
            thermalRegistered = false;
            thermalListener = null;
        }
    }
}
