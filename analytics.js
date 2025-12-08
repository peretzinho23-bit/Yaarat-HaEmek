// analytics.js – לוגים + דשבורד אנליטיקות ליערת העמק

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// IMPORTANT: use the same collection name as in Firestore rules
// your rules allow writes to analytics_pageViews
const LOGS_COLLECTION = "analytics_pageViews";
const logsRef = collection(db, LOGS_COLLECTION);

/* ========= 1. Log page views from all pages (except dashboard itself) ========= */

async function logPageView() {
  try {
    const path = window.location.pathname + window.location.search;
    const page = document.body.dataset.page || null;   // index / exams-class / admin / analytics-dashboard...
    const grade = document.body.dataset.grade || null; // z / h / t if exists
    const usp = new URLSearchParams(window.location.search);
    const classId =
      usp.get("class") ||
      document.body.dataset.classId ||
      null; // z1/h3/t5 if exists

    await addDoc(logsRef, {
      path,
      page,
      grade,
      classId,
      userAgent: navigator.userAgent || null,
      createdAt: serverTimestamp()
    });

    // console.log("✅ analytics log saved:", { path, page, grade, classId });
  } catch (err) {
    console.error("שגיאה בשמירת לוג אנליטיקות:", err);
  }
}

/* ========= 2. Analytics dashboard ========= */

function safeGetDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") {
    return ts.toDate();
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

  const itemsHtml = entries
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

  container.innerHTML = itemsHtml;
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
        <td>${hoursArr[h]}</td>
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
    const qLogs = query(
      logsRef,
      orderBy("createdAt", "desc"),
      limit(5000)
    );
    const snap = await getDocs(qLogs);

    const logs = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push(data);
    });

    if (!logs.length) {
      if (statusEl) statusEl.textContent = "אין עדיין לוגים להצגה.";
      setText("analytics-total-visits", 0);
      setText("analytics-today-visits", 0);
      setText("analytics-unique-pages", 0);
      setText("analytics-unique-classes", 0);
      return;
    }

    const now = new Date();
    const todayKey = formatDateKey(now);

    let totalVisits = 0;
    let todayVisits = 0;

    const byPage = new Map();   // path -> count
    const byClass = new Map();  // classId -> count
    const byGrade = new Map();  // z/h/t -> count
    const byHour = new Array(24).fill(0); // index = hour

    logs.forEach((log) => {
      totalVisits++;

      const d = safeGetDate(log.createdAt);
      if (d) {
        const key = formatDateKey(d);
        if (key === todayKey) {
          todayVisits++;
        }
        const hour = d.getHours();
        if (hour >= 0 && hour < 24) {
          byHour[hour]++;
        }
      }

      const path = log.path || "(לא ידוע)";
      byPage.set(path, (byPage.get(path) || 0) + 1);

      if (log.classId) {
        const classId = String(log.classId).toLowerCase();
        byClass.set(classId, (byClass.get(classId) || 0) + 1);
      }

      if (log.grade) {
        const g = String(log.grade).toLowerCase();
        byGrade.set(g, (byGrade.get(g) || 0) + 1);
      }
    });

    const uniquePages = byPage.size;
    const uniqueClasses = byClass.size;

    setText("analytics-total-visits", totalVisits);
    setText("analytics-today-visits", todayVisits);
    setText("analytics-unique-pages", uniquePages);
    setText("analytics-unique-classes", uniqueClasses);

    renderTopList(
      "analytics-top-pages",
      byPage,
      10,
      (path) => path || "(לא ידוע)"
    );

    renderTopList(
      "analytics-top-classes",
      byClass,
      10,
      (classId) => {
        const map = {
          z1: "ז1", z2: "ז2", z3: "ז3", z4: "ז4", z5: "ז5",
          h1: "ח1", h2: "ח2", h3: "ח3", h4: "ח4", h5: "ח5", h6: "ח6",
          t1: "ט1", t2: "ט2", t3: "ט3", t4: "ט4", t5: "ט5"
        };
        return map[classId] || classId;
      }
    );

    renderTopList(
      "analytics-top-grades",
      byGrade,
      3,
      (g) => {
        const map = { z: "שכבת ז׳", h: "שכבת ח׳", t: "שכבת ט׳" };
        return map[g] || g;
      }
    );

    renderHourlyTable("analytics-by-hour", byHour);

    if (statusEl) statusEl.textContent = `נטענו ${logs.length} לוגים אחרונים.`;
  } catch (err) {
    console.error("שגיאה בטעינת האנליטיקות:", err);
    if (statusEl) {
      statusEl.textContent =
        "אירעה שגיאה בטעינת נתוני האנליטיקות. בדוק את ה־console.";
    }
  }
}

/* ========= 3. MAIN ========= */

document.addEventListener("DOMContentLoaded", () => {
  const pageType = document.body.dataset.page || "";

  if (pageType === "analytics-dashboard") {
    // dashboard page
    loadAnalyticsDashboard();
  } else {
    // all other pages – only log
    logPageView();
  }
});
