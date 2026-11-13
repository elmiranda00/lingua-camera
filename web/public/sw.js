// Service worker: keeps the OCR files and the app on the phone
// Bump MODELS when a model or runtime file changes; old caches are deleted on activate.
const MODELS = "lc-models-v1";
const STATIC = "lc-static-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== MODELS && key !== STATIC) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.status === 200) await cache.put(request, res.clone());
  return res;
}

async function networkFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.status === 200) await cache.put(request, res.clone());
    return res;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/models/") || url.pathname.startsWith("/ort/")) {
    event.respondWith(cacheFirst(MODELS, request));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(STATIC, request)); // hashed file names never change
  } else if (request.mode === "navigate" || url.pathname === "/ocr-assets.json") {
    event.respondWith(networkFirst(STATIC, request));
  }
});
