// Minimal service worker for the Proviant Production satellite app.
// Caches the app shell so /production loads when offline; API and dynamic
// data still go to the network. Mutations (POSTs/PATCHes) are not queued —
// they fail loudly when offline, by design for v1.

const CACHE = "proviant-production-v1";
const APP_SHELL = ["/production", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only GETs are cacheable. Anything else hits the network.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Out-of-scope requests: ignore.
  if (url.origin !== self.location.origin) return;

  // API calls: network-first, no cache fallback (mutations need fresh data).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // App shell / static assets: cache-first, fall back to network.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && (req.destination === "document" || req.destination === "script" || req.destination === "style" || req.destination === "image")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Final fallback for navigation requests when fully offline.
          if (req.destination === "document") {
            return caches.match("/production");
          }
          throw new Error("offline and not cached");
        });
    })
  );
});
