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

        SharedPreferences prefs = context.getSharedPreferences("CloudSync", Context.MODE_PRIVATE);
        String token = prefs.getString("googleToken", null);

        if (token == null || token.isEmpty()) {
            Log.e(TAG, "No Google Token found.");
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
}
