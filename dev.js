import { app, auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  getAuth
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

// =============================
// הגדרות DEV
// =============================
const DEV_EMAILS = ["nadavp1119@gmail.com", "peretzinho23@gmail.com"].map((e) => e.toLowerCase());
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
  return g.map((x) => map[x] || x).join(" , ") || "-";
}

// =============================
// DOM
// =============================
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

// =============================
// Theme toggle (אם כבר יש לך לוגיקה אחרת – זה לא מפריע)
// =============================
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

// =============================
// Secondary Auth (כדי ליצור משתמשים בלי לזרוק את ה-DEV מהסשן)
// =============================
function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === "secondary");
  const secondaryApp = existing || initializeApp(app.options, "secondary");
  return getAuth(secondaryApp);
}

// =============================
// Login
// =============================
elLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  elLoginMsg.textContent = "";
  const email = document.getElementById("dev-email").value.trim();
  const password = document.getElementById("dev-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    elLoginMsg.textContent = "שגיאה בכניסה: " + (err?.message || err);
  }
});

elLogout.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    elStatus.textContent = "לא מחובר";
    elLogin.style.display = "block";
    elContent.style.display = "none";
    return;
  }

  const email = norm(user.email);
  if (!DEV_EMAILS.includes(email)) {
    elStatus.textContent = "אין לך גישה (לא DEV)";
    alert("אין לך גישה לדף DEV");
    await signOut(auth);
    return;
  }

  elStatus.textContent = `מחובר כ-DEV: ${user.email}`;
  elLogin.style.display = "none";
  elContent.style.display = "block";

  // דואגים של-DEV יהיה גם מסמך הרשאות כדי שהאדמין יעבוד חלק
  await ensureDevAdminUserDoc(user);

  await refreshAll();
});

async function ensureDevAdminUserDoc(user) {
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
}

async function refreshAll() {
  await Promise.all([renderRequests(), renderUsers()]);
}

// =============================
// Requests (adminRequests)
// =============================
async function renderRequests() {
  reqBody.innerHTML = "";

  const qy = query(
    collection(db, "adminRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );

  let snaps;
  try {
    snaps = await getDocs(qy);
  } catch (e) {
    // אם אין אינדקס ל-where+orderBy - ניפול לגרסה בלי orderBy
    snaps = await getDocs(query(collection(db, "adminRequests"), where("status", "==", "pending")));
  }

  const arr = [];
  snaps.forEach((s) => arr.push({ id: s.id, ...s.data() }));

  if (arr.length === 0) {
    reqEmpty.style.display = "block";
    return;
  }
  reqEmpty.style.display = "none";

  for (const r of arr) {
    reqBody.appendChild(renderRequestRow(r));
  }
}

function renderRequestRow(r) {
  const tr = document.createElement("tr");
  tr.className = "row";

  const tdEmail = document.createElement("td");
  tdEmail.innerHTML = `<div><b>${escapeHtml(r.email || "")}</b></div><div class="small">${escapeHtml(r.fullName || "")}</div>`;

  const tdInfo = document.createElement("td");
  tdInfo.innerHTML = `
    <div class="small">תפקיד בבי"ס: <b>${escapeHtml(r.jobTitle || "-")}</b></div>
    <div class="small">הערה: ${escapeHtml(r.note || "-")}</div>
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
    const grades = Array.from(chkWrap.querySelectorAll("input[type=checkbox]:checked")).map((c) => c.value);
    if (grades.length === 0 && role !== "principal") {
      alert("בחר לפחות שכבה אחת");
      return;
    }
    msg.textContent = "יוצר משתמש...";
    try {
      await approveRequest(r, role, grades);
      msg.textContent = "אושר ✅";
      await refreshAll();
    } catch (e) {
      console.error(e);
      msg.textContent = "שגיאה: " + (e?.message || e);
    }
  });

  btnReject.addEventListener("click", async () => {
    if (!confirm("לדחות את הבקשה?") ) return;
    msg.textContent = "דוחה...";
    try {
      await updateDoc(doc(db, "adminRequests", r.id), {
        status: "rejected",
        handledAt: serverTimestamp(),
        handledBy: auth.currentUser?.email || ""
      });
      msg.textContent = "נדחה ✅";
      await refreshAll();
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
      await refreshAll();
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
  const password = String(r.password || "");
  if (!email || !password) throw new Error("לבקשה חסר אימייל/סיסמה");

  const secondaryAuth = getSecondaryAuth();

  // יצירת משתמש Auth (בלי להחליף את ה-DEV מהסשן)
  const cred = await import("https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js").then(async (m) => {
    return await m.createUserWithEmailAndPassword(secondaryAuth, email, password);
  });

  const uid = cred.user.uid;

  // שמירת הרשאות
  await setDoc(doc(db, "adminUsers", uid), {
    email,
    fullName: r.fullName || "",
    role,
    allowedGrades: role === "principal" ? ALL_GRADES : grades,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.email || ""
  });

  // סגירת בקשה
  await updateDoc(doc(db, "adminRequests", r.id), {
    status: "approved",
    approvedRole: role,
    approvedGrades: role === "principal" ? ALL_GRADES : grades,
    handledAt: serverTimestamp(),
    handledBy: auth.currentUser?.email || "",
    approvedUid: uid
  });
}

// =============================
// Users (adminUsers)
// =============================
async function renderUsers() {
  usersList.innerHTML = "";
  const snaps = await getDocs(collection(db, "adminUsers"));
  const users = [];
  snaps.forEach((s) => users.push({ id: s.id, ...s.data() }));

  // לא מציגים משתמשים בלי email
  const filtered = users.filter((u) => u.email);

  if (filtered.length === 0) {
    usersEmpty.style.display = "block";
    return;
  }
  usersEmpty.style.display = "none";

  // sort by role then email
  filtered.sort((a, b) => (String(a.role).localeCompare(String(b.role)) || String(a.email).localeCompare(String(b.email))));

  for (const u of filtered) {
    usersList.appendChild(renderUserCard(u));
  }
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
      await refreshAll();
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
      newGrades = g.split(",").map((x) => x.trim()).filter(Boolean);
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
      await refreshAll();
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

// =============================
// Utils
// =============================
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
    // Firestore Timestamp
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("he-IL");
  } catch {
    return "-";
  }
}
