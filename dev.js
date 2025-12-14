import { app, auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

/* =============================
   DEV הגדרות
============================= */
const DEV_EMAILS = ["nadavp1119@gmail.com", "peretzinho23@gmail.com"].map(e => e.toLowerCase());
const ALL_GRADES = ["z", "h", "t"];

function norm(email) {
  return String(email || "").trim().toLowerCase();
}

function roleLabel(role) {
  switch (role) {
    case "teacher": return "מורה";
    case "gradeLead": return "אחראי שכבה";
    case "counselor": return "יועץ";
    case "principal": return "מנהל";
    case "dev": return "DEV";
    default: return role || "-";
  }
}

function gradesLabel(grades) {
  const g = Array.isArray(grades) ? grades : [];
  const map = { z: "ז׳", h: "ח׳", t: "ט׳" };
  return g.map(x => map[x] || x).join(" , ") || "-";
}

/* =============================
   DOM
============================= */
const elStatus = document.getElementById("dev-status");
const elLogout = document.getElementById("dev-logout");
const elLogin = document.getElementById("dev-login");
const elContent = document.getElementById("dev-content");
const elLoginForm = document.getElementById("dev-login-form");
const elLoginMsg = document.getElementById("dev-login-msg");

const reqBody = document.getElementById("requests-body");
const reqEmpty = document.getElementById("requests-empty");
const usersList = document.getElementById("users-list");
const usersEmpty = document.getElementById("users-empty");

/* =============================
   Theme toggle (לא חובה)
============================= */
const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    themeBtn.textContent = next === "dark" ? "🌙" : "☀️";
    try { localStorage.setItem("theme", next); } catch {}
  });
  try {
    const saved = localStorage.getItem("theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
      themeBtn.textContent = saved === "dark" ? "🌙" : "☀️";
    }
  } catch {}
}

/* =============================
   Secondary Auth (ליצור משתמש בלי להעיף DEV)
============================= */
function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === "secondary");
  const secondaryApp = existing || initializeApp(app.options, "secondary");
  return getAuth(secondaryApp);
}

/* =============================
   Login
============================= */
console.log("✅ DEV.JS LOADED");

if (elLoginForm) {
  elLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (elLoginMsg) elLoginMsg.textContent = "";
    const email = document.getElementById("dev-email")?.value?.trim() || "";
    const password = document.getElementById("dev-password")?.value || "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("DEV login error:", err);
      if (elLoginMsg) elLoginMsg.textContent = "שגיאה בכניסה: " + (err?.message || err);
    }
  });
}

if (elLogout) {
  elLogout.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, async (user) => {
  console.log("onAuthStateChanged:", user?.email || null);

  if (!user) {
    if (elStatus) elStatus.textContent = "לא מחובר";
    if (elLogin) elLogin.style.display = "block";
    if (elContent) elContent.style.display = "none";
    stopRealtime();
    return;
  }

  const email = norm(user.email);
  if (!DEV_EMAILS.includes(email)) {
    if (elStatus) elStatus.textContent = "אין לך גישה (לא DEV)";
    alert("אין לך גישה לדף DEV");
    await signOut(auth);
    return;
  }

  if (elStatus) elStatus.textContent = `מחובר כ-DEV: ${user.email}`;
  if (elLogin) elLogin.style.display = "none";
  if (elContent) elContent.style.display = "block";

  await ensureDevAdminUserDoc(user);

  // realtime במקום “רענון ידני” (עדיין יש רענון פנימי)
  startRealtime();
});

/* =============================
   ensure DEV exists in adminUsers
============================= */
async function ensureDevAdminUserDoc(user) {
  try {
    const ref = doc(db, "adminUsers", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    await setDoc(ref, {
      email: user.email,
      fullName: "DEV",
      role: "dev",
      allowedGrades: ALL_GRADES,
      createdAt: serverTimestamp(),
      createdBy: user.email
    });
  } catch (e) {
    console.error("ensureDevAdminUserDoc error:", e);
  }
}

/* =============================
   REALTIME subscriptions
============================= */
let unsubReq = null;
let unsubUsers = null;

function stopRealtime() {
  try { if (unsubReq) unsubReq(); } catch {}
  try { if (unsubUsers) unsubUsers(); } catch {}
  unsubReq = null;
  unsubUsers = null;
}

function startRealtime() {
  stopRealtime();

  // adminRequests realtime
  try {
    unsubReq = onSnapshot(collection(db, "adminRequests"), (snap) => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      renderRequestsFromArray(arr);
    }, (err) => {
      console.error("onSnapshot adminRequests error:", err);
      // fallback חד פעמי
      refreshAll();
    });
  } catch (e) {
    console.error("startRealtime adminRequests failed:", e);
  }

  // adminUsers realtime
  try {
    unsubUsers = onSnapshot(collection(db, "adminUsers"), (snap) => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      renderUsersFromArray(arr);
    }, (err) => {
      console.error("onSnapshot adminUsers error:", err);
      refreshAll();
    });
  } catch (e) {
    console.error("startRealtime adminUsers failed:", e);
  }

  // גם רענון ראשוני
  refreshAll();
}

