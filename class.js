// class.js
import { db, auth } from "./firebase-config.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ====== config ======
const CLASS_IDS_BY_GRADE = {
  z: ["z1", "z2", "z3", "z4", "z5"],
  h: ["h1", "h4", "h5", "h6"],
  t: ["t1", "t2", "t3", "t4", "t5"]
};

const DAYS = [
  { key: "sun", label: "ראשון" },
  { key: "mon", label: "שני" },
  { key: "tue", label: "שלישי" },
  { key: "wed", label: "רביעי" },
  { key: "thu", label: "חמישי" },
  { key: "fri", label: "שישי" }
];

// שיעורים 1–9
const PERIODS = [1,2,3,4,5,6,7,8,9];

// שישי קצר (אפשר לשנות)
const DAY_PERIOD_LIMITS = { fri: 6 };

// ✅ שעות שיעורים בדיוק כמו שכתבת
// (שיעור 9 נשאר ריק כדי לא לבלבל אם אין לכם)
const PERIOD_TIMES = {
  1: "8:10-8:55",
  2: "8:55-9:40",
  3: "10:15-11:00",
  4: "11:00-11:45",
  5: "12:00-12:45",
  6: "12:45-13:30",
  7: "13:45-14:30",
  8: "14:30-15:15",
  9: ""
};

// ✅ הפסקות/אירועים קבועים (לתצוגה בסליידר בנייד)
const BETWEEN_BLOCKS = [
  { label: "הפסקה", time: "9:40-10:00" },
  { label: "פותחים בטוב", time: "10:00-10:15" },
  { label: "הפסקה", time: "11:45-12:00" },
  { label: "הפסקה", time: "13:30-13:45" }
];
function toMinutes(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return (Number(m[1]) * 60) + Number(m[2]);
}

function parseRange(rangeStr) {
  // "8:10-8:55"
  const s = String(rangeStr || "").trim();
  const m = s.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (!m) return null;
  const a = toMinutes(m[1]);
  const b = toMinutes(m[2]);
  if (a == null || b == null) return null;
  return { start: a, end: b };
}

function todayDayKey() {
  // JS: 0=Sun .. 6=Sat
  const d = new Date().getDay();
  const map = ["sun","mon","tue","wed","thu","fri","sat"];
  return map[d] || "sun";
}

function buildDayTimeline(dayKey) {
  // בונה ציר זמן לפי השעות שנתת (שיעורים) + בין לבין
  const limit = maxPeriodsForDay(dayKey);

  const blocks = [];
  for (let p = 1; p <= PERIODS.length; p++) {
    if (p > limit) continue;
    const r = parseRange(PERIOD_TIMES[p]);
    if (!r) continue; // למשל שיעור 9 ריק
    blocks.push({ type:"lesson", period:p, label:`שיעור ${p}`, start:r.start, end:r.end });
  }

  // מוסיף בלוקים קבועים של הפסקות/פותחים בטוב
  for (const b of BETWEEN_BLOCKS) {
    const r = parseRange(b.time);
    if (!r) continue;
    blocks.push({ type:"break", period:null, label:b.label, start:r.start, end:r.end });
  }

  // ממיין לפי התחלה
  blocks.sort((a,b) => a.start - b.start);
  return blocks;
}

function getNowNextForDay(dayKey) {
  const nowKey = todayDayKey();
  if (dayKey !== nowKey) return { nowId: null, nextId: null, nowText: "", nextText: "" };

  const blocks = buildDayTimeline(dayKey);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let nowBlock = null;
  let nextBlock = null;

  for (let i=0; i<blocks.length; i++) {
    const b = blocks[i];
    if (nowMin >= b.start && nowMin < b.end) {
      nowBlock = b;
      nextBlock = blocks[i+1] || null;
      break;
    }
    if (nowMin < b.start) {
      nextBlock = b;
      break;
    }
  }

  const nowId = nowBlock ? `${nowBlock.type}:${nowBlock.type==="lesson" ? nowBlock.period : nowBlock.start}` : null;
  const nextId = nextBlock ? `${nextBlock.type}:${nextBlock.type==="lesson" ? nextBlock.period : nextBlock.start}` : null;

  const nowText = nowBlock ? `${nowBlock.label} (${String(Math.floor(nowBlock.start/60)).padStart(2,"0")}:${String(nowBlock.start%60).padStart(2,"0")}-${String(Math.floor(nowBlock.end/60)).padStart(2,"0")}:${String(nowBlock.end%60).padStart(2,"0")})` : "";
  const nextText = nextBlock ? `${nextBlock.label} (${String(Math.floor(nextBlock.start/60)).padStart(2,"0")}:${String(nextBlock.start%60).padStart(2,"0")}-${String(Math.floor(nextBlock.end/60)).padStart(2,"0")}:${String(nextBlock.end%60).padStart(2,"0")})` : "";

  return { nowId, nextId, nowText, nextText };
}

