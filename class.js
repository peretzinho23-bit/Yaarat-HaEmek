import { db, auth } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
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

const PERIODS = [1,2,3,4,5,6,7,8,9];

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

// ====== show DEV link only when logged in (not security, just UI) ======
onAuthStateChanged(auth, (user) => {
  if (devLink) devLink.style.display = user ? "" : "none";
});

// ====== chooser logic ======
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
  const g = gradeSel.value;
  fillClassesForGrade(g);
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

// ====== timetable render (supports BOTH schemas: grid (new) + days (old)) ======
function renderTimetableFromGrid(grid) {
  // grid = { sun: [{subject,teacher,room}...], mon: [...] ... }
  const blocks = DAYS.map((d) => {
    const arr = Array.isArray(grid?.[d.key]) ? grid[d.key] : [];
    // נציג רק שיעורים שמלאים כדי שלא ייראה מפוצץ
    const rows = PERIODS.map((p, idx) => {
      const cell = arr[idx] || { subject:"", teacher:"", room:"" };
      const has = (cell.subject || cell.teacher || cell.room);
      if (!has) return null;
      return `
        <tr>
          <td><b>${p}</b></td>
          <td>${escapeHtml(cell.subject || "")}</td>
          <td>${escapeHtml(cell.teacher || "")}</td>
          <td>${escapeHtml(cell.room || "")}</td>
        </tr>
      `;
    }).filter(Boolean);

    const tableHtml = rows.length ? `
      <table>
        <thead><tr><th>שיעור</th><th>מקצוע</th><th>מורה</th><th>חדר</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    ` : `<div class="muted">אין שיעורים ליום הזה.</div>`;

    return `
      <div style="margin-bottom:12px;">
        <div class="dayTitle">${escapeHtml(d.label)}</div>
        ${tableHtml}
      </div>
    `;
  });

  tt.innerHTML = blocks.join("");
}

function renderTimetableFromDays(days) {
  // days = [{day:"ראשון", rows:[{hour,subject,teacher,room}]}]
  tt.innerHTML = days.map(d => {
    const rows = Array.isArray(d.rows) ? d.rows : [];
    const tableHtml = rows.length ? `
      <table>
        <thead><tr><th>שעה</th><th>מקצוע</th><th>מורה</th><th>חדר</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${escapeHtml(r.hour)}</td>
              <td>${escapeHtml(r.subject)}</td>
              <td>${escapeHtml(r.teacher)}</td>
              <td>${escapeHtml(r.room)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : `<div class="muted">אין שיעורים ליום הזה.</div>`;

    return `
      <div style="margin-bottom:12px;">
        <div class="dayTitle">${escapeHtml(d.day || "")}</div>
        ${tableHtml}
      </div>
    `;
  }).join("");
}

async function loadTimetable(classId) {
  tt.innerHTML = "";
  ttStatus.textContent = "טוען…";
  try {
    const snap = await getDoc(doc(db, "timetables", classId));
    if (!snap.exists()) {
      ttStatus.textContent = "אין מערכת שעות לכיתה הזאת עדיין.";
      return;
    }

    const data = snap.data() || {};

    // ✅ schema חדש (של timetable-admin.js שלך)
    if (data.grid && typeof data.grid === "object") {
      ttStatus.textContent = "";
      renderTimetableFromGrid(data.grid);
      return;
    }

    // schema ישן (אם יש לך עדיין במסמכים ישנים)
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

// ====== exams ======
async function loadExams(classId) {
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
        <div class="body">${escapeHtml(e.topic || "")}</div>
      </div>
    `).join("");

  } catch (e) {
    console.error("exams error:", e);
    exStatus.textContent = "שגיאה בטעינת מבחנים (בדוק Console/Rules).";
  }
}

// ====== news (class-specific + images) ======
function extractNewsImages(n) {
  const imgs = [];
  if (Array.isArray(n.imageUrls)) imgs.push(...n.imageUrls.filter(Boolean));
  if (n.imageUrl) imgs.push(n.imageUrl);
  if (n.imageUrl2) imgs.push(n.imageUrl2);
  // ייחודי + עד 2
  return [...new Set(imgs.map(x => String(x).trim()).filter(Boolean))].slice(0,2);
}

async function loadNews(classId) {
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

    // חדשות לכיתה: חייב להיות classId בפריט
    const classSpecific = items.filter(n => String(n.classId || "").toLowerCase() === classId);

    if (!classSpecific.length) {
      newsStatus.textContent = "אין חדשות לכיתה הזאת עדיין (צריך שהאדמין ישמור חדשות עם classId לכיתה).";
      return;
    }

    const ordered = classSpecific.slice(-12).reverse();

    newsStatus.textContent = "";
    news.innerHTML = ordered.map(n => {
      const colorStyle = n.color ? `style="color:${escapeHtml(n.color)}"` : "";
      const imgs = extractNewsImages(n);
      const imgsHtml = imgs.length ? `
        <div class="imgs">
          ${imgs.map(url => `<img src="${escapeHtml(url)}" alt="תמונה לידיעה">`).join("")}
        </div>
      ` : "";

      return `
        <div class="item" ${colorStyle}>
          <div><b>${escapeHtml(n.title || "")}</b></div>
          <div class="meta">${escapeHtml(n.meta || "")}</div>
          <div class="body">${escapeHtml(n.body || "")}</div>
          ${imgsHtml}
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("news error:", e);
    newsStatus.textContent = "שגיאה בטעינת חדשות (בדוק Console/Rules).";
  }
}

async function openClass(classId) {
  showContentFor(classId);
  await Promise.all([
    loadTimetable(classId),
    loadExams(classId),
    loadNews(classId)
  ]);
}

// ====== boot ======
const qs = new URLSearchParams(location.search);
const classId = (qs.get("class") || "").trim().toLowerCase();

if (!classId) {
  showChooser();
} else {
  openClass(classId);
}
