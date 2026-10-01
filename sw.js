const CACHE = "abmgis-v0.1.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/app.js",
  "./src/models.js",
  "./src/engine.js",
  "./src/sim-worker.js",
  "./src/bila-bridge.js",
  "./src/gis.js",
  "./vendor/bilascript/v4/src/compiler.js",
  "./vendor/bilascript/v4/src/parser.js",
  "./vendor/bilascript/v4/src/lexer.js",
  "./vendor/bilascript/v4/src/vocabulary.js",
  "./vendor/bilascript/v4/src/semantic.js",
  "./vendor/bilascript/v4/src/normalize.js",
  "./vendor/bilascript/v4/src/codegen-js.js",
  "./vendor/bilascript/v4/src/source-map.js",
  "./vendor/bilascript/v4/src/performance.js",
  "./vendor/bilascript/v4/src/type-system.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => cached);

      return cached || network;
    })
  );
});
