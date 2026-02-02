/**
 * SmartNav 2050 - 3D Driving & Liquid Glass Edition (Integrated)
 * Kemaskini: Real-time POV (Bearing & Dynamic Pitch) + Service Worker
 */

// 1. Inisialisasi Pembolehubah Global
let map;
let userMarker = null;
let currentPos = [101.6869, 3.1390]; 
let isSatellite = false;
let lastHeading = 0; // Menyimpan arah terakhir untuk kelancaran POV
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

// --- 4. FUNGSI TUKAR STYLE ---
function toggleStyle() {
    isSatellite = !isSatellite;
    const style = isSatellite 
        ? 'https://tiles.openfreemap.org/styles/bright' 
        : 'https://tiles.openfreemap.org/styles/liberty';
    
    map.setStyle(style);
    const modeText = isSatellite ? "Mod Satellite Hybrid Aktif" : "Mod Peta Vektor Aktif";
    statusEl.innerText = modeText;
    speak(modeText);
}

// --- 5. SEARCH POI ---
async function searchPOI(query) {
    if (!query) return;
    statusEl.innerText = `Mencari: ${query}...`;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
            headers: { 'Accept-Language': 'ms' }
        });
        
        if (!response.ok) throw new Error("Pelayan tidak bertindak balas.");
        const data = await response.json();
        
        if (data && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const dest = [parseFloat(lon), parseFloat(lat)];
            
            map.flyTo({ 
                center: dest, 
                zoom: 17, 
                pitch: 70, 
                speed: 1.2,
                essential: true
            });
            
            new maplibregl.Marker({ color: '#ff4b2b' })
                .setLngLat(dest)
                .setPopup(new maplibregl.Popup().setHTML(`<b>Destinasi:</b><br>${display_name}`))
                .addTo(map);

            statusEl.innerText = `Destinasi: ${display_name}`;
            speak(`Destinasi ditemui. Menghalakan sistem ke ${display_name}`);
        } else {
            alert("Lokasi tidak ditemui.");
            updateOnlineStatus();
        }
    } catch (err) {
        console.error("Search Error:", err);
        statusEl.innerText = "⚠️ Ralat rangkaian carian.";
    }
}

// --- 6. LOGIK POV PEMANDUAN & TRACKING (DIKEMASKINI) ---
function startLocationTracking() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const newCoords = [longitude, latitude];
        currentPos = newCoords;

        // Simpan heading jika GPS memberikannya (untuk POV)
        if (heading !== null && heading !== undefined) {
            lastHeading = heading;
        }

        // Update Marker Pengguna
        if (!userMarker) {
            userMarker = new maplibregl.Marker({ color: '#00d4ff', scale: 0.9 })
                .setLngLat(newCoords)
                .addTo(map);
        } else {
            userMarker.setLngLat(newCoords);
        }

        // KEMASKINI POV DINAMIK:
        map.easeTo({
            center: newCoords,
            bearing: lastHeading, 
            pitch: speed > 2 ? 75 : 65, 
            duration: 1500, // Memberikan kesan 'Liquid' yang smooth
            easing: (t) => t 
        });

        saveTripData(position.coords);
    }, (err) => console.warn(err), { 
        enableHighAccuracy: true,
        maximumAge: 0, 
        timeout: 5000 
    });
}

// --- 7. RECENTER ---
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

// --- 8. SHARE LOCATION (DIPERBAIKI) ---
function shareMyLocation() {
    const shareUrl = `https://www.google.com/maps?q=${currentPos[1]},${currentPos[0]}`;
    if (navigator.share) {
        navigator.share({
            title: 'SmartNav 2050',
            text: 'Lokasi pemanduan real-time saya:',
            url: shareUrl
        });
    } else {
        navigator.clipboard.writeText(shareUrl);
        alert("Pautan lokasi telah disalin!");
    }
}

// --- 9. INIT MAP ---
function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/bright', 
        center: currentPos,
        zoom: 15,
        pitch: 65, 
        bearing: 0,
        antialias: true
    });

    map.on('load', () => {
        statusEl.innerText = "🚀 Navigasi 3D 2050 Aktif";
        
        if (map.getLayer('building')) {
            map.setPaintProperty('building', 'fill-extrusion-height', ['get', 'height']);
        }
        
        startLocationTracking();
        updateOnlineStatus();
    });
}

// --- 10. UTILITY ---
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

// --- 11. STARTUP ---
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});

// --- 12. DAFTARKAN SERVICE WORKER UNTUK MOD OFFLINE ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SmartNav Offline Engine: Ready', reg))
            .catch(err => console.log('SmartNav Offline Engine: Failed', err));
    });
}
