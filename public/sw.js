const CACHE_NAME = 'sealsend-v2';
const PRECACHE_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/events/') ||
    url.pathname.startsWith('/settings') ||
    url.pathname.startsWith('/guest') ||
    url.pathname.startsWith('/callback') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/signup')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cacheControl = response.headers.get('cache-control') || '';
        if (response.ok && response.type === 'basic' && !cacheControl.includes('no-store')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
