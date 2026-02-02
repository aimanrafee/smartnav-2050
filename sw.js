/**
 * SmartNav 2050 - Service Worker
 * Core: Offline Smartest Algorithm Engine
 */

const CACHE_NAME = 'smartnav-v2-2050';
const TILE_CACHE = 'map-tiles-v1'; // Cache berasingan untuk data peta yang berat
const OFFLINE_URL = './offline.html';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './app.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    // Tambah fail CSS anda di sini jika ada
];

// 1. INSTALL: Simpan aset teras & cipta fail offline kecemasan
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Algorithm Engine: Pre-caching assets');
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

// 2. ACTIVATE: Bersihkan storan lama untuk optimumkan ruang OS
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== TILE_CACHE) {
                        console.log('Algorithm Engine: Cleaning old cache', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    // Pastikan SW mengawal semua tab serta-merta
    self.clients.claim();
});

// 3. FETCH: Logik Pintar "Network First with Timeout"
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Strategi Khas untuk Tiles Peta (Penting untuk Navigasi Offline)
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(cacheFirst(event.request, TILE_CACHE));
        return;
    }

    // Strategi untuk fail aplikasi (Network First)
    event.respondWith(
        timeoutFetch(3000, event.request)
            .then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                return caches.match(event.request).then((response) => {
                    if (response) return response;
                    
                    // Jika user cuba buka page baru semasa offline
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                });
            })
    );
});

/**
 * Strategi Cache First: Cari dalam cache dulu, kalau takde baru fetch.
 * Sangat berkesan untuk data peta (tiles) supaya jimat data/bateri.
 */
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    
    try {
        const networkResponse = await fetch(request);
        cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        return new Response(null, { status: 404 });
    }
}

/**
 * Fungsi Timeout: Jika internet lembap (Slow 3G), sistem terus tukar ke Offline Mode.
 */
function timeoutFetch(ms, request) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);

        fetch(request, { signal: controller.signal })
            .then((response) => {
                clearTimeout(timeoutId);
                resolve(response);
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                reject(err);
            });
    });
}

// 4. Background Sync (Persediaan untuk Algorithm 2050)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-location-data') {
        console.log('Algorithm Engine: Syncing data to cloud when online...');
        // Letakkan fungsi hantar data ke server anda di sini
    }
});
