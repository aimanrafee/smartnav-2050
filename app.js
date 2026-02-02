/**
 * SmartNav 2050 - 3D Driving Edition
 * Features: MapLibre 3D, Offline IndexedDB, Real-time Tracking, 
 * Voice Guidance, Search POI, and Location Sharing.
 */

// 1. Inisialisasi Pembolehubah Global
let map, userMarker;
let currentPos = [101.6869, 3.1390]; // MapLibre guna format [LNG, LAT]
const statusEl = document.getElementById('status');

// --- 2. INDEXEDDB SETUP (Storan Offline Pintar) ---
const dbRequest = indexedDB.open("SmartNavDB", 1);
dbRequest.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("trips")) {
        db.createObjectStore("trips", { keyPath: "timestamp" });
    }
};

// --- 3. FUNGSI VOICE GUIDANCE (TTS) ---
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ms-MY';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// --- 4. FUNGSI NAVIGASI & SEARCH POI ---
async function searchPOI(query) {
    if (!query) return;
    statusEl.innerText = `Mencari: ${query}...`;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await response.json();
        
        if (data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const dest = [parseFloat(lon), parseFloat(lat)];
            
            // Animasi ke destinasi
            map.flyTo({ center: dest, zoom: 16, pitch: 60, speed: 1.2 });
            
            // Tambah Marker Destinasi
            new maplibregl.Marker({ color: 'red' })
                .setLngLat(dest)
                .setPopup(new maplibregl.Popup().setHTML(`<b>Destinasi:</b><br>${display_name}`))
                .addTo(map)
                .togglePopup();

            speak(`Destinasi ditemui. Menghalakan sistem ke ${display_name}`);
        } else {
            alert("Lokasi tidak ditemui.");
        }
    } catch (err) {
        console.error("Search Error:", err);
    }
}

// --- 5. FUNGSI DRIVING VIEW & TRACKING ---
function startLocationTracking() {
    if (!navigator.geolocation) {
        statusEl.innerText = "GPS Tidak Disokong";
        return;
    }

    navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const newCoords = [longitude, latitude];
        currentPos = newCoords;

        // Kemaskini Marker Pengguna
        if (!userMarker) {
            userMarker = new maplibregl.Marker({ scale: 0.8, color: '#007bff' })
                .setLngLat(newCoords)
                .addTo(map);
        } else {
            userMarker.setLngLat(newCoords);
        }

        // --- LOGIK DRIVING VIEW (Real-time) ---
        // Jika sedang bergerak (speed > 0), peta akan pusing ikut arah (heading)
        map.easeTo({
            center: newCoords,
            bearing: heading || 0, // Pusing peta ikut arah kereta
            pitch: 60,             // Kekalkan pandangan 3D
            duration: 1000,
            essential: true
        });

        saveTripData(position.coords);
    }, (err) => console.warn(err), { enableHighAccuracy: true });
}

// --- 6. FUNGSI RECENTER ---
function recenterMap() {
    if (currentPos) {
        map.flyTo({
            center: currentPos,
            zoom: 17,
            pitch: 60,
            bearing: 0,
            essential: true,
            duration: 1500
        });
        statusEl.innerText = "Mengunci lokasi GPS...";
        setTimeout(updateOnlineStatus, 2000);
    }
}

// --- 7. SHARE LOCATION ---
function shareMyLocation() {
    const shareUrl = `https://www.google.com/maps?q=${currentPos[1]},${currentPos[0]}`;
    if (navigator.share) {
        navigator.share({
            title: 'SmartNav 2050',
            text: 'Ini lokasi saya:',
            url: shareUrl
        });
    } else {
        alert("Link lokasi disalin!");
    }
}

// --- 8. INIT MAP (MAPLIBRE 3D) ---
function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/liberty', // OSM Liberty 3D Style
        center: currentPos,
        zoom: 14,
        pitch: 45, // Pandangan awal sedikit senget
        bearing: 0
    });

    // Tambah kawalan Navigasi (Zoom/Compass)
    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    map.on('load', () => {
        updateOnlineStatus();
    });
}

// --- 9. UTILITY ---
function saveTripData(coords) {
    const db = dbRequest.result;
    if (!db) return;
    const tx = db.transaction("trips", "readwrite");
    tx.objectStore("trips").add({
        timestamp: Date.now(),
        lat: coords.latitude,
        lng: coords.longitude
    });
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    statusEl.innerText = isOnline ? "Sistem Online (3D Engine)" : "Mod Offline (Smart Algorithm)";
    statusEl.style.borderLeft = isOnline ? "5px solid #28a745" : "5px solid #dc3545";
}

// --- 10. STARTUP ---
window.addEventListener('load', () => {
    initMap();
    startLocationTracking();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
