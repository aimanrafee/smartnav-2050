const CACHE_NAME = 'smartnav-v2-2050';
const OFFLINE_URL = '/offline.html'; // Sediakan fail ringkas jika benar-benar gagal

// Senarai aset kritikal yang mesti ada untuk "Smartest Algorithm" berfungsi offline
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './style.css',
    './app.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// 1. Install Event: Simpan aset kritikal ke dalam cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting(); // Paksa SW baru aktif serta-merta
});

// 2. Activate Event: Cuci cache lama
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
});

// 3. Fetch Event: Logik Pengesanan Kualiti Internet
self.addEventListener('fetch', (event) => {
    // Kita hanya intercept request GET (peta & skrip)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        // Gunakan AbortController untuk set "Timeout" 
        // Jika internet terlalu perlahan (e.g. 3 saat tiada respon), terus guna Cache
        timeoutFetch(3000, event.request)
            .then((networkResponse) => {
                // Jika internet OK, simpan salinan terbaru dalam cache (Stale-while-revalidate)
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                // Jika internet DOWN atau TERLALU PERLAHAN, ambil dari Cache
                return caches.match(event.request).then((response) => {
                    if (response) return response;
                    
                    // Jika fail tiada dalam cache langsung (e.g. kawasan peta baru)
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                });
            })
    );
});

// Fungsi pembantu untuk mengesan "Slow Internet"
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
