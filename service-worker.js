const CACHE_NAME = "slovicka-v3";
const APP_SHELL = ["./index.html", "./manifest.json"];
const STATIC_ASSETS = ["./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...APP_SHELL, ...STATIC_ASSETS]))
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

  // App shell (index.html, manifest.json): always try the network first,
  // so updates you upload to GitHub show up immediately. Falls back to
  // cache only if there's no internet connection.
  if (event.request.mode === "navigate" || isAppShell(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (icons, fonts, etc.): cache-first is fine, they rarely change.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (event.request.method === "GET" && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
