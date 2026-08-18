package com.iunico.mynotes;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class CalendarWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new CalendarWidgetFactory(this.getApplicationContext(), intent);
    }
}
