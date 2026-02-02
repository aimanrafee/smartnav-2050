/**
 * SmartNav 2050 - 3D Driving Edition (Satellite Hybrid)
 * Features: Dynamic Pitch, Satellite Layer, Improved Error Handling
 */

// 1. Inisialisasi Pembolehubah Global
let map;
let userMarker = null;
let currentPos = [101.6869, 3.1390]; // Format: [LNG, LAT]
const statusEl = document.getElementById('status');

// --- 2. INDEXEDDB SETUP ---
const dbRequest = indexedDB.open("SmartNavDB", 1);
dbRequest.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("trips")) {
        db.createObjectStore("trips", { keyPath: "timestamp" });
    }
};

// --- 3. FUNGSI VOICE GUIDANCE ---
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ms-MY';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// --- 4. SEARCH POI (Dengan Perbaikan Ralat) ---
async function searchPOI(query) {
    if (!query) return;
    statusEl.innerText = `Mencari: ${query}...`;
    
    try {
        // Menggunakan User-Agent untuk mengelakkan ralat 403 pada Nominatim
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
            headers: { 'Accept-Language': 'ms' }
        });
        
        if (!response.ok) throw new Error("Pelayan carian tidak bertindak balas.");
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const dest = [parseFloat(lon), parseFloat(lat)];
            
            map.flyTo({ 
                center: dest, 
                zoom: 17, 
                pitch: 65, 
                speed: 1.5,
                curve: 1.2,
                essential: true
            });
            
            new maplibregl.Marker({ color: '#ff0000' })
                .setLngLat(dest)
                .setPopup(new maplibregl.Popup().setHTML(`<b>Destinasi:</b><br>${display_name}`))
                .addTo(map);

            speak(`Destinasi ditemui. Menghalakan sistem ke ${display_name}`);
        } else {
            alert("Lokasi tidak ditemui. Sila cuba kata kunci lain.");
            updateOnlineStatus();
        }
    } catch (err) {
        console.error("Search Error:", err);
        alert("Ralat: Gagal menghubungi pelayan carian. Sila semak internet anda.");
        updateOnlineStatus();
    }
}

// --- 5. LOGIK MOOD PEMANDUAN & TRACKING ---
function startLocationTracking() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const newCoords = [longitude, latitude];
        currentPos = newCoords;

        // Update Marker Pengguna
        if (!userMarker) {
            userMarker = new maplibregl.Marker({ color: '#00d4ff', scale: 0.9 })
                .setLngLat(newCoords)
                .addTo(map);
        } else {
            userMarker.setLngLat(newCoords);
        }

        // FUNGSI UPDATE KAMERA DINAMIK (Mood 2050)
        // Semakin laju kenderaan, semakin senget (pitch) peta untuk pandangan jauh
        map.easeTo({
            center: newCoords,
            bearing: heading || 0,
            pitch: speed > 10 ? 75 : 65, // Dynamic pitch berdasarkan kelajuan
            duration: 2000,
            easing: (t) => t // Pergerakan linear yang lebih natural
        });

        saveTripData(position.coords);
    }, (err) => console.warn(err), { 
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000 
    });
}

// --- 6. RECENTER ---
function recenterMap() {
    if (map && currentPos) {
        map.flyTo({
            center: currentPos,
            zoom: 18,
            pitch: 65,
            bearing: 0,
            duration: 1500,
            essential: true
        });
        statusEl.innerText = "🎯 GPS Terkunci";
        setTimeout(updateOnlineStatus, 2000);
    }
}

// --- 7. SHARE LOCATION ---
function shareMyLocation() {
    const shareUrl = `https://www.google.com/maps?q=${currentPos[1]},${currentPos[0]}`;
    if (navigator.share) {
        navigator.share({
            title: 'SmartNav 2050',
            text: 'Lokasi pemanduan bijak saya:',
            url: shareUrl
        });
    } else {
        navigator.clipboard.writeText(shareUrl);
        alert("Pautan lokasi telah disalin!");
    }
}

// --- 8. INIT MAP (Mod Satellite Hybrid) ---
function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        // Menggunakan style Bright/Liberty yang menyokong label jalan yang jelas
        style: 'https://tiles.openfreemap.org/styles/bright', 
        center: currentPos,
        zoom: 15,
        pitch: 65, 
        bearing: 0,
        antialias: true
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    map.on('load', () => {
        statusEl.innerText = "🚀 Navigasi 3D 2050 Aktif";
        // Tambah lapisan bangunan 3D jika ada data
        if (map.getLayer('building')) {
            map.setPaintProperty('building', 'fill-extrusion-height', ['get', 'height']);
        }
        startLocationTracking();
        updateOnlineStatus();
    });
}

// --- 9. UTILITY ---
function saveTripData(coords) {
    if (dbRequest.result) {
        try {
            const tx = dbRequest.result.transaction("trips", "readwrite");
            tx.objectStore("trips").add({
                timestamp: Date.now(),
                lat: coords.latitude,
                lng: coords.longitude
            });
        } catch(e) { console.error("IDB Error", e); }
    }
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    statusEl.innerText = isOnline ? "Sistem Online (3D Engine)" : "⚠️ Mod Offline Aktif";
    statusEl.style.borderLeft = isOnline ? "5px solid #00d4ff" : "5px solid #ff4b2b";
}

// --- 10. STARTUP ---
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});
