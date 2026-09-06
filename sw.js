const CACHE_NAME = 'cofrinho-estavel-v1';

// Apenas arquivos locais do próprio repositório
const LOCAL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Busca primeiro na rede. Se falhar (offline), busca no cache local.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Se a resposta for válida e for do nosso próprio domínio, atualiza o cache silenciosamente
        if (response && response.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, respClone));
        }
        return response;
      })
      .catch(() => {
        // Sem internet: entrega do cache local ou a página principal
        return caches.match(e.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
