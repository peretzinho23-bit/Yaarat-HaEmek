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

const devLink = document.getElementById("dev-link");

// ====== DEV link only when logged in ======
onAuthStateChanged(auth, (user) => {
  if (devLink) devLink.style.display = user ? "" : "none";
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

// ====== Timetable (REAL schedule grid) ======
function getCell(grid, dayKey, pIndex) {
  const arr = Array.isArray(grid?.[dayKey]) ? grid[dayKey] : [];
  const c = arr[pIndex] || {};
  return {
    subject: String(c.subject || ""),
    teacher: String(c.teacher || ""),
    room: String(c.room || "")
  };
}

function renderTimetableFromGrid(grid) {
  // grid = { sun:[{subject,teacher,room}..], mon:.. }

  // שישה ימים + עמודת "שיעור"
  const thead = `
    <thead>
      <tr>
        <th style="width:76px">שיעור</th>
        ${DAYS.map(d => `<th>${escapeHtml(d.label)}</th>`).join("")}
      </tr>
    </thead>
  `;

  const tbodyRows = PERIODS.map((p, pIndex) => {
    const tds = DAYS.map((d) => {
      const cell = (Array.isArray(grid?.[d.key]) ? grid[d.key][pIndex] : null) || {};
      const subject = (cell.subject || "").trim();
      const teacher = (cell.teacher || "").trim();
      const room = (cell.room || "").trim();

      const empty = !subject && !teacher && !room;

      // תא יפה: מקצוע בולט, מתחת מורה/חדר בשורה קטנה
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
        <td class="tt-period">${p}</td>
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
}



// תמיכה גם בסכמה ישנה (days/rows) אם יש מסמכים ישנים
function renderTimetableFromDays(days) {
  // ננסה להפוך ל-grid ואז להציג באותו style
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

  renderTimetableSchedule(grid);
}

// ====== Data loaders (getDoc versions) ======
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

    // ✅ schema חדש
if (data.grid && typeof data.grid === "object") {
  ttStatus.textContent = "";
  renderTimetableFromGrid(data.grid || {}); // גם אם ריק
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

    const classSpecific = items.filter(n => String(n.classId || "").toLowerCase() === classId);

    if (!classSpecific.length) {
      newsStatus.textContent = "אין חדשות לכיתה הזאת עדיין.";
      return;
    }

    const ordered = classSpecific.slice(-12).reverse();

    newsStatus.textContent = "";
    news.innerHTML = ordered.map(n => {
      const imgs = extractNewsImages(n);

      // ✅ פיקס ללייט מוד: אם בחרו צבע לבן וזה בהיר -> עדיין יהיה קריא כי אנחנו נותנים רקע עדין
      const color = n.color ? escapeHtml(n.color) : "";
      const style = `
        border:1px solid rgba(148,163,184,.25);
        border-radius:14px;
        padding:10px;
        margin-bottom:10px;
        background: rgba(255,255,255,.06);
        ${color ? `color:${color};` : ""}
      `;

      const imgsHtml = imgs.length ? `
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
          ${imgs.map(url => `
            <img src="${escapeHtml(url)}" alt="תמונה לידיעה"
                 style="max-width:220px; width:100%; border-radius:12px; border:1px solid rgba(148,163,184,.25);" />
          `).join("")}
        </div>
      ` : "";

      return `
        <div class="item" style="${style}">
          <div><b>${escapeHtml(n.title || "")}</b></div>
          <div class="meta" style="opacity:.85; margin-top:2px;">${escapeHtml(n.meta || "")}</div>
          <div class="body" style="margin-top:6px;">${escapeHtml(n.body || "")}</div>
          ${imgsHtml}
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("news error:", e);
    newsStatus.textContent = "שגיאה בטעינת חדשות (בדוק Console/Rules).";
  }
}

// ====== REALTIME (no refresh) ======
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

  // timetables/classId
  unsubTT = onSnapshot(doc(db, "timetables", classId), (snap) => {
    if (!snap.exists()) {
      tt.innerHTML = "";
      ttStatus.textContent = "אין מערכת שעות לכיתה הזאת עדיין.";
      return;
    }
    const data = snap.data() || {};
    ttStatus.textContent = "";
    if (data.grid && typeof data.grid === "object") return renderTimetableSchedule(data.grid);
    const days = Array.isArray(data.days) ? data.days : [];
    if (days.length) return renderTimetableFromDays(days);
    ttStatus.textContent = "המערכת קיימת אבל ריקה.";
  }, (err) => {
    console.error("timetable snapshot error:", err);
    ttStatus.textContent = "שגיאה בטעינת מערכת שעות (בדוק Console/Rules).";
  });

  // exams/grade
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

  // news/grade
  unsubNews = onSnapshot(doc(db, "news", grade), (snap) => {
    const items = snap.exists() ? (snap.data()?.items || []) : [];
    news.innerHTML = "";
    newsStatus.textContent = "טוען…";

    const classSpecific = items.filter(n => String(n.classId || "").toLowerCase() === classId);

    if (!classSpecific.length) {
      newsStatus.textContent = "אין חדשות לכיתה הזאת עדיין.";
      return;
    }

    const ordered = classSpecific.slice(-12).reverse();
    newsStatus.textContent = "";

    news.innerHTML = ordered.map(n => {
      const imgs = extractNewsImages(n);
      const color = n.color ? escapeHtml(n.color) : "";
      const style = `
        border:1px solid rgba(148,163,184,.25);
        border-radius:14px;
        padding:10px;
        margin-bottom:10px;
        background: rgba(255,255,255,.06);
        ${color ? `color:${color};` : ""}
      `;

      const imgsHtml = imgs.length ? `
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
          ${imgs.map(url => `
            <img src="${escapeHtml(url)}" alt="תמונה לידיעה"
                 style="max-width:220px; width:100%; border-radius:12px; border:1px solid rgba(148,163,184,.25);" />
          `).join("")}
        </div>
      ` : "";

      return `
        <div class="item" style="${style}">
          <div><b>${escapeHtml(n.title || "")}</b></div>
          <div class="meta" style="opacity:.85; margin-top:2px;">${escapeHtml(n.meta || "")}</div>
          <div class="body" style="margin-top:6px;">${escapeHtml(n.body || "")}</div>
          ${imgsHtml}
        </div>
      `;
    }).join("");
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

if (!classId) {
  showChooser();
} else {
  openClass(classId);
}
