// Force immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Delete ALL caches when activated
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Pass-through fetch (NO CACHING) to ensure the app always loads the latest code
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
