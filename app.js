/**
 * SmartNav 2050 - 3D Driving & Liquid Glass Edition (Integrated)
 * Features: Dynamic Pitch, Satellite Hybrid Toggle, IndexedDB, Voice Guidance
 */

// 1. Inisialisasi Pembolehubah Global
let map;
let userMarker = null;
let currentPos = [101.6869, 3.1390]; // Format: [LNG, LAT]
let isSatellite = false;
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

// --- 4. FUNGSI TUKAR STYLE (Satellite/Hybrid Toggle) ---
function toggleStyle() {
    isSatellite = !isSatellite;
    // Menggunakan URL tiles yang menyokong label jalan (Hybrid)
    const style = isSatellite 
        ? 'https://tiles.openfreemap.org/styles/bright' // Hybrid/Satellite style
        : 'https://tiles.openfreemap.org/styles/liberty'; // Vektor/Street style
    
    map.setStyle(style);
    
    const modeText = isSatellite ? "Mod Satellite Hybrid Aktif" : "Mod Peta Vektor Aktif";
    statusEl.innerText = modeText;
    speak(modeText);
}

// --- 5. SEARCH POI (Dengan Perbaikan Ralat & Voice) ---
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
                speed: 1.5,
                curve: 1.2,
                essential: true
            });
            
            // Tambah Marker Destinasi
            new maplibregl.Marker({ color: '#ff4b2b' })
                .setLngLat(dest)
                .setPopup(new maplibregl.Popup().setHTML(`<b>Destinasi:</b><br>${display_name}`))
                .addTo(map);

            statusEl.innerText = `Destinasi: ${display_name}`;
            speak(`Destinasi ditemui. Menghalakan sistem ke ${display_name}`);
        } else {
            alert("Lokasi tidak ditemui. Sila cuba kata kunci lain.");
            updateOnlineStatus();
        }
    } catch (err) {
        console.error("Search Error:", err);
        statusEl.innerText = "⚠️ Ralat rangkaian carian.";
        alert("Gagal menghubungi pelayan carian.");
    }
}

// --- 6. LOGIK MOOD PEMANDUAN & TRACKING ---
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
        map.easeTo({
            center: newCoords,
            bearing: heading || 0,
            pitch: speed > 10 ? 75 : 65, // Dynamic pitch berdasarkan kelajuan (Driving Mood)
            duration: 2000,
            easing: (t) => t // Linear movement
        });

        saveTripData(position.coords);
    }, (err) => console.warn(err), { 
        enableHighAccuracy: true,
        maximumAge: 1000,
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

// --- 8. SHARE LOCATION ---
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
        alert("Pautan lokasi telah disalin ke clipboard!");
    }
}

// --- 9. INIT MAP (Mod Smart Vektor Awal) ---
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

    // Sembunyikan kawalan asal untuk kekalkan estetika Liquid Glass
    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    map.on('load', () => {
        statusEl.innerText = "🚀 Navigasi 3D 2050 Aktif";
        
        // Aktifkan Bangunan 3D
        if (map.getLayer('building')) {
            map.setPaintProperty('building', 'fill-extrusion-height', ['get', 'height']);
        }
        
        startLocationTracking();
        updateOnlineStatus();
    });
}

// --- 10. UTILITY (IndexedDB & Online Status) ---
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