async function refreshAll() {
  await Promise.all([renderRequests(), renderUsers()]);
}

/* =============================
   Requests (adminRequests)
   תומך גם ב-createdAt כ-Timestamp וגם כ-string
============================= */
async function renderRequests() {
  if (!reqBody) return;

  try {
    const snaps = await getDocs(collection(db, "adminRequests"));
    const arr = [];
    snaps.forEach(s => arr.push({ id: s.id, ...s.data() }));
    renderRequestsFromArray(arr);
  } catch (e) {
    console.error("renderRequests getDocs error:", e);
    reqBody.innerHTML = "";
    if (reqEmpty) {
      reqEmpty.style.display = "block";
      reqEmpty.textContent = "שגיאה בטעינת בקשות. תבדוק Console.";
    }
  }
}

function isPendingRequest(r) {
  const handled = r.handled === true;
  const status = String(r.status || "").toLowerCase();
  return !handled && status !== "approved" && status !== "rejected";
}

function toMillisCreatedAt(v) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();        // Timestamp
    if (typeof v === "string") return new Date(v).getTime() || 0;            // ISO string
    if (v instanceof Date) return v.getTime();
    return 0;
  } catch {
    return 0;
  }
}

function renderRequestsFromArray(arr) {
  if (!reqBody) return;
  reqBody.innerHTML = "";

  const pending = (arr || []).filter(isPendingRequest);

  // מיון בצד-לקוח כדי להימנע מ-orderBy שנדפק מערבוב טיפוסים
  pending.sort((a, b) => toMillisCreatedAt(b.createdAt) - toMillisCreatedAt(a.createdAt));

  console.log("DEV pending requests:", pending.length, pending);

  if (pending.length === 0) {
    if (reqEmpty) {
      reqEmpty.style.display = "block";
      reqEmpty.textContent = "אין בקשות ממתינות כרגע.";
    }
    return;
  }
  if (reqEmpty) reqEmpty.style.display = "none";

  for (const r of pending) reqBody.appendChild(renderRequestRow(r));
}

