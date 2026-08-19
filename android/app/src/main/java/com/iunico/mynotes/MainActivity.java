package com.iunico.mynotes;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetSyncPlugin.class);
        registerPlugin(CloudAuthPlugin.class);
        super.onCreate(savedInstanceState);

        // Enable pinch-to-zoom controls
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().getSettings().setSupportZoom(true);
            bridge.getWebView().getSettings().setBuiltInZoomControls(true);
            bridge.getWebView().getSettings().setDisplayZoomControls(false);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        handleIntent(getIntent());
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
