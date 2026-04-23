// FCM background message handler.
// Uses importScripts (compat CDN) — service workers cannot use ES module imports.
// IMPORTANT: Keep the version string below in sync with firebase in client/package.json.
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyCD1uMNkBMdbArrv4zKppc54Lgxg66xMdo',
  authDomain:        'dad-med-tracker.firebaseapp.com',
  projectId:         'dad-med-tracker',
  storageBucket:     'dad-med-tracker.firebasestorage.app',
  messagingSenderId: '1043260614123',
  appId:             '1:1043260614123:web:352f4cfa5ee621f22425ae',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.data;
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'med-supply-alert',
    data: { url: '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
