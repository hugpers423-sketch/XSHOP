// apps/web/public/sw.js
// Service Worker — X-STORE PWA
// Estrategias: cache-first para assets, network-first para API, offline shell

const VERSION = 'xstore-v1.0.0';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const API_CACHE = `${VERSION}-api`;

const PRECACHE_URLS = [
  '/',
  '/reels',
  '/marketplace',
  '/cart',
  '/manifest.json',
];

// Instalar: precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activar: limpiar versiones viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: estrategia híbrida
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API: network-first con fallback a cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 2. Assets estáticos: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpg|svg|webp|avif|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // 3. Navegaciones: network-first con offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(
          () =>
            caches.match('/').then((cached) => cached || new Response('Offline', { status: 503 }))
        )
    );
    return;
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {
    title: 'X-STORE 🔔',
    body: 'Tienes una nueva notificación',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: data.url ?? '/',
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data ?? '/')
  );
});

// Background sync (carrito pendiente)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cart') {
    event.waitUntil(
      caches.open('pending-actions').then((cache) =>
        cache.keys().then((keys) =>
          Promise.all(
            keys.map((key) =>
              fetch(key, { method: 'POST', body: 'sync' }).then(() => cache.delete(key))
            )
          )
        )
      )
    );
  }
});
