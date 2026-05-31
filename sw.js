// Service Worker for ChatLog PWA
// Cache-first strategy for assets, network-first for data

const CACHE_NAME = 'chatlog-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/style.css',
  '/assets/js/app.js',
  '/assets/js/storage.js',
  '/assets/js/parser.js',
  '/assets/js/mobile-nav.js',
  '/assets/js/user-mode.js',
  '/assets/js/cards.js',
  '/assets/js/tags.js',
  '/assets/js/search-filters.js',
  '/assets/js/stats.js',
  '/assets/js/ai.js',
  '/assets/js/sync.js',
  '/assets/js/summarizer.js',
  '/assets/js/animations.js',
  '/assets/js/virtual-list.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
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
        // Only cache valid responses with correct content type
        if (response.ok && response.status === 200) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {
        // Background update failed, cached version is still valid
      });
    return cached;
  }
  
  // Not in cache, fetch and store
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed and nothing in cache
    console.error('[SW] Fetch failed:', error);
    return new Response('Network error', { status: 408, statusText: 'Network Error' });
  }
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
