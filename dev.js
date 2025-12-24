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

// מי מורשה להיכנס ל-DEV PANEL (תפקידים)
const ALLOWED_ROLES_FOR_DEV_PANEL = ["dev", "principal", "gradelead"];

/* =============================
   Helpers
============================= */
function norm(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();

  // תומך גם בגרסאות ישנות / עברית
  if (r === "teacherpanel" || r === "teacher_panel" || r === "פאנל מורים") return "teacherpanel";
  if (r === "gradelead" || r === "grade_lead" || r === "אחראי שכבה") return "gradelead";
  if (r === "principal" || r === "מנהל" || r === "מנהלת") return "principal";
  if (r === "counselor" || r === "יועץ" || r === "יועצת") return "counselor";
  if (r === "teacher" || r === "מורה") return "teacher";
  if (r === "dev") return "dev";

  return r || "teacher";
}

function roleLabel(role) {
  const r = normalizeRole(role);
  switch (r) {
    case "teacherpanel": return "פאנל מורים";
    case "teacher": return "מורה";
    case "gradelead": return "אחראי שכבה";
    case "counselor": return "יועץ";
    case "principal": return "מנהל";
    case "dev": return "DEV";
    default: return r || "-";
  }
}

function gradesLabel(grades) {
  const g = Array.isArray(grades) ? grades : [];
  const map = { z: "ז׳", h: "ח׳", t: "ט׳" };
  return g.map(x => map[x] || x).join(" , ") || "-";
}

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
   🔥 REALTIME PERMISSION GUARD
============================= */
let unsubPerm = null;

function stopRealtime() {
  try { if (unsubReq) unsubReq(); } catch {}
  try { if (unsubUsers) unsubUsers(); } catch {}
  unsubReq = null;
  unsubUsers = null;
}

function kick(msg = "אין לך יותר גישה") {
  alert(msg);
  try { if (unsubPerm) unsubPerm(); } catch {}
  unsubPerm = null;

  stopRealtime();

  signOut(auth).finally(() => {
    window.location.href = "dev.html";
  });
}

function stopPermWatcher() {
  try { if (unsubPerm) unsubPerm(); } catch {}
  unsubPerm = null;
}

