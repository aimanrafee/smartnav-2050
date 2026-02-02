/**
 * SmartNav 2050 - 3D Driving Edition (FIXED)
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

// --- 4. SEARCH POI ---
async function searchPOI(query) {
    if (!query) return;
    statusEl.innerText = `Mencari: ${query}...`;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const dest = [parseFloat(lon), parseFloat(lat)];
            
            map.flyTo({ 
                center: dest, 
                zoom: 17, 
                pitch: 60, 
                speed: 1.5,
                curve: 1
            });
            
            new maplibregl.Marker({ color: '#ff0000' })
                .setLngLat(dest)
                .setPopup(new maplibregl.Popup().setHTML(`<b>Destinasi:</b><br>${display_name}`))
                .addTo(map);

            speak(`Destinasi ditemui: ${display_name}`);
        } else {
            alert("Lokasi tidak ditemui.");
        }
    } catch (err) {
        console.error("Search Error:", err);
    }
}

// --- 5. TRACKING & DRIVING VIEW ---
function startLocationTracking() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude, heading } = position.coords;
        const newCoords = [longitude, latitude];
        currentPos = newCoords;

        // Update Marker
        if (!userMarker) {
            userMarker = new maplibregl.Marker({ color: '#007bff' })
                .setLngLat(newCoords)
                .addTo(map);
        } else {
            userMarker.setLngLat(newCoords);
        }

        // Auto-follow Driving View
        map.easeTo({
            center: newCoords,
            bearing: heading || 0,
            pitch: 60,
            duration: 1000
        });

        saveTripData(position.coords);
    }, (err) => console.warn(err), { enableHighAccuracy: true });
}

// --- 6. RECENTER ---
function recenterMap() {
    if (map && currentPos) {
        map.flyTo({
            center: currentPos,
            zoom: 17,
            pitch: 60,
            bearing: 0,
            duration: 1500
        });
        statusEl.innerText = "Mengunci GPS...";
        setTimeout(updateOnlineStatus, 2000);
    }
}

// --- 7. SHARE (FIXED LINK) ---
function shareMyLocation() {
    const shareUrl = `https://www.google.com/maps?q=${currentPos[1]},${currentPos[0]}`;
    if (navigator.share) {
        navigator.share({
            title: 'SmartNav 2050',
            text: 'Lokasi semasa saya:',
            url: shareUrl
        });
    } else {
        navigator.clipboard.writeText(shareUrl);
        alert("Link lokasi disalin ke clipboard!");
    }
}

// --- 8. INIT MAP ---
function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/liberty', 
        center: currentPos,
        zoom: 14,
        pitch: 45
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    // Tunggu map 'load' sebelum start tracking
    map.on('load', () => {
        console.log("MapLibre 3D Ready");
        startLocationTracking();
        updateOnlineStatus();
    });
}

// --- 9. UTILITY ---
function saveTripData(coords) {
    if (dbRequest.result) {
        const tx = dbRequest.result.transaction("trips", "readwrite");
        tx.objectStore("trips").add({
            timestamp: Date.now(),
            lat: coords.latitude,
            lng: coords.longitude
        });
    }
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    statusEl.innerText = isOnline ? "Sistem Online (3D Engine)" : "Mod Offline (Smart Algorithm)";
    statusEl.style.borderLeft = isOnline ? "5px solid #28a745" : "5px solid #dc3545";
}

// --- 10. STARTUP ---
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});
