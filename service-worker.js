// service-worker.js – גרסת בסיס ל־PWA של יערת העמק

const CACHE_NAME = "yaarat-haemek-v1";

const ASSETS_TO_CACHE = [
  "index.html",
  "style.css",
  "app.js",
  "logo.png",
  "exams.html",
  "admin.html"
  // תוכל להוסיף פה קבצים נוספים אם בא לך
];

self.addEventListener("install", (event) => {
  console.log("[SW] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activate");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  // ניסיון קודם מה־cache, אם אין – רשת
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
