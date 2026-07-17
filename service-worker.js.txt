const CACHE_NAME = 'jarvis-ai-pro-v17-fixed';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS.map(url => new Request(url, {cache: 'reload'}))).catch(()=>{});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); })
      );
    }).then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', function(event) {
  // API calls ko cache mat karo - yehi busy error ka reason tha
  if (event.request.url.includes('workers.dev') || 
      event.request.url.includes('generativelanguage.googleapis.com') ||
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebase')) {
    return; // Network only
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Sirf success wale ko cache karo
      if (response && response.status === 200 && response.type === 'basic') {
        var respClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { 
          cache.put(event.request, respClone); 
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
