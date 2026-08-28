/* ============================================================
   SENTINELLE CI — Service Worker
   Rôle : permettre l'installation de la plateforme comme application
   (icône sur écran d'accueil) et garder la dernière version ouverte
   accessible même sans connexion (la carte tactique par défaut et
   la plupart des fonctions n'ont de toute façon pas besoin d'internet).

   Ce fichier ne met en cache QUE les fichiers du même site (le shell :
   index.html, le manifeste, les icônes). Les ressources externes
   (Leaflet, ECharts, tuiles satellite Esri) passent normalement par le
   réseau et ne sont pas interceptées ici, pour rester simple et fiable.
   ============================================================ */

const CACHE_NAME = 'sentinelle-ci-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .catch(function () { /* pas bloquant si un fichier manque */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* laisser passer les CDN externes */

  /* navigation (ouverture/rechargement de la page) : réseau d'abord, repli sur le cache si hors-ligne */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, res.clone()); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
        })
    );
    return;
  }

  /* autres fichiers du même site : servir le cache immédiatement, rafraîchir en arrière-plan */
  event.respondWith(
    caches.match(req).then(function (cached) {
      const network = fetch(req)
        .then(function (res) {
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, res.clone()); });
          return res;
        })
        .catch(function () { return cached; });
      return cached || network;
    })
  );
});
