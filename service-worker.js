// service-worker.js
// SW פשוט, עדכני, עובד טוב עם PWA 💙

const CACHE_VERSION = "v33"; // אם אתה משנה SW - תעלה גרסה
const CACHE_NAME = `yaarat-static-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/news.html",
  "/article.html",
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
  "/logo.png"
];

// 🔹 התקנה – מנסה לעשות פריקאש, לא מתפוצץ אם משהו לא נטען
self.addEventListener("install", (event) => {
  console.log("[SW] install", CACHE_NAME);

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        console.warn("[SW] precache error (לא נורא אם חלק נופל):", err);
      }
    })()
  );

  self.skipWaiting();
});

// 🔹 אקטיבציה – מנקה קאש ישן
self.addEventListener("activate", (event) => {
  console.log("[SW] activate", CACHE_NAME);

  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith("yaarat-static-")) {
            console.log("[SW] deleting old cache:", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// האם הבקשה היא ניווט ל-HTML (עמוד)
function isHtmlNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept") &&
      request.headers.get("accept").includes("text/html"))
  );
}

// 🔹 FETCH – לוגיקה:
// HTML → network first + fallback קאש
// CSS/JS/תמונות → קאש קודם, אח"כ רשת
// כל השאר → קאש או רשת
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // רק לדומיין שלנו
  if (url.origin !== self.location.origin) return;

  // 1) דפי HTML
  if (isHtmlNavigationRequest(request)) {
    event.respondWith(handleHtmlRequest(request));
    return;
  }

  // 2) סטטיק – CSS / JS / תמונות / פונט
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // 3) כל השאר – קודם קאש, אם אין אז רשת
  event.respondWith(handleGenericRequest(request));
});

async function handleHtmlRequest(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    // אין רשת – ננסה מהקאש
    const cached = await caches.match(request);
    if (cached) return cached;

    // ניסיון אחרון – index.html
    const fallback = await caches.match("/index.html");
    if (fallback) return fallback;

    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function handleStaticRequest(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      const resClone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
      return response;
    })
    .catch(() => cached || new Response("Offline", { status: 503 }));

  // אם יש קאש – נחזיר אותו מהר, ובמקביל נעדכן מהאינטרנט
  return cached || fetchPromise;
}

async function handleGenericRequest(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    return await fetch(request);
  } catch {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

// 🔹 קבלת הודעה מהדף (כדי לעשות skipWaiting בלחיצת כפתור)
self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});
