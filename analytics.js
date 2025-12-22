// analytics.js – לוגים + דשבורד אנליטיקות ליערת העמק (Firestore)
// מצב מומלץ: analytics_pageViews = אגרגציה (מסמך אחד ליום+דף(+כיתה))
// אופציונלי: analytics_events = לוג גולמי לכל כניסה (אם תרצה פירוט)

import { db } from "./firebase-config.js";
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
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* =============================
   CONFIG
============================= */

// ✅ אגרגציה (נקי, מעט מסמכים)
const PAGEVIEWS_COLLECTION = "analytics_pageViews";

// ✅ לוג גולמי (אפשר לכבות)
const EVENTS_COLLECTION = "analytics_events";
const ENABLE_RAW_EVENTS = false; // אם תרצה גם אירועים גולמיים, שנה ל-true

const pageviewsRef = collection(db, PAGEVIEWS_COLLECTION);
const eventsRef = collection(db, EVENTS_COLLECTION);

// כמה זמן לא לרשום שוב אותו דף (מונע כפילויות מרענון/טעינות כפולות)
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

function getPageKeyFromPath(pathname) {
  const p = (pathname || "/").toLowerCase();

  if (p === "/" || p.endsWith("/index.html")) return "index";

  if (p.includes("class.html")) return "class";
  if (p.includes("classes.html")) return "classes";
  if (p.includes("exams.html")) return "exams";
  if (p.includes("articles.html")) return "articles";
  if (p.includes("article.html")) return "article";
  if (p.includes("news.html")) return "news";
  if (p.includes("admin.html")) return "admin";
  if (p.includes("login.html")) return "login";
  if (p.includes("links.html")) return "links";
  if (p.includes("analytics.html")) return "analytics-dashboard";

  const file = p.split("/").pop() || "";
  if (file.endsWith(".html")) return file.replace(".html", "");
  return "page";
}

function parseGradeClassFromURL() {
  const usp = new URLSearchParams(location.search);

  const classIdRaw =
    usp.get("class") ||
    usp.get("classId") ||
    usp.get("cid") ||
    null;

  const gradeRaw =
    usp.get("grade") ||
    usp.get("g") ||
    null;

  const classId = safeLower(classIdRaw);
  let grade = safeLower(gradeRaw);

  if (!grade && classId && /^[zht]\d+$/i.test(classId)) {
    grade = classId[0];
  }

  const body = document.body;
  const bodyGrade = safeLower(body?.dataset?.grade || null);
  const bodyClassId = safeLower(body?.dataset?.classId || null);

  return {
    classId: bodyClassId || classId || null,
    grade: bodyGrade || grade || null,
  };
}

function getPageMeta() {
  const body = document.body;
  const pageFromBody = safeLower(body?.dataset?.page || null);
  const page = pageFromBody || getPageKeyFromPath(location.pathname);
  const { grade, classId } = parseGradeClassFromURL();
  return { page, grade, classId };
}

function shouldSkipLogging(page) {
  if (page === "analytics-dashboard") return true;
  return false;
}

function dedupeKey() {
  const meta = getPageMeta();
  return JSON.stringify({
    path: getPathWithQuery(),
    page: meta.page,
    classId: meta.classId,
  });
}

function canLogNow() {
  try {
    const key = "analytics_last_" + btoa(dedupeKey()).slice(0, 32);
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || "0");
    if (now - last < DEDUPE_WINDOW_MS) return false;
    localStorage.setItem(key, String(now));
    return true;
  } catch {
    return true;
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// YYYY-MM-DD לפי השעון המקומי (ישראל)
function dateKeyLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* =============================
   1) LOG PAGE VIEW (AGGREGATED)
============================= */

