// Improved Service Worker: cache-first app-shell with background update + update flow handling
const CACHE_NAME = 'cofrinho-v3';
const APP_SHELL = [
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
  console.info('[SW] install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] some assets failed to cache', err);
        return cache.add('./').catch(() => {});
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.info('[SW] activate');
  event.waitUntil((async () => {
    // cleanup old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    // enable navigation preload if supported
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); console.info('[SW] navigationPreload enabled'); } catch (e) { console.warn('[SW] preload enable failed', e); }
    }
    await self.clients.claim();
  })());
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

// helper: background update for a url
function backgroundUpdate(url) {
  return fetch(url).then(resp => {
    if (!resp || resp.status !== 200) return;
    const copy = resp.clone();
    return caches.open(CACHE_NAME).then(cache => cache.put(url, copy));
  }).catch(() => {/* ignore */});
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // cross-origin: network-first, fallback to cache
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Navigation requests (pages) - cache-first + background update
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      // try cached app shell first
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('./index.html');
      if (cached) {
        // trigger background update but do not wait for it
        backgroundUpdate('./index.html');
        return cached;
      }

      // no cache -> try network (with preload if available) then fallback to offline
      try {
        // try navigation preload response first
        const preloadResp = await event.preloadResponse;
        if (preloadResp) {
          const copy = preloadResp.clone();
          cache.put('./index.html', copy);
          return preloadResp;
        }
        const networkResp = await fetchWithTimeout(request);
        if (networkResp && networkResp.status === 200) {
          const copy = networkResp.clone();
          cache.put('./index.html', copy);
        }
        return networkResp;
      } catch (err) {
        const fallback = await cache.match('./index.html') || await cache.match('./offline.html');
        return fallback;
      }
    })());
    return;
  }

  // Static resources: stale-while-revalidate for scripts/styles/images
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      // update in background
      backgroundUpdate(request.url);
      return cached;
    }
    try {
      const networkResp = await fetchWithTimeout(request);
      if (networkResp && networkResp.status === 200) {
        const copy = networkResp.clone();
        cache.put(request, copy);
      }
      return networkResp;
    } catch (err) {
      return cache.match('./offline.html');
    }
  })());
});

// listen for skipWaiting message from client
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