// ====== helpers ======
function classToGrade(classId) {
  const c = String(classId || "").toLowerCase();
  if (c.startsWith("z")) return "z";
  if (c.startsWith("h")) return "h";
  if (c.startsWith("t")) return "t";
  return null;
}

function classLabel(classId) {
  const c = String(classId || "").toLowerCase();
  const map = {
    z1:"ז1", z2:"ז2", z3:"ז3", z4:"ז4", z5:"ז5",
    h1:"ח1/7", h4:"ח4/8", h5:"ח5/9", h6:"ח6/10",
    t1:"ט1", t2:"ט2", t3:"ט3", t4:"ט4", t5:"ט5"
  };
  return map[c] || c.toUpperCase();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(text) {
  const escaped = escapeHtml(text);
  // הופך https://... ללחיץ
  return escaped.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    let d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    if (y < 100) y = 2000 + y;
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function todayMidnight() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.getTime();
}

function setQueryClass(classId) {
  const url = new URL(location.href);
  url.searchParams.set("class", classId);
  history.replaceState({}, "", url.toString());
}

function maxPeriodsForDay(dayKey) {
  return Number(DAY_PERIOD_LIMITS[dayKey] || PERIODS.length);
}

function isDarkMode() {
  return (document.documentElement.getAttribute("data-theme") || "dark") === "dark";
}

function ensureLocalStyles() {
  if (document.getElementById("classjs-inline-styles")) return;

  const style = document.createElement("style");
  style.id = "classjs-inline-styles";
  style.textContent = `
    /* ===== Timetable ===== */
    .tt-wrap-table{
      width: 100%;
      overflow:auto;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.35);
      background: rgba(255,255,255,.06);
    }
    html[data-theme="light"] .tt-wrap-table{
      background: rgba(255,255,255,.85);
      border-color: rgba(148,163,184,.35);
    }
    table.tt-big{
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      min-width: 760px;
    }
    table.tt-big thead th{
      position: sticky;
      top: 0;
      z-index: 2;
      font-weight: 800;
      padding: 10px 10px;
      border-bottom: 1px solid rgba(148,163,184,.35);
      background: rgba(15,23,42,.22);
      color: rgba(255,255,255,.92);
      text-align: center;
      white-space: nowrap;
    }
    html[data-theme="light"] table.tt-big thead th{
      background: rgba(241,245,249,.95);
      color: #0f172a;
    }
    table.tt-big td{
      padding: 10px 8px;
      border-bottom: 1px solid rgba(148,163,184,.22);
      border-left: 1px solid rgba(148,163,184,.18);
      vertical-align: middle;
      text-align: center;
      min-height: 56px;
    }
    table.tt-big tr td:first-child,
    table.tt-big tr th:first-child{
      border-left: none;
    }
    td.tt-period{
      font-weight: 900;
      width: 76px;
      background: rgba(56,189,248,.16);
      color: rgba(255,255,255,.92);
      position: sticky;
      right: 0;
      z-index: 1;
      border-left: 1px solid rgba(148,163,184,.25);
    }
    html[data-theme="light"] td.tt-period{
      color:#0f172a;
      background: rgba(56,189,248,.10);
    }
    .tt-td.tt-disabled{
      opacity: .45;
      background: rgba(148,163,184,.08);
    }
    html[data-theme="light"] .tt-td.tt-disabled{
      background: rgba(15,23,42,.04);
    }
    .tt-subject{
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 4px;
    }
    .tt-meta{
      opacity: .86;
      font-size: .9rem;
      display:flex;
      gap:6px;
      justify-content:center;
      flex-wrap:wrap;
    }
    .tt-dot{ opacity:.6; }
    .tt-dash{ opacity:.55; font-weight:700; }

    /* ===== News ===== */
    .news-item{
      border:1px solid rgba(148,163,184,.25);
      border-radius:14px;
      padding:12px;
      margin-bottom:10px;
      background: rgba(255,255,255,.06);
    }
    html[data-theme="light"] .news-item{
      background: rgba(255,255,255,.92);
    }
    .news-title{
      font-weight: 900;
      margin-bottom: 2px;
    }
    .news-meta{
      opacity:.78;
      font-size:.9rem;
      margin-bottom: 8px;
    }
    .news-body{
      line-height: 1.45;
      white-space: pre-wrap;
    }
    .news-body a{
      text-decoration: underline;
      font-weight: 800;
    }
    .news-imgs{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:10px;
    }
    .news-imgs img{
      max-width: 240px;
      width: 100%;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,.25);
    }
  `;
  document.head.appendChild(style);
}

// ====== DOM ======
const elTitle = document.getElementById("page-title");
const elSub = document.getElementById("page-sub");
const elPill = document.getElementById("class-pill");

const chooserCard = document.getElementById("chooser-card");
const content = document.getElementById("content");

const gradeSel = document.getElementById("gradeSel");
const classSel = document.getElementById("classSel");
const goBtn = document.getElementById("goBtn");

const tt = document.getElementById("tt");
const ttStatus = document.getElementById("ttStatus");
const ex = document.getElementById("ex");
const exStatus = document.getElementById("exStatus");
const news = document.getElementById("news");
const newsStatus = document.getElementById("newsStatus");
const announceBox = document.getElementById("announceBox");
const boomSub = document.getElementById("boomSub");
const boomExams = document.getElementById("boomExams");
const boomNews = document.getElementById("boomNews");
const boomNowNext = document.getElementById("boomNowNext");

const devLink = document.getElementById("dev-link");

// ====== DEV link only when logged in ======
onAuthStateChanged(auth, (user) => {
  if (devLink) devLink.style.display = user ? "" : "none";
});

// ===============================
// ✅ MOBILE DAY SLIDER (added only)
// ===============================
const ttMobileWrap = document.getElementById("tt-mobile");
const daySelect = document.getElementById("daySelect");
const daySchedule = document.getElementById("daySchedule");

let lastTimetableGrid = null;
let selectedDayKey = "sun";

function isMobileView() {
  return window.matchMedia && window.matchMedia("(max-width: 820px)").matches;
}

function setSelectedDayKey(key) {
  if (!key) return;
  selectedDayKey = key;
  try { localStorage.setItem("ttDay", key); } catch {}
  if (daySelect) daySelect.value = key;
}

(function initDaySelect() {
  if (!daySelect) return;
  let saved = null;
  try { saved = localStorage.getItem("ttDay"); } catch {}
  if (saved) setSelectedDayKey(saved);

  daySelect.addEventListener("change", () => {
    setSelectedDayKey(daySelect.value);
    renderMobileDayFromLastGrid();
  });
})();

function renderMobileDayFromLastGrid() {
  if (!ttMobileWrap || !daySchedule) return;
  if (!lastTimetableGrid) {
    daySchedule.innerHTML = "";
    return;
  }

  const dayKey = selectedDayKey || "sun";
  const dayLabel = (DAYS.find(d => d.key === dayKey)?.label) || "";

  const limit = maxPeriodsForDay(dayKey);
  const arr = Array.isArray(lastTimetableGrid?.[dayKey]) ? lastTimetableGrid[dayKey] : [];

const { nowId, nextId, nowText, nextText } = getNowNextForDay(dayKey);

const rows = PERIODS.map((p, idx) => {
  const disabled = (idx + 1) > limit;
  if (disabled) return null;

  const cell = arr[idx] || {};
  const subject = String(cell.subject || "").trim();
  const teacher = String(cell.teacher || "").trim();
  const room = String(cell.room || "").trim();
  const empty = !subject && !teacher && !room;

  const id = `lesson:${p}`;
  const isNow = (id === nowId);
  const isNext = (!isNow && id === nextId);

  const badge = isNow
    ? `<span class="ttm-badge">🔥 עכשיו</span>`
    : (isNext ? `<span class="ttm-badge">➡️ הבא</span>` : "");

  return `
    <div class="ttm-row ${isNow ? "ttm-now" : ""} ${isNext ? "ttm-next" : ""}" style="
      border:1px solid rgba(148,163,184,.25);
      border-radius:14px;
      padding:10px 12px;
      margin-bottom:10px;
      background: ${isDarkMode() ? "rgba(2,6,23,.28)" : "rgba(255,255,255,.92)"};
    ">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px;">
        <div style="display:flex;gap:10px;align-items:center;">
          <div style="font-weight:900; opacity:.92;">שיעור ${p}</div>
          ${badge}
        </div>
        <div style="font-weight:800; opacity:.75;">${escapeHtml(PERIOD_TIMES[p] || "")}</div>
      </div>
      ${empty ? `<div style="opacity:.65; font-weight:700;">—</div>` : `
        <div style="font-weight:900; line-height:1.2;">${escapeHtml(subject)}</div>
        <div style="opacity:.85; margin-top:6px;">
          ${teacher ? `<span>${escapeHtml(teacher)}</span>` : ""}
          ${teacher && room ? `<span style="opacity:.6; margin:0 6px;">•</span>` : ""}
          ${room ? `<span>${escapeHtml(room)}</span>` : ""}
        </div>
      `}
    </div>
  `;
}).filter(Boolean);


  const betweenHtml = BETWEEN_BLOCKS.map(b => `
    <div class="ttm-row" style="
      border:1px dashed rgba(148,163,184,.35);
      border-radius:14px;
      padding:10px 12px;
      margin-bottom:10px;
      opacity:.92;
      background: ${isDarkMode() ? "rgba(2,6,23,.18)" : "rgba(241,245,249,.95)"};
    ">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">
        <div style="font-weight:900;">⏸ ${escapeHtml(b.label)}</div>
        <div style="font-weight:800; opacity:.75;">${escapeHtml(b.time)}</div>
      </div>
    </div>
  `).join("");

  daySchedule.innerHTML = `
    <div style="font-weight:900; margin: 4px 0 10px; opacity:.9;">${escapeHtml(dayLabel)}</div>
    ${rows.join("") || `<div style="opacity:.75;">אין שיעורים ליום הזה.</div>`}
    <div style="margin-top:12px; font-weight:900; opacity:.85;">בין לבין</div>
    ${betweenHtml}
  `;
}
// ✅ עדכון "עכשיו/הבא" בקופסה למעלה אם קיימת
if (boomNowNext) {
  if (nowText || nextText) {
    boomNowNext.innerHTML = `
      <div style="font-weight:900;">${nowText ? `🔥 עכשיו: ${escapeHtml(nowText)}` : "🔥 עכשיו: אין"}</div>
      <div style="opacity:.85; margin-top:6px;">${nextText ? `➡️ הבא: ${escapeHtml(nextText)}` : "➡️ הבא: אין"}</div>
    `;
  } else {
    boomNowNext.innerHTML = "";
  }
}

function syncTimetableMobileVisibility() {
  if (!ttMobileWrap) return;

  const wrapTable = tt.querySelector(".tt-wrap-table");
  const mobile = isMobileView();

  // בטלפון: מציגים את בחירת היום ומסתירים את הטבלה הגדולה
  ttMobileWrap.style.display = mobile ? "" : "none";
  if (wrapTable) wrapTable.style.display = mobile ? "none" : "";
}

window.addEventListener("resize", () => {
  syncTimetableMobileVisibility();
});

// ====== chooser ======
function fillClassesForGrade(g) {
  classSel.innerHTML = `<option value="">בחר כיתה</option>`;
  const arr = CLASS_IDS_BY_GRADE[g] || [];
  for (const c of arr) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = classLabel(c);
    classSel.appendChild(opt);
  }
  classSel.disabled = !arr.length;
}

