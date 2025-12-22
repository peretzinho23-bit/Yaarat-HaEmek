// analytics.js – לוגים + דשבורד אנליטיקות ליערת העמק (Firestore)
// ✅ מצב מומלץ: analytics_pageViews = אגרגציה נקייה (מסמך אחד ליום+דף)
// ❌ לא “לוג לכל כניסה” = לא מיליוני מסמכים
// אופציונלי: analytics_events = לוג גולמי לכל כניסה (אם תרצה פירוט אמיתי לפי כיתה/שעה/דפים)

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
 * ✅ מתאים לרשימה: about, admin, adminapps, article, class, exams, index, news, polls, redirect-edu, register
 * (ואם יש עוד – fallback לשם קובץ)
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

  // דשבורד (אם קיים)
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

  // ✅ דדופ לפי pageId + query
  // כדי שלא יהיו 2 כתיבות בגלל טעינה כפולה
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
    // אם localStorage חסום – עדיין נלוג
    return true;
  }
}

/* =============================
   1) LOG PAGE VIEW (AGGREGATED)
   ✅ מסמך אחד ליום+pageId => אין הצפה
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

    // ✅ פה הקסם: מסמך אחד בלבד לכל יום+דף
    // זה מונע אלפי מסמכים לכל כניסה / לכל classId
    const docId = `${dateKey}__${page}`;

    await setDoc(
      doc(db, PAGEVIEWS_COLLECTION, docId),
      {
        dateKey,
        pageId: page,              // תואם למה שה-analytics.html שלך מצפה (pageId)
        views: increment(1),

        // “last seen” מידע שימושי (לא לספירה!)
        lastPath: path,
        lastHour: hour,
        lastGrade: grade || null,
        lastClassId: classId || null,

        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ RAW EVENTS רק אם באמת צריך פירוט אמיתי לפי כיתה/שעה וכו'
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
    console.error("שגיאה בשמירת אנליטיקות:", err);
  }
}

/* =============================
   2) DASHBOARD (reads AGGREGATION)
   ✅ מיועד ל-analytics.html שלך שקורא analytics_pageViews
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
    const today = dateKeyLocal(new Date());

    // שים לב: orderBy("dateKey") עובד כי תמיד יש dateKey
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

    const byPage = new Map(); // pageId -> views
    // ⚠️ אגרגציה לפי דף לא יודעת “כיתות מובילות” בלי RAW EVENTS
    // לכן unique-classes פה יהיה 0 או "לא נתמך" אם תרצה (נשאיר 0 נקי)
    // אם תדליק RAW EVENTS, תעשה בדשבורד קריאה ל-analytics_events ותחשב.
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
    if (statusEl)
      statusEl.textContent =
        "אירעה שגיאה בטעינת נתוני האנליטיקות. בדוק את ה-console.";
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
