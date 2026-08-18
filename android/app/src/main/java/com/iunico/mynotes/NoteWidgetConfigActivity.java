package com.iunico.mynotes;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;

public class NoteWidgetConfigActivity extends Activity {

    int mAppWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set the result to CANCELED.  This will cause the widget host to cancel
        // out of the widget placement if they press the back button.
        setResult(RESULT_CANCELED);

        setContentView(R.layout.activity_note_widget_config);

        // Find the widget id from the intent.
        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            mAppWidgetId = extras.getInt(
                    AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }

        // If they gave us an intent without the widget id, just bail.
        if (mAppWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        ListView listView = findViewById(R.id.config_notes_list);
        ArrayList<String> noteTitles = new ArrayList<>();
        
        SharedPreferences prefs = getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String notesJson = prefs.getString("notes", "[]");
        
        String lang = prefs.getString("language", "es");
        String untitledText;
        String noNotesText;

        if ("es".equals(lang)) {
            untitledText = "Nota sin título";
            noNotesText = "No hay notas disponibles";
        } else if ("zh".equals(lang)) {
            untitledText = "无标题笔记";
            noNotesText = "没有可用的笔记";
        } else if ("fr".equals(lang)) {
            untitledText = "Note sans titre";
            noNotesText = "Aucune note disponible";
        } else if ("de".equals(lang)) {
            untitledText = "Unbenannte Notiz";
            noNotesText = "Keine Notizen verfügbar";
        } else if ("pt".equals(lang)) {
            untitledText = "Nota sem título";
            noNotesText = "Nenhuma nota disponível";
        } else if ("ar".equals(lang)) {
            untitledText = "ملاحظة بدون عنوان";
            noNotesText = "لا توجد ملاحظات متاحة";
        } else if ("ja".equals(lang)) {
            untitledText = "無題のノート";
            noNotesText = "利用可能なノートはありません";
        } else if ("hi".equals(lang)) {
            untitledText = "अनाम नोट";
            noNotesText = "कोई नोट उपलब्ध नहीं है";
        } else {
            untitledText = "Untitled Note";
            noNotesText = "No notes available";
        }

        try {
            JSONArray notes = new JSONArray(notesJson);
            for (int i = 0; i < notes.length(); i++) {
                JSONObject note = notes.getJSONObject(i);
                noteTitles.add(note.optString("title", untitledText));
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }

        if (noteTitles.isEmpty()) {
            noteTitles.add(noNotesText);
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, noteTitles);
        listView.setAdapter(adapter);

        listView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                String noteId = "";
                try {
                    JSONArray notes = new JSONArray(notesJson);
                    if (position < notes.length()) {
                        JSONObject note = notes.getJSONObject(position);
                        noteId = note.optString("id", "");
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }

                // Save both index and note ID
                SharedPreferences.Editor editor = prefs.edit();
                editor.putInt("widget_note_index_" + mAppWidgetId, position);
                if (!noteId.isEmpty()) {
                    editor.putString("widget_note_id_" + mAppWidgetId, noteId);
                }
                editor.apply();

                // Update the widget
                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(NoteWidgetConfigActivity.this);
                NotesWidgetProvider.updateAppWidget(NoteWidgetConfigActivity.this, appWidgetManager, mAppWidgetId);

                // Make sure we pass back the original appWidgetId
                Intent resultValue = new Intent();
                resultValue.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, mAppWidgetId);
                setResult(RESULT_OK, resultValue);
                finish();
            }
        });
    }
}
