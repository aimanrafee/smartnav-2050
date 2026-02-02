const CACHE_NAME = 'smartnav-2050-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './smartnav2050.png',
    'https://unpkg.com/maplibre-gl@3.x/dist/maplibre-gl.js',
    'https://unpkg.com/maplibre-gl@3.x/dist/maplibre-gl.css'
];

// 1. Install Service Worker & Simpan Assets Asas
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SmartNav: Caching System Assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate & Padam Cache Lama
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// 3. Smart Strategy: Stale-While-Revalidate
// Ia akan cuba ambil dari internet, jika gagal (offline), ia guna cache.
self.addEventListener('fetch', (event) => {
    // Abaikan permintaan API carian (Nominatim) supaya sentiasa segar
    if (event.request.url.includes('nominatim')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Simpan salinan data peta (tiles) yang baru dibuka ke dalam cache
                if (networkResponse && networkResponse.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Jika offline sepenuhnya dan tiada dalam cache
                return cachedResponse;
            });

            return cachedResponse || fetchPromise;
        })
    );
});
