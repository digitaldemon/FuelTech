// Minimal service worker — satisfies PWA installability criteria.
// Caches static assets so the app still loads offline.
//
// Cache name is versioned: bumping it purges every old entry on activate.
// v3 evicts caches poisoned by v2, which served stale bundles cache-first and
// stored login-redirect HTML under auth-gated asset URLs (broke /desk/app.js).
const CACHE = 'fueltechai-v3';

// Only genuinely public, static files belong here. Auth-gated routes must never
// be precached — addAll follows their login redirect and stores that HTML.
const SHELL = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// A response is only safe to cache if it came back from the URL we asked for.
// A redirect means auth (or a rewrite) sent us elsewhere, so the body belongs to
// that other URL — storing it under this key corrupts the entry.
function cacheable(res) {
  return res.ok && !res.redirected && res.type === 'basic';
}

self.addEventListener('fetch', (e) => {
  // Only handle same-origin GET requests; let API calls and cross-origin pass through.
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first: a fresh deploy must reach the user on the next load. The
  // cache is an offline fallback, not the primary source.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (cacheable(res)) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => {
        if (cached) return cached;
        throw new Error('offline and not cached');
      }))
  );
});
