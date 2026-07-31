// Service Worker para Cofrinho Inteligente
// Versão: 1.1.0 (Com módulo de Nudge Psicológico)

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

  // DISPARADOR OPORTUNISTA: Sempre que o app se move, o SW avalia o hábito
  event.waitUntil(verificarGatilhoMentalOportunista());

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
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

// Sincronização em background como plano B
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(verificarGatilhoMentalOportunista());
  }
});

// Evento disparado quando o usuário clica na Notificação Silenciosa
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});

/* =========================================================================
   MÓDULO: GATILHO MENTAL SILENCIOSO (NUDGE)
   ========================================================================= */
async function verificarGatilhoMentalOportunista() {
  const clientsList = await self.clients.matchAll({ type: 'window' });
  const appVisivel = clientsList.some(client => client.visibilityState === 'visible');
  if (appVisivel) return;

  const hoje = new Date().toLocaleString('sv-SE', { timeZoneName: 'unset' }).split(' ');
  const cacheControle = await caches.open('nudge-controle-v1');
  
  const respostaUltimoAcesso = await cacheControle.match('/ultimo-acesso');
  if (respostaUltimoAcesso) {
    const dataUltimoAcesso = await respostaUltimoAcesso.text();
    if (dataUltimoAcesso === hoje) return;
  }

  const respostaUltimoDisparo = await cacheControle.match('/ultimo-disparo');
  if (respostaUltimoDisparo) {
    const dataUltimoDisparo = await respostaUltimoDisparo.text();
    if (dataUltimoDisparo === hoje) return;
  }

  try {
    await self.registration.showNotification('Saldo Seguro', {
      body: 'Só passando para lembrar que seu futuro financeiro existe.',
      tag: 'nudge-diario',
      silent: true,            
      renotify: false,         
      requireInteraction: false 
    });

    await cacheControle.put('/ultimo-disparo', new Response(hoje));
  } catch (err) {
    console.warn('[Nudge] Erro ao aplicar estímulo visual:', err);
  }
}
