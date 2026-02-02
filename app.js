/**
 * SmartNav 2050 - Ultimate Edition
 * Features: Offline IndexedDB, Real-time Tracking, Turn-by-Turn Routing, 
 * Recenter, Voice Guidance, Search POI, Layer Control & Location Sharing.
 */

// 1. Inisialisasi Pembolehubah Global
let map, userMarker, routingControl;
let currentPos = [3.1390, 101.6869]; // Koordinat Lalai (KL)
const statusEl = document.getElementById('status');

// --- 2. SETUP LAYERS (Google Maps Style) ---
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
});

const baseMaps = {
    "Default Street": streetLayer,
    "Satellite View": satelliteLayer
};

// --- 3. INDEXEDDB SETUP (Storan Offline Pintar) ---
const dbRequest = indexedDB.open("SmartNavDB", 1);

dbRequest.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("trips")) {
        db.createObjectStore("trips", { keyPath: "timestamp" });
    }
    console.log("SmartNavDB: Database Ready.");
};

dbRequest.onerror = (e) => console.error("Database Error:", e.target.errorCode);

// --- 4. FUNGSI VOICE GUIDANCE (TTS) ---
function speak(text) {
    if ('speechSynthesis' in window) {
        // Hentikan suara sedia ada jika ada
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ms-MY'; // Bahasa Melayu
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// --- 5. FUNGSI NAVIGASI & ROUTING ---
function createRoute(destLat, destLng) {
    if (routingControl) {
        map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(currentPos[0], currentPos[1]), 
            L.latLng(destLat, destLng)
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
        speak("Laluan ditemui. Sila ikut arahan pada peta.");
    });
}

// --- 6. SEARCH POI (Point of Interest) ---
async function searchPOI(query) {
    if (!query) return;
    statusEl.innerText = `Mencari: ${query}...`;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await response.json();
        
        if (data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const newDest = [parseFloat(lat), parseFloat(lon)];
            
            map.flyTo(newDest, 15);
            L.popup().setLatLng(newDest).setContent(`<b>Destinasi:</b><br>${display_name}`).openOn(map);
            
            createRoute(newDest[0], newDest[1]);
        } else {
            alert("Lokasi tidak ditemui. Sila cuba kata kunci lain.");
            updateOnlineStatus();
        }
    } catch (err) {
        console.error("Search Error:", err);
        alert("Gagal menghubungi pelayan carian.");
    }
}

// --- 7. FUNGSI SHARE LOCATION (Link & Geolocation) ---
function shareMyLocation() {
    // Format link yang serasi dengan Google Maps & Apple Maps
    const shareUrl = `https://www.google.com/maps?q=${currentPos[0]},${currentPos[1]}`;
    const shareText = `Lokasi SmartNav 2050 saya:\nLat: ${currentPos[0]}\nLng: ${currentPos[1]}`;

    if (navigator.share) {
        navigator.share({
            title: 'SmartNav 2050 - Perkongsian Lokasi',
            text: shareText,
            url: shareUrl
        }).catch(err => console.log("Gagal share:", err));
    } else {
        // Fallback jika browser tidak sokong Web Share API
        const dummy = document.createElement("input");
        document.body.appendChild(dummy);
        dummy.value = shareUrl;
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        alert("Link lokasi telah disalin ke clipboard!");
    }
}

// --- 8. RECENTER & TRACKING ---
function recenterMap() {
    if (currentPos) {
        map.flyTo(currentPos, 17, { animate: true, duration: 1.5 });
        statusEl.innerText = "Mengunci lokasi GPS...";
        statusEl.style.background = "rgba(230, 255, 240, 0.9)";
        setTimeout(updateOnlineStatus, 2000);
    } else {
        alert("GPS sedang mencari isyarat...");
    }
}

function startLocationTracking() {
    if (!navigator.geolocation) {
        statusEl.innerText = "GPS Tidak Disokong";
        return;
    }

    navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude, accuracy } = position.coords;
        currentPos = [latitude, longitude];

        if (!userMarker) {
            userMarker = L.marker(currentPos).addTo(map).bindPopup("Anda di sini").openPopup();
        } else {
            userMarker.setLatLng(currentPos);
        }

        if (!routingControl) {
            map.panTo(currentPos);
        }
        
        saveTripData(position.coords);
    }, (err) => console.warn(err), { enableHighAccuracy: true, timeout: 10000 });
}

// --- 9. INIT MAP & STARTUP ---
function initMap() {
    map = L.map('map', {
        center: currentPos,
        zoom: 13,
        layers: [streetLayer] 
    });

    // Tambah kawalan layer (Street vs Satellite)
    L.control.layers(baseMaps).addTo(map);

    map.on('click', (e) => {
        createRoute(e.latlng.lat, e.latlng.lng);
    });
}

function saveTripData(coords) {
    const db = dbRequest.result;
    if (!db) return;
    const tx = db.transaction("trips", "readwrite");
    tx.objectStore("trips").add({
        timestamp: Date.now(),
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
    });
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    statusEl.innerText = isOnline ? "Sistem Online" : "Mod Offline Aktif";
    statusEl.style.background = isOnline ? "rgba(230, 255, 240, 0.9)" : "rgba(255, 245, 245, 0.9)";
    statusEl.style.color = isOnline ? "#2d3748" : "#c53030";
    statusEl.style.borderLeft = isOnline ? "5px solid #28a745" : "5px solid #dc3545";
}

// --- 10. EVENT LISTENERS ---
window.addEventListener('load', () => {
    initMap();
    startLocationTracking();
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('SW Registered'))
        .catch(err => console.error('SW Failed', err));
}
