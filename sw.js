// Service Worker for ChatLog PWA
// Cache-first strategy for assets, network-first for data

const CACHE_NAME = 'chatlog-v8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/style.css',
  '/assets/js/app.js',
  '/assets/js/storage.js',
  '/assets/js/parser.js',
  '/assets/js/mobile-nav.js',
  '/assets/js/user-mode.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js'
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('[SW] Cache failed:', err))
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache-first for static assets, network-first for data
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // For static assets: Cache first, network fallback
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // For everything else: Network first, cache fallback
  event.respondWith(networkFirst(request));
});

function isStaticAsset(url) {
  const staticPaths = ['/assets/', '/manifest.json'];
  return staticPaths.some(path => url.pathname.startsWith(path)) ||
         url.pathname === '/';
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    // Return cached but also fetch update in background
    fetch(request)
      .then(response => {
        if (response.ok) cache.put(request, response);
      })
      .catch(() => {});
    return cached;
  }
  
  // Not in cache, fetch and store
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-chats') {
    console.log('[SW] Background sync triggered');
  }
});

// Push notifications (future enhancement)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'ChatLog', {
      body: data.body || 'New update available',
      icon: '/assets/icon-192x192.png'
    })
  );
});
