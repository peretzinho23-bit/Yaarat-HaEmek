// timetable-admin.js
import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// מי מותר לו להעלות מערכת שעות:
const DEV_EMAILS = ["nadavp1119@gmail.com", "peretzinho23@gmail.com"].map(e => e.toLowerCase());
const ALLOWED_ROLES = ["gradelead", "principal", "dev"]; // רק אלה

// ימים (כולל שישי)
const DAYS = [
  { key: "sun", label: "ראשון" },
  { key: "mon", label: "שני" },
  { key: "tue", label: "שלישי" },
  { key: "wed", label: "רביעי" },
  { key: "thu", label: "חמישי" },
  { key: "fri", label: "שישי" },
];

// שיעורים 1–9 (כולל שעות אמיתיות לתצוגה)
const PERIODS = [
  { n: 1, time: "08:10–08:55" },
  { n: 2, time: "08:55–09:40" },
  { n: 3, time: "10:15–11:00" },
  { n: 4, time: "11:00–11:45" },
  { n: 5, time: "12:00–12:45" },
  { n: 6, time: "12:45–13:30" },
  { n: 7, time: "13:45–14:30" },
  { n: 8, time: "14:15–15:00" },
  { n: 9, time: "15:05–15:50" },
];

// כמה שיעורים יש בכל יום (שישי קצר)
const DAY_PERIOD_LIMITS = {
  fri: 6, // שישי עד שיעור 6
  // שאר הימים = 9 אוטומטית
};

const $ = (id) => document.getElementById(id);
const authStatus = $("auth-status");
const loginSection = $("login-section");
const panel = $("panel");
const loginForm = $("login-form");
const logoutBtn = $("logout-btn");
const classIdSel = $("classId");
const loadBtn = $("load");
const saveBtn = $("save");
const table = $("table");
const metaEl = $("meta");
const msgEl = $("msg");

function norm(email) {
  return String(email || "").trim().toLowerCase();
}

function roleNorm(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "gradelead" || r === "grade_lead") return "gradelead";
  return r;
}

async function assertAccess(user) {
  const email = norm(user?.email);
  if (DEV_EMAILS.includes(email)) return { role: "dev", by: "email" };

  const snap = await getDoc(doc(db, "adminUsers", user.uid));
  if (!snap.exists()) throw new Error("אין לך הרשאות (אין מסמך adminUsers).");

  const data = snap.data() || {};
  const role = roleNorm(data.role);
  if (!ALLOWED_ROLES.includes(role)) throw new Error("אין לך הרשאה לעריכת מערכות שעות.");

  return { role, by: "role" };
}

function maxPeriodsForDay(dayKey) {
  return Number(DAY_PERIOD_LIMITS[dayKey] || PERIODS.length);
}

function blankGrid() {
  const grid = {};
  for (const d of DAYS) {
    grid[d.key] = PERIODS.map(() => ({ subject: "", teacher: "", room: "" }));
  }
  return grid;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setMsg(txt) {
  msgEl.textContent = txt || "";
}

function renderTable(grid) {
  table.innerHTML = "";

  // header
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  trh.innerHTML = `<th>שעה</th>` + DAYS.map(d => `<th>${d.label}</th>`).join("");
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let pIndex = 0; pIndex < PERIODS.length; pIndex++) {
    const p = PERIODS[pIndex];
    const tr = document.createElement("tr");

    // עמודת שעה: מספר + טווח שעות
    const tdP = document.createElement("td");
    tdP.innerHTML = `<b>${p.n}</b><div style="opacity:.75;font-size:.85rem;margin-top:2px;">${p.time}</div>`;
    tr.appendChild(tdP);

    for (const d of DAYS) {
      const limit = maxPeriodsForDay(d.key);
      const isDisabled = (pIndex + 1) > limit; // למשל בשישי שיעור 7–9

      const cell = (grid?.[d.key]?.[pIndex]) || { subject: "", teacher: "", room: "" };

      const td = document.createElement("td");
      if (isDisabled) td.style.opacity = "0.45";

      // אם התא “כבוי” – לא נותנים להקליד כדי שלא תטעה
      const disAttr = isDisabled ? "disabled" : "";

      td.innerHTML = `
        <div class="tt-cell">
          <input ${disAttr} data-day="${d.key}" data-p="${pIndex}" data-field="subject"
                 placeholder="מקצוע" value="${escapeHtml(cell.subject)}">
          <input ${disAttr} data-day="${d.key}" data-p="${pIndex}" data-field="teacher"
                 placeholder="מורה" value="${escapeHtml(cell.teacher)}">
          <input ${disAttr} data-day="${d.key}" data-p="${pIndex}" data-field="room"
                 placeholder="כיתה/חדר (אופציונלי)" value="${escapeHtml(cell.room)}">
        </div>
      `;

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
}

function readGridFromInputs() {
  const grid = blankGrid();
  const inputs = table.querySelectorAll("input[data-day][data-p][data-field]");

  inputs.forEach((inp) => {
    // אם input disabled – לא שומרים אותו (כמו בשישי שיעור 7–9)
    if (inp.disabled) return;

    const day = inp.dataset.day;
    const p = Number(inp.dataset.p);
    const field = inp.dataset.field;
    if (!grid[day] || !grid[day][p]) return;
    grid[day][p][field] = inp.value || "";
  });

  return grid;
}

async function loadTimetable(classId) {
  const ref = doc(db, "timetables", classId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    metaEl.textContent = "אין מערכת שמורה לכיתה הזאת עדיין.";
    renderTable(blankGrid());
    return;
  }

  const data = snap.data() || {};
  const grid = data.grid || blankGrid();
  renderTable(grid);

  const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleString("he-IL") : "";
  metaEl.textContent = `עודכן לאחרונה: ${updatedAt || "-"} · ע"י: ${data.updatedBy || "-"}`;
}

async function saveTimetable(classId) {
  const grid = readGridFromInputs();
  const ref = doc(db, "timetables", classId);

  await setDoc(ref, {
    classId,
    grid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.email || ""
  }, { merge: true });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      alert("כניסה נכשלה: " + (err?.message || err));
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

if (loadBtn) {
  loadBtn.addEventListener("click", async () => {
    const c = classIdSel.value;
    if (!c) return alert("בחר כיתה");
    setMsg("טוען...");
    await loadTimetable(c);
    setMsg("");
  });
}

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const c = classIdSel.value;
    if (!c) return alert("בחר כיתה");
    setMsg("שומר...");
    try {
      await saveTimetable(c);
      setMsg("נשמר ✅");
      await loadTimetable(c);
    } catch (err) {
      console.error(err);
      setMsg("שגיאה בשמירה (בדוק Console/Rules).");
      alert("שגיאה בשמירה: " + (err?.message || err));
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    authStatus.textContent = "לא מחובר";
    loginSection.style.display = "block";
    panel.style.display = "none";
    return;
  }

  try {
    const { role } = await assertAccess(user);
    authStatus.textContent = `מחובר: ${user.email} · תפקיד: ${role}`;
    loginSection.style.display = "none";
    panel.style.display = "block";
    renderTable(blankGrid());
  } catch (e) {
    console.error(e);
    alert(e?.message || "אין הרשאה");
    await signOut(auth);
  }
});
