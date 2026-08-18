package com.iunico.mynotes;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Build;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.widget.RemoteViews;
import androidx.core.content.res.ResourcesCompat;

import java.util.Locale;

public class QuotesWidgetProvider extends AppWidgetProvider {

    private static class Quote {
        String text;
        String author;

        Quote(String text, String author) {
            this.text = text;
            this.author = author;
        }
    }

    private static final Quote[] SPANISH_QUOTES = new Quote[]{
        new Quote("Cada paso es una elección. Cada elección tiene sus consecuencias.", "Jean-Paul Sartre"),
        new Quote("La felicidad no es algo hecho. Viene de tus propias acciones.", "Dalai Lama"),
        new Quote("Lo que no nos mata, nos hace más fuertes.", "Friedrich Nietzsche"),
        new Quote("El único modo de hacer un gran trabajo es amar lo que haces.", "Steve Jobs"),
        new Quote("La vida es lo que pasa mientras estás ocupado haciendo otros planes.", "John Lennon"),
        new Quote("Pienso, luego existo.", "René Descartes"),
        new Quote("La paciencia es amarga, pero su fruto es dulce.", "Jean-Jacques Rousseau"),
        new Quote("La calidad no es un acto, es un hábito.", "Aristóteles"),
        new Quote("La mejor forma de predecir el futuro es creándolo.", "Peter Drucker"),
        new Quote("La inteligencia sin ambición es un pájaro sin alas.", "Salvador Dalí"),
        new Quote("Solo sé que no sé nada.", "Sócrates"),
        new Quote("El que tiene un porqué para vivir puede soportar casi cualquier cómo.", "Friedrich Nietzsche"),
        new Quote("La libertad está en ser dueños de nuestra propia vida.", "Platón"),
        new Quote("El éxito es ir de fracaso en fracaso sin perder el entusiasmo.", "Winston Churchill"),
        new Quote("La mayor gloria no es nunca caer, sino levantarse siempre.", "Nelson Mandela"),
        new Quote("La imaginación es más importante que el conocimiento.", "Albert Einstein"),
        new Quote("Vivir es lo más raro del mundo. La mayoría de la gente existe, eso es todo.", "Oscar Wilde"),
        new Quote("Cada mañana nacemos de nuevo. Lo que hacemos hoy es lo que más importa.", "Buda"),
        new Quote("Un viaje de mil millas comienza con un solo paso.", "Lao Tsé"),
        new Quote("El sabio no dice todo lo que piensa, pero siempre piensa todo lo que dice.", "Aristóteles"),
        new Quote("No hay nada permanente excepto el cambio.", "Heráclito"),
        new Quote("El futuro pertenece a quienes creen en la belleza de sus sueños.", "Eleanor Roosevelt"),
        new Quote("En medio del invierno, aprendí por fin que había en mí un verano invencible.", "Albert Camus"),
        new Quote("La vida comienza donde termina el miedo.", "Osho"),
        new Quote("El verdadero viaje de descubrimiento no consiste en buscar nuevos paisajes, sino en tener nuevos ojos.", "Marcel Proust"),
        new Quote("La disciplina es el puente entre las metas y los logros.", "Jim Rohn"),
        new Quote("La suerte es lo que sucede cuando la preparación se encuentra con la oportunidad.", "Séneca"),
        new Quote("La simplicidad es la máxima sofisticación.", "Leonardo da Vinci"),
        new Quote("El aprendizaje es lo único que la mente nunca agota, nunca teme y nunca lamenta.", "Leonardo da Vinci"),
        new Quote("No camines delante de mí, puede que no te siga. No camines detrás de mí, puede que no te guíe. Camina a mi lado y sé mi amigo.", "Albert Camus")
    };

