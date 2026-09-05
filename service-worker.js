const CACHE_NAME = "slovicka-v5";
const APP_SHELL = ["./index.html", "./manifest.json"];
const STATIC_ASSETS = ["./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  // Only precache truly static assets (icons) that rarely change. The app
  // shell (index.html, manifest.json) is deliberately NOT precached here —
  // precaching it would freeze whatever version happens to be live at the
  // moment this service worker is installed, and that frozen copy would
  // then sit untouched indefinitely, only surfacing (looking like a bizarre
  // trip back in time) on the rare occasion a live fetch fails. Instead, the
  // app shell is only ever cached at runtime, straight from a fresh network
  // fetch — so any cached fallback is always the last version that actually
  // loaded successfully, never a stale install-time snapshot.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isAppShell(url) {
  return APP_SHELL.some((path) => url.endsWith(path.replace("./", "")) || url.endsWith("/"));
}

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // App shell (index.html, manifest.json): always fetch a truly fresh copy
  // from the network — cache: "no-store" skips the browser's own HTTP cache
  // too, not just the service worker's cache — so updates you upload to
  // GitHub always show up. Falls back to the last successfully-fetched copy
  // only if there's no internet connection at all — and that fallback is
  // scoped to this app's own cache bucket specifically (never an orphaned
  // one from an older version of this service worker).
  if (event.request.mode === "navigate" || isAppShell(url)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(event.request)))
    );
    return;
  }

  // Static assets (icons, fonts, etc.): cache-first is fine, they rarely change.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (event.request.method === "GET" && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    )
  );
});
