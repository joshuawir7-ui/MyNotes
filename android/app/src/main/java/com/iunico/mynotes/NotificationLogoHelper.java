package com.iunico.mynotes;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;

/**
 * Renders the brand "n" glyph using the real Dancing Script font (.ttf) via
 * Android's Canvas API, producing a pixel-perfect Bitmap — NOT an AI
 * approximation.
 *
 * The resulting Bitmap is intended for use with RemoteViews.setImageViewBitmap()
 * inside notification layouts where a dynamic Typeface cannot be applied directly.
 *
 * Usage:
 *   Bitmap logo = NotificationLogoHelper.renderLogo(context);
 *   if (logo != null) {
 *       remoteViews.setImageViewBitmap(R.id.notification_logo, logo);
 *   }
 *   // If null, the static @drawable/ic_notification_logo fallback in the XML is used.
 */
public final class NotificationLogoHelper {

    private static final String TAG = "NotificationLogoHelper";

    /** Asset path relative to the assets/ root. */
    private static final String FONT_ASSET_PATH = "fonts/dancing_script.ttf";

    /** Text size in pixels for the notification logo glyph. */
    private static final float TEXT_SIZE_PX = 72f;

    /** Padding (px) around the glyph so descenders / ascenders are not clipped. */
    private static final int PADDING_PX = 8;

    /**
     * Cached Typeface. Loaded once per process; never replaced with a fallback
     * so that any loading failure stays detectable via {@link #sTypefaceLoadFailed}.
     */
    private static volatile Typeface sCachedTypeface = null;
    private static volatile boolean  sTypefaceLoadFailed = false;

    private NotificationLogoHelper() { /* utility class */ }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Returns a Bitmap of the "n" glyph rendered in Dancing Script, or
     * {@code null} if the font asset cannot be loaded (failure is logged to
     * Logcat so it is never silent).
     *
     * The Bitmap uses {@link Bitmap.Config#ARGB_8888} with a transparent
     * background, matching the white-on-transparent style expected by the
     * notification layout.
     *
     * @param context Any context — only used to access assets.
     * @return Bitmap, or null on font-load failure.
     */
    public static Bitmap renderLogo(Context context) {
        boolean isNight = (context.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        int color = isNight ? Color.WHITE : Color.BLACK;
        return renderTextToBitmap(context, "n", TEXT_SIZE_PX, color);
    }

    /**
     * General-purpose text-to-bitmap renderer using Dancing Script.
     *
     * @param context      Any context.
     * @param text         The string to render (typically "n").
     * @param textSizePx   Desired text size in pixels.
     * @param color        Text color (e.g. {@link Color#BLACK}).
     * @return Bitmap, or null if the font asset failed to load.
     */
    public static Bitmap renderTextToBitmap(Context context,
                                             String text,
                                             float textSizePx,
                                             int color) {
        Typeface typeface = getTypeface(context);
        if (typeface == null) {
            // Failure already logged inside getTypeface().
            return null;
        }

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setTypeface(typeface);
        paint.setTextSize(textSizePx);
        paint.setColor(color);
        paint.setStyle(Paint.Style.FILL);

        // Measure the glyph's exact bounding box.
        Rect bounds = new Rect();
        paint.getTextBounds(text, 0, text.length(), bounds);

        int width  = bounds.width()  + PADDING_PX * 2;
        int height = bounds.height() + PADDING_PX * 2;

        if (width <= 0 || height <= 0) {
            android.util.Log.e(TAG, "Glyph bounds are zero — text may be empty.");
            return null;
        }

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        // ARGB_8888 with no background fill → transparent by default.

        Canvas canvas = new Canvas(bitmap);
        // Offset so the glyph top-left aligns with the padding.
        canvas.drawText(text, PADDING_PX - bounds.left, PADDING_PX - bounds.top, paint);

        android.util.Log.d(TAG,
            "Logo bitmap rendered from real Dancing Script font: "
            + width + "×" + height + "px");

        return bitmap;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * Returns the cached Dancing Script Typeface, loading it from assets on
     * the first call. If loading fails, logs an explicit error and returns
     * {@code null} — it will NOT silently fall back to the system default
     * Typeface (which would produce the wrong glyph rendering).
     */
    private static Typeface getTypeface(Context context) {
        if (sTypefaceLoadFailed) {
            // Already failed previously; avoid retrying on every call.
            return null;
        }

        if (sCachedTypeface != null) {
            return sCachedTypeface;
        }

        // Double-checked locking — safe because Typeface creation is idempotent.
        synchronized (NotificationLogoHelper.class) {
            if (sCachedTypeface != null) return sCachedTypeface;
            if (sTypefaceLoadFailed)    return null;

            try {
                Typeface tf = Typeface.createFromAsset(
                    context.getApplicationContext().getAssets(),
                    FONT_ASSET_PATH
                );
                // createFromAsset() never returns null — it throws on failure.
                sCachedTypeface = tf;
                android.util.Log.d(TAG,
                    "Dancing Script loaded from assets/" + FONT_ASSET_PATH);
            } catch (Exception e) {
                sTypefaceLoadFailed = true;
                // EXPLICIT failure log — never silent.
                android.util.Log.e(TAG,
                    "CRITICAL: Failed to load Dancing Script from assets/"
                    + FONT_ASSET_PATH + ". "
                    + "Notification logo will fall back to the static PNG. "
                    + "Make sure the file exists at: "
                    + "android/app/src/main/assets/" + FONT_ASSET_PATH,
                    e);
            }
        }

        return sCachedTypeface;
    }
}
