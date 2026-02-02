/**
 * SmartNav 2050 - Offline Engine (sw.js)
 * Strategi: Cache-First for API + Stale-While-Revalidate for Tiles
 */

const CACHE_NAME = 'smartnav-2050-v1';
const DATA_CACHE_NAME = 'smartnav-data-v1'; // Cache khas untuk API JSON anda
const TILE_CACHE_NAME = 'smartnav-tiles-v1';

// URL API yang baru anda cipta
const SMARTNAV_API_POI = 'https://raw.githubusercontent.com/aimanrafee/SmartNav-API/main/data/semenanjung-poi.json';
const SMARTNAV_API_ROADS = 'https://raw.githubusercontent.com/aimanrafee/SmartNav-API/main/data/semenanjung-roads.json';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './smartnav2050.png',
    'https://unpkg.com/maplibre-gl@3.x/dist/maplibre-gl.js',
    'https://unpkg.com/maplibre-gl@3.x/dist/maplibre-gl.css',
    SMARTNAV_API_POI // Kita pre-cache POI (1.6MB) terus semasa install
];

// 1. Install & Cache Aset Asas + POI API
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SmartNav: Menjamin Aset & POI Data...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. Activate & Pembersihan
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== TILE_CACHE_NAME && key !== DATA_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 3. Strategi Fetch: Pintar Caching
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // A. Khas untuk API JSON (POI & Roads)
    if (url.includes('raw.githubusercontent.com/aimanrafee/SmartNav-API')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    // Jika ada dalam cache, berikan segera. Jika tiada, ambil dari network dan simpan.
                    return response || fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // B. Khas untuk Tiles Peta (Stale-While-Revalidate)
    if (url.includes('tiles.openfreemap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => null);
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // C. Untuk Aset Lain (UI/CSS/JS)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
