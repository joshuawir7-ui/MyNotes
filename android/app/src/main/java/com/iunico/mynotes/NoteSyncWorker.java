package com.iunico.mynotes;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class NoteSyncWorker extends Worker {

    private static final String TAG = "NoteSyncWorker";

    public NoteSyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Starting background sync to Google Drive...");
        Context context = getApplicationContext();

        SharedPreferences prefs = context.getSharedPreferences("CloudSync", Context.MODE_PRIVATE);
        String token = prefs.getString("googleToken", null);

        if (token == null || token.isEmpty()) {
            Log.e(TAG, "No Google Token found.");
            return Result.failure();
        }

        File file = new File(context.getFilesDir(), "cloud_sync_payload.json");
        if (!file.exists()) {
            Log.e(TAG, "No payload file found.");
            return Result.failure();
        }

        try {
            // Read payload
            FileInputStream fis = new FileInputStream(file);
            BufferedReader reader = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();
            String jsonPayload = sb.toString();

            // PARSE JSON and UPLOAD IMAGES
            JSONObject payload = new JSONObject(jsonPayload);
            JSONArray notes = payload.optJSONArray("notes");
            String folderId = null;

            if (notes != null) {
                for (int i = 0; i < notes.length(); i++) {
                    JSONObject note = notes.getJSONObject(i);
                    JSONArray blocks = note.optJSONArray("blocks");
                    if (blocks != null) {
                        for (int j = 0; j < blocks.length(); j++) {
                            JSONObject block = blocks.getJSONObject(j);
                            String type = block.optString("type");
                            if ("image".equals(type) || "drawing".equals(type)) {
                                String driveFileId = block.optString("driveFileId", null);
                                String content = block.optString("content", null);
                                
                                if ((driveFileId == null || driveFileId.isEmpty()) && content != null && content.startsWith("file://")) {
                                    if (folderId == null) {
                                        folderId = getOrCreateImagesFolder(token);
                                    }
                                    Log.d(TAG, "Uploading missing image for block: " + block.optString("id"));
                                    String uploadedId = uploadImageToDrive(content, token, folderId);
                                    if (uploadedId != null) {
                                        block.put("driveFileId", uploadedId);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            jsonPayload = payload.toString();

            // 1. Search for existing file
            URL searchUrl = new URL("https://www.googleapis.com/drive/v3/files?q=name='mynotes_backup.json'+and+trashed=false");
            HttpURLConnection searchConn = (HttpURLConnection) searchUrl.openConnection();
            searchConn.setRequestMethod("GET");
            searchConn.setRequestProperty("Authorization", "Bearer " + token);

            int searchCode = searchConn.getResponseCode();
            if (searchCode != 200) {
                Log.e(TAG, "Failed to search Drive: " + searchCode);
                return Result.retry();
            }

            BufferedReader searchReader = new BufferedReader(new InputStreamReader(searchConn.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder searchSb = new StringBuilder();
            while ((line = searchReader.readLine()) != null) {
                searchSb.append(line);
            }
            searchReader.close();

            JSONObject searchResult = new JSONObject(searchSb.toString());
            JSONArray filesArray = searchResult.optJSONArray("files");
            String existingFileId = null;

            if (filesArray != null && filesArray.length() > 0) {
                existingFileId = filesArray.getJSONObject(0).optString("id", null);
            }

            if (existingFileId != null) {
                // UPDATE (PATCH)
                Log.d(TAG, "File found. Updating (PATCH)...");
                URL updateUrl = new URL("https://www.googleapis.com/upload/drive/v3/files/" + existingFileId + "?uploadType=media");
                HttpURLConnection updateConn = (HttpURLConnection) updateUrl.openConnection();
                updateConn.setRequestMethod("PATCH");
                updateConn.setRequestProperty("Authorization", "Bearer " + token);
                updateConn.setRequestProperty("Content-Type", "application/json");
                updateConn.setDoOutput(true);

                byte[] out = jsonPayload.getBytes(StandardCharsets.UTF_8);
                updateConn.setFixedLengthStreamingMode(out.length);
                OutputStream os = updateConn.getOutputStream();
                os.write(out);
                os.close();

                int updateCode = updateConn.getResponseCode();
                if (updateCode >= 200 && updateCode < 300) {
                    Log.d(TAG, "Update successful!");
                    file.delete();
                    return Result.success();
                } else {
                    Log.e(TAG, "Update failed: " + updateCode);
                    return Result.retry();
                }

            } else {
                // CREATE (POST multipart)
                Log.d(TAG, "File not found. Creating (POST multipart)...");
                String boundary = "foo_bar_baz";
                URL createUrl = new URL("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
                HttpURLConnection createConn = (HttpURLConnection) createUrl.openConnection();
                createConn.setRequestMethod("POST");
                createConn.setRequestProperty("Authorization", "Bearer " + token);
                createConn.setRequestProperty("Content-Type", "multipart/related; boundary=" + boundary);
                createConn.setDoOutput(true);

                String metadata = "{\"name\":\"mynotes_backup.json\",\"mimeType\":\"application/json\"}";
                
                StringBuilder body = new StringBuilder();
                body.append("\r\n--").append(boundary).append("\r\n");
                body.append("Content-Type: application/json; charset=UTF-8\r\n\r\n");
                body.append(metadata).append("\r\n");
                
                body.append("--").append(boundary).append("\r\n");
                body.append("Content-Type: application/json\r\n\r\n");
                body.append(jsonPayload).append("\r\n");
                
                body.append("--").append(boundary).append("--");

                byte[] out = body.toString().getBytes(StandardCharsets.UTF_8);
                createConn.setFixedLengthStreamingMode(out.length);
                OutputStream os = createConn.getOutputStream();
                os.write(out);
                os.close();

                int createCode = createConn.getResponseCode();
                if (createCode >= 200 && createCode < 300) {
                    Log.d(TAG, "Create successful!");
                    file.delete();
                    return Result.success();
                } else {
                    Log.e(TAG, "Create failed: " + createCode);
                    return Result.retry();
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Exception during sync", e);
            return Result.retry();
        }
    }
    
    private String getOrCreateImagesFolder(String token) {
        try {
            URL searchUrl = new URL("https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'+and+name='MyNotes_Images'+and+trashed=false");
            HttpURLConnection searchConn = (HttpURLConnection) searchUrl.openConnection();
            searchConn.setRequestMethod("GET");
            searchConn.setRequestProperty("Authorization", "Bearer " + token);
            
            if (searchConn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(searchConn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                
                JSONObject res = new JSONObject(sb.toString());
                JSONArray files = res.optJSONArray("files");
                if (files != null && files.length() > 0) {
                    return files.getJSONObject(0).optString("id", null);
                }
            }

            URL createUrl = new URL("https://www.googleapis.com/drive/v3/files");
            HttpURLConnection createConn = (HttpURLConnection) createUrl.openConnection();
            createConn.setRequestMethod("POST");
            createConn.setRequestProperty("Authorization", "Bearer " + token);
            createConn.setRequestProperty("Content-Type", "application/json");
            createConn.setDoOutput(true);
            
            String metadata = "{\"name\":\"MyNotes_Images\",\"mimeType\":\"application/vnd.google-apps.folder\"}";
            OutputStream os = createConn.getOutputStream();
            os.write(metadata.getBytes(StandardCharsets.UTF_8));
            os.close();
            
            if (createConn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(createConn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                
                JSONObject res = new JSONObject(sb.toString());
                return res.optString("id", null);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting or creating images folder", e);
        }
        return null;
    }
    
    private String uploadImageToDrive(String fileUri, String token, String folderId) {
        try {
            String path = fileUri.replace("file://", "");
            File imageFile = new File(path);
            if (!imageFile.exists()) {
                Log.e(TAG, "Image file does not exist: " + path);
                return null;
            }

            String boundary = "image_upload_boundary_" + System.currentTimeMillis();
            URL createUrl = new URL("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
            HttpURLConnection conn = (HttpURLConnection) createUrl.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "multipart/related; boundary=" + boundary);
            conn.setDoOutput(true);

            String mimeType = "image/jpeg";
            if (path.endsWith(".png")) mimeType = "image/png";
            
            String metadata = "{\"name\":\"" + imageFile.getName() + "\",\"mimeType\":\"" + mimeType + "\"";
            if (folderId != null) {
                metadata += ",\"parents\":[\"" + folderId + "\"]";
            }
            metadata += "}";

            OutputStream os = conn.getOutputStream();
            
            String header = "\r\n--" + boundary + "\r\n" +
                            "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
                            metadata + "\r\n" +
                            "--" + boundary + "\r\n" +
                            "Content-Type: " + mimeType + "\r\n\r\n";
                            
            os.write(header.getBytes(StandardCharsets.UTF_8));
            
            FileInputStream fis = new FileInputStream(imageFile);
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                os.write(buffer, 0, bytesRead);
            }
            fis.close();
            
            String footer = "\r\n--" + boundary + "--";
            os.write(footer.getBytes(StandardCharsets.UTF_8));
            os.close();

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                
                JSONObject res = new JSONObject(sb.toString());
                return res.optString("id", null);
            } else {
                Log.e(TAG, "Image upload failed with code: " + code);
            }
        } catch (Exception e) {
            Log.e(TAG, "Exception uploading image", e);
        }
        return null;
    }
}
