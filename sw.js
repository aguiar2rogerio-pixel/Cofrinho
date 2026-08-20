// Service Worker para Cofrinho Inteligente
// Versão: 2.0.0 (Estrutura separada e cache atualizado)

const CACHE_NAME = 'cofrinho-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Evento de instalação
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache aberto, adicionando assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Alguns assets não puderam ser cacheados:', err);
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

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Servindo do cache:', request.url);
            return cachedResponse;
          }
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

// ==========================================
// MÓDULO DE LEMBRETE ELEGANTE (SERVICE WORKER)
// ==========================================

// Recebe comandos da página principal (ex: disparar notificação local silenciosa)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_SILENT_REMINDER') {
    const title = event.data.title || 'Saldo Seguro';
    const options = {
      body: event.data.body || 'Só passando para lembrar que seu futuro financeiro existe.',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      silent: true, // Sem som e sem vibração
      tag: 'daily-reminder', // Evita acumular múltiplas notificações idênticas
      renotify: false
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Ao clicar na notificação, foca ou abre o aplicativo de forma direta
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se o app já estiver aberto em alguma aba/janela, foca nele
      for (const client of clientList) {
        if (client.url.includes('./') && 'focus' in client) {
          return client.focus();
        }
      }
      // Se estiver fechado, abre o aplicativo
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

console.log('[SW] Service Worker carregado com sucesso!');
