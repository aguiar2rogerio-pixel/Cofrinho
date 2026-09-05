// Service Worker hardened: add network timeout and offline fallback
const CACHE_NAME = 'cofrinho-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './offline.html'
];

const NETWORK_TIMEOUT = 8000; // ms

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache aberto, adicionando assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Alguns assets não puderam ser cacheados:', err);
        // tentamos ao menos garantir a raiz
        return cache.add('./').catch(() => {
          console.warn('[SW] Falha ao cachear a página raiz');
        });
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function fetchWithTimeout(request, timeout = NETWORK_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network-timeout')), timeout);
    fetch(request).then(response => {
      clearTimeout(timer);
      resolve(response);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // ignore cross-origin requests to avoid CORS cache issues
  const reqUrl = new URL(request.url);
  if (reqUrl.origin !== self.location.origin) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Handle navigation requests (pages) with network-first + fallback to index/offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match('./index.html').then(cached => cached || caches.match('./offline.html')))
    );
    return;
  }

  // For other GET requests: network-first with timeout, fallback to cache, then offline page
  event.respondWith(
    fetchWithTimeout(request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, respClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('./offline.html')))
  );
});
