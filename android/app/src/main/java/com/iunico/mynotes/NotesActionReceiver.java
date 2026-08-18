package com.iunico.mynotes;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class NotesActionReceiver extends BroadcastReceiver {

    private static long lastClickTime = 0;
    private static String lastClickedItemId = null;
    private static final long DOUBLE_TAP_TIMEOUT = 500; // milliseconds

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        int appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            return;
        }

        if (NotesWidgetProvider.ACTION_NEXT_NOTE.equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
            int currentIndex = prefs.getInt("widget_note_index_" + appWidgetId, 0);
            currentIndex++;
            prefs.edit().putInt("widget_note_index_" + appWidgetId, currentIndex).apply();
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            NotesWidgetProvider.updateAppWidget(context, appWidgetManager, appWidgetId);
        } else if (NotesWidgetProvider.ACTION_PREV_NOTE.equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
            int currentIndex = prefs.getInt("widget_note_index_" + appWidgetId, 0);
            currentIndex--;
            prefs.edit().putInt("widget_note_index_" + appWidgetId, currentIndex).apply();
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            NotesWidgetProvider.updateAppWidget(context, appWidgetManager, appWidgetId);
        } else if (NotesWidgetProvider.ACTION_NOTE_ITEM_CLICK.equals(action)) {
            String clickType = intent.getStringExtra("click_type");
            String noteId = intent.getStringExtra("note_id");
            
            if (noteId == null) {
                return;
            }

            // Check if clicked text contains a URL and open it
            String text = intent.getStringExtra("text");
            if (text != null) {
                String url = extractUrl(text);
                if (url != null) {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        context.startActivity(browserIntent);
                        return; // Opened browser, skip opening app or checklist toggle
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }

            if ("checklist".equals(clickType)) {
                String blockId = intent.getStringExtra("block_id");
                String itemId = intent.getStringExtra("item_id");
                if (blockId != null && itemId != null) {
                    toggleChecklistItem(context, noteId, blockId, itemId);
                }
                return; // Checklist toggled, stop here
            }

            if ("open_app".equals(clickType)) {
                long currentTime = System.currentTimeMillis();
                String blockId = intent.getStringExtra("block_id");
                
                String clickTargetId = noteId;
                if (blockId != null) clickTargetId += "_" + blockId;

                if (clickTargetId.equals(lastClickedItemId) && (currentTime - lastClickTime) < DOUBLE_TAP_TIMEOUT) {
                    // Double tap! Open the note in the app
                    openNoteInApp(context, noteId);
                    
                    // Reset double tap state
                    lastClickTime = 0;
                    lastClickedItemId = null;
                } else {
                    // First click!
                    lastClickTime = currentTime;
                    lastClickedItemId = clickTargetId;
                }
            }
        }
    }

    private void openNoteInApp(Context context, String noteId) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        prefs.edit().putString("pending_open_note_id", noteId).apply();

        Intent appIntent = new Intent(context, MainActivity.class);
        appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        appIntent.putExtra("noteId", noteId); // Redundancy via Intent
        context.startActivity(appIntent);
    }

    private void toggleChecklistItem(Context context, String noteId, String blockId, String itemId) {
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String notesJson = prefs.getString("notes", "[]");
        try {
            JSONArray notes = new JSONArray(notesJson);
            boolean updated = false;
            for (int i = 0; i < notes.length(); i++) {
                JSONObject note = notes.getJSONObject(i);
                if (noteId.equals(note.optString("id"))) {
                    JSONArray blocks = note.optJSONArray("blocks");
                    if (blocks != null) {
                        for (int j = 0; j < blocks.length(); j++) {
                            JSONObject block = blocks.getJSONObject(j);
                            if (blockId.equals(block.optString("id")) && "task-list".equals(block.optString("type"))) {
                                JSONArray items = null;
                                JSONObject contentObj = block.optJSONObject("content");
                                if (contentObj != null) {
                                    items = contentObj.optJSONArray("items");
                                } else {
                                    items = block.optJSONArray("content");
                                }

                                if (items != null) {
                                    for (int k = 0; k < items.length(); k++) {
                                        JSONObject item = items.getJSONObject(k);
                                        if (itemId.equals(item.optString("id"))) {
                                            boolean checked = item.optBoolean("checked", false);
                                            item.put("checked", !checked);
                                            updated = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (updated) break;
                        }
                    }
                }
                if (updated) break;
            }
            if (updated) {
                prefs.edit().putString("notes", notes.toString()).commit();
                
                // Notify the Notes widget that data has changed
                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
                ComponentName thisWidget = new ComponentName(context, NotesWidgetProvider.class);
                int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
                appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_note_content_list);

                // Broadcast update to the widget provider to force instant view refresh
                Intent updateIntent = new Intent(context, NotesWidgetProvider.class);
                updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
                context.sendBroadcast(updateIntent);

                // Notify JS app in real-time that note checklist item was toggled
                WidgetSyncPlugin.notifyNotesChanged();
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    private String extractUrl(String text) {
        if (text == null) return null;
        // First try to extract from href if it's inside an <a> tag
        int hrefIndex = text.indexOf("href=\"");
        if (hrefIndex != -1) {
            int start = hrefIndex + 6;
            int end = text.indexOf("\"", start);
            if (end != -1) {
                return text.substring(start, end);
            }
        }
        
        // Otherwise search for http:// or https://
        int httpIndex = text.indexOf("http://");
        if (httpIndex == -1) {
            httpIndex = text.indexOf("https://");
        }
        if (httpIndex != -1) {
            // Find end of URL (space or end of string or brackets, etc.)
            int end = httpIndex;
            while (end < text.length()) {
                char c = text.charAt(end);
                if (c == ' ' || c == '<' || c == '>' || c == '"' || c == '\'') {
                    break;
                }
                end++;
            }
            return text.substring(httpIndex, end);
        }
        return null;
    }
}