function renderRequestRow(r) {
  const tr = document.createElement("tr");
  tr.className = "row";

  const tdEmail = document.createElement("td");
  tdEmail.innerHTML = `
    <div><b>${escapeHtml(r.email || "")}</b></div>
    <div class="small">${escapeHtml(r.fullName || "")}</div>
  `;

  const tdInfo = document.createElement("td");
  tdInfo.innerHTML = `
    <div class="small">תפקיד שהזין: <b>${escapeHtml(r.role || "-")}</b></div>
    <div class="small">סיבה: <b>${escapeHtml(r.reason || "-")}</b></div>
    <div class="small">הודעה: ${escapeHtml(r.message || "-")}</div>
    <div class="small muted">נשלח: ${formatTime(r.createdAt)}</div>
  `;

  const tdPerm = document.createElement("td");
  const roleSel = document.createElement("select");
  roleSel.className = "select";
  roleSel.innerHTML = `
    <option value="teacher">מורה</option>
    <option value="gradeLead">אחראי שכבה</option>
    <option value="counselor">יועץ</option>
    <option value="principal">מנהל</option>
  `;

  const chkWrap = document.createElement("div");
  chkWrap.className = "chkline";
  chkWrap.innerHTML = `
    <label><input type="checkbox" value="z" checked> ז׳</label>
    <label><input type="checkbox" value="h" checked> ח׳</label>
    <label><input type="checkbox" value="t" checked> ט׳</label>
  `;

  tdPerm.appendChild(roleSel);
  tdPerm.appendChild(chkWrap);

  const tdAct = document.createElement("td");
  const act = document.createElement("div");
  act.className = "actions";

  const btnApprove = document.createElement("button");
  btnApprove.className = "btn";
  btnApprove.type = "button";
  btnApprove.textContent = "אשר + צור משתמש";

  const btnReject = document.createElement("button");
  btnReject.className = "btn-outline";
  btnReject.type = "button";
  btnReject.textContent = "דחה";

  const btnDelete = document.createElement("button");
  btnDelete.className = "btn-outline";
  btnDelete.type = "button";
  btnDelete.textContent = "מחק בקשה";

  const msg = document.createElement("div");
  msg.className = "small";
  msg.style.marginTop = "8px";

  btnApprove.addEventListener("click", async () => {
    const role = roleSel.value;
    const grades = Array.from(chkWrap.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);

    if (grades.length === 0 && role !== "principal") {
      alert("בחר לפחות שכבה אחת");
      return;
    }

    msg.textContent = "יוצר משתמש...";
    try {
      await approveRequest(r, role, grades);
      msg.textContent = "אושר ✅";
    } catch (e) {
      console.error(e);
      msg.textContent = "שגיאה: " + (e?.message || e);
    }
  });

  btnReject.addEventListener("click", async () => {
    if (!confirm("לדחות את הבקשה?")) return;
    msg.textContent = "דוחה...";
    try {
      await updateDoc(doc(db, "adminRequests", r.id), {
        handled: true,
        status: "rejected",
        handledAt: serverTimestamp(),
        handledBy: auth.currentUser?.email || ""
      });
      msg.textContent = "נדחה ✅";
    } catch (e) {
      console.error(e);
      msg.textContent = "שגיאה: " + (e?.message || e);
    }
  });

  btnDelete.addEventListener("click", async () => {
    if (!confirm("למחוק את הבקשה?")) return;
    msg.textContent = "מוחק...";
    try {
      await deleteDoc(doc(db, "adminRequests", r.id));
      msg.textContent = "נמחק ✅";
    } catch (e) {
      console.error(e);
      msg.textContent = "שגיאה: " + (e?.message || e);
    }
  });

  act.appendChild(btnApprove);
  act.appendChild(btnReject);
  act.appendChild(btnDelete);
  tdAct.appendChild(act);
  tdAct.appendChild(msg);

  tr.appendChild(tdEmail);
  tr.appendChild(tdInfo);
  tr.appendChild(tdPerm);
  tr.appendChild(tdAct);
  return tr;
}

async function approveRequest(r, role, grades) {
  const email = String(r.email || "").trim();
  const password = String(r.password || "").trim();
  if (!email || !password) throw new Error("לבקשה חסר אימייל/סיסמה");

  const secondaryAuth = getSecondaryAuth();

  // יצירת משתמש Auth (בלי להעיף את DEV)
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  } catch (e) {
    // אם המשתמש כבר קיים - תן הודעה ברורה (כי בלי Admin SDK אי אפשר “למצוא uid לפי אימייל”)
    if (String(e?.code || "").includes("auth/email-already-in-use")) {
      throw new Error("האימייל הזה כבר קיים ב-Auth. אם זה משתמש ישן — תיצור לו הרשאות ידנית דרך Users (צריך UID).");
    }
    throw e;
  } finally {
    // מנקה את הסשן של secondaryAuth כדי שלא יעשה בלגן
    try { await signOut(secondaryAuth); } catch {}
  }

  const uid = cred.user.uid;

  // הרשאות
  await setDoc(doc(db, "adminUsers", uid), {
    email,
    fullName: r.fullName || "",
    role,
    allowedGrades: (role === "principal" || role === "dev") ? ALL_GRADES : grades,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.email || ""
  });

  // סגירת בקשה
  await updateDoc(doc(db, "adminRequests", r.id), {
    handled: true,
    status: "approved",
    approvedRole: role,
    approvedGrades: (role === "principal" || role === "dev") ? ALL_GRADES : grades,
    handledAt: serverTimestamp(),
    handledBy: auth.currentUser?.email || "",
    approvedUid: uid
  });
}