    private static final Quote[] ENGLISH_QUOTES = new Quote[]{
        new Quote("Each step is a choice. Each choice has its consequences.", "Jean-Paul Sartre"),
        new Quote("Happiness is not something ready made. It comes from your own actions.", "Dalai Lama"),
        new Quote("That which does not kill us makes us stronger.", "Friedrich Nietzsche"),
        new Quote("The only way to do great work is to love what you do.", "Steve Jobs"),
        new Quote("Life is what happens when you're busy making other plans.", "John Lennon"),
        new Quote("I think, therefore I am.", "René Descartes"),
        new Quote("Patience is bitter, but its fruit is sweet.", "Jean-Jacques Rousseau"),
        new Quote("Quality is not an act, it is a habit.", "Aristotle"),
        new Quote("The best way to predict the future is to create it.", "Peter Drucker"),
        new Quote("Intelligence without ambition is a bird without wings.", "Salvador Dalí"),
        new Quote("I know that I know nothing.", "Socrates"),
        new Quote("He who has a why to live for can bear almost any how.", "Friedrich Nietzsche"),
        new Quote("Freedom is being masters of our own lives.", "Plato"),
        new Quote("Success is going from failure to failure without losing sarcasm.", "Winston Churchill"),
        new Quote("The greatest glory in living lies not in never falling, but in rising every time we fall.", "Nelson Mandela"),
        new Quote("Imagination is more important than knowledge.", "Albert Einstein"),
        new Quote("To live is the rarest thing in the world. Most people exist, that is all.", "Oscar Wilde"),
        new Quote("Each morning we are born again. What we do today is what matters most.", "Buddha"),
        new Quote("A journey of a thousand miles begins with a single step.", "Lao Tzu"),
        new Quote("The wise man does not say all that he thinks, but he always thinks all that he says.", "Aristotle"),
        new Quote("There is nothing permanent except change.", "Heraclitus"),
        new Quote("The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"),
        new Quote("In the depth of winter, I finally learned that within me there lay an invincible summer.", "Albert Camus"),
        new Quote("Life begins where fear ends.", "Osho"),
        new Quote("The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.", "Marcel Proust"),
        new Quote("Discipline is the bridge between goals and accomplishment.", "Jim Rohn"),
        new Quote("Luck is what happens when preparation meets opportunity.", "Seneca"),
        new Quote("Simplicity is the ultimate sophistication.", "Leonardo da Vinci"),
        new Quote("Learning never exhausts the mind.", "Leonardo da Vinci"),
        new Quote("Don't walk in front of me, I may not follow. Don't walk behind me, I may not lead. Walk beside me and be my friend.", "Albert Camus")
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
        scheduleNextUpdate(context);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        scheduleNextUpdate(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        cancelUpdate(context);
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quotes);

        // Determine language
        SharedPreferences prefs = context.getSharedPreferences("WidgetData", Context.MODE_PRIVATE);
        String lang = prefs.getString("language", "es");
        Quote[] quotesList = "es".equals(lang) ? SPANISH_QUOTES : ENGLISH_QUOTES;

        // Get index based on current hour since epoch to shift deterministically every hour
        long hourEpoch = System.currentTimeMillis() / 3600000;
        int quoteIndex = (int) (hourEpoch % quotesList.length);
        Quote quote = quotesList[quoteIndex];

        // Render quote text with custom Dancing Script font to a Bitmap to prevent inflation crashes
        Bitmap quoteBitmap = renderQuoteToBitmap(context, "\"" + quote.text + "\"", 800, 320);
        if (quoteBitmap != null) {
            views.setImageViewBitmap(R.id.widget_quote_image, quoteBitmap);
        }
        
        views.setTextViewText(R.id.widget_quote_author, quote.author.toUpperCase(Locale.getDefault()));

        // Clicking the quote opens the main activity
        Intent appIntent = new Intent(context, MainActivity.class);
        PendingIntent appPendingIntent = PendingIntent.getActivity(
            context, appWidgetId, appIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_quote_image, appPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_quote_author, appPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap renderQuoteToBitmap(Context context, String text, int width, int height) {
        try {
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.TRANSPARENT);

            Typeface tf = null;
            try {
                tf = Typeface.createFromAsset(context.getAssets(), "fonts/dancing_script.ttf");
            } catch (Exception e) {
                e.printStackTrace();
            }
            if (tf == null) {
                tf = Typeface.create(Typeface.SERIF, Typeface.ITALIC);
            }

            TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            boolean isDarkMode = (context.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
            paint.setColor(isDarkMode ? Color.WHITE : Color.parseColor("#1F2937"));
            paint.setTypeface(tf);
            
            // Adjust text size based on quote length to keep it readable and fit the widget (Larger Font)
            float textSize = 46f;
            if (text.length() > 100) {
                textSize = 30f;
            } else if (text.length() > 75) {
                textSize = 36f;
            } else if (text.length() > 45) {
                textSize = 40f;
            }
            paint.setTextSize(textSize);

            StaticLayout staticLayout;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                staticLayout = StaticLayout.Builder.obtain(text, 0, text.length(), paint, width - 40)
                        .setAlignment(Layout.Alignment.ALIGN_CENTER)
                        .setLineSpacing(0f, 1.15f)
                        .setIncludePad(false)
                        .build();
            } else {
                staticLayout = new StaticLayout(
                        text, paint, width - 40,
                        Layout.Alignment.ALIGN_CENTER, 1.15f, 0f, false
                );
            }

            float textHeight = staticLayout.getHeight();
            float y = (height - textHeight) / 2f;
            if (y < 0) y = 0;

            canvas.save();
            canvas.translate(20f, y);
            staticLayout.draw(canvas);
            canvas.restore();

            return bitmap;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private static void scheduleNextUpdate(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, QuotesWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(new ComponentName(context, QuotesWidgetProvider.class));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 201, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );

        long hourMs = 3600000;
        long triggerAt = System.currentTimeMillis() + hourMs;

        if (alarmManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            }
        }
    }

    private static void cancelUpdate(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, QuotesWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 201, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );

        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }
    }
}
