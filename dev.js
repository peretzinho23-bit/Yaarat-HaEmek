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
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  addDoc,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

/* =============================
   DEV HUB – Nadav only
   =============================
   Notes:
   - Access guard is strict: only DEV_EMAILS OR role=dev in adminUsers.
   - Pages manager uses Firestore collection: pages
   - Classes manager uses Firestore collection: classes
   - Logs use Firestore collection: logs
*/

const DEV_EMAILS = ["nadavp1119@gmail.com", "peretzinho23@gmail.com"].map(x => x.toLowerCase());
const ALLOWED_ROLES = ["dev"]; // only you
const ALL_GRADES = ["z","h","t"];

/* =============================
   Helpers
============================= */
const norm = (s) => String(s || "").trim().toLowerCase();

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtTime(ts) {
  try {
    if (!ts) return "-";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("he-IL");
  } catch {
    return "-";
  }
}

function slugify(input) {
  const s = String(input || "").trim().toLowerCase();
  // keep a-z 0-9 - _
  const cleaned = s
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "";
}

function getUrlParam(name) {
  try { return new URLSearchParams(location.search).get(name); } catch { return null; }
}

async function log(action, entity, entityId, meta = {}) {
  try {
    const by = auth.currentUser?.email || "";
    await addDoc(collection(db, "logs"), {
      action,
      entity,
      entityId: entityId || "",
      meta: meta || {},
      by,
      at: serverTimestamp()
    });
  } catch (e) {
    console.warn("log failed:", e);
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
const btnRefreshRequests = document.getElementById("btn-refresh-requests");
const btnRefreshUsers = document.getElementById("btn-refresh-users");
const themeBtn = document.getElementById("theme-toggle");

/* Tabs */
const tabBtns = Array.from(document.querySelectorAll(".tab[data-tab]"));
const panels = {
  pages: document.getElementById("panel-pages"),
  classes: document.getElementById("panel-classes"),
  logs: document.getElementById("panel-logs"),
  quick: document.getElementById("panel-quick"),
  access: document.getElementById("panel-access"),
};

/* Pages Manager */
const pagesList = document.getElementById("pages-list");
const pagesEmpty = document.getElementById("pages-empty");
const pagesSearch = document.getElementById("pages-search");
const btnNewPage = document.getElementById("btn-new-page");
const btnOpenPages = document.getElementById("open-pages");

/* Classes */
const clsGrade = document.getElementById("cls-grade");
const clsName = document.getElementById("cls-name");
const btnCreateClass = document.getElementById("btn-create-class");
const classesList = document.getElementById("classes-list");
const classesEmpty = document.getElementById("classes-empty");

/* Logs */
const logsList = document.getElementById("logs-list");
const logsEmpty = document.getElementById("logs-empty");
const logsFilter = document.getElementById("logs-filter");
const btnRefreshLogs = document.getElementById("btn-refresh-logs");
const btnOpenLogs = document.getElementById("open-logs");

/* Quick */
const btnOpenSite = document.getElementById("btn-open-site");
const btnOpenClass = document.getElementById("btn-open-class");
const btnOpenPage = document.getElementById("btn-open-page");
const quickSlug = document.getElementById("quick-slug");

/* Modal */
const modal = document.getElementById("page-modal");
const pmClose = document.getElementById("pm-close");
const pmTitle = document.getElementById("pm-title");
const pmSlug = document.getElementById("pm-slug");
const pmPageTitle = document.getElementById("pm-page-title");
const pmStatus = document.getElementById("pm-status");
const pmVisibility = document.getElementById("pm-visibility");
const pmBlocks = document.getElementById("pm-blocks");
const pmPreview = document.getElementById("pm-preview");
const pmSave = document.getElementById("pm-save");
const pmDelete = document.getElementById("pm-delete");
const pmMsg = document.getElementById("pm-msg");

let currentUser = null;
let currentRole = null;

/* =============================
   Theme toggle
============================= */
(function initTheme(){
  if (!themeBtn) return;

  function apply(theme){
    document.documentElement.setAttribute("data-theme", theme);
    themeBtn.textContent = theme === "dark" ? "🌙" : "☀️";
    try { localStorage.setItem("theme", theme); } catch {}
  }

  let saved = "dark";
  try { saved = localStorage.getItem("theme") || "dark"; } catch {}
  apply(saved);

  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    apply(cur === "dark" ? "light" : "dark");
  });
})();

