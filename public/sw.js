const CACHE_NAME = 'torneio-facil-v1'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  )
})

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch: network-first for API/auth, cache-first for static
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return

  // Network-first for API, auth, and Supabase calls
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // Stale-while-revalidate for Next.js pages
  if (url.hostname === self.location.hostname) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          return cached ?? networkFetch
        })
      )
    )
    return
  }

  // Cache-first for static assets (fonts, CDN)
  event.respondWith(
    caches.match(request).then(cached => cached ?? fetch(request))
  )
})

// Background sync for offline score submissions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-results') {
    event.waitUntil(syncPendingResults())
  }
})

async function syncPendingResults() {
  // Get pending results from IndexedDB and sync when online
  // (Implementation would use IndexedDB for offline queue)
}
