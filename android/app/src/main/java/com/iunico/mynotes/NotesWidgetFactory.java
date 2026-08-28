package com.iunico.mynotes;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class NotesWidgetFactory implements RemoteViewsService.RemoteViewsFactory {

    private Context context;
    private int appWidgetId;
    
    private static class NoteItem {
        boolean isImage;
        boolean isChecklist;
        String noteId;
        String blockId;
        String itemId;
        boolean checked;
        String text;
        Bitmap image;
        RemoteViews customView;
        boolean hasTaskList;

        NoteItem(String text) {
            this.text = text;
        }

        NoteItem(String text, String noteId, String blockId, String itemId, boolean checked) {
            this.text = text;
            this.noteId = noteId;
            this.blockId = blockId;
            this.itemId = itemId;
            this.checked = checked;
            this.isChecklist = true;
        }

        NoteItem(Bitmap image) {
            this.image = image;
        }

        NoteItem(RemoteViews customView) {
            this.customView = customView;
        }
    }

    private volatile List<NoteItem> noteItems = new ArrayList<>();

    public NotesWidgetFactory(Context context, Intent intent) {
        this.context = context;
        this.appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
    }

    @Override
    public void onCreate() {
        loadNoteContent();
    }

    @Override
    public void onDataSetChanged() {
        loadNoteContent();
    }

    private void loadNoteContent() {
        List<NoteItem> newNoteItems = new ArrayList<>();
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String notesJson = prefs.getString("notes", "[]");
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

                // Bounds safety
                if (currentIndex >= notes.length()) {
                    currentIndex = 0;
                } else if (currentIndex < 0) {
                    currentIndex = notes.length() - 1;
                }

                // Update the index in preferences in case it shifted
                SharedPreferences.Editor editor = prefs.edit();
                editor.putInt("widget_note_index_" + appWidgetId, currentIndex);
                if (isConfigured) {
                    editor.putString("widget_note_id_" + appWidgetId, notes.getJSONObject(currentIndex).optString("id", ""));
                }
                editor.apply();

                JSONObject note = notes.getJSONObject(currentIndex);
                String noteId = note.optString("id");
                JSONArray blocks = note.optJSONArray("blocks");
                
                boolean noteHasTaskList = false;
                if (blocks != null) {
                    for (int i = 0; i < blocks.length(); i++) {
                        JSONObject block = blocks.getJSONObject(i);
                        if ("task-list".equals(block.optString("type"))) {
                            noteHasTaskList = true;
                            break;
                        }
                    }
                }

                if (blocks != null) {
                    for (int i = 0; i < blocks.length(); i++) {
                        JSONObject block = blocks.getJSONObject(i);
                        String blockId = block.optString("id");
                        String type = block.optString("type");

                        if ("text".equals(type)) {
                            String textContent = block.optString("content", "");
                            
                            // Remove list container tags
                            textContent = textContent.replaceAll("(?i)</?(ul|ol)[^>]*>", "");
                            
                            // Replace break tags with newline
                            textContent = textContent.replaceAll("(?i)<br\\s*/?>", "\n");
                            
                            // Replace block transitions </tag><tag> (with optional whitespace) with newline
                            textContent = textContent.replaceAll("(?i)</(p|div|h[1-6]|li)>\\s*<(p|div|h[1-6]|li)[^>]*>", "\n");
                            
                            // Replace remaining opening/closing block tags with newline
                            textContent = textContent.replaceAll("(?i)</?(p|div|h[1-6]|li)[^>]*>", "\n");
                            
                            String[] rawLines = textContent.split("\n", -1);
                            List<String> processedLines = new ArrayList<>();
                            for (String rawLine : rawLines) {
                                String cleaned = rawLine.replace("&nbsp;", " ")
                                                        .replace("&nbsp", " ")
                                                        .replace("\u00A0", " ");
                                processedLines.add(cleaned);
                            }
                            
                            boolean lastWasEmpty = true; // Start with true to skip leading empty lines
                            
                            for (int j = 0; j < processedLines.size(); j++) {
                                String line = processedLines.get(j);
                                String trimmedLine = line.trim();
                                
                                if (trimmedLine.isEmpty()) {
                                    if (lastWasEmpty) {
                                        continue;
                                    }
                                    
                                    boolean hasMoreContent = false;
                                    for (int k = j + 1; k < processedLines.size(); k++) {
                                        if (!processedLines.get(k).trim().isEmpty()) {
                                            hasMoreContent = true;
                                            break;
                                        }
                                    }
                                    
                                    if (hasMoreContent) {
                                        NoteItem item = new NoteItem("\u00A0");
                                        item.noteId = noteId;
                                        item.blockId = blockId;
                                        item.hasTaskList = noteHasTaskList;
                                        newNoteItems.add(item);
                                        lastWasEmpty = true;
                                    }
                                } else {
                                    NoteItem item = new NoteItem(trimmedLine);
                                    item.noteId = noteId;
                                    item.blockId = blockId;
                                    item.hasTaskList = noteHasTaskList;
                                    newNoteItems.add(item);
                                    lastWasEmpty = false;
                                }
                            }
                        } else if ("task-list".equals(type)) {
                            JSONArray items = null;
                            String listTitle = "";
                            JSONObject contentObj = block.optJSONObject("content");
                            if (contentObj != null) {
                                listTitle = contentObj.optString("title", "");
                                items = contentObj.optJSONArray("items");
                            } else {
                                items = block.optJSONArray("content");
                            }

                            if (listTitle != null && !listTitle.trim().isEmpty()) {
                                listTitle = listTitle.replace("&nbsp;", " ").replace("&nbsp", " ").replace("\u00A0", " ").trim();
                                NoteItem item = new NoteItem("<b>" + listTitle + "</b>");
                                item.noteId = noteId;
                                item.blockId = blockId;
                                item.hasTaskList = noteHasTaskList;
                                newNoteItems.add(item);
                            }

                            if (items != null) {
                                for (int j = 0; j < items.length(); j++) {
                                    JSONObject item = items.getJSONObject(j);
                                    String itemId = item.optString("id");
                                    boolean checked = item.optBoolean("checked", false);
                                    String itemText = item.optString("text", "");
                                    itemText = itemText.replace("&nbsp;", " ").replace("&nbsp", " ").replace("\u00A0", " ").trim();
                                    NoteItem noteItem = new NoteItem(itemText, noteId, blockId, itemId, checked);
                                    noteItem.hasTaskList = noteHasTaskList;
                                    newNoteItems.add(noteItem);
                                }
                            }
                        } else if ("table".equals(type)) {
                            JSONObject tableContent = block.optJSONObject("content");
                            if (tableContent != null) {
                                JSONArray headers = tableContent.optJSONArray("headers");
                                JSONArray rows = tableContent.optJSONArray("rows");
                                
                                if (headers != null && headers.length() > 0) {
                                    RemoteViews tableContainer = new RemoteViews(context.getPackageName(), R.layout.widget_note_table);
                                    
                                    RemoteViews headerRow = new RemoteViews(context.getPackageName(), R.layout.widget_table_row);
                                    for (int h = 0; h < headers.length(); h++) {
                                        RemoteViews cell = new RemoteViews(context.getPackageName(), R.layout.widget_table_header_cell);
                                        cell.setTextViewText(R.id.widget_table_cell_text, parseHtml(headers.optString(h, "").replace("&nbsp;", " ").trim()));
                                        headerRow.addView(R.id.widget_table_row, cell);
                                    }
                                    tableContainer.addView(R.id.widget_table_container, headerRow);
                                    
                                    if (rows != null) {
                                        for (int r = 0; r < rows.length(); r++) {
                                            JSONArray row = rows.optJSONArray(r);
                                            if (row != null) {
                                                RemoteViews dataRow = new RemoteViews(context.getPackageName(), R.layout.widget_table_row);
                                                for (int c = 0; c < row.length(); c++) {
                                                    RemoteViews cell = new RemoteViews(context.getPackageName(), R.layout.widget_table_cell);
                                                    cell.setTextViewText(R.id.widget_table_cell_text, parseHtml(row.optString(c, "").replace("&nbsp;", " ").trim()));
                                                    dataRow.addView(R.id.widget_table_row, cell);
                                                }
                                                tableContainer.addView(R.id.widget_table_container, dataRow);
                                            }
                                        }
                                    }
                                    NoteItem item = new NoteItem(tableContainer);
                                    item.noteId = noteId;
                                    item.blockId = blockId;
                                    item.hasTaskList = noteHasTaskList;
                                    newNoteItems.add(item);
                                }
                            }
                        } else if ("image".equals(type) || "drawing".equals(type) || "video".equals(type)) {
                            String imageContent = "";
                            if ("video".equals(type)) {
                                imageContent = block.optString("thumbnailPath", "");
                            } else {
                                imageContent = block.optString("content", "");
                            }
                            if (imageContent != null && !imageContent.isEmpty()) {
                                Bitmap bitmap = decodeBase64(imageContent);
                                if (bitmap != null) {
                                    NoteItem item = new NoteItem(bitmap);
                                    item.noteId = noteId;
                                    item.blockId = blockId;
                                    item.hasTaskList = noteHasTaskList;
                                    newNoteItems.add(item);
                                }
                            }
                        }
                    }
                }
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        noteItems = newNoteItems;
    }

    private Bitmap decodeBase64(String input) {
        try {
            if (input == null || input.isEmpty()) return null;
            Bitmap decoded = null;
            
            // Check if the input is a local file URI (from Capacitor Filesystem migration)
            if (input.startsWith("file://") || input.startsWith("/")) {
                String filePath = input;
                if (filePath.startsWith("file://")) {
                    filePath = filePath.substring(7);
                }
                decoded = android.graphics.BitmapFactory.decodeFile(filePath);
            } else {
                // Fallback for older Base64 encoded images
                if (input.startsWith("data:image")) {
                    input = input.substring(input.indexOf(",") + 1);
                }
                byte[] decodedByte = android.util.Base64.decode(input, android.util.Base64.DEFAULT);
                decoded = android.graphics.BitmapFactory.decodeByteArray(decodedByte, 0, decodedByte.length);
            }
            
            if (decoded != null) {
                float density = context.getResources().getDisplayMetrics().density;
                return getRoundedCornerBitmap(decoded, 5f, density);
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private Bitmap getRoundedCornerBitmap(Bitmap bitmap, float radiusDp, float density) {
        float radiusPx = radiusDp * density;
        Bitmap output = android.graphics.Bitmap.createBitmap(
            bitmap.getWidth(), bitmap.getHeight(), android.graphics.Bitmap.Config.ARGB_8888
        );
        android.graphics.Canvas canvas = new android.graphics.Canvas(output);

        android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        android.graphics.RectF rectF = new android.graphics.RectF(0, 0, bitmap.getWidth(), bitmap.getHeight());

        canvas.drawRoundRect(rectF, radiusPx, radiusPx, paint);
        paint.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, 0, 0, paint);

        return output;
    }

    @Override
    public void onDestroy() {
        noteItems = new ArrayList<>();
    }

    @Override
    public int getCount() {
        return noteItems.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        List<NoteItem> localList = noteItems;
        if (position >= localList.size()) return null;

        NoteItem item = localList.get(position);
        
        if (item.customView != null) {
            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("click_type", "open_app");
            fillInIntent.putExtra("note_id", item.noteId);
            fillInIntent.putExtra("block_id", item.blockId);
            fillInIntent.putExtra("has_task_list", item.hasTaskList);
            item.customView.setOnClickFillInIntent(R.id.widget_table_container, fillInIntent);
            return item.customView;
        }

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_note_item);

        if (item.image != null) {
            rv.setImageViewBitmap(R.id.widget_note_item_image, item.image);
            rv.setViewVisibility(R.id.widget_note_item_image, View.VISIBLE);
            rv.setViewVisibility(R.id.widget_note_item_text, View.GONE);
            rv.setViewVisibility(R.id.widget_note_item_checklist_container, View.GONE);
            
            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("click_type", "open_app");
            fillInIntent.putExtra("note_id", item.noteId);
            fillInIntent.putExtra("block_id", item.blockId);
            fillInIntent.putExtra("has_task_list", item.hasTaskList);
            rv.setOnClickFillInIntent(R.id.widget_note_item_image, fillInIntent);
        } else if (item.isChecklist) {
            rv.setViewVisibility(R.id.widget_note_item_image, View.GONE);
            rv.setViewVisibility(R.id.widget_note_item_text, View.GONE);
            rv.setViewVisibility(R.id.widget_note_item_checklist_container, View.VISIBLE);
            rv.setTextViewText(R.id.widget_note_item_checklist_text, parseHtml(item.text));
            
            if (item.checked) {
                rv.setImageViewResource(R.id.widget_note_item_checkbox, R.drawable.ic_check_box_checked);
            } else {
                rv.setImageViewResource(R.id.widget_note_item_checkbox, R.drawable.ic_check_box_outline);
            }

            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("click_type", "checklist");
            fillInIntent.putExtra("note_id", item.noteId);
            fillInIntent.putExtra("block_id", item.blockId);
            fillInIntent.putExtra("item_id", item.itemId);
            fillInIntent.putExtra("checked", item.checked);
            fillInIntent.putExtra("has_task_list", item.hasTaskList);
            fillInIntent.putExtra("text", item.text);
            rv.setOnClickFillInIntent(R.id.widget_note_item_checklist_container, fillInIntent);
        } else {
            rv.setTextViewText(R.id.widget_note_item_text, parseHtml(item.text));
            rv.setViewVisibility(R.id.widget_note_item_text, View.VISIBLE);
            rv.setViewVisibility(R.id.widget_note_item_image, View.GONE);
            rv.setViewVisibility(R.id.widget_note_item_checklist_container, View.GONE);
            
            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("click_type", "open_app");
            fillInIntent.putExtra("note_id", item.noteId);
            fillInIntent.putExtra("block_id", item.blockId);
            fillInIntent.putExtra("has_task_list", item.hasTaskList);
            fillInIntent.putExtra("text", item.text);
            rv.setOnClickFillInIntent(R.id.widget_note_item_text, fillInIntent);
        }


        return rv;
    }

    private CharSequence parseHtml(String htmlText) {
        if (htmlText == null) return "";
        if (htmlText.equals("\u00A0")) return "\u00A0";
        String plainText = htmlText;

        // Convert style-based bold/italic/underline safely by wrapping content for Android Compatibility (supporting single and double quotes)
        plainText = plainText.replaceAll("(?is)<span([^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:font-weight:\\s*(?:bold|700))[^\\\"']*[\\\"'][^>]*)>(.*?)</span>", "<span$1><b>$2</b></span>");
        plainText = plainText.replaceAll("(?is)<span([^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:font-style:\\s*italic)[^\\\"']*[\\\"'][^>]*)>(.*?)</span>", "<span$1><i>$2</i></span>");
        plainText = plainText.replaceAll("(?is)<span([^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:text-decoration:\\s*underline)[^\\\"']*[\\\"'][^>]*)>(.*?)</span>", "<span$1><u>$2</u></span>");

        // Dynamically detect dark mode by checking SharedPreferences first, falling back to system configuration
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        boolean defaultDarkMode = (context.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        String isDarkModePref = prefs.getString("isDarkMode", null);
        boolean isDarkMode = isDarkModePref != null ? "true".equals(isDarkModePref) : defaultDarkMode;

        if (isDarkMode) {
            // Neon glow highlights for dark mode (using solid dark background colors because Android's Html.fromHtml
            // forces background color alpha to 100% via 'c | 0xFF000000', along with bright neon text colors)
            // 1. Yellow: rgb(254, 240, 138) or #fef08a -> Background: solid dark gold/yellow (#403500)
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*254\\s*[,\\s]\\s*240\\s*[,\\s]\\s*138\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#fef08a)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#403500;\"><font color=\"#FEF08A\"><b>$2</b></font></span>");
            // 2. Green: rgb(187, 247, 208) or #bbf7d0 -> Background: solid dark green (#0F4020)
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*187\\s*[,\\s]\\s*247\\s*[,\\s]\\s*208\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#bbf7d0)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#0F4020;\"><font color=\"#4ADE80\"><b>$2</b></font></span>");
            // 3. Blue: rgb(191, 219, 254) or #bfdbfe -> Background: solid dark blue (#10305C)
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*191\\s*[,\\s]\\s*219\\s*[,\\s]\\s*254\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#bfdbfe)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#10305C;\"><font color=\"#60A5FA\"><b>$2</b></font></span>");
            // 4. Red: rgb(254, 202, 202) or #fecaca -> Background: solid dark red (#4D1515)
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*254\\s*[,\\s]\\s*202\\s*[,\\s]\\s*202\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#fecaca)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#4D1515;\"><font color=\"#F87171\"><b>$2</b></font></span>");
            // 5. Purple: rgb(233, 213, 255) or #e9d5ff -> Background: solid dark purple (#2D154D)
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*233\\s*[,\\s]\\s*213\\s*[,\\s]\\s*255\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#e9d5ff)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#2D154D;\"><font color=\"#C084FC\"><b>$2</b></font></span>");

            // Also handle <mark> tags (usually yellow by default) -> Background: solid dark gold/yellow (#403500)
            plainText = plainText.replaceAll("(?is)<mark[^>]*>(.*?)</mark>",
                                             "<span style=\"background-color:#403500;\"><font color=\"#FEF08A\"><b>$1</b></font></span>");
        } else {
            // High contrast readable highlights for light mode (solid background and dark text color, quote-safe)
            // 1. Yellow
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*254\\s*[,\\s]\\s*240\\s*[,\\s]\\s*138\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#fef08a)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#FEF08A;\"><font color=\"#0F172A\"><b>$2</b></font></span>");
            // 2. Green
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*187\\s*[,\\s]\\s*247\\s*[,\\s]\\s*208\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#bbf7d0)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#BBF7D0;\"><font color=\"#0F172A\"><b>$2</b></font></span>");
            // 3. Blue
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*191\\s*[,\\s]\\s*219\\s*[,\\s]\\s*254\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#bfdbfe)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#BFDBFE;\"><font color=\"#0F172A\"><b>$2</b></font></span>");
            // 4. Red
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*254\\s*[,\\s]\\s*202\\s*[,\\s]\\s*202\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#fecaca)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#FECACA;\"><font color=\"#0F172A\"><b>$2</b></font></span>");
            // 5. Purple
            plainText = plainText.replaceAll("(?is)<(span|font)[^>]*style\\s*=\\s*[\\\"'][^\\\"']*(?:background-color|background)\\s*:\\s*(?:rgba?\\(\\s*233\\s*[,\\s]\\s*213\\s*[,\\s]\\s*255\\s*(?:[,/]\\s*[\\d.]+\\s*)?\\)|#e9d5ff)[^\\\"']*[\\\"'][^>]*>(.*?)</\\1>",
                                             "<span style=\"background-color:#E9D5FF;\"><font color=\"#0F172A\"><b>$2</b></font></span>");

            // Also handle <mark> tags (usually yellow by default)
            plainText = plainText.replaceAll("(?is)<mark[^>]*>(.*?)</mark>",
                                             "<span style=\"background-color:#FEF08A;\"><font color=\"#0F172A\"><b>$1</b></font></span>");
        }

        // Standardize common HTML tags
        plainText = plainText.replaceAll("(?i)<strong[^>]*>", "<b>").replaceAll("(?i)</strong>", "</b>");
        plainText = plainText.replaceAll("(?i)<em[^>]*>", "<i>").replaceAll("(?i)</em>", "</i>");
        plainText = plainText.replace("&nbsp;", " ").replace("&nbsp", " ").replace("\u00A0", " ").trim();

        // Convert plain text URLs to <a> tags
        plainText = linkifyTextInJava(plainText);

        if (plainText.contains("<") && plainText.contains(">")) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                return android.text.Html.fromHtml(plainText, android.text.Html.FROM_HTML_MODE_LEGACY);
            } else {
                return android.text.Html.fromHtml(plainText);
            }
        }
        return plainText;
    }

    private String linkifyTextInJava(String text) {
        if (text == null) return "";
        if (text.contains("<a ") || text.contains("<a\t") || text.contains("<a>")) {
            return text;
        }
        return text.replaceAll("https?://[^\\s<\"']+", "<a href=\"$0\">$0</a>");
    }




    @Override
    public RemoteViews getLoadingView() {
        return null;
    }

    @Override
    public int getViewTypeCount() {
        return 1;
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public boolean hasStableIds() {
        return true;
    }
}
