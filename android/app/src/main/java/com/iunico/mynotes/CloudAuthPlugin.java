package com.iunico.mynotes;

import android.content.Context;
import android.util.Log;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "CloudAuth")
public class CloudAuthPlugin extends Plugin {

    private static final String TAG = "CloudAuthPlugin";
    // Si tu tipo de cliente en Google Cloud Console es Web y tienes un Secret, colócalo aquí. 
    // De lo contrario, para clientes de Android, se deja vacío.
    private static final String GOOGLE_CLIENT_ID = "309899943436-gp6o1oaqpij5qq6sal77f6dr15lh61fp.apps.googleusercontent.com";
    private static final String GOOGLE_CLIENT_SECRET = ""; 

    @PluginMethod
    public void exchangeAndSaveTokens(PluginCall call) {
        String authCode = call.getString("authCode");
        if (authCode == null) {
            call.reject("authCode is required");
            return;
        }

        new Thread(() -> {
            try {
                URL url = new URL("https://oauth2.googleapis.com/token");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                conn.setDoOutput(true);

                StringBuilder params = new StringBuilder();
                params.append("client_id=").append(URLEncoder.encode(GOOGLE_CLIENT_ID, "UTF-8"));
                if (!GOOGLE_CLIENT_SECRET.isEmpty()) {
                    params.append("&client_secret=").append(URLEncoder.encode(GOOGLE_CLIENT_SECRET, "UTF-8"));
                }
                params.append("&grant_type=authorization_code");
                params.append("&code=").append(URLEncoder.encode(authCode, "UTF-8"));
                // El redirect_uri suele ser vacío o igual al bundleId para apps instaladas según la config.
                params.append("&redirect_uri=").append(URLEncoder.encode("", "UTF-8"));

                byte[] out = params.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(out.length);
                OutputStream os = conn.getOutputStream();
                os.write(out);
                os.close();

                int code = conn.getResponseCode();
                BufferedReader reader;
                if (code >= 200 && code < 300) {
                    reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                } else {
                    reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8));
                }
                
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();

                if (code >= 200 && code < 300) {
                    JSONObject res = new JSONObject(sb.toString());
                    String refreshToken = res.optString("refresh_token", null);
                    String accessToken = res.optString("access_token", null);
                    long expiresIn = res.optLong("expires_in", 3600);
                    
                    if (refreshToken != null) {
                        saveTokens(getContext(), refreshToken, accessToken, System.currentTimeMillis() + (expiresIn * 1000));
                        call.resolve();
                    } else {
                        Log.e(TAG, "No refresh_token returned. Payload: " + sb.toString());
                        // Puede que ya tuvieras el refresh token de una sesión previa que no se revocó, 
                        // si es así Google no manda uno nuevo a menos que se fuerce prompt=consent.
                        call.reject("No refresh_token returned. Did you prompt consent?");
                    }
                } else {
                    Log.e(TAG, "Failed to exchange tokens: " + sb.toString());
                    call.reject("Failed to exchange tokens: " + sb.toString());
                }

            } catch (Exception e) {
                Log.e(TAG, "Error exchanging tokens", e);
                call.reject("Error exchanging tokens: " + e.getMessage());
            }
        }).start();
    }

    public static void saveTokens(Context context, String refreshToken, String accessToken, long expiryTime) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();

            android.content.SharedPreferences encryptedPrefs = EncryptedSharedPreferences.create(
                    context,
                    "secure_auth_prefs",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );

            encryptedPrefs.edit()
                    .putString("google_refresh_token", refreshToken)
                    .putString("google_access_token", accessToken)
                    .putLong("google_token_expiry", expiryTime)
                    .apply();
            
            // Retrocompatibilidad con el JS/Capacitor viejo
            context.getSharedPreferences("CloudSync", Context.MODE_PRIVATE)
                    .edit()
                    .putString("googleToken", accessToken)
                    .apply();
            Log.d(TAG, "Tokens saved securely");
        } catch (Exception e) {
            Log.e(TAG, "Error saving to EncryptedSharedPreferences", e);
        }
    }
}
