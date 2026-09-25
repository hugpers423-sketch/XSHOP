const CACHE_NAME = 'xshop-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/critical.css',
  '/styles/components.css',
  '/styles/layout.css',
  '/src/app.js',
  '/src/core/state.js',
  '/src/core/router.js',
  '/src/core/api.js',
  '/src/core/events.js',
  '/src/animations/waapi.js',
  '/src/animations/scroll.js',
  '/src/animations/transitions.js',
  '/src/ui/Button.js',
  '/src/ui/Input.js',
  '/src/ui/Modal.js',
  '/src/ui/Toast.js',
  '/src/ui/Skeleton.js',
  '/src/ui/Avatar.js',
  '/src/ui/Badge.js',
  '/src/ui/AuthModal.js',
  '/src/modules/payments/index.js',
  '/src/modules/feed/index.js',
  '/src/modules/reputation/index.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Ignorar peticiones que no sean GET
  if (request.method !== 'GET') return;

  // Ignorar chrome-extension:, data:, etc.
  if (!url.protocol.startsWith('http')) return;

  // Peticiones a la API — network first, sin caché
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request)
        .catch(() => new Response(JSON.stringify({ error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' }}))
    );
    return;
  }

  // Assets estáticos — stale while revalidate
  e.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(networkRes => {
        if (networkRes.ok) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, resClone));
        }
        return networkRes;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Sincronización en segundo plano de peticiones fallidas
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-payments') {
    e.waitUntil(syncPayments());
  }
});

async function syncPayments() {
  // Implementar lógica de sincronización offline de pagos
  console.log('[SW] Syncing pending payments...');
}