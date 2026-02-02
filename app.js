/**
 * SmartNav 2050 - 3D Driving & Liquid Glass Edition (Integrated)
 * Kemaskini: Hybrid Search (Online + Offline Fallback) + API Integration
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

// --- 5. HYBRID SEARCH POI (ONLINE + OFFLINE) ---
async function searchPOI(query) {
    if (!query) return;
    query = query.toLowerCase();
    statusEl.innerText = `Mencari: ${query}...`;

    // A. STRATEGI ONLINE: Guna Nominatim jika ada rangkaian
    if (navigator.onLine) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
                headers: { 
                    'Accept-Language': 'ms',
                    'User-Agent': 'SmartNav2050-App-AimanRafee' 
                }
            });
            const data = await response.json();
            if (data && data.length > 0) {
                renderSearchResult(data[0].lat, data[0].lon, data[0].display_name);
                return;
            }
        } catch (err) {
            console.log("Online search gagal, beralih ke mod Offline...");
        }
    }

    // B. STRATEGI OFFLINE: Guna data dari semenanjung-poi.json (Fallback)
    try {
        const poiSource = map.getSource('semenanjung-poi');
        if (poiSource) {
            // Mengambil features yang telah dimuatkan ke dalam peta
            const features = map.querySourceFeatures('semenanjung-poi');
            
            // Cari padanan nama dalam harta (properties) GeoJSON
            const match = features.find(f => 
                f.properties.name && f.properties.name.toLowerCase().includes(query)
            );

            if (match) {
                const [lon, lat] = match.geometry.coordinates;
                renderSearchResult(lat, lon, match.properties.name + " (Data Offline)");
                speak(`Menemui lokasi offline: ${match.properties.name}`);
            } else {
                alert("Lokasi tidak ditemui. Sila cuba kata kunci lain.");
                updateOnlineStatus();
            }
        }
    } catch (e) {
        console.error("Offline Search Error:", e);
        statusEl.innerText = "⚠️ Ralat enjin carian.";
    }
}

// Fungsi pembantu untuk memaparkan hasil carian pada peta
function renderSearchResult(lat, lon, name) {
    const dest = [parseFloat(lon), parseFloat(lat)];
    window.currentDest = dest;

    map.flyTo({ 
        center: dest, 
        zoom: 17, 
        pitch: 70, 
        speed: 1.2, 
        essential: true 
    });

    // Buat marker baru untuk destinasi
    new maplibregl.Marker({ color: '#ff4b2b' })
        .setLngLat(dest)
        .setPopup(new maplibregl.Popup().setHTML(`<b>${name}</b>`))
        .addTo(map);

    statusEl.innerText = `Destinasi: ${name}`;
    speak(`Destinasi ditemui. Klik mula untuk navigasi.`);

    setTimeout(() => {
        if(confirm(`Mulakan Navigasi ke ${name}?`)) {
            startNavigation();
        }
    }, 800);
}

// --- 6. LOGIK MOD PEMANDUAN 3D ---
function startNavigation() {
    const navPanel = document.getElementById('nav-instruction');
    if (navPanel) navPanel.style.display = 'block';
    
    map.easeTo({
        pitch: 75,
        zoom: 18,
        duration: 2000,
        bearing: lastHeading,
        essential: true
    });

    statusEl.innerText = "Mod Navigasi Aktif";
    speak("Navigasi bermula. Terus ke hadapan.");
}

// --- 7. LOGIK POV PEMANDUAN & TRACKING ---
function startLocationTracking() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const newCoords = [longitude, latitude];
        currentPos = newCoords;

        if (heading !== null && heading !== undefined) {
            lastHeading = heading;
        }

        if (!userMarker) {
            userMarker = new maplibregl.Marker({ color: '#00d4ff', scale: 0.9 })
                .setLngLat(newCoords)
                .addTo(map);
        } else {
            userMarker.setLngLat(newCoords);
        }

        map.easeTo({
            center: newCoords,
            bearing: lastHeading, 
            pitch: speed > 2 ? 75 : 65, 
            duration: 1500,
            easing: (t) => t 
        });

        saveTripData(position.coords);
    }, (err) => console.warn(err), { 
        enableHighAccuracy: true,
        maximumAge: 0, 
        timeout: 5000 
    });
}

// --- 8. RECENTER ---
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
        
        const navPanel = document.getElementById('nav-instruction');
        if (navPanel) navPanel.style.display = 'none';
        
        setTimeout(updateOnlineStatus, 2000);
    }
}

// --- 9. SHARE LOCATION ---
function shareMyLocation() {
    const shareUrl = `https://www.google.com/maps?q=${currentPos[1]},${currentPos[0]}`;
    if (navigator.share) {
        navigator.share({
            title: 'SmartNav 2050',
            text: 'Lokasi real-time saya:',
            url: shareUrl
        });
    } else {
        navigator.clipboard.writeText(shareUrl);
        alert("Pautan lokasi disalin!");
    }
}

// --- 10. INIT MAP (INTEGRASI SMARTNAV-API) ---
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
        statusEl.innerText = "🚀 Menghubungkan ke SmartNav-API...";

        // A. Masukkan Data Jalan Raya (76MB dari GitHub)
        map.addSource('semenanjung-roads', {
            type: 'geojson',
            data: 'https://raw.githubusercontent.com/aimanrafee/SmartNav-API/main/data/semenanjung-roads.json',
            tolerance: 0.5 
        });

        // B. Paparkan Layer Jalan (Neon Style 2050)
        map.addLayer({
            'id': 'roads-master-layer',
            'type': 'line',
            'source': 'semenanjung-roads',
            'paint': {
                'line-color': '#00d4ff',
                'line-width': 2,
                'line-opacity': 0.6
            }
        });

        // C. Masukkan Data POI (1.6MB) untuk Offline Search
        map.addSource('semenanjung-poi', {
            type: 'geojson',
            data: 'https://raw.githubusercontent.com/aimanrafee/SmartNav-API/main/data/semenanjung-poi.json'
        });

        // D. Baiki Ralat 'building' (Check dahulu jika layer wujud)
        if (map.getLayer('building')) {
            try {
                map.setPaintProperty('building', 'fill-extrusion-height', ['get', 'height']);
            } catch (e) {
                console.warn("Sistem: Layer 'building' wujud tetapi data 'height' tidak ditemui.");
            }
        }
        
        startLocationTracking();
        updateOnlineStatus();
        statusEl.innerText = "🚀 Navigasi 3D 2050 Aktif (API Connected)";
    });

    map.on('styleimagemissing', (e) => {
        console.warn(`Ikon "${e.id}" tiada dalam sprite. Menggunakan placeholder.`);
    });
}

// --- 11. UTILITY ---
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

// --- 12. STARTUP ---
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SmartNav Offline Engine: Ready'))
            .catch(err => console.log('SmartNav Offline Engine: Failed', err));
    });
}