/* =============================
   Tabs
============================= */
function setTab(name){
  tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  Object.entries(panels).forEach(([k, el]) => el?.classList.toggle("active", k === name));

  // Access realtime only when needed
  if (name === "access") {
    try { startAccessRealtime(); } catch {}
    try { refreshAccess(); } catch {}
  } else {
    try { stopAccessRealtime(); } catch {}
  }
}
tabBtns.forEach(btn => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

btnOpenPages?.addEventListener("click", () => { setTab("pages"); window.scrollTo({top:0,behavior:"smooth"}); });
btnOpenLogs?.addEventListener("click", () => { setTab("logs"); window.scrollTo({top:0,behavior:"smooth"}); });

/* =============================
   Login / Logout
============================= */
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
   Permission guard (realtime)
============================= */
let unsubPerm = null;

function kick(msg="אין לך גישה לדף DEV"){
  alert(msg);
  try { if (unsubPerm) unsubPerm(); } catch {}
  unsubPerm = null;
  signOut(auth).finally(() => location.href = "dev.html");
}

function stopPermWatcher(){
  try { if (unsubPerm) unsubPerm(); } catch {}
  unsubPerm = null;
}

function normalizeRole(role){
  return String(role || "").trim().toLowerCase();
}

function startPermWatcher(user){
  stopPermWatcher();
  if (!user) return;

  const ref = doc(db, "adminUsers", user.uid);
  unsubPerm = onSnapshot(ref, (snap) => {
    const email = norm(user.email);
    const isDevEmail = DEV_EMAILS.includes(email);

    if (isDevEmail) return; // still ok, no need doc
    if (!snap.exists()) return kick("אין הרשאות (adminUsers לא קיים)");

    const r = normalizeRole(snap.data()?.role);
    if (!ALLOWED_ROLES.includes(r)) return kick("הרשאות בוטלו (רק DEV)");
  }, (err) => {
    console.error("perm snapshot error:", err);
    kick("שגיאת הרשאות (בדוק חוקים/קונסול)");
  });
}

async function ensureDevDoc(user){
  const email = norm(user?.email);
  if (!DEV_EMAILS.includes(email)) return;

  // make sure adminUsers exists (role dev) so rules can use it if you want
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
    console.warn("ensureDevDoc failed:", e);
  }
}

/* =============================
   Auth state
============================= */
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if (!user) {
    stopPermWatcher();
    if (elStatus) elStatus.textContent = "לא מחובר";
    if (elLogin) elLogin.style.display = "block";
    if (elContent) elContent.style.display = "none";
    if (elLogout) elLogout.style.display = "none";
    return;
  }

  const email = norm(user.email);
  const isDevEmail = DEV_EMAILS.includes(email);
  if (isDevEmail) await ensureDevDoc(user);

  // load role
  let role = null;
  if (!isDevEmail){
    try {
      const snap = await getDoc(doc(db, "adminUsers", user.uid));
      role = snap.exists() ? normalizeRole(snap.data()?.role) : null;
    } catch (e) {
      console.error("Failed reading adminUsers role:", e);
    }
  } else role = "dev";

  currentRole = role;

  if (!isDevEmail && !ALLOWED_ROLES.includes(role || "")) {
    if (elStatus) elStatus.textContent = "אין לך גישה";
    kick("אין לך גישה לדף DEV (רק DEV)");
    return;
  }

  startPermWatcher(user);

  if (elStatus) elStatus.textContent = `מחובר: ${user.email} · role: ${role || "-"}`;
  if (elLogin) elLogin.style.display = "none";
  if (elContent) elContent.style.display = "block";
  if (elLogout) elLogout.style.display = "inline-flex";

  // init tools
  initLauncher();
  await refreshPages();
  await refreshClasses();
  await refreshLogs();

  // If dev.html?edit=slug -> open editor directly
  const editSlug = getUrlParam("edit");
  if (editSlug) {
    setTab("pages");
    await openPageEditorBySlug(editSlug);
  }
});

/* =============================
   Launcher (open links in new tab)
============================= */
function initLauncher(){
  document.querySelectorAll("[data-open]").forEach(a => {
    a.addEventListener("click", (e) => {
      // open in new tab for speed
      e.preventDefault();
      window.open(a.getAttribute("href"), "_blank", "noopener,noreferrer");
    });
  });
}