/* =============================
   Users (adminUsers)
============================= */
async function renderUsers() {
  if (!usersList) return;

  try {
    const snaps = await getDocs(collection(db, "adminUsers"));
    const arr = [];
    snaps.forEach(s => arr.push({ id: s.id, ...s.data() }));
    renderUsersFromArray(arr);
  } catch (e) {
    console.error("renderUsers getDocs error:", e);
    usersList.innerHTML = "";
    if (usersEmpty) {
      usersEmpty.style.display = "block";
      usersEmpty.textContent = "שגיאה בטעינת משתמשים. תבדוק Console.";
    }
  }
}

function renderUsersFromArray(users) {
  if (!usersList) return;
  usersList.innerHTML = "";

  const filtered = (users || []).filter(u => u.email);

  console.log("DEV adminUsers:", filtered.length, filtered);

  if (filtered.length === 0) {
    if (usersEmpty) {
      usersEmpty.style.display = "block";
      usersEmpty.textContent = "אין משתמשי אדמין עדיין.";
    }
    return;
  }
  if (usersEmpty) usersEmpty.style.display = "none";

  filtered.sort((a, b) =>
    (String(a.role).localeCompare(String(b.role)) || String(a.email).localeCompare(String(b.email)))
  );

  for (const u of filtered) usersList.appendChild(renderUserCard(u));
}

function renderUserCard(u) {
  const wrap = document.createElement("div");
  wrap.className = "row";
  wrap.style.padding = "12px";

  const top = document.createElement("div");
  top.style.display = "flex";
  top.style.justifyContent = "space-between";
  top.style.gap = "10px";
  top.style.flexWrap = "wrap";

  const info = document.createElement("div");
  info.innerHTML = `
    <div><b>${escapeHtml(u.email || "")}</b></div>
    <div class="small">${escapeHtml(u.fullName || "")}</div>
    <div class="small">תפקיד: <b>${escapeHtml(roleLabel(u.role))}</b></div>
    <div class="small">שכבות: <b>${escapeHtml(gradesLabel(u.allowedGrades))}</b></div>
  `;

  const controls = document.createElement("div");
  controls.className = "actions";

  const btnEdit = document.createElement("button");
  btnEdit.className = "btn-outline";
  btnEdit.type = "button";
  btnEdit.textContent = "ערוך הרשאות";

  const btnRemove = document.createElement("button");
  btnRemove.className = "btn";
  btnRemove.type = "button";
  btnRemove.textContent = "בטל גישה";

  const msg = document.createElement("div");
  msg.className = "small";
  msg.style.marginTop = "6px";

  btnRemove.addEventListener("click", async () => {
    const me = norm(auth.currentUser?.email);
    if (norm(u.email) === me) {
      alert("לא מוחקים את עצמנו 😅");
      return;
    }
    if (!confirm(`לבטל גישה ל-${u.email}?`)) return;
    msg.textContent = "מבטל...";
    try {
      await deleteDoc(doc(db, "adminUsers", u.id));
      msg.textContent = "בוטל ✅";
    } catch (e) {
      console.error(e);
      msg.textContent = "שגיאה: " + (e?.message || e);
    }
  });

  btnEdit.addEventListener("click", async () => {
    const newRole = prompt("תפקיד (teacher/gradeLead/counselor/principal/dev)", u.role || "teacher");
    if (!newRole) return;

    let newGrades = u.allowedGrades || [];
    if (newRole !== "principal" && newRole !== "dev") {
      const g = prompt("שכבות (z,h,t) מופרד בפסיקים", (newGrades || []).join(","));
      if (g === null) return;
      newGrades = g.split(",").map(x => x.trim()).filter(Boolean);
    } else {
      newGrades = ALL_GRADES;
    }

    msg.textContent = "שומר...";
    try {
      await updateDoc(doc(db, "adminUsers", u.id), {
        role: newRole,
        allowedGrades: newGrades,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || ""
      });
      msg.textContent = "נשמר ✅";
    } catch (e) {
      console.error(e);
      msg.textContent = "שגיאה: " + (e?.message || e);
    }
  });

  controls.appendChild(btnEdit);
  controls.appendChild(btnRemove);
  controls.appendChild(msg);

  top.appendChild(info);
  top.appendChild(controls);
  wrap.appendChild(top);
  return wrap;
}

/* =============================
   Utils
============================= */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(ts) {
  try {
    if (!ts) return "-";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("he-IL");
  } catch {
    return "-";
  }
}
