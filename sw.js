// Service Worker for PWA
// This file will handle caching of application assets (the "App Shell")
// and provide offline functionality.

const CACHE_NAME = 'grocery-pos-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/main.js',
  '/src/db.js',
  '/src/pos.js',
  '/src/products.js',
  '/src/customers.js',
  '/src/reports.js',
  'https://cdn.jsdelivr.net/npm/pouchdb@8.0.1/dist/pouchdb.min.js'
];

// Install event: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: serve from cache first
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Not in cache - fetch from network
        return fetch(event.request);
      }
    )
  );
});
