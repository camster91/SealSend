/* No guest content, authenticated pages, tokens or API responses are cached. */
const CACHE = 'sealsend-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('sealsend-offline-') || key === 'sealsend-v2' || key === 'sealsend-v1') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const offline = await caches.match(OFFLINE);
    return offline || new Response('You are offline. Reconnect to use SealSend.', { status:503,headers:{ 'Content-Type':'text/plain' } });
  }));
});