async function logPageView() {
  try {
    const { page, grade, classId } = getPageMeta();
    if (shouldSkipLogging(page)) return;
    if (!canLogNow()) return;

    const now = new Date();
    const dateKey = dateKeyLocal(now);
    const hour = pad2(now.getHours());

    const path = getPathWithQuery();

    // ✅ 1) אגרגציה נקייה: מסמך אחד ליום+דף(+כיתה)
    // אם אתה לא רוצה פיצול לפי כיתה, תוריד את classPart מה-docId
    const classPart = classId ? `__${classId}` : "__all";
    const docId = `${dateKey}__${page}${classPart}`;

    await setDoc(
      doc(db, PAGEVIEWS_COLLECTION, docId),
      {
        dateKey,
        pageId: page,     // חשוב: תואם ל-analytics.html שלך (pageId)
        grade: grade || null,
        classId: classId || null,
        views: increment(1),
        lastPath: path,
        lastHour: hour,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ 2) אופציונלי: לוג גולמי (רק אם באמת צריך)
    if (ENABLE_RAW_EVENTS) {
      await addDoc(eventsRef, {
        path,
        pageId: page,
        grade,
        classId,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent || null,
        language: navigator.language || null,
        screen: { w: window.screen?.width || null, h: window.screen?.height || null },
        tzOffsetMin: new Date().getTimezoneOffset(),
        dateKey,
        hour,
        createdAt: serverTimestamp(),
        createdAtClient: new Date().toISOString(),
      });
    }

  } catch (err) {
    console.error("שגיאה בשמירת אנליטיקות:", err);
  }
}

/* =============================
   2) DASHBOARD (reads AGGREGATION)
   ✅ זה מיועד לעמוד analytics.html שלך (שקורא analytics_pageViews)
============================= */

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value);
}

async function loadAnalyticsDashboard() {
  const statusEl = document.getElementById("analytics-status");
  if (statusEl) statusEl.textContent = "טוען נתוני אנליטיקות...";

  try {
    // קוראים אגרגציה מסודרת
    // שים לב: יש מסמכים עם views מספרי, לא “לוג לכל כניסה”
    const qViews = query(pageviewsRef, orderBy("dateKey", "desc"), limit(6000));
    const snap = await getDocs(qViews);
    const rows = snap.docs.map(d => d.data());

    if (!rows.length) {
      if (statusEl) statusEl.textContent = "אין עדיין נתונים להצגה.";
      setText("analytics-total-visits", 0);
      setText("analytics-today-visits", 0);
      setText("analytics-unique-pages", 0);
      setText("analytics-unique-classes", 0);
      return;
    }

    const today = dateKeyLocal(new Date());

    let totalViews = 0;
    let todayViews = 0;

    const byPage = new Map();   // pageId -> views
    const byClass = new Map();  // classId -> views
    const byGrade = new Map();  // grade -> views

    rows.forEach(r => {
      const v = Number(r.views || 0);
      totalViews += v;
      if (r.dateKey === today) todayViews += v;

      const pageId = r.pageId || "(לא ידוע)";
      byPage.set(pageId, (byPage.get(pageId) || 0) + v);

      if (r.classId) {
        const cid = safeLower(r.classId) || "(לא ידוע)";
        byClass.set(cid, (byClass.get(cid) || 0) + v);
      }

      if (r.grade) {
        const g = safeLower(r.grade) || "(לא ידוע)";
        byGrade.set(g, (byGrade.get(g) || 0) + v);
      }
    });

    setText("analytics-total-visits", totalViews);
    setText("analytics-today-visits", todayViews);
    setText("analytics-unique-pages", byPage.size);
    setText("analytics-unique-classes", byClass.size);

    if (statusEl) statusEl.textContent = `נטענו ${rows.length} מסמכי סיכום.`;
  } catch (err) {
    console.error("שגיאה בטעינת האנליטיקות:", err);
    if (statusEl) statusEl.textContent = "אירעה שגיאה בטעינת נתוני האנליטיקות. בדוק את ה-console.";
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
    loadAnalyticsDashboard();
  } else {
    logPageView();
  }
});
