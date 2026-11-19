"use strict";

const CACHE_NAME = "petal-run-v27";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./renderer3d.js",
  "./three.min.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(APP_FILES.map(async file => {
        const url = new URL(file, self.registration.scope);
        const updateUrl = new URL(url);
        updateUrl.searchParams.set("precache", CACHE_NAME);
        const response = await fetch(updateUrl, { cache: "reload" });
        if (!response.ok) throw new Error(`Could not cache ${file}: ${response.status}`);
        await cache.put(url, response);
      }));
    })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(request)).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
