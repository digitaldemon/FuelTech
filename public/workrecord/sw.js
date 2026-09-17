/* Keeps the app working with no signal. Bump CACHE when you re-deploy. */
const CACHE = "workrecord-v4";
const SHELL = ["./", "./index.html", "./manifest.json",
               "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Never cache the weather lookup — it must be live or fail.
  if (new URL(req.url).origin !== self.location.origin) return;

  // Serve the app instantly from cache, and quietly refresh it when there is signal.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const live = fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || live;
    })
  );
});
