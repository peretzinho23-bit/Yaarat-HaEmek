// service-worker.js
// חכם, לא ננעל על גרסה ישנה 😉

const CACHE_VERSION = "v5"; // כשתשנה קוד – תעלה ל-v6, v7 וכו'
const CACHE_NAME = `yaarat-static-${CACHE_VERSION}`;

// קבצים עיקריים שכדאי לשמור מראש (יעבוד גם אם לא תשים את כולם)
const PRECACHE_URLS = [
  "/",                 // root
  "/index.html",
  "/admin.html",
  "/polls.html",

  "/z.html",
  "/h.html",
  "/t.html",
  "/exams.html",
  "/redirect-edu.html",

  "/style.css",
  "/admin.css",

  "/app.js",
  "/admin.js",
  "/polls.js",
  "/home-poll-mini.js",
  "/firebase-config.js",
  "/analytics.js",
  "/accessibility.js",

  "/manifest.json",
  "/logo.png",
];

// בזמן התקנה – שומר סטטי בסיסי
self.addEventListener("install", (event) => {
  console.log("[SW] install", CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] precache error (לא נורא אם חלק נופל):", err);
      });
    })
  );

  // לגרום ל-SW החדש להתקין כמה שיותר מהר
  self.skipWaiting();
});

// בזמן הפעלה – מוחק קאש ישן
self.addEventListener("activate", (event) => {
  console.log("[SW] activate", CACHE_NAME);

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith("yaarat-static-")) {
            console.log("[SW] deleting old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// פונקציה: האם הבקשה היא לדף HTML (ניווט)
function isHtmlNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept") &&
      request.headers.get("accept").includes("text/html"))
  );
}

// FETCH – לוגיקה חכמה
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // רק תחום האתר שלנו
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1) דפי HTML – NETWORK FIRST
  if (isHtmlNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // שומר ב-cache לגרסה הנוכחית
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, resClone);
          });
          return response;
        })
        .catch(() => {
          // אין רשת? נחפש בקאש
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // ניסיון אחרון – index.html
            return caches.match("/index.html");
          });
        })
    );
    return;
  }

  // 2) CSS / JS / תמונות – STALE WHILE REVALIDATE
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, resClone);
            });
            return response;
          })
          .catch((err) => {
            // אם אין רשת – מחזיר מהקאש אם יש
            if (cached) return cached;
            throw err;
          });

        // אם יש בקאש – מחזיר מהר, ומאחורה מעדכן
        return cached || networkFetch;
      })
    );
    return;
  }

  // 3) שאר הדברים – נסה מהקאש, אחרת מהאינטרנט
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).catch(() => {
          // אם אין כלום – כלום :)
          return new Response("Offline", { status: 503, statusText: "Offline" });
        })
      );
    })
  );
});
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
