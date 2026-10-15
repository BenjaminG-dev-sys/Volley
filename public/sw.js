// Service worker de Voley EC.
// - Recursos estáticos de Next (/_next/static, íconos): primero caché.
// - Páginas: primero red; si no hay red, la última copia guardada o /offline.
//   Así la mesa de control (/mesa/*) abre sin conexión y su cola local (IndexedDB) sincroniza al volver.
// - Nunca se guardan /api, /admin ni respuestas de otros dominios (InsForge); sin red, /admin muestra /offline.
const VERSION = "ligas-rurales-v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const CACHEABLE_PAGES = /^\/($|mesa|torneos|partidos|equipos|jugadores|offline)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Al cerrar sesión se borran las páginas guardadas (pueden tener datos del usuario).
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && CACHEABLE_PAGES.test(url.pathname)) {
            const copy = res.clone();
            caches.open(PAGES).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          // Redirige en vez de servir /offline bajo otra URL: Next no puede hidratar una ruta distinta.
          if (url.pathname !== OFFLINE_URL) return Response.redirect(OFFLINE_URL, 302);
          return (await caches.match(OFFLINE_URL)) || Response.error();
        }),
    );
  }
});