gradeSel?.addEventListener("change", () => {
  fillClassesForGrade(gradeSel.value);
  goBtn.disabled = true;
});

classSel?.addEventListener("change", () => {
  goBtn.disabled = !classSel.value;
});

goBtn?.addEventListener("click", () => {
  const c = classSel.value;
  if (!c) return;
  setQueryClass(c);
  openClass(c);
});

// ====== render helpers ======
function showChooser() {
  chooserCard.classList.remove("hide");
  content.classList.add("hide");
  elTitle.textContent = "דף כיתה";
  elSub.textContent = "בחר כיתה כדי לראות חדשות, מבחנים ומערכת שעות";
  elPill.textContent = "לא נבחרה כיתה";
}

function showContentFor(classId) {
  chooserCard.classList.add("hide");
  content.classList.remove("hide");
  elTitle.textContent = `דף כיתה ${classLabel(classId)}`;
  elSub.textContent = "חדשות לכיתה · מבחנים לכיתה · מערכת שעות";
  elPill.textContent = `${classLabel(classId)}`;
}

// ====== Timetable (grid) ======
function renderTimetableFromGrid(grid) {
  ensureLocalStyles();

  // ✅ keep last grid for mobile day view
  lastTimetableGrid = grid || null;

  const thead = `
    <thead>
      <tr>
        <th style="width:76px">
          שיעור
          <div style="font-weight:700; opacity:.75; font-size:.82rem; margin-top:2px;">שעה</div>
        </th>
        ${DAYS.map(d => `<th>${escapeHtml(d.label)}</th>`).join("")}
      </tr>
    </thead>
  `;

  const tbodyRows = PERIODS.map((p, pIndex) => {
    const tds = DAYS.map((d) => {
      const limit = maxPeriodsForDay(d.key);
      const disabled = (pIndex + 1) > limit;

      const cell = (Array.isArray(grid?.[d.key]) ? grid[d.key][pIndex] : null) || {};
      const subject = (cell.subject || "").trim();
      const teacher = (cell.teacher || "").trim();
      const room = (cell.room || "").trim();
      const empty = !subject && !teacher && !room;

      if (disabled) {
        return `<td class="tt-td tt-disabled"><div class="tt-dash">—</div></td>`;
      }

      return `
        <td class="tt-td ${empty ? "tt-empty" : ""}">
          ${empty ? `<div class="tt-dash">—</div>` : `
            <div class="tt-subject">${escapeHtml(subject)}</div>
            <div class="tt-meta">
              ${teacher ? `<span>${escapeHtml(teacher)}</span>` : ""}
              ${teacher && room ? `<span class="tt-dot">•</span>` : ""}
              ${room ? `<span>${escapeHtml(room)}</span>` : ""}
            </div>
          `}
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td class="tt-period">
          ${p}
          <div style="font-weight:800; opacity:.78; font-size:.78rem; margin-top:4px;">
            ${escapeHtml(PERIOD_TIMES[p] || "")}
          </div>
        </td>
        ${tds}
      </tr>
    `;
  }).join("");

  tt.innerHTML = `
    <div class="tt-wrap-table">
      <table class="tt-big">
        ${thead}
        <tbody>${tbodyRows}</tbody>
      </table>
    </div>
  `;

  // ✅ mobile sync + render selected day
  syncTimetableMobileVisibility();
  renderMobileDayFromLastGrid();
}

// schema ישן (days/rows) -> ממירים ל-grid ומציגים
function renderTimetableFromDays(days) {
  const grid = {};
  for (const d of DAYS) grid[d.key] = PERIODS.map(() => ({ subject:"", teacher:"", room:"" }));

  (Array.isArray(days) ? days : []).forEach((dayObj) => {
    const name = String(dayObj?.day || "").trim();
    const key =
      name.includes("ראשון") ? "sun" :
      name.includes("שני") ? "mon" :
      name.includes("שלישי") ? "tue" :
      name.includes("רביעי") ? "wed" :
      name.includes("חמישי") ? "thu" :
      name.includes("שישי") ? "fri" : null;

    if (!key) return;

    const rows = Array.isArray(dayObj.rows) ? dayObj.rows : [];
    rows.forEach((r, idx) => {
      if (idx < PERIODS.length) {
        grid[key][idx] = {
          subject: r.subject || "",
          teacher: r.teacher || "",
          room: r.room || ""
        };
      }
    });
  });

  renderTimetableFromGrid(grid);
}

// ====== Data loaders (first load) ======
async function loadTimetableOnce(classId) {
  tt.innerHTML = "";
  ttStatus.textContent = "טוען…";

  try {
    const snap = await getDoc(doc(db, "timetables", classId));
    if (!snap.exists()) {
      ttStatus.textContent = "אין מערכת שעות לכיתה הזאת עדיין.";
      return;
    }

    const data = snap.data() || {};

    if (data.grid && typeof data.grid === "object") {
      ttStatus.textContent = "";
      renderTimetableFromGrid(data.grid || {});
      return;
    }

    const days = Array.isArray(data.days) ? data.days : [];
    if (days.length) {
      ttStatus.textContent = "";
      renderTimetableFromDays(days);
      return;
    }

    ttStatus.textContent = "המערכת קיימת אבל ריקה.";
  } catch (e) {
    console.error("timetable error:", e);
    ttStatus.textContent = "שגיאה בטעינת מערכת שעות (בדוק Console/Rules).";
  }
}

async function loadExamsOnce(classId) {
  ex.innerHTML = "";
  exStatus.textContent = "טוען…";

  const grade = classToGrade(classId);
  if (!grade) {
    exStatus.textContent = "כיתה לא חוקית.";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "exams", grade));
    const items = snap.exists() ? (snap.data()?.items || []) : [];

    const arr = items
      .filter(x => String(x.classId || "").toLowerCase() === classId)
      .map(x => ({ ...x, _d: parseDate(x.date) }))
      .filter(x => !x._d || x._d.getTime() >= todayMidnight())
      .sort((a,b) => {
        const da = a._d ? a._d.getTime() : Infinity;
        const dbt = b._d ? b._d.getTime() : Infinity;
        return da - dbt;
      })
      .slice(0, 12);

    if (!arr.length) {
      exStatus.textContent = "אין מבחנים קרובים לכיתה הזאת.";
      return;
    }

    exStatus.textContent = "";
    ex.innerHTML = arr.map(e => `
      <div class="item">
        <div><b>${escapeHtml(e.subject || "")}</b></div>
        <div class="meta">${escapeHtml(e.date || "")}${e.time ? " · " + escapeHtml(e.time) : ""}</div>
        <div class="body" style="margin-top:6px;">${escapeHtml(e.topic || "")}</div>
      </div>
    `).join("");

  } catch (e) {
    console.error("exams error:", e);
    exStatus.textContent = "שגיאה בטעינת מבחנים (בדוק Console/Rules).";
  }
}

