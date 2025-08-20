const CACHE_NAME = 'cs-study-app-v4';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  '/cs-duolingo-lite.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  OFFLINE_URL,
  '/icons/app-icon-192.svg',
  '/icons/app-icon-512.svg',
  'https://unpkg.com/dexie@3.2.4/dist/dexie.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Navigation requests: network-first, fallback to offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('/cs-duolingo-lite.html');
        return cached || cache.match(OFFLINE_URL);
      }
    })());
    return;
  }

  // Static assets: cache-first
  const dest = req.destination;
  if ([ 'style', 'script', 'worker', 'image', 'font' ].includes(dest)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        // Only cache successful GETs
        if (fresh && fresh.status === 200) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // Other GETs: network-first, fallback to cache
  if (req.method === 'GET') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        if (fresh && fresh.status === 200) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        return cached || Response.error();
      }
    })());
  }
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.map((n) => n !== CACHE_NAME ? caches.delete(n) : Promise.resolve())
    );
    await self.clients.claim();
  })());
});

// Background sync for offline data
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Sync any pending data when connection is restored
  return new Promise((resolve) => {
    // In a real implementation, you would sync pending changes
    console.log('Background sync triggered');
    resolve();
  });
}

// Push notifications (for future study reminders)
self.addEventListener('push', function(event) {
  const options = {
    body: event.data ? event.data.text() : 'Time for your daily study session!',
    icon: '/icons/app-icon-192.svg',
    badge: '/icons/app-icon-192.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'study-reminder'
    },
    actions: [
      {
        action: 'study',
        title: 'Start Studying',
        icon: '/icons/app-icon-192.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/app-icon-192.svg'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('CS Study App', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'study') {
    event.waitUntil(
      clients.openWindow('/cs-duolingo-lite.html')
    );
  }
});
