// analytics.js – לוגים + דשבורד אנליטיקות ליערת העמק (Firestore)
// ✅ analytics_pageViews = אגרגציה נקייה (מסמך אחד ליום+דף)
// אופציונלי: analytics_events = לוג גולמי (כבוי)

import { db, auth } from "./firebase-config.js";

import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  increment,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

/* =============================
   CONFIG
============================= */

const PAGEVIEWS_COLLECTION = "analytics_pageViews";

// RAW EVENTS (מומלץ להשאיר כבוי כדי לא ליצור מלא מסמכים)
const EVENTS_COLLECTION = "analytics_events";
const ENABLE_RAW_EVENTS = false;

const pageviewsRef = collection(db, PAGEVIEWS_COLLECTION);
const eventsRef = collection(db, EVENTS_COLLECTION);

// מניעת כפילויות מרענון/טעינות כפולות
const DEDUPE_WINDOW_MS = 12_000;

/* =============================
   HELPERS
============================= */

function safeLower(v) {
  return v == null ? null : String(v).trim().toLowerCase();
}

function getPathWithQuery() {
  return (location.pathname || "/") + (location.search || "");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// YYYY-MM-DD לפי שעון מקומי (ישראל)
function dateKeyLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseGradeClassFromURL() {
  const usp = new URLSearchParams(location.search);

  const classIdRaw = usp.get("class") || usp.get("classId") || usp.get("cid") || null;
  const gradeRaw = usp.get("grade") || usp.get("g") || null;

  const classId = safeLower(classIdRaw);
  let grade = safeLower(gradeRaw);

  // אם אין grade אבל יש classId כמו z3 -> נחלץ ממנו
  if (!grade && classId && /^[zht]\d+$/i.test(classId)) {
    grade = classId[0];
  }

  // data-* על ה-body תמיד מנצח
  const body = document.body;
  const bodyGrade = safeLower(body?.dataset?.grade || null);
  const bodyClassId = safeLower(body?.dataset?.classId || null);

  return {
    classId: bodyClassId || classId || null,
    grade: bodyGrade || grade || null,
  };
}

/**
 * מיפוי קבוע של הדפים שלך
 */
function getPageKeyFromPath(pathname) {
  const p = (pathname || "/").toLowerCase();

  if (p === "/" || p.endsWith("/index.html")) return "index";

  if (p.endsWith("/about.html")) return "about";
  if (p.endsWith("/admin.html")) return "admin";
  if (p.endsWith("/adminapps.html")) return "adminapps";
  if (p.endsWith("/article.html")) return "article";
  if (p.endsWith("/class.html")) return "class";
  if (p.endsWith("/exams.html")) return "exams";
  if (p.endsWith("/news.html")) return "news";
  if (p.endsWith("/polls.html")) return "polls";
  if (p.endsWith("/redirect-edu.html")) return "redirect-edu";
  if (p.endsWith("/register.html")) return "register";

  // דשבורד
  if (p.endsWith("/analytics.html")) return "analytics-dashboard";

  // fallback: שם הקובץ בלי .html
  const file = (p.split("/").pop() || "").trim();
  if (file.endsWith(".html")) return file.replace(".html", "");
  return "page";
}

function getPageMeta() {
  const body = document.body;
  const pageFromBody = safeLower(body?.dataset?.page || null);

  const page = pageFromBody || getPageKeyFromPath(location.pathname);
  const { grade, classId } = parseGradeClassFromURL();

  return { page, grade, classId };
}

function shouldSkipLogging(page) {
  // לא רושמים צפיות לדשבורד אנליטיקס עצמו
  return page === "analytics-dashboard";
}

function dedupeKey() {
  const meta = getPageMeta();
  return JSON.stringify({
    page: meta.page,
    path: getPathWithQuery(),
  });
}

function canLogNow() {
  try {
    const key = "analytics_last_" + btoa(dedupeKey()).slice(0, 40);
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || "0");
    if (now - last < DEDUPE_WINDOW_MS) return false;
    localStorage.setItem(key, String(now));
    return true;
  } catch {
    return true;
  }
}

function isPermissionDenied(err) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  return code.includes("permission-denied") || msg.toLowerCase().includes("permission");
}

/* =============================
   AUTH: Try anonymous sign-in (helps if rules require auth)
============================= */
async function ensureAuthForAnalytics() {
  try {
    if (auth?.currentUser) return true;
    // יצליח רק אם Anonymous Auth מופעל בפרויקט
    await signInAnonymously(auth);
    return true;
  } catch (e) {
    // לא שוברים כלום אם זה לא פעיל
    console.warn("analytics: anonymous auth not available:", e?.code || e?.message || e);
    return false;
  }
}

/* =============================
   1) LOG PAGE VIEW (AGGREGATED)
============================= */

