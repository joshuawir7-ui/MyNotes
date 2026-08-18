package com.iunico.mynotes;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class NotesWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_NEXT_NOTE = "com.iunico.mynotes.ACTION_NEXT_NOTE";
    public static final String ACTION_PREV_NOTE = "com.iunico.mynotes.ACTION_PREV_NOTE";
    public static final String ACTION_NOTE_ITEM_CLICK = "com.iunico.mynotes.ACTION_NOTE_ITEM_CLICK";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_notes);

        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String notesJson = prefs.getString("notes", "[]");

        String lang = prefs.getString("language", "es");
        String emptyText;

        if ("es".equals(lang)) {
            emptyText = "Haz clic para seleccionar una nota";
        } else if ("zh".equals(lang)) {
            emptyText = "点击选择笔记";
        } else if ("fr".equals(lang)) {
            emptyText = "Cliquez pour sélectionner une note";
        } else if ("de".equals(lang)) {
            emptyText = "Klicken Sie, um eine Notiz auszuwählen";
        } else if ("pt".equals(lang)) {
            emptyText = "Clique para selecionar uma nota";
        } else if ("ar".equals(lang)) {
            emptyText = "انقر لتحديد ملاحظة";
        } else if ("ja".equals(lang)) {
            emptyText = "クリックしてノートを選択";
        } else if ("hi".equals(lang)) {
            emptyText = "एक नोट चुनने के लिए क्लिक करें";
        } else {
            emptyText = "Click to select a note";
        }

        views.setTextViewText(R.id.widget_notes_empty, emptyText);

        String pinnedNoteId = prefs.getString("pinnedNoteId", null);
        String selectedNoteId = prefs.getString("widget_note_id_" + appWidgetId, null);
        boolean isConfigured = prefs.getBoolean("widget_note_configured_" + appWidgetId, false);
        int currentIndex = -1;

        try {
            JSONArray notes = new JSONArray(notesJson);
            if (notes.length() > 0) {
                // If not explicitly configured, try to show the app's pinned note, or fallback to the most recent note
                if (!isConfigured) {
                    if (pinnedNoteId != null && !pinnedNoteId.isEmpty()) {
                        for (int i = 0; i < notes.length(); i++) {
                            if (pinnedNoteId.equals(notes.getJSONObject(i).optString("id"))) {
                                currentIndex = i;
                                break;
                            }
                        }
                    }
                    
                    // If no pinned note is found, fallback to the most recent note (latest createdAt lexicographically)
                    if (currentIndex == -1) {
                        String latestCreated = "";
                        for (int i = 0; i < notes.length(); i++) {
                            String createdAt = notes.getJSONObject(i).optString("createdAt", "");
                            if (createdAt.compareTo(latestCreated) > 0) {
                                latestCreated = createdAt;
                                currentIndex = i;
                            }
                        }
                    }
                } else {
                    // Explicitly configured note
                    if (selectedNoteId != null) {
                        for (int i = 0; i < notes.length(); i++) {
                            if (selectedNoteId.equals(notes.getJSONObject(i).optString("id"))) {
                                currentIndex = i;
                                break;
                            }
                        }
                    }
                }

                // Fallback to index if not found
                if (currentIndex == -1) {
                    currentIndex = prefs.getInt("widget_note_index_" + appWidgetId, 0);
                }

                // Keep index in bounds
                if (currentIndex >= notes.length()) {
                    currentIndex = 0;
                } else if (currentIndex < 0) {
                    currentIndex = notes.length() - 1;
                }

                // Sync index and ID back to preferences
                JSONObject note = notes.getJSONObject(currentIndex);
                SharedPreferences.Editor editor = prefs.edit();
                editor.putInt("widget_note_index_" + appWidgetId, currentIndex);
                if (isConfigured) {
                    editor.putString("widget_note_id_" + appWidgetId, note.optString("id", ""));
                }
                editor.apply();

                String title = note.optString("title", "Untitled Note");

                views.setTextViewText(R.id.widget_note_title, title);

                // Set up the remote adapter for the ListView
                Intent intent = new Intent(context, NotesWidgetService.class);
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
                intent.setData(android.net.Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME)));
                views.setRemoteAdapter(R.id.widget_note_content_list, intent);
                views.setEmptyView(R.id.widget_note_content_list, R.id.widget_notes_empty);

                views.setViewVisibility(R.id.widget_note_title, android.view.View.VISIBLE);
                views.setViewVisibility(R.id.widget_note_content_list, android.view.View.VISIBLE);
                views.setViewVisibility(R.id.widget_notes_empty, android.view.View.GONE);

                // Click template to handle clicks via Broadcast in NotesActionReceiver
                Intent clickIntent = new Intent(context, NotesActionReceiver.class);
                clickIntent.setAction(ACTION_NOTE_ITEM_CLICK);
                clickIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
                PendingIntent clickPendingIntent = PendingIntent.getBroadcast(
                    context, appWidgetId, clickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
                );
                views.setPendingIntentTemplate(R.id.widget_note_content_list, clickPendingIntent);

                // Clicking note title requires double tap handled in ActionReceiver
                Intent titleIntent = new Intent(context, NotesActionReceiver.class);
                titleIntent.setAction(ACTION_NOTE_ITEM_CLICK);
                titleIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
                titleIntent.putExtra("click_type", "open_app");
                titleIntent.putExtra("note_id", note.optString("id"));
                PendingIntent titlePendingIntent = PendingIntent.getBroadcast(
                    context, appWidgetId, titleIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
                );
                views.setOnClickPendingIntent(R.id.widget_note_title, titlePendingIntent);

            } else {
                // Hide content, show empty
                views.setViewVisibility(R.id.widget_note_title, android.view.View.GONE);
                views.setViewVisibility(R.id.widget_note_content_list, android.view.View.GONE);
                views.setViewVisibility(R.id.widget_notes_empty, android.view.View.VISIBLE);
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }

        // Click on empty state opens config
        Intent configIntent = new Intent(context, NoteWidgetConfigActivity.class);
        configIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        PendingIntent configPendingIntent = PendingIntent.getActivity(context, appWidgetId, configIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_notes_empty, configPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_note_content_list);
    }
}
