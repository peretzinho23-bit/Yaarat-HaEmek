// analytics.js – לוגים + דשבורד אנליטיקות ליערת העמק (Firestore)

// NOTE: this file is intended to run in the browser.
// It uses Firebase Firestore via your firebase-config.js (local module).

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* =============================
   CONFIG
============================= */

const LOGS_COLLECTION = "analytics_pageViews";
const logsRef = collection(db, LOGS_COLLECTION);

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
  // Normalize
  const p = (pathname || "/").toLowerCase();

  // Home
  if (p === "/" || p.endsWith("/index.html")) return "index";

  // Common pages (תעדכן לפי שמות קבצים אצלך)
  if (p.includes("class.html")) return "class";
  if (p.includes("classes.html")) return "classes";
  if (p.includes("exams.html")) return "exams";
  if (p.includes("articles.html")) return "articles";
  if (p.includes("article.html")) return "article";
  if (p.includes("news.html")) return "news";
  if (p.includes("admin.html")) return "admin";
  if (p.includes("login.html")) return "login";
  if (p.includes("links.html")) return "links";
  if (p.includes("analytics.html")) return "analytics-dashboard"; // הדשבורד
  if (p.includes("personal") || p.includes("my.edu.gov.il")) return "personal";

  // Fallback: file name or "page"
  const file = p.split("/").pop() || "";
  if (file.endsWith(".html")) return file.replace(".html", "");
  return "page";
}

function parseGradeClassFromURL() {
  const usp = new URLSearchParams(location.search);

  // classId: ?class=z1 / ?class=h3 / ?class=t5
  const classIdRaw =
    usp.get("class") ||
    usp.get("classId") ||
    usp.get("cid") ||
    null;

  // grade: ?grade=z / h / t
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

  // גם אם יש data-attributes על ה-body
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

  const page =
    pageFromBody ||
    getPageKeyFromPath(location.pathname);

  const { grade, classId } = parseGradeClassFromURL();

  return { page, grade, classId };
}

function shouldSkipLogging(page) {
  // לא רושמים לוגים על הדשבורד עצמו
  if (page === "analytics-dashboard") return true;

  // אם זה local file (לפעמים עושים בדיקות עם file://)
  if (location.protocol === "file:") return false; // אפשר גם true אם אתה רוצה לא ללוג לוקאלית

  return false;
}

function dedupeKey() {
  // נזהה יוניק לפי path + page + classId
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
    // אם localStorage חסום - נלוג בלי דדופ
    return true;
  }
}

/* =============================
   1) LOG PAGE VIEW
============================= */

async function logPageView() {
  try {
    const { page, grade, classId } = getPageMeta();
    if (shouldSkipLogging(page)) return;
    if (!canLogNow()) return;

    await addDoc(logsRef, {
      path: getPathWithQuery(),
      page,
      grade,
      classId,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent || null,
      language: navigator.language || null,
      screen: { w: window.screen?.width || null, h: window.screen?.height || null },
      tzOffsetMin: new Date().getTimezoneOffset(), // ישראל לרוב -120
      createdAt: serverTimestamp(),
      createdAtClient: new Date().toISOString(),
    });

    // console.log("✅ analytics log saved", { page, grade, classId, path: getPathWithQuery() });
  } catch (err) {
    console.error("שגיאה בשמירת לוג אנליטיקות:", err);
  }
}

/* =============================
   2) DASHBOARD
============================= */

function safeGetDate(ts) {
  if (!ts) return null;

  // Firestore Timestamp has toDate()
  if (typeof ts.toDate === "function") return ts.toDate();

  // ISO string (createdAtClient)
  if (typeof ts === "string") {
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  if (ts instanceof Date) return ts;
  return null;
}

function formatDateKey(d) {
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value);
}

function renderTopList(containerId, mapObj, maxItems, labelFormatter) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = Array.from(mapObj.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems);

  if (!entries.length) {
    container.innerHTML = `<p class="analytics-empty">אין נתונים עדיין.</p>`;
    return;
  }

  container.innerHTML = entries
    .map(([key, count]) => {
      const label = labelFormatter ? labelFormatter(key) : key;
      return `
        <div class="analytics-row">
          <span class="analytics-label">${label}</span>
          <span class="analytics-count">${count}</span>
        </div>
      `;
    })
    .join("");
}

