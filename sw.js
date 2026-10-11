// Service worker aplikacji Robot Zuzi: działa bez internetu (np. w sieci Wi-Fi robota).
// - strona: najpierw sieć (świeża wersja), bez sieci z pamięci,
// - pliki z /assets/ (nazwy z hashem) i ikony: z pamięci,
// - modele i silnik MediaPipe (kilkanaście MB): z osobnej pamięci, która przeżywa nowe wersje aplikacji.
// Rejestrowany tylko w buildzie produkcyjnym (src/pwa.ts); wersja = parametr ?v= w adresie.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const APP = `robot-zuzi-app-${VERSION}`;
const MODELS = "robot-zuzi-models";
const SHELL = ["./", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== MODELS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isModel = (url) =>
  (url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("/@mediapipe/")) ||
  (url.hostname === "storage.googleapis.com" && url.pathname.startsWith("/mediapipe-models/"));

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(APP);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put("./", res.clone());
    return res;
  } catch {
    return (await cache.match("./")) || Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req));
  } else if (isModel(url)) {
    e.respondWith(cacheFirst(req, MODELS));
  } else if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(req, APP));
  }
});
