package com.djscratch;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    private static final String GITHUB_API = "https://api.github.com/repos/GamerNation12/DJ-Scratch/releases/latest";
    private static final String APK_URL = "https://github.com/GamerNation12/DJ-Scratch/releases/download/v2.21/DJ-Scratch-mobile-v2.21.apk";
    private static final String NOTIFICATION_CHANNEL_ID = "djscratch_update";
    private static final int NOTIFICATION_ID = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Check for updates on app start
        new UpdateCheckTask(this).execute();
    }

    private static class UpdateCheckTask extends AsyncTask<Void, Void, String> {
        private final MainActivity activity;

        UpdateCheckTask(MainActivity activity) {
            this.activity = activity;
        }

        @Override
        protected String doInBackground(Void... voids) {
            try {
                URL url = new URL(GITHUB_API);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                int responseCode = conn.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    InputStream input = conn.getInputStream();
                    BufferedReader reader = new BufferedReader(new InputStreamReader(input));
                    StringBuilder result = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        result.append(line);
                    }
                    reader.close();
                    conn.disconnect();
                    return result.toString();
                }
                conn.disconnect();
            } catch (Exception e) {
                e.printStackTrace();
            }
            return null;
        }

        @Override
        protected void onPostExecute(String json) {
            super.onPostExecute(json);
            if (json != null) {
                try {
                    // Parse tag_name from JSON
                    String tagName = extractJsonValue(json, "tag_name");
                    if (tagName != null && !tagName.equals("v2.21")) {
                        activity.showUpdateNotification(tagName);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    private static String extractJsonValue(String json, String key) {
        String searchKey = "\"" + key + "\"";
        int index = json.indexOf(searchKey);
        if (index == -1) return null;
        int colonIndex = json.indexOf(":", index);
        if (colonIndex == -1) return null;
        int valueStart = colonIndex + 1;
        // Skip whitespace
        while (valueStart < json.length() && (json.charAt(valueStart) == ' ' || json.charAt(valueStart) == '\t')) {
            valueStart++;
        }
        if (valueStart < json.length() && json.charAt(valueStart) == '"') {
            valueStart++;
            int valueEnd = json.indexOf("\"", valueStart);
            if (valueEnd == -1) return null;
            return json.substring(valueStart, valueEnd);
        }
        return null;
    }

    private void showUpdateNotification(String newVersion) {
        // Create notification channel (required for Android 8+)
        createNotificationChannel();

        // Download and install intent
        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(Uri.parse(APK_URL), "application/vnd.android.package-archive");
        installIntent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                installIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_CANCEL_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("DJ Scratch Update Available")
                .setContentText("Version " + newVersion + " is ready to install")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID, builder.build());

        Toast.makeText(this, "New version " + newVersion + " available! Check notifications.", Toast.LENGTH_LONG).show();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "DJ Scratch Updates";
            String description = "Notifications for app updates";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(NOTIFICATION_CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.enableVibration(true);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }
}
