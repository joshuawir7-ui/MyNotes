package com.iunico.mynotes;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;

public class ImageDownloadWorker extends Worker {

    private static final String TAG = "ImageDownloadWorker";

    public ImageDownloadWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Starting Image Download Worker...");
        Context context = getApplicationContext();

        String driveFileId = getInputData().getString("driveFileId");
        String noteId = getInputData().getString("noteId");
        String blockId = getInputData().getString("blockId");

        if (driveFileId == null || driveFileId.isEmpty()) {
            Log.e(TAG, "No driveFileId provided.");
            return Result.failure();
        }

        String token = getFreshAccessToken(context);

        if (token == null || token.isEmpty()) {
            Log.e(TAG, "No valid Google Token found or failed to refresh.");
            return Result.failure();
        }

        try {
            URL url = new URL("https://www.googleapis.com/drive/v3/files/" + driveFileId + "?alt=media");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);

            int code = conn.getResponseCode();
            if (code == 200) {
                // Determine file extension
                String fileName = "img_" + driveFileId + ".jpg"; // default
                String contentType = conn.getContentType();
                if (contentType != null && contentType.contains("png")) {
                    fileName = "img_" + driveFileId + ".png";
                }

                File outFile = new File(context.getFilesDir(), fileName);
                
                InputStream is = conn.getInputStream();
                FileOutputStream fos = new FileOutputStream(outFile);
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    fos.write(buffer, 0, bytesRead);
                }
                fos.close();
                is.close();

                String localUri = "file://" + outFile.getAbsolutePath();
                Log.d(TAG, "Image downloaded to " + localUri);

                // Notify UI via Broadcast
                Intent intent = new Intent("com.iunico.mynotes.IMAGE_DOWNLOADED");
                intent.putExtra("driveFileId", driveFileId);
                intent.putExtra("noteId", noteId);
                intent.putExtra("blockId", blockId);
                intent.putExtra("localUri", localUri);
                // Send broadcast targeting our app specifically
                intent.setPackage(context.getPackageName());
                context.sendBroadcast(intent);

                Data outputData = new Data.Builder()
                        .putString("localUri", localUri)
                        .build();

                return Result.success(outputData);
            } else {
                Log.e(TAG, "Failed to download image: " + code);
                return Result.retry();
            }

        } catch (Exception e) {
            Log.e(TAG, "Exception during image download", e);
            return Result.retry();
        }
    }

    private String getFreshAccessToken(Context context) {
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

            String accessToken = encryptedPrefs.getString("google_access_token", null);
            String refreshToken = encryptedPrefs.getString("google_refresh_token", null);
            long expiryTime = encryptedPrefs.getLong("google_token_expiry", 0);

            if (accessToken != null && System.currentTimeMillis() < (expiryTime - 5 * 60 * 1000)) {
                return accessToken;
            }

            if (refreshToken == null) {
                return null;
            }

            Log.d(TAG, "Token expired or expiring soon. Refreshing natively...");
            return refreshGoogleAccessToken(context, encryptedPrefs, refreshToken);

        } catch (Exception e) {
            Log.e(TAG, "Error accessing EncryptedSharedPreferences", e);
            return null;
        }
    }

    private String refreshGoogleAccessToken(Context context, android.content.SharedPreferences encryptedPrefs, String refreshToken) {
        try {
            URL url = new URL("https://oauth2.googleapis.com/token");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setDoOutput(true);

            String clientId = "309899943436-gp6o1oaqpij5qq6sal77f6dr15lh61fp.apps.googleusercontent.com";
            String clientSecret = ""; // Agrega si tienes

            StringBuilder params = new StringBuilder();
            params.append("client_id=").append(URLEncoder.encode(clientId, "UTF-8"));
            if (!clientSecret.isEmpty()) {
                params.append("&client_secret=").append(URLEncoder.encode(clientSecret, "UTF-8"));
            }
            params.append("&refresh_token=").append(URLEncoder.encode(refreshToken, "UTF-8"));
            params.append("&grant_type=refresh_token");

            byte[] out = params.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(out.length);
            OutputStream os = conn.getOutputStream();
            os.write(out);
            os.close();

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();

                JSONObject res = new JSONObject(sb.toString());
                String newAccessToken = res.optString("access_token", null);
                long expiresIn = res.optLong("expires_in", 3600);

                if (newAccessToken != null) {
                    encryptedPrefs.edit()
                            .putString("google_access_token", newAccessToken)
                            .putLong("google_token_expiry", System.currentTimeMillis() + (expiresIn * 1000))
                            .apply();
                    
                    context.getSharedPreferences("CloudSync", Context.MODE_PRIVATE)
                            .edit()
                            .putString("googleToken", newAccessToken)
                            .apply();

                    Log.d(TAG, "Token refreshed successfully");
                    return newAccessToken;
                }
            } else {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8));
                StringBuilder errorSb = new StringBuilder();
                String errorLine;
                while ((errorLine = errorReader.readLine()) != null) errorSb.append(errorLine);
                errorReader.close();
                Log.e(TAG, "Failed to refresh token: " + errorSb.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "Exception during token refresh", e);
        }
        return null;
    }
}