function renderHourlyTable(containerId, hoursArr) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let rows = "";
  for (let h = 0; h < 24; h++) {
    const label = `${String(h).padStart(2, "0")}:00`;
    rows += `
      <tr>
        <td>${label}</td>
        <td>${hoursArr[h] || 0}</td>
      </tr>
    `;
  }

  container.innerHTML = `
    <table class="analytics-table">
      <thead>
        <tr>
          <th>שעה</th>
          <th>כמות כניסות</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

async function loadAnalyticsDashboard() {
  const statusEl = document.getElementById("analytics-status");
  if (statusEl) statusEl.textContent = "טוען נתוני אנליטיקות...";

  try {
    // ✅ אם createdAt חסר אצל חלק מהמסמכים, orderBy יכול להפיל.
    // אז: נביא לפי createdAt desc, אבל אם זה נופל – נביא בלי orderBy ונמיין מקומית.
    let snap;
    try {
      const qLogs = query(logsRef, orderBy("createdAt", "desc"), limit(5000));
      snap = await getDocs(qLogs);
    } catch (e) {
      console.warn("orderBy(createdAt) נכשל, מביא בלי orderBy וממיין מקומית…", e);
      const qLogs = query(logsRef, limit(5000));
      snap = await getDocs(qLogs);
    }

    const logs = [];
    snap.forEach((docSnap) => logs.push(docSnap.data()));

    if (!logs.length) {
      if (statusEl) statusEl.textContent = "אין עדיין לוגים להצגה.";
      setText("analytics-total-visits", 0);
      setText("analytics-today-visits", 0);
      setText("analytics-unique-pages", 0);
      setText("analytics-unique-classes", 0);
      return;
    }

    // מיון מקומי לפי זמן (createdAt -> createdAtClient)
    logs.sort((a, b) => {
      const da = safeGetDate(a.createdAt) || safeGetDate(a.createdAtClient);
      const dbb = safeGetDate(b.createdAt) || safeGetDate(b.createdAtClient);
      return (dbb?.getTime() || 0) - (da?.getTime() || 0);
    });

    const now = new Date();
    const todayKey = formatDateKey(now);

    let totalVisits = 0;
    let todayVisits = 0;

    const byPage = new Map();   // path -> count
    const byClass = new Map();  // classId -> count
    const byGrade = new Map();  // z/h/t -> count
    const byHour = new Array(24).fill(0);

    logs.forEach((log) => {
      totalVisits++;

      const d = safeGetDate(log.createdAt) || safeGetDate(log.createdAtClient);
      if (d) {
        const key = formatDateKey(d);
        if (key === todayKey) todayVisits++;

        const hour = d.getHours();
        if (hour >= 0 && hour < 24) byHour[hour]++;
      }

      const path = log.path || "(לא ידוע)";
      byPage.set(path, (byPage.get(path) || 0) + 1);

      if (log.classId) {
        const classId = safeLower(log.classId) || "(לא ידוע)";
        byClass.set(classId, (byClass.get(classId) || 0) + 1);
      }

      if (log.grade) {
        const g = safeLower(log.grade) || "(לא ידוע)";
        byGrade.set(g, (byGrade.get(g) || 0) + 1);
      }
    });

    setText("analytics-total-visits", totalVisits);
    setText("analytics-today-visits", todayVisits);
    setText("analytics-unique-pages", byPage.size);
    setText("analytics-unique-classes", byClass.size);

    renderTopList("analytics-top-pages", byPage, 12, (path) => path || "(לא ידוע)");

    renderTopList("analytics-top-classes", byClass, 12, (classId) => {
      const map = {
        z1: "ז1", z2: "ז2", z3: "ז3", z4: "ז4", z5: "ז5",
        h1: "ח1", h2: "ח2", h3: "ח3", h4: "ח4", h5: "ח5", h6: "ח6",
        t1: "ט1", t2: "ט2", t3: "ט3", t4: "ט4", t5: "ט5",
      };
      return map[classId] || classId;
    });

    renderTopList("analytics-top-grades", byGrade, 3, (g) => {
      const map = { z: "שכבת ז׳", h: "שכבת ח׳", t: "שכבת ט׳" };
      return map[g] || g;
    });

    renderHourlyTable("analytics-by-hour", byHour);

    if (statusEl) statusEl.textContent = `נטענו ${logs.length} לוגים אחרונים.`;
  } catch (err) {
    console.error("שגיאה בטעינת האנליטיקות:", err);
    if (statusEl) statusEl.textContent = "אירעה שגיאה בטעינת נתוני האנליטיקות. בדוק את ה־console.";
  }
}

/* =============================
   3) MAIN
============================= */

document.addEventListener("DOMContentLoaded", () => {
  const pageType = safeLower(document.body?.dataset?.page || "") || null;

  // אם אתה משתמש בעמוד דשבורד תן data-page="analytics-dashboard"
  const computed = getPageKeyFromPath(location.pathname);
  const finalPage = pageType || computed;

  if (finalPage === "analytics-dashboard") {
    loadAnalyticsDashboard();
  } else {
    logPageView();
  }
});
