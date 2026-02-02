/**
 * SmartNav 2050 - Offline Engine (sw.js)
 * Strategi: Stale-While-Revalidate + Aggressive Tile Caching
 */

const CACHE_NAME = 'smartnav-2050-v1';
const TILE_CACHE_NAME = 'smartnav-tiles-v1';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './smartnav2050.png',
    'https://unpkg.com/maplibre-gl@3.x/dist/maplibre-gl.js',
    'https://unpkg.com/maplibre-gl@3.x/dist/maplibre-gl.css'
];

// 1. Install & Cache Aset Asas (UI Liquid Glass)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SmartNav: Menjamin Aset Sistem...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. Activate & Pembersihan Cache Lama
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 3. Strategi Fetch: Agresif Caching untuk Peta
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // A. Khas untuk Tiles Peta (Paling penting untuk elak Gambar 1)
    if (url.includes('tiles.openfreemap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    // Berikan dari cache jika ada, sambil ambil yang baru dari network
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => null); // Jika offline, fetchPromise gagal senyap

                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // B. Abaikan Carian (Nominatim) supaya tidak simpan ralat "offline"
    if (url.includes('nominatim')) {
        return;
    }

    // C. Untuk Aset Lain (HTML/JS/CSS)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Simpan aset baru yang ditemui ke cache sistem
                if (networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Jika offline sepenuhnya dan tiada aset dalam cache
                console.log('SmartNav Offline: Aset tidak ditemui');
            });
        })
    );
});