function extractNewsImages(n) {
  const imgs = [];
  if (Array.isArray(n.imageUrls)) imgs.push(...n.imageUrls.filter(Boolean));
  if (n.imageUrl) imgs.push(n.imageUrl);
  if (n.imageUrl2) imgs.push(n.imageUrl2);
  return [...new Set(imgs.map(x => String(x).trim()).filter(Boolean))].slice(0,2);
}

function normalizeNewsColorForTheme(color) {
  const c = String(color || "").trim().toLowerCase();
  if (!c) return "";

  // בלייט מוד: אם מישהו בחר לבן -> זה בלתי נראה -> מחזירים לשחור
  if (!isDarkMode() && (c === "#ffffff" || c === "white" || c === "rgb(255,255,255)")) {
    return "#0f172a";
  }

  return color;
}

function renderNewsList(classId, items) {
  ensureLocalStyles();

  const classSpecific = items.filter(n => String(n.classId || "").toLowerCase() === classId);

  if (!classSpecific.length) {
    newsStatus.textContent = "אין חדשות לכיתה הזאת עדיין.";
    news.innerHTML = "";
    return;
  }

  const ordered = classSpecific.slice(-12).reverse();
  newsStatus.textContent = "";

  news.innerHTML = ordered.map(n => {
    const imgs = extractNewsImages(n);

    // צבע טקסט
    const finalColor = normalizeNewsColorForTheme(n.color);
    const baseText = isDarkMode() ? "rgba(255,255,255,.92)" : "#0f172a";

    const titleColor = (!isDarkMode()) ? "#0f172a" : (finalColor || baseText);
    const bodyColor = finalColor || baseText;

    const imgsHtml = imgs.length ? `
      <div class="news-imgs">
        ${imgs.map(url => `<img src="${escapeHtml(url)}" alt="תמונה לידיעה">`).join("")}
      </div>
    ` : "";

    return `
      <div class="news-item" style="color:${bodyColor};">
        <div class="news-title" style="color:${titleColor};">${escapeHtml(n.title || "")}</div>
        <div class="news-meta">${escapeHtml(n.meta || "")}</div>
        <div class="news-body">${linkify(n.body || "")}</div>
        ${imgsHtml}
      </div>
    `;
  }).join("");
}

