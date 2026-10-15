/* =========================================================
   FINANCE AI — SERVICE WORKER (OFFLINE PWA CACHE)
   Provides offline functionality and fast asset caching
========================================================= */

const CACHE_NAME = "finance-ai-cache-v1";

// Core assets to pre-cache on service worker installation
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/gura_chibi_left_clean.png",
  "./assets/gura_chibi_right_clean.png",
  "./assets/exact_hero_mascot.png",
  "./assets/gura_hero_clean.png",
  "./assets/gura_hero_exact.png",
  "./assets/gura_confirm_chibi.png",
  "./assets/gura_emote_happy.png",
  "./assets/gura_emote_plead.png",
  "./assets/demo_7eleven.jpg",
  "./assets/demo_goodmate.jpg"
];

// Install Event: Pre-cache core files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline assets");
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate caching strategy with offline fallback
self.addEventListener("fetch", (event) => {
  // Only handle HTTP/HTTPS GET requests
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  // Skip browser extension schemes
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Cache successful responses for subsequent offline loads
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is page navigation, return index.html
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });

      // Serve from cache immediately if present, otherwise fetch from network
      return cachedResponse || fetchPromise;
    })
  );
});
