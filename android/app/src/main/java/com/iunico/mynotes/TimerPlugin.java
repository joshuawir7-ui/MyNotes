package com.iunico.mynotes;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
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
}

