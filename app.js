/**
 * SmartNav 2050 - Full Integrated Navigation Logic
 * Features: Offline IndexedDB, Real-time Tracking, Turn-by-Turn Routing, Recenter Map
 */

// 1. Inisialisasi Pembolehubah Global
let map, userMarker, routingControl;
let currentPos = [3.1390, 101.6869]; // Koordinat Lalai (KL)
const statusEl = document.getElementById('status');

// --- 2. INDEXEDDB SETUP (Storan Offline Pintar) ---
const dbRequest = indexedDB.open("SmartNavDB", 1);

dbRequest.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("trips")) {
        db.createObjectStore("trips", { keyPath: "timestamp" });
    }
    console.log("SmartNavDB: Database Ready.");
};

dbRequest.onerror = (e) => console.error("Database Error:", e.target.errorCode);

// --- 3. FUNGSI NAVIGASI (Turn-by-Turn Routing) ---
function createRoute(destLat, destLng) {
    // Buang laluan lama jika pengguna tukar destinasi
    if (routingControl) {
        map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(currentPos[0], currentPos[1]), // Titik Mula (GPS)
            L.latLng(destLat, destLng)              // Titik Tamat (Klik Peta)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        lineOptions: {
            styles: [{ color: '#007bff', opacity: 0.8, weight: 6 }]
        }
    }).addTo(map);

    routingControl.on('routesfound', function(e) {
        statusEl.innerText = "Laluan Ditemui! Navigasi Aktif.";
        statusEl.style.background = "rgba(226, 236, 255, 0.9)";
    });
}

// --- 4. TRACKING LOKASI REAL-TIME ---
function startLocationTracking() {
    if (!navigator.geolocation) {
        statusEl.innerText = "GPS Tidak Disokong";
        return;
    }

    navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude, accuracy } = position.coords;
        currentPos = [latitude, longitude];

        // Kemaskini Marker Lokasi Pengguna
        if (!userMarker) {
            userMarker = L.marker(currentPos).addTo(map)
                .bindPopup("Lokasi Anda")
                .openPopup();
        } else {
            userMarker.setLatLng(currentPos);
        }

        // Fokuskan peta ke lokasi pengguna secara lembut jika tidak dalam mod navigasi
        if (!routingControl) {
            map.panTo(currentPos);
        }

        // AUTO-SAVE: Simpan data ke IndexedDB untuk Algoritma 2050
        saveTripData(position.coords);

    }, (err) => console.warn(`Error GPS: ${err.message}`), 
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

// --- 5. FUNGSI RECENTER (Kembali ke GPS) ---
function recenterMap() {
    if (currentPos) {
        // Efek 'Fly' yang futuristik ke lokasi semasa
        map.flyTo(currentPos, 16, {
            animate: true,
            duration: 1.5
        });
        
        statusEl.innerText = "Mengunci lokasi GPS...";
        statusEl.style.background = "rgba(230, 255, 240, 0.9)";
        
        // Kembalikan status asal selepas 2 saat
        setTimeout(updateOnlineStatus, 2000);
    } else {
        alert("GPS sedang mencari isyarat lokasi...");
    }
}

// --- 6. INISIALISASI PETA (Leaflet) ---
function initMap() {
    map = L.map('map').setView(currentPos, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap | SmartNav 2050'
    }).addTo(map);

    // Event Click: Set destinasi apabila peta diklik
    map.on('click', function(e) {
        const { lat, lng } = e.latlng;
        createRoute(lat, lng);
    });
}

// --- 7. FUNGSI UTILITY & STATUS ---
function saveTripData(coords) {
    const db = dbRequest.result;
    if (!db) return;

    const tx = db.transaction("trips", "readwrite");
    const store = tx.objectStore("trips");
    
    store.add({
        timestamp: Date.now(),
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
    });
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    statusEl.innerText = isOnline ? "Sistem Online" : "Mod Offline (Algoritma Aktif)";
    statusEl.style.background = isOnline ? "rgba(230, 255, 240, 0.9)" : "rgba(255, 245, 245, 0.9)";
    statusEl.style.color = isOnline ? "#2d3748" : "#c53030";
    statusEl.style.borderLeft = isOnline ? "5px solid #28a745" : "5px solid #dc3545";
}

// --- 8. STARTUP & EVENT LISTENERS ---
window.addEventListener('load', () => {
    initMap();
    startLocationTracking();
    updateOnlineStatus();
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});

// Pendaftaran Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('SmartNav SW Registered'))
        .catch(err => console.error('SW Failed', err));
}
