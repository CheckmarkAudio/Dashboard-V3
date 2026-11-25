// Online-first app. Only the public reconnect page is stored offline.
// Never cache app HTML, credentials, API responses, images or project data.
const CACHE = 'checkmark-reconnect-v1'
const OFFLINE = '/offline.html'
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request(OFFLINE, { cache: 'reload' }))))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('checkmark-reconnect-') && key !== CACHE).map(key => caches.delete(key)),
  )).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE)
    return (await cache.match(OFFLINE)) || new Response('Reconnect to open Checkmark. Your saved work is online.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }))
})