function startPermWatcher(user) {
  stopPermWatcher();
  if (!user) return;

  const refDoc = doc(db, "adminUsers", user.uid);

  unsubPerm = onSnapshot(refDoc, (snap) => {
    if (!snap.exists()) return kick("הגישה שלך בוטלה");

    const data = snap.data() || {};
    const role = normalizeRole(data.role);

    if (!ALLOWED_ROLES_FOR_DEV_PANEL.includes(role)) {
      return kick("אין לך גישה לדף DEV (מותר רק מנהל / אחראי שכבה / DEV)");
    }
  }, (err) => {
    console.error("perm snapshot error:", err);
    kick("שגיאת הרשאות (בדוק חוקים/קונסול)");
  });
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

/* =============================
   ensure DEV exists in adminUsers
============================= */
async function ensureDevAdminUserDoc(user) {
  try {
    const refDoc = doc(db, "adminUsers", user.uid);
    const snap = await getDoc(refDoc);
    if (snap.exists()) return;

    await setDoc(refDoc, {
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
   Auth state
============================= */
onAuthStateChanged(auth, async (user) => {
  console.log("onAuthStateChanged:", user?.email || null);

  if (!user) {
    stopPermWatcher();
    stopRealtime();

    if (elStatus) elStatus.textContent = "לא מחובר";
    if (elLogin) elLogin.style.display = "block";
    if (elContent) elContent.style.display = "none";
    return;
  }

  const email = norm(user.email);
  const isDevByEmail = DEV_EMAILS.includes(email);

  if (isDevByEmail) {
    await ensureDevAdminUserDoc(user);
  }

  let role = null;
  try {
    const snap = await getDoc(doc(db, "adminUsers", user.uid));
    role = snap.exists() ? normalizeRole(snap.data()?.role) : null;
  } catch (e) {
    console.error("Failed reading adminUsers role:", e);
  }

  if (!role && !isDevByEmail) {
    if (elStatus) elStatus.textContent = "אין לך גישה";
    alert("אין לך גישה לדף DEV (חסר מסמך הרשאות)");
    await signOut(auth);
    return;
  }

  if (!isDevByEmail && !ALLOWED_ROLES_FOR_DEV_PANEL.includes(role)) {
    if (elStatus) elStatus.textContent = "אין לך גישה (מותר רק מנהל/אחראי שכבה/DEV)";
    alert("אין לך גישה לדף DEV (מותר רק מנהל / אחראי שכבה / DEV)");
    await signOut(auth);
    return;
  }

  startPermWatcher(user);

  if (elStatus) {
    elStatus.textContent =
      `מחובר: ${user.email} · תפקיד: ${roleLabel(role || (isDevByEmail ? "dev" : ""))}`;
  }
  if (elLogin) elLogin.style.display = "none";
  if (elContent) elContent.style.display = "block";

  startRealtime();
});

/* =============================
   REALTIME subscriptions (טבלאות)
============================= */
let unsubReq = null;
let unsubUsers = null;

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

  refreshAll();
}

async function refreshAll() {
  await Promise.all([renderRequests(), renderUsers()]);
}

/* =============================
   Requests (adminRequests)
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
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v === "string") return new Date(v).getTime() || 0;
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
  pending.sort((a, b) => toMillisCreatedAt(b.createdAt) - toMillisCreatedAt(a.createdAt));

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
    <option value="teacherpanel">פאנל מורים</option>
    <option value="teacher">מורה</option>
    <option value="gradelead">אחראי שכבה</option>
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

  function syncReqGradesUI() {
    const rrole = normalizeRole(roleSel.value);
    const isTeacherPanel = (rrole === "teacherpanel");

    chkWrap.style.display = isTeacherPanel ? "none" : "";

    if (isTeacherPanel) {
      chkWrap.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    } else {
      const anyChecked = !!chkWrap.querySelector('input[type="checkbox"]:checked');
      if (!anyChecked) {
        chkWrap.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = true);
      }
    }
  }
  roleSel.addEventListener("change", syncReqGradesUI);
  syncReqGradesUI();

  btnApprove.addEventListener("click", async () => {
    const role = normalizeRole(roleSel.value);

    let grades = [];
    if (role !== "teacherpanel") {
      grades = Array.from(chkWrap.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
      if (grades.length === 0 && role !== "principal") {
        alert("בחר לפחות שכבה אחת");
        return;
      }
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
  const meUid = auth.currentUser?.uid;
  const meEmail = norm(auth.currentUser?.email);
  const isDev = DEV_EMAILS.includes(meEmail);

  if (!isDev) {
    const snap = await getDoc(doc(db, "adminUsers", meUid));
    const myRole = snap.exists() ? normalizeRole(snap.data()?.role) : "";
    if (!["principal", "gradelead", "dev"].includes(myRole)) {
      throw new Error("אין לך הרשאה לאשר בקשות (רק מנהל/אחראי שכבה/DEV)");
    }
  }

  const email = String(r.email || "").trim();
  const password = String(r.password || "").trim();
  if (!email || !password) throw new Error("לבקשה חסר אימייל/סיסמה");

  const secondaryAuth = getSecondaryAuth();

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  } catch (e) {
    if (String(e?.code || "").includes("auth/email-already-in-use")) {
      throw new Error("האימייל הזה כבר קיים ב-Auth. אם זה משתמש ישן — תיצור לו הרשאות ידנית דרך Users (צריך UID).");
    }
    throw e;
  } finally {
    try { await signOut(secondaryAuth); } catch {}
  }

  const uid = cred.user.uid;
  const finalRole = normalizeRole(role);

  await setDoc(doc(db, "adminUsers", uid), {
    email,
    fullName: r.fullName || "",
    role: finalRole,
    allowedGrades:
      (finalRole === "principal" || finalRole === "dev") ? ALL_GRADES :
      (finalRole === "teacherpanel") ? [] :
      grades,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.email || ""
  });

  await updateDoc(doc(db, "adminRequests", r.id), {
    handled: true,
    status: "approved",
    approvedRole: finalRole,
    approvedGrades:
      (finalRole === "principal" || finalRole === "dev") ? ALL_GRADES :
      (finalRole === "teacherpanel") ? [] :
      grades,
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

function createRoleSelect(currentRole) {
  const sel = document.createElement("select");
  sel.className = "select";

  const canSeeDev = DEV_EMAILS.includes(norm(auth.currentUser?.email));

  sel.innerHTML = `
    <option value="teacherpanel">פאנל מורים</option>
    <option value="teacher">מורה</option>
    <option value="gradelead">אחראי שכבה</option>
    <option value="counselor">יועץ</option>
    <option value="principal">מנהל</option>
    ${canSeeDev ? `<option value="dev">DEV</option>` : ``}
  `;

  const normalized = normalizeRole(currentRole || "teacher");
  sel.value = (!canSeeDev && normalized === "dev") ? "principal" : normalized;

  return sel;
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
    <div class="small">תפקיד: <b class="role-text">${escapeHtml(roleLabel(u.role))}</b></div>
    <div class="small">שכבות: <b class="grades-text">${escapeHtml(gradesLabel(u.allowedGrades))}</b></div>
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

  controls.appendChild(btnEdit);
  controls.appendChild(btnRemove);
  controls.appendChild(msg);

  top.appendChild(info);
  top.appendChild(controls);
  wrap.appendChild(top);

  const editor = document.createElement("div");
  editor.style.marginTop = "10px";
  editor.style.padding = "10px";
  editor.style.borderRadius = "14px";
  editor.style.border = "1px solid rgba(148,163,184,0.35)";
  editor.style.background = "rgba(255,255,255,0.7)";
  editor.style.display = "none";

  const roleRow = document.createElement("div");
  roleRow.style.display = "flex";
  roleRow.style.gap = "10px";
  roleRow.style.flexWrap = "wrap";
  roleRow.style.alignItems = "center";

  const roleLabelEl = document.createElement("div");
  roleLabelEl.className = "small";
  roleLabelEl.innerHTML = "<b>תפקיד:</b>";

  const roleSel = createRoleSelect(u.role || "teacher");

  roleRow.appendChild(roleLabelEl);
  roleRow.appendChild(roleSel);

  const gradesRow = document.createElement("div");
  gradesRow.style.display = "flex";
  gradesRow.style.gap = "12px";
  gradesRow.style.flexWrap = "wrap";
  gradesRow.style.alignItems = "center";
  gradesRow.style.marginTop = "10px";

  const gradesLabelEl = document.createElement("div");
  gradesLabelEl.className = "small";
  gradesLabelEl.innerHTML = "<b>שכבות:</b>";

  const chkWrap = document.createElement("div");
  chkWrap.style.display = "flex";
  chkWrap.style.gap = "10px";
  chkWrap.style.flexWrap = "wrap";

  chkWrap.innerHTML = `
    <label class="small"><input type="checkbox" value="z"> ז׳</label>
    <label class="small"><input type="checkbox" value="h"> ח׳</label>
    <label class="small"><input type="checkbox" value="t"> ט׳</label>
  `;

  const currentGrades = Array.isArray(u.allowedGrades) ? u.allowedGrades : [];
  chkWrap.querySelectorAll('input[type="checkbox"]').forEach((c) => {
    c.checked = currentGrades.includes(c.value);
  });

  gradesRow.appendChild(gradesLabelEl);
  gradesRow.appendChild(chkWrap);

  const actionRow = document.createElement("div");
  actionRow.style.display = "flex";
  actionRow.style.gap = "10px";
  actionRow.style.flexWrap = "wrap";
  actionRow.style.marginTop = "12px";

  const btnSave = document.createElement("button");
  btnSave.className = "btn";
  btnSave.type = "button";
  btnSave.textContent = "שמור";

  const btnCancel = document.createElement("button");
  btnCancel.className = "btn-outline";
  btnCancel.type = "button";
  btnCancel.textContent = "ביטול";

  actionRow.appendChild(btnSave);
  actionRow.appendChild(btnCancel);

  editor.appendChild(roleRow);
  editor.appendChild(gradesRow);
  editor.appendChild(actionRow);
  wrap.appendChild(editor);

  function setGradesLockUI(role) {
    const r = normalizeRole(role);
    const lockAll = (r === "principal" || r === "dev");
    const hideAll = (r === "teacherpanel");

    gradesRow.style.display = hideAll ? "none" : "";

    chkWrap.querySelectorAll('input[type="checkbox"]').forEach((c) => {
      if (hideAll) {
        c.disabled = true;
        c.checked = false;
        return;
      }
      c.disabled = lockAll;
      c.checked = lockAll ? true : c.checked;
    });
  }

  setGradesLockUI(roleSel.value);
  roleSel.addEventListener("change", () => setGradesLockUI(roleSel.value));

  btnEdit.addEventListener("click", () => {
    const open = editor.style.display === "block";
    editor.style.display = open ? "none" : "block";
    btnEdit.textContent = open ? "ערוך הרשאות" : "סגור עריכה";
    msg.textContent = "";
  });

  btnCancel.addEventListener("click", () => {
    roleSel.value = normalizeRole(u.role || "teacher");
    chkWrap.querySelectorAll('input[type="checkbox"]').forEach((c) => {
      c.checked = currentGrades.includes(c.value);
      c.disabled = false;
    });
    setGradesLockUI(roleSel.value);

    editor.style.display = "none";
    btnEdit.textContent = "ערוך הרשאות";
    msg.textContent = "";
  });

  btnSave.addEventListener("click", async () => {
    const newRole = normalizeRole(roleSel.value);

    let newGrades = [];
    if (newRole === "principal" || newRole === "dev") {
      newGrades = ALL_GRADES;
    } else if (newRole === "teacherpanel") {
      newGrades = [];
    } else {
      newGrades = Array.from(chkWrap.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.value);
      if (newGrades.length === 0) {
        alert("בחר לפחות שכבה אחת");
        return;
      }
    }

    msg.textContent = "שומר...";
    try {
      await updateDoc(doc(db, "adminUsers", u.id), {
        role: newRole,
        allowedGrades: newGrades,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || ""
      });

      u.role = newRole;
      u.allowedGrades = newGrades;

      info.querySelector(".role-text").textContent = roleLabel(newRole);
      info.querySelector(".grades-text").textContent = gradesLabel(newGrades);

      msg.textContent = "נשמר ✅";
      editor.style.display = "none";
      btnEdit.textContent = "ערוך הרשאות";
    } catch (e) {
      console.error(e);
      msg.textContent = "שגיאה: " + (e?.message || e);
    }
  });

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

  return wrap;
}