async function loadNewsOnce(classId) {
  news.innerHTML = "";
  newsStatus.textContent = "טוען…";

  const grade = classToGrade(classId);
  if (!grade) {
    newsStatus.textContent = "כיתה לא חוקית.";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "news", grade));
    const items = snap.exists() ? (snap.data()?.items || []) : [];
    renderNewsList(classId, items);
  } catch (e) {
    console.error("news error:", e);
    newsStatus.textContent = "שגיאה בטעינת חדשות (בדוק Console/Rules).";
  }
}

// ====== REALTIME ======
let unsubTT = null;
let unsubNews = null;
let unsubExams = null;

function stopRealtime() {
  try { if (unsubTT) unsubTT(); } catch {}
  try { if (unsubNews) unsubNews(); } catch {}
  try { if (unsubExams) unsubExams(); } catch {}
  unsubTT = unsubNews = unsubExams = null;
}

function startRealtime(classId) {
  stopRealtime();

  const grade = classToGrade(classId);
  if (!grade) return;

  unsubTT = onSnapshot(doc(db, "timetables", classId), (snap) => {
    if (!snap.exists()) {
      tt.innerHTML = "";
      ttStatus.textContent = "אין מערכת שעות לכיתה הזאת עדיין.";
      return;
    }
    const data = snap.data() || {};
    if (data.grid && typeof data.grid === "object") {
      ttStatus.textContent = "";
      renderTimetableFromGrid(data.grid || {});
      return;
    }
    const days = Array.isArray(data.days) ? data.days : [];
    if (days.length) {
      ttStatus.textContent = "";
      renderTimetableFromDays(days);
      return;
    }
    ttStatus.textContent = "המערכת קיימת אבל ריקה.";
  }, (err) => {
    console.error("timetable snapshot error:", err);
    ttStatus.textContent = "שגיאה בטעינת מערכת שעות (בדוק Console/Rules).";
  });

  unsubExams = onSnapshot(doc(db, "exams", grade), (snap) => {
    const items = snap.exists() ? (snap.data()?.items || []) : [];
    ex.innerHTML = "";
    exStatus.textContent = "טוען…";

    const arr = items
      .filter(x => String(x.classId || "").toLowerCase() === classId)
      .map(x => ({ ...x, _d: parseDate(x.date) }))
      .filter(x => !x._d || x._d.getTime() >= todayMidnight())
      .sort((a,b) => {
        const da = a._d ? a._d.getTime() : Infinity;
        const dbt = b._d ? b._d.getTime() : Infinity;
        return da - dbt;
      })
      .slice(0, 12);

    if (!arr.length) {
      exStatus.textContent = "אין מבחנים קרובים לכיתה הזאת.";
      return;
    }

    exStatus.textContent = "";
    ex.innerHTML = arr.map(e => `
      <div class="item">
        <div><b>${escapeHtml(e.subject || "")}</b></div>
        <div class="meta">${escapeHtml(e.date || "")}${e.time ? " · " + escapeHtml(e.time) : ""}</div>
        <div class="body" style="margin-top:6px;">${escapeHtml(e.topic || "")}</div>
      </div>
    `).join("");
  }, (err) => {
    console.error("exams snapshot error:", err);
    exStatus.textContent = "שגיאה בטעינת מבחנים (בדוק Console/Rules).";
  });

  unsubNews = onSnapshot(doc(db, "news", grade), (snap) => {
    const items = snap.exists() ? (snap.data()?.items || []) : [];
    newsStatus.textContent = "טוען…";
    renderNewsList(classId, items);
  }, (err) => {
    console.error("news snapshot error:", err);
    newsStatus.textContent = "שגיאה בטעינת חדשות (בדוק Console/Rules).";
  });
}

// ====== open class ======
async function openClass(classId) {
  showContentFor(classId);

  // טעינה ראשונה מהר
  await Promise.all([
    loadTimetableOnce(classId),
    loadExamsOnce(classId),
    loadNewsOnce(classId)
  ]);

  // ואז realtime בלי רענון
  startRealtime(classId);
}

// ====== boot ======
const qs = new URLSearchParams(location.search);
const classId = (qs.get("class") || "").trim().toLowerCase();
// ✅ refresh NOW/NEXT highlight every 30s (only affects mobile day view)
setInterval(() => {
  if (!isMobileView()) return;
  renderMobileDayFromLastGrid();
}, 30000);

if (!classId) {
  showChooser();
} else {
  openClass(classId);
}