/* =============================
   Pages Manager
============================= */
let pagesCache = [];

function safeBlocksExample(){
  return [
    { "type":"hero", "title":"כותרת", "subtitle":"טקסט קצר", "icon":"✨" },
    { "type":"text", "text":"כאן כותבים פסקה/הסבר." },
    { "type":"button", "text":"כפתור לדוגמה", "href":"https://example.com", "style":"primary" },
    { "type":"image", "src":"https://picsum.photos/1200/650", "alt":"תמונה" },
    { "type":"links", "title":"קישורים", "items":[{"text":"דוגמה","href":"https://example.com"}] }
  ];
}

function openModal(){
  modal?.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeModal(){
  modal?.classList.remove("open");
  document.body.style.overflow = "";
  pmMsg && (pmMsg.textContent = "");
}

pmClose?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

btnNewPage?.addEventListener("click", () => {
  openPageEditor({ mode: "new" });
});

pagesSearch?.addEventListener("input", () => renderPages());

async function refreshPages(){
  if (!pagesList) return;
  try {
    const qy = query(collection(db, "pages"), orderBy("updatedAt", "desc"));
    const snap = await getDocs(qy);
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    pagesCache = arr;
  } catch (e) {
    console.error("refreshPages error:", e);
    pagesCache = [];
  }
  renderPages();
}

function renderPages(){
  if (!pagesList) return;
  pagesList.innerHTML = "";

  const q = norm(pagesSearch?.value || "");
  const filtered = pagesCache.filter(p => {
    const s = norm(p.slug) + " " + norm(p.title) + " " + norm(p.status) + " " + norm(p.visibility);
    return !q || s.includes(q);
  });

  if (filtered.length === 0) {
    if (pagesEmpty) pagesEmpty.style.display = "block";
    return;
  }
  if (pagesEmpty) pagesEmpty.style.display = "none";

  filtered.forEach(p => pagesList.appendChild(renderPageCard(p)));
}

function renderPageCard(p){
  const el = document.createElement("div");
  el.className = "item";

  const status = String(p.status || "draft");
  const vis = String(p.visibility || "public");
  const title = p.title || "(בלי כותרת)";
  const slug = p.slug || p.id;

  el.innerHTML = `
    <div class="item-top">
      <div>
        <div class="item-title">${escapeHtml(title)}</div>
        <div class="meta">
          <span class="badge">${escapeHtml(status)}</span>
          <span class="badge">${escapeHtml(vis)}</span>
          <span class="badge mono">${escapeHtml(slug)}</span>
        </div>
        <div class="meta">עודכן: ${escapeHtml(fmtTime(p.updatedAt || p.createdAt))} · ע״י: ${escapeHtml(p.updatedBy || p.createdBy || "-")}</div>
      </div>

      <div class="actions">
        <button class="btn" type="button" data-act="preview">Preview</button>
        <button class="btn btn-primary" type="button" data-act="edit">Edit</button>
      </div>
    </div>
  `;

  el.querySelector('[data-act="preview"]').addEventListener("click", () => {
    window.open(`page.html?p=${encodeURIComponent(slug)}`, "_blank", "noopener,noreferrer");
  });

  el.querySelector('[data-act="edit"]').addEventListener("click", () => {
    openPageEditor({ mode: "edit", page: p });
  });

  return el;
}

async function openPageEditorBySlug(slug){
  const s = slugify(slug);
  if (!s) return;

  // try cache first
  const cached = pagesCache.find(p => norm(p.slug) === norm(s));
  if (cached) return openPageEditor({ mode:"edit", page: cached });

  // fetch directly
  try {
    const ref = doc(db, "pages", s);
    const snap = await getDoc(ref);
    if (!snap.exists()) return alert("לא נמצא דף עם slug=" + s);
    openPageEditor({ mode:"edit", page: { id: snap.id, ...snap.data() } });
  } catch (e) {
    console.error(e);
    alert("שגיאה בטעינת דף");
  }
}

function openPageEditor({mode, page}){
  const isNew = mode === "new";
  const data = page || {};

  pmTitle.textContent = isNew ? "➕ דף חדש (Pages Manager)" : "✏️ עריכת דף";
  pmSlug.value = data.slug || data.id || "";
  pmPageTitle.value = data.title || "";
  pmStatus.value = data.status || "draft";
  pmVisibility.value = data.visibility || "dev";

  // blocks
  const blocks = Array.isArray(data.contentBlocks) ? data.contentBlocks : safeBlocksExample();
  pmBlocks.value = JSON.stringify(blocks, null, 2);

  // slug locking? allow editing but warn
  pmSlug.disabled = !isNew; // keep doc id stable
  pmDelete.style.display = isNew ? "none" : "inline-flex";
  pmPreview.style.display = isNew ? "none" : "inline-flex";

  pmMsg.textContent = isNew ? "טיפ: slug נהיה ה־Document ID. אחרי יצירה, משנים דרך “שכפול” (בפיתוח עתידי)." : "";

  // events
  pmSave.onclick = () => savePage(isNew);
  pmDelete.onclick = () => deletePage(pmSlug.value);
  pmPreview.onclick = () => window.open(`page.html?p=${encodeURIComponent(pmSlug.value)}`, "_blank", "noopener,noreferrer");

  openModal();
}

async function savePage(isNew){
  const slugRaw = pmSlug.value;
  const slug = slugify(slugRaw);
  if (!slug) { alert("חייבים slug תקין (a-z/0-9/-)"); return; }

  const title = pmPageTitle.value.trim();
  const status = pmStatus.value;
  const visibility = pmVisibility.value;

  let blocks;
  try {
    blocks = JSON.parse(pmBlocks.value || "[]");
    if (!Array.isArray(blocks)) throw new Error("contentBlocks חייב להיות מערך");
  } catch (e) {
    alert("JSON לא תקין ב-contentBlocks: " + (e?.message || e));
    return;
  }

  const nowUser = auth.currentUser?.email || "";

  pmMsg.textContent = "שומר...";
  try {
    const ref = doc(db, "pages", slug);

    if (isNew){
      await setDoc(ref, {
        slug,
        title,
        status,
        visibility,
        contentBlocks: blocks,
        createdAt: serverTimestamp(),
        createdBy: nowUser,
        updatedAt: serverTimestamp(),
        updatedBy: nowUser
      });
      await log("create", "pages", slug, { title, status, visibility });
    } else {
      await updateDoc(ref, {
        title,
        status,
        visibility,
        contentBlocks: blocks,
        updatedAt: serverTimestamp(),
        updatedBy: nowUser
      });
      await log("update", "pages", slug, { title, status, visibility });
    }

    pmMsg.textContent = "נשמר ✅";
    await refreshPages();

    // if it was new: enable preview/delete and lock slug
    if (isNew){
      pmSlug.disabled = true;
      pmDelete.style.display = "inline-flex";
      pmPreview.style.display = "inline-flex";
      pmSave.onclick = () => savePage(false);
    }
  } catch (e) {
    console.error(e);
    pmMsg.textContent = "שגיאה: " + (e?.message || e);
  }
}

async function deletePage(slugRaw){
  const slug = slugify(slugRaw);
  if (!slug) return;
  if (!confirm("למחוק את הדף הזה?")) return;

  pmMsg.textContent = "מוחק...";
  try {
    await deleteDoc(doc(db, "pages", slug));
    await log("delete", "pages", slug, {});
    pmMsg.textContent = "נמחק ✅";
    closeModal();
    await refreshPages();
  } catch (e) {
    console.error(e);
    pmMsg.textContent = "שגיאה: " + (e?.message || e);
  }
}

/* =============================
   Classes Manager
============================= */
let classesCache = [];

btnCreateClass?.addEventListener("click", createClass);

async function refreshClasses(){
  try {
    const snap = await getDocs(collection(db, "classes"));
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    classesCache = arr;
  } catch (e) {
    console.error("refreshClasses error:", e);
    classesCache = [];
  }
  renderClasses();
}

function renderClasses(){
  if (!classesList) return;
  classesList.innerHTML = "";

  const sorted = [...classesCache].sort((a,b)=> (String(a.grade||"").localeCompare(String(b.grade||"")) || String(a.name||"").localeCompare(String(b.name||""))));
  if (sorted.length === 0){
    if (classesEmpty) classesEmpty.style.display = "block";
    return;
  }
  if (classesEmpty) classesEmpty.style.display = "none";

  sorted.forEach(c => classesList.appendChild(renderClassCard(c)));
}

function renderClassCard(c){
  const el = document.createElement("div");
  el.className = "item";

  const grade = c.grade || "-";
  const name = c.name || "-";
  const id = c.id;

  el.innerHTML = `
    <div class="item-top">
      <div>
        <div class="item-title">כיתה: ${escapeHtml(grade)} · ${escapeHtml(name)}</div>
        <div class="meta mono">${escapeHtml(id)}</div>
        <div class="meta">נוצר: ${escapeHtml(fmtTime(c.createdAt))} · ע״י: ${escapeHtml(c.createdBy || "-")}</div>
      </div>
      <div class="actions">
        <button class="btn" type="button" data-act="open">פתח דף כיתה</button>
        <button class="btn btn-danger" type="button" data-act="del">מחק</button>
      </div>
    </div>
  `;

  el.querySelector('[data-act="open"]').addEventListener("click", () => {
    // Your class page path might differ; keep it simple:
    window.open(`class.html?grade=${encodeURIComponent(grade)}&class=${encodeURIComponent(name)}`, "_blank", "noopener,noreferrer");
  });

  el.querySelector('[data-act="del"]').addEventListener("click", async () => {
    if (!confirm("למחוק כיתה מהרשימה? (זה לא מוחק חדשות/מבחנים אם הם במקום אחר)")) return;
    try {
      await deleteDoc(doc(db, "classes", id));
      await log("delete", "classes", id, { grade, name });
      await refreshClasses();
    } catch (e) {
      console.error(e);
      alert("שגיאה במחיקה: " + (e?.message || e));
    }
  });

  return el;
}

async function createClass(){
  const grade = String(clsGrade?.value || "z");
  const nameRaw = String(clsName?.value || "").trim();
  if (!nameRaw) { alert("חייבים שם כיתה"); return; }

  const name = nameRaw;
  const id = slugify(`${grade}-${name}`) || `${grade}-${Date.now()}`;

  try {
    await setDoc(doc(db, "classes", id), {
      grade,
      name,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.email || ""
    });
    await log("create", "classes", id, { grade, name });
    clsName.value = "";
    await refreshClasses();
  } catch (e) {
    console.error(e);
    alert("שגיאה ביצירת כיתה: " + (e?.message || e));
  }
}

/* =============================
   Logs viewer
============================= */
async function refreshLogs(){
  if (!logsList) return;
  logsList.innerHTML = "";
  if (logsEmpty) logsEmpty.style.display = "none";

  try {
    const qy = query(collection(db, "logs"), orderBy("at", "desc"), limit(40));
    const snap = await getDocs(qy);
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));

    renderLogs(arr);
  } catch (e) {
    console.error("refreshLogs error:", e);
    renderLogs([]);
  }
}

