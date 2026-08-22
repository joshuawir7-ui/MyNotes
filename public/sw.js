// MyNotes Web Service Worker
// Handles background push notifications for tasks and appointments

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Handle notification click: focus/open the app tab
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If a tab is already open, focus it
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            // Otherwise open a new tab
            if (self.clients.openWindow) {
                return self.clients.openWindow('/');
            }
        })
    );
});

// Listen for messages from the main thread to show a notification
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, icon, tag } = event.data;
        self.registration.showNotification(title, {
            body,
            icon: icon || '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: tag || 'mynotes-reminder',
            renotify: true,
            requireInteraction: false,
            silent: false,
        });
    }
});
