/*
 * Service worker minimal — Taxi Saint Irénée
 * - Pages : réseau d'abord (contenu toujours à jour), page hors ligne en secours
 *   pour que le numéro de téléphone reste accessible sans connexion.
 * - Fichiers /_astro/ (empreinte dans le nom, immuables) : cache d'abord.
 * Les appels aux API externes (adresses, itinéraire, envoi) ne sont jamais mis en cache.
 */
const VERSION = 'tsi-v1';
const SCOPE = self.registration.scope;
const OFFLINE_URL = new URL('offline/', SCOPE).href;
const PRECACHE = [OFFLINE_URL, new URL('favicon.svg', SCOPE).href];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.includes('/_astro/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