function renderLogs(arr){
  if (!logsList) return;
  logsList.innerHTML = "";

  const filter = String(logsFilter?.value || "");
  const list = (arr || []).filter(x => !filter || String(x.entity || "") === filter);

  if (list.length === 0){
    if (logsEmpty) logsEmpty.style.display = "block";
    return;
  }
  if (logsEmpty) logsEmpty.style.display = "none";

  list.forEach(l => logsList.appendChild(renderLogCard(l)));
}

function renderLogCard(l){
  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <div class="item-top">
      <div>
        <div class="item-title">${escapeHtml(String(l.action || "action"))} · ${escapeHtml(String(l.entity || "entity"))}</div>
        <div class="meta">מזהה: <span class="mono">${escapeHtml(String(l.entityId || ""))}</span></div>
        <div class="meta">מתי: ${escapeHtml(fmtTime(l.at))} · מי: ${escapeHtml(l.by || "-")}</div>
      </div>
      <div class="actions">
        <button class="btn" type="button" data-act="copy">העתק</button>
      </div>
    </div>
    <div class="meta mono">${escapeHtml(JSON.stringify(l.meta || {}, null, 0))}</div>
  `;
  el.querySelector('[data-act="copy"]').addEventListener("click", async () => {
    const txt = JSON.stringify(l, null, 2);
    try { await navigator.clipboard.writeText(txt); alert("הועתק"); }
    catch { alert("לא הצלחתי להעתיק"); }
  });
  return el;
}

btnRefreshLogs?.addEventListener("click", refreshLogs);
logsFilter?.addEventListener("change", refreshLogs);

/* =============================
   Quick actions
============================= */
btnOpenSite?.addEventListener("click", () => window.open("index.html", "_blank", "noopener,noreferrer"));
btnOpenClass?.addEventListener("click", () => window.open("class.html", "_blank", "noopener,noreferrer"));
btnOpenPage?.addEventListener("click", () => {
  const slug = slugify(quickSlug?.value || "");
  if (!slug) return alert("תכתוב slug");
  window.open(`page.html?p=${encodeURIComponent(slug)}`, "_blank", "noopener,noreferrer");
});



/* =============================
   🔐 Access Requests + Users
   (adminRequests + adminUsers)
============================= */

// Only DEV emails can approve / manage users
function isDevEmailCurrent() {
  return DEV_EMAILS.includes(norm(auth.currentUser?.email));
}

/* Secondary Auth (create user without kicking DEV) */
function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === "secondary");
  const secondaryApp = existing || initializeApp(app.options, "secondary");
  return getAuth(secondaryApp);
}

let unsubReq = null;
let unsubUsers = null;

function stopAccessRealtime() {
  try { if (unsubReq) unsubReq(); } catch {}
  try { if (unsubUsers) unsubUsers(); } catch {}
  unsubReq = null;
  unsubUsers = null;
}

async function refreshAccess() {
  await Promise.all([renderRequests(), renderUsers()]);
}

if (btnRefreshRequests) btnRefreshRequests.addEventListener("click", refreshAccess);
if (btnRefreshUsers) btnRefreshUsers.addEventListener("click", refreshAccess);

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
  tdEmail.style.padding = "10px 8px";
  tdEmail.innerHTML = `
    <div><b>${escapeHtml(r.email || "")}</b></div>
    <div class="small">${escapeHtml(r.fullName || "")}</div>
  `;

  const tdInfo = document.createElement("td");
  tdInfo.style.padding = "10px 8px";
  tdInfo.innerHTML = `
    <div class="small">תפקיד שביקש: <b>${escapeHtml(r.role || "-")}</b></div>
    <div class="small">סיבה: <b>${escapeHtml(r.reason || "-")}</b></div>
    <div class="small">הודעה: ${escapeHtml(r.message || "-")}</div>
    <div class="small muted">נשלח: ${formatTime(r.createdAt)}</div>
  `;

  const tdPerm = document.createElement("td");
  tdPerm.style.padding = "10px 8px";

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
  chkWrap.style.display = "flex";
  chkWrap.style.gap = "10px";
  chkWrap.style.flexWrap = "wrap";
  chkWrap.style.marginTop = "8px";
  chkWrap.innerHTML = `
    <label class="small"><input type="checkbox" value="z" checked> ז׳</label>
    <label class="small"><input type="checkbox" value="h" checked> ח׳</label>
    <label class="small"><input type="checkbox" value="t" checked> ט׳</label>
  `;

  tdPerm.appendChild(roleSel);
  tdPerm.appendChild(chkWrap);

  const tdAct = document.createElement("td");
  tdAct.style.padding = "10px 8px";
  const act = document.createElement("div");
  act.className = "actions";

  const btnApprove = document.createElement("button");
  btnApprove.className = "btn btn-primary";
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
    if (!isDevEmailCurrent()) {
      alert("רק DEV יכול לאשר בקשות כאן.");
      return;
    }

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
  const meEmail = norm(auth.currentUser?.email);
  const isDev = DEV_EMAILS.includes(meEmail);
  if (!isDev) throw new Error("אין הרשאה לאשר בקשות (רק DEV).");

  const email = String(r.email || "").trim();
  const password = String(r.password || "").trim();
  if (!email || !password) throw new Error("לבקשה חסר אימייל/סיסמה");

  const secondaryAuth = getSecondaryAuth();

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  } catch (e) {
    if (String(e?.code || "").includes("auth/email-already-in-use")) {
      throw new Error("האימייל הזה כבר קיים ב-Auth. אם זה משתמש ישן — צריך להוסיף לו adminUsers לפי UID.");
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

  sel.innerHTML = `
    <option value="teacherpanel">פאנל מורים</option>
    <option value="teacher">מורה</option>
    <option value="gradelead">אחראי שכבה</option>
    <option value="counselor">יועץ</option>
    <option value="principal">מנהל</option>
    <option value="dev">DEV</option>
  `;

  const normalized = normalizeRole(currentRole || "teacher");
  sel.value = normalized;

  return sel;
}

function renderUserCard(u) {
  const wrap = document.createElement("div");
  wrap.className = "item";

  const top = document.createElement("div");
  top.className = "item-top";

  const info = document.createElement("div");
  info.innerHTML = `
    <div class="item-title">${escapeHtml(u.email || "")}</div>
    <div class="meta">${escapeHtml(u.fullName || "")}</div>
    <div class="meta">תפקיד: <b class="role-text">${escapeHtml(roleLabel(u.role))}</b></div>
    <div class="meta">שכבות: <b class="grades-text">${escapeHtml(gradesLabel(u.allowedGrades))}</b></div>
  `;

  const controls = document.createElement("div");
  controls.className = "actions";

  const btnEdit = document.createElement("button");
  btnEdit.className = "btn-outline";
  btnEdit.type = "button";
  btnEdit.textContent = "ערוך הרשאות";

  const btnRemove = document.createElement("button");
  btnRemove.className = "btn btn-danger";
  btnRemove.type = "button";
  btnRemove.textContent = "בטל גישה";

  const msg = document.createElement("div");
  msg.className = "meta";
  msg.style.marginTop = "6px";

  controls.appendChild(btnEdit);
  controls.appendChild(btnRemove);
  controls.appendChild(msg);

  top.appendChild(info);
  top.appendChild(controls);
  wrap.appendChild(top);

  const editor = document.createElement("div");
  editor.style.marginTop = "8px";
  editor.style.display = "none";

  const roleRow = document.createElement("div");
  roleRow.className = "row";

  const roleLabelEl = document.createElement("div");
  roleLabelEl.className = "meta";
  roleLabelEl.innerHTML = "<b>תפקיד:</b>";

  const roleSel = createRoleSelect(u.role || "teacher");

  roleRow.appendChild(roleLabelEl);
  roleRow.appendChild(roleSel);

  const gradesRow = document.createElement("div");
  gradesRow.className = "row";
  gradesRow.style.marginTop = "8px";

  const gradesLabelEl = document.createElement("div");
  gradesLabelEl.className = "meta";
  gradesLabelEl.innerHTML = "<b>שכבות:</b>";

  const chkWrap = document.createElement("div");
  chkWrap.className = "row";
  chkWrap.style.gap = "10px";

  chkWrap.innerHTML = `
    <label class="meta"><input type="checkbox" value="z"> ז׳</label>
    <label class="meta"><input type="checkbox" value="h"> ח׳</label>
    <label class="meta"><input type="checkbox" value="t"> ט׳</label>
  `;

  const currentGrades = Array.isArray(u.allowedGrades) ? u.allowedGrades : [];
  chkWrap.querySelectorAll('input[type="checkbox"]').forEach((c) => {
    c.checked = currentGrades.includes(c.value);
  });

  gradesRow.appendChild(gradesLabelEl);
  gradesRow.appendChild(chkWrap);

  const actionRow = document.createElement("div");
  actionRow.className = "actions";
  actionRow.style.marginTop = "10px";

  const btnSave = document.createElement("button");
  btnSave.className = "btn btn-primary";
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
    if (!isDevEmailCurrent()) {
      alert("רק DEV יכול לערוך משתמשים כאן.");
      return;
    }

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
    if (!isDevEmailCurrent()) {
      alert("רק DEV יכול לבטל גישה כאן.");
      return;
    }

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
      await renderUsers();
    } catch (e) {
      console.error(e);
      msg.textContent = "שגיאה: " + (e?.message || e);
    }
  });

  return wrap;
}

function startAccessRealtime() {
  stopAccessRealtime();

  try {
    unsubReq = onSnapshot(collection(db, "adminRequests"), (snap) => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      renderRequestsFromArray(arr);
    }, (err) => {
      console.error("onSnapshot adminRequests error:", err);
      renderRequests();
    });
  } catch (e) {
    console.error("startAccessRealtime adminRequests failed:", e);
  }

  try {
    unsubUsers = onSnapshot(collection(db, "adminUsers"), (snap) => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      renderUsersFromArray(arr);
    }, (err) => {
      console.error("onSnapshot adminUsers error:", err);
      renderUsers();
    });
  } catch (e) {
    console.error("startAccessRealtime adminUsers failed:", e);
  }
}
document.querySelectorAll('a[data-open]').forEach(a => {
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');
});

