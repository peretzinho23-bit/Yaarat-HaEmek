// analytics-dashboard.js
// Dashboard for analytics_daily (daily total) + analytics_pageViews (top pages)

import { db, auth } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

/* =============================
   DOM HELPERS
============================= */
function $(id) {
  return document.getElementById(id);
}

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = String(v);
}

function showStatus(msg) {
  const el = $("analytics-status");
  if (el) el.textContent = msg;
}

/* =============================
   DATE HELPERS
============================= */
function pad2(n) { return String(n).padStart(2, "0"); }
function dateKeyLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

/* =============================
   CHART (simple canvas line)
============================= */
function drawLineChart(canvasId, labels, values) {
  const canvas = $(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const maxV = Math.max(1, ...values);
  const padding = 28;

  // axes
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();

  // line
  const n = values.length;
  if (n < 2) return;

  const xStep = (w - 2*padding) / (n - 1);

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = padding + i * xStep;
    const y = (h - padding) - (values[i] / maxV) * (h - 2*padding);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // dots
  for (let i = 0; i < n; i++) {
    const x = padding + i * xStep;
    const y = (h - padding) - (values[i] / maxV) * (h - 2*padding);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // min/max labels
  ctx.fillText("0", 6, h - padding + 4);
  ctx.fillText(String(maxV), 6, padding + 4);
}

/* =============================
   LOADERS
============================= */
async function loadDaily30() {
  const ref = collection(db, "analytics_daily");

  // dateKey הוא string YYYY-MM-DD אז orderBy עובד מעולה
  const q = query(ref, orderBy("dateKey", "desc"), limit(30));
  const snap = await getDocs(q);

  // רוצים תצוגה מהישן לחדש בגרף
  const rows = snap.docs.map(d => d.data()).filter(Boolean);
  rows.sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));

  const labels = rows.map(r => r.dateKey);
  const values = rows.map(r => Number(r.views || 0));

  const total30 = values.reduce((s, x) => s + x, 0);
  const todayKey = dateKeyLocal(new Date());
  const todayRow = rows.find(r => r.dateKey === todayKey);
  const todayViews = Number(todayRow?.views || 0);

  setText("analytics-today-visits", todayViews);
  setText("analytics-30d-visits", total30);

  // קצב ממוצע יומי
  const avg = rows.length ? Math.round(total30 / rows.length) : 0;
  setText("analytics-avg-daily", avg);

  drawLineChart("dailyChart", labels, values);

  // טבלה
  const tbody = $("dailyTableBody");
  if (tbody) {
    tbody.innerHTML = rows
      .slice()
      .reverse()
      .map(r => `<tr><td>${r.dateKey}</td><td>${Number(r.views || 0)}</td></tr>`)
      .join("");
  }

  return { todayViews, total30 };
}

async function loadTopPages30() {
  // top pages מתוך analytics_pageViews (זה “לפי יום+דף”)
  const ref = collection(db, "analytics_pageViews");
  const q = query(ref, orderBy("dateKey", "desc"), limit(6000));
  const snap = await getDocs(q);
  const rows = snap.docs.map(d => d.data()).filter(Boolean);

  // נבנה טופ 10 לפי views מצטבר
  const byPage = new Map();
  for (const r of rows) {
    const pageId = r.pageId || "(לא ידוע)";
    const v = Number(r.views || 0);
    byPage.set(pageId, (byPage.get(pageId) || 0) + v);
  }

  const sorted = [...byPage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const ol = $("topPagesList");
  if (ol) {
    ol.innerHTML = sorted
      .map(([page, v]) => `<li><b>${page}</b> <span style="opacity:.75">(${v})</span></li>`)
      .join("");
  }

  setText("analytics-unique-pages", byPage.size);
}

/* =============================
   MAIN
============================= */
async function initDashboard() {
  showStatus("טוען אנליטיקות...");

  try {
    await loadDaily30();
    await loadTopPages30();
    showStatus("✅ נטען בהצלחה.");
  } catch (err) {
    console.error("Analytics dashboard failed:", err);
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes("permission")) {
      showStatus("אין הרשאה לאנליטיקות. צריך DEV / Principal / Admin.");
    } else {
      showStatus("שגיאה בטעינה. בדוק Console.");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      showStatus("כדי לראות אנליטיקות צריך להתחבר (אדמין).");
      return;
    }
    initDashboard();
  });
});