async function logPageView() {
  try {
    const { page, grade, classId } = getPageMeta();
    if (shouldSkipLogging(page)) return;
    if (!canLogNow()) return;

    // ננסה ליצור user אנונימי כדי לעבור rules שדורשות auth
    await ensureAuthForAnalytics();

    const now = new Date();
    const dateKey = dateKeyLocal(now);
    const hour = pad2(now.getHours());
    const path = getPathWithQuery();

    const docId = `${dateKey}__${page}`;

    await setDoc(
      doc(db, PAGEVIEWS_COLLECTION, docId),
      {
        dateKey,
        pageId: page,
        views: increment(1),

        lastPath: path,
        lastHour: hour,
        lastGrade: grade || null,
        lastClassId: classId || null,

        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (ENABLE_RAW_EVENTS) {
      await addDoc(eventsRef, {
        path,
        pageId: page,
        grade: grade || null,
        classId: classId || null,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent || null,
        language: navigator.language || null,
        screen: {
          w: window.screen?.width || null,
          h: window.screen?.height || null,
        },
        tzOffsetMin: new Date().getTimezoneOffset(),
        dateKey,
        hour,
        createdAt: serverTimestamp(),
        createdAtClient: new Date().toISOString(),
      });
    }
  } catch (err) {
    if (isPermissionDenied(err)) {
      // שקט – לא מפילים אתר בגלל אנליטיקס
      console.warn("analytics: permission denied (log skipped)");
      return;
    }
    console.error("שגיאה בשמירת אנליטיקות:", err);
  }
}

/* =============================
   2) DASHBOARD (reads AGGREGATION)
============================= */

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value);
}

async function canReadAnalyticsDashboard(user) {
  // אם אין לך rules שמגינות על זה, תחזיר true.
  // אם יש, נבדוק adminUsers role.
  try {
    const uid = user?.uid;
    if (!uid) return false;

    const snap = await getDoc(doc(db, "adminUsers", uid));
    if (!snap.exists()) return false;

    const role = String(snap.data()?.role || "").trim().toLowerCase();
    return ["dev", "principal", "admin"].includes(role);
  } catch (e) {
    console.warn("analytics dashboard role check failed:", e?.code || e?.message || e);
    return false;
  }
}

async function loadAnalyticsDashboard() {
  const statusEl = document.getElementById("analytics-status");
  if (statusEl) statusEl.textContent = "טוען נתוני אנליטיקות...";

  try {
    const today = dateKeyLocal(new Date());

    const qViews = query(pageviewsRef, orderBy("dateKey", "desc"), limit(6000));
    const snap = await getDocs(qViews);
    const rows = snap.docs.map((d) => d.data());

    if (!rows.length) {
      if (statusEl) statusEl.textContent = "אין עדיין נתונים להצגה.";
      setText("analytics-total-visits", 0);
      setText("analytics-today-visits", 0);
      setText("analytics-unique-pages", 0);
      setText("analytics-unique-classes", 0);
      return;
    }

    let totalViews = 0;
    let todayViews = 0;

    const byPage = new Map();
    for (const r of rows) {
      const v = Number(r.views || 0);
      totalViews += v;
      if (r.dateKey === today) todayViews += v;

      const pageId = r.pageId || "(לא ידוע)";
      byPage.set(pageId, (byPage.get(pageId) || 0) + v);
    }

    setText("analytics-total-visits", totalViews);
    setText("analytics-today-visits", todayViews);
    setText("analytics-unique-pages", byPage.size);
    setText("analytics-unique-classes", 0);

    if (statusEl) statusEl.textContent = `נטענו ${rows.length} מסמכי סיכום.`;
  } catch (err) {
    console.error("שגיאה בטעינת האנליטיקות:", err);
    if (isPermissionDenied(err)) {
      const statusEl = document.getElementById("analytics-status");
      if (statusEl) statusEl.textContent = "אין הרשאה לקרוא אנליטיקות. התחבר עם משתמש אדמין.";
      return;
    }
    const statusEl = document.getElementById("analytics-status");
    if (statusEl) statusEl.textContent = "אירעה שגיאה בטעינת נתוני האנליטיקות. בדוק Console.";
  }
}

/* =============================
   3) MAIN
============================= */

document.addEventListener("DOMContentLoaded", () => {
  const pageType = safeLower(document.body?.dataset?.page || "") || null;
  const computed = getPageKeyFromPath(location.pathname);
  const finalPage = pageType || computed;

  if (finalPage === "analytics-dashboard") {
    // דשבורד: נטען רק אחרי auth, כדי לא לקבל permission denied “סתם”
    onAuthStateChanged(auth, async (user) => {
      const statusEl = document.getElementById("analytics-status");

      if (!user) {
        if (statusEl) statusEl.textContent = "כדי לראות אנליטיקות צריך להתחבר (אדמין).";
        return;
      }

      const ok = await canReadAnalyticsDashboard(user);
      if (!ok) {
        if (statusEl) statusEl.textContent = "מחובר ✅ אבל אין הרשאה לדשבורד אנליטיקות.";
        return;
      }

      await loadAnalyticsDashboard();
    });
  } else {
    // כל שאר הדפים: לוג צפייה
    logPageView();
  }
});
