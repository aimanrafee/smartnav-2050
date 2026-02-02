/**
 * SmartNav 2050 - Main Application Logic
 * Fokus: Offline-First, Real-time Tracking, Local Algorithm & IndexedDB Storage
 */

// 1. Inisialisasi Peta & Pembolehubah Global
let map, userMarker;
const statusEl = document.getElementById('status');

// --- INTEGRASI INDEXEDDB (Database Offline) ---
const dbRequest = indexedDB.open("SmartNavDB", 1);

dbRequest.onupgradeneeded = (event) => {
    const db = event.target.result;
    // Cipta storan untuk sejarah perjalanan jika belum wujud
    if (!db.objectStoreNames.contains("trips")) {
        db.createObjectStore("trips", { keyPath: "timestamp" });
    }
    console.log("SmartNavDB: Pangkalan data sedia.");
};

dbRequest.onerror = (event) => {
    console.error("SmartNavDB Error:", event.target.errorCode);
};

// Fungsi untuk menyimpan data koordinat ke storan peranti
function saveTripData(coords) {
    const db = dbRequest.result;
    if (!db) return;

    const transaction = db.transaction("trips", "readwrite");
    const store = transaction.objectStore("trips");
    
    const dataPoint = {
        timestamp: Date.now(),
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
    };

    store.add(dataPoint);
    console.log("Lokasi disimpan secara offline:", dataPoint);
}
// ----------------------------------------------

// 2. Fungsi Utama: Dijalankan apabila tetingkap dimuatkan
window.addEventListener('load', () => {
    initMap();
    registerServiceWorker();
    startLocationTracking();
    updateOnlineStatus();

    // Listener untuk perubahan status rangkaian
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});

// 3. Pendaftaran Service Worker (SW)
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            console.log('SW Registered!', reg);
        } catch (err) {
            console.error('SW Registration Failed!', err);
        }
    }
}

// 4. Inisialisasi Peta (Leaflet)
function initMap() {
    map = L.map('map').setView([3.1390, 101.6869], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap | SmartNav 2050'
    }).addTo(map);

    userMarker = L.marker([3.1390, 101.6869]).addTo(map)
        .bindPopup('Mencari lokasi anda...')
        .openPopup();
}

// 5. Tracking Lokasi Real-time
function startLocationTracking() {
    if (!navigator.geolocation) {
        statusEl.innerText = "GPS tidak disokong oleh peranti.";
        return;
    }

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            const newPos = [latitude, longitude];

            // Update Marker & Peta
            userMarker.setLatLng(newPos).getPopup().setContent("Lokasi Anda").update();
            map.panTo(newPos);

            // AUTO-SAVE: Simpan ke IndexedDB setiap kali lokasi berubah
            saveTripData(position.coords);

            // Contoh penggunaan algoritma offline
            const dist = calculateDistance(latitude, longitude, 3.1578, 101.7123);
            console.log(`Jarak ke KLCC: ${dist.toFixed(2)} km`);
        },
        (err) => console.warn(`Error GPS: ${err.message}`),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

// 6. Pengesanan Status Rangkaian (Pintar)
function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    statusEl.innerText = isOnline ? "Online" : "Offline Mode (Algorithm Active)";
    statusEl.style.background = isOnline ? "rgba(230, 255, 250, 0.9)" : "rgba(255, 245, 245, 0.9)";
    statusEl.style.color = isOnline ? "#2d3748" : "#c53030";
    statusEl.style.borderLeft = isOnline ? "5px solid green" : "5px solid red";
}

// 7. Smartest Algorithm: Haversine Formula (Offline Distance Calculation)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Jejari bumi dalam KM
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
