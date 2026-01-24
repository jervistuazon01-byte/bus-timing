const CACHE_NAME = 'sg-bus-v2';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './api.js',
    './icon.png',
    './manifest.json'
];

// Install: Cache assets and skip waiting to activate immediately
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting(); // Force new SW to take over
});

// Activate: Clean up old caches and claim clients
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim(); // Immediately control open pages
});

// Fetch: Cache First, then Network
self.addEventListener('fetch', (e) => {
    // API calls should NOT be cached by SW (handled by api.js or live)
    if (e.request.url.includes('/api/')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
