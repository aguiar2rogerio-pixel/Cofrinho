// Service Worker para Cofrinho Inteligente
// Versão: 1.0.0

const CACHE_NAME = 'cofrinho-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// Evento de instalação
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache aberto, adicionando assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Alguns assets não puderam ser cacheados:', err);
        // Continuar mesmo se alguns assets falharem
        return cache.add('./').catch(() => {
          console.warn('[SW] Falha ao cachear a página raiz');
        });
      });
    })
  );
  self.skipWaiting();
});

// Evento de ativação
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
    })
  );
  self.clients.claim();
});

// Estratégia de fetch: Network First, com fallback para Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorar requisições não-GET
  if (request.method !== 'GET') {
    return;
  }

  // Estratégia: tentar rede primeiro, fallback para cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Se a resposta for bem-sucedida, cacheá-la
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tentar o cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Servindo do cache:', request.url);
            return cachedResponse;
          }
          // Se não estiver no cache, retornar página offline (se aplicável)
          console.warn('[SW] Recurso não encontrado:', request.url);
          return new Response('Recurso não disponível offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Sincronização em background (opcional, para navegadores que suportam)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Aqui você pode adicionar lógica de sincronização
      Promise.resolve()
    );
  }
});

console.log('[SW] Service Worker carregado com sucesso!');
