// teachers.js — Portal Teachers (Firebase v11) — v5
import { db, auth } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

console.log("👩‍🏫 TEACHERS.JS LOADED v5");

/* =========================
   DOM
   ========================= */
const $ = (id) => document.getElementById(id);
const tDayBar = document.getElementById("tDayBar");
const tDutiesWrap = document.getElementById("tDutiesWrap");
const tDutiesEmpty = document.getElementById("tDutiesEmpty");

let dutiesData = null;
let selectedDay = "א";
let dutiesUnsub = null;

const tMenuBtn = $("tMenuBtn");
const tMenu = $("tMenu");
const tLogoutBtn = $("tLogoutBtn");

const tAuthCard = $("tAuthCard");
const tPortal = $("tPortal");

const teacherLoginForm = $("teacherLoginForm");
const tLoginMsg = $("tLoginMsg");

const tOpenRequest = $("tOpenRequest");
const tRequestForm = $("tRequestForm");
const tBackToLogin = $("tBackToLogin");
const tReqMsg = $("tReqMsg");

const tGlobalStatus = $("tGlobalStatus");

const tStaffList = $("tStaffList");
const tStaffEmpty = $("tStaffEmpty");

const tLinksList = $("tLinksList");
const tLinksEmpty = $("tLinksEmpty");

/* =========================
   UI helpers
   ========================= */
function showBanner(text) {
  if (!tGlobalStatus) return;
  tGlobalStatus.textContent = text;
  tGlobalStatus.style.display = "block";
}
function hideBanner() {
  if (!tGlobalStatus) return;
  tGlobalStatus.style.display = "none";
  tGlobalStatus.textContent = "";
}
function msg(el, text, cls) {
  if (!el) return;
  el.textContent = text || "";
  el.className = "t-msg" + (cls ? " " + cls : "");
}
function emailLower(user) {
  return String(user?.email || "").trim().toLowerCase();
}
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function isPermissionDenied(err) {
  const code = String(err?.code || "");
  const msgg = String(err?.message || "");
  return code.includes("permission-denied") || msgg.toLowerCase().includes("permission");
}

/* =========================
   Mobile menu
   ========================= */
function closeMenu() {
  tMenu?.classList.remove("open");
  tMenuBtn?.setAttribute("aria-expanded", "false");
}
function toggleMenu() {
  if (!tMenu || !tMenuBtn) return;
  const isOpen = tMenu.classList.toggle("open");
  tMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
}
tMenuBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleMenu();
});
document.addEventListener("click", (e) => {
  if (!tMenu?.classList.contains("open")) return;
  if (tMenu.contains(e.target) || tMenuBtn.contains(e.target)) return;
  closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
tMenu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => closeMenu()));

/* =========================
   Tabs (safe)
   ========================= */
function showTab(tabId) {
  document.querySelectorAll(".t-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll(".t-tabpane").forEach((p) => {
    p.style.display = "none";
  });
  const pane = document.getElementById(tabId);
  if (pane) pane.style.display = "block";
}
document.querySelectorAll(".t-tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});
showTab("duties"); // ברירת מחדל

/* =========================
   Permission checks
   1) teacherAllow/{emailLower} OR teacherAllow/{uid} active:true
   2) adminUsers/{uid} role in allowedRolesForTeacherPortal
   ========================= */
const allowedRolesForTeacherPortal = ["teacher", "gradelead", "counselor", "principal", "dev"];

async function hasTeacherAllowDoc(user) {
  const e = emailLower(user);
  const uid = user?.uid;

  // לפי אימייל
  if (e) {
    const snapEmail = await getDoc(doc(db, "teacherAllow", e));
    if (snapEmail.exists() && snapEmail.data()?.active === true) return true;
  }

  // לפי uid
  if (uid) {
    const snapUid = await getDoc(doc(db, "teacherAllow", uid));
    if (snapUid.exists() && snapUid.data()?.active === true) return true;
  }

  return false;
}

async function hasAdminRoleTeacherOrAbove(user) {
  const uid = user?.uid;
  if (!uid) return false;

  const snap = await getDoc(doc(db, "adminUsers", uid));
  if (!snap.exists()) return false;

  const role = String(snap.data()?.role || "").toLowerCase();
  return allowedRolesForTeacherPortal.includes(role);
}

async function canEnterTeacherPortal(user) {
  // נותנים כניסה אם אחד מהשניים נכון
  // (teacherAllow) OR (adminUsers role teacher+)
  try {
    if (await hasTeacherAllowDoc(user)) return true;
  } catch (e) {
    // אם rules חוסמות teacherAllow, ננסה adminUsers
    console.warn("teacherAllow check failed:", e);
  }

  try {
    if (await hasAdminRoleTeacherOrAbove(user)) return true;
  } catch (e) {
    console.warn("adminUsers role check failed:", e);
  }

  return false;
}

/* =========================
   Load portal content
   teacherPortal/main
   ========================= */
async function loadPortalContent() {
  try {
    const snap = await getDoc(doc(db, "teacherPortal", "main"));
    const data = snap.exists() ? snap.data() : {};

    const staff = Array.isArray(data.staffMessages) ? data.staffMessages : [];
    const links = Array.isArray(data.links) ? data.links : [];

    // staff
    if (tStaffList) tStaffList.innerHTML = "";
    if (!staff.length) {
      if (tStaffEmpty) tStaffEmpty.style.display = "block";
    } else {
      if (tStaffEmpty) tStaffEmpty.style.display = "none";
      staff.slice(0, 50).forEach((item) => {
        const div = document.createElement("div");
        div.className = "t-item";
        div.innerHTML = `
          <div class="t-item-title">${escapeHtml(item.title || "הודעה")}</div>
          ${item.meta ? `<div class="t-item-meta">${escapeHtml(item.meta)}</div>` : ""}
          ${item.body ? `<p class="t-item-body">${escapeHtml(item.body)}</p>` : ""}
        `;
        tStaffList?.appendChild(div);
      });
    }

    // links
    if (tLinksList) tLinksList.innerHTML = "";
    if (!links.length) {
      if (tLinksEmpty) tLinksEmpty.style.display = "block";
    } else {
      if (tLinksEmpty) tLinksEmpty.style.display = "none";
      links.slice(0, 60).forEach((l) => {
        const a = document.createElement("a");
        a.className = "t-linkcard";
        a.href = l.url || "#";
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML = `
          <div class="t-linkcard-title">${escapeHtml(l.title || "קישור")}</div>
          <div class="t-linkcard-sub">${escapeHtml(l.subtitle || (l.url || ""))}</div>
        `;
        tLinksList?.appendChild(a);
      });
    }
  } catch (err) {
    console.error("loadPortalContent error:", err);
    if (isPermissionDenied(err)) {
      showBanner("אין הרשאה לקרוא את תוכן הפורטל (teacherPortal). בדוק Rules.");
    } else {
      showBanner("שגיאה בטעינת הפורטל. בדוק Console.");
    }
  }
}

/* =========================
   UI state
   ========================= */
async function setUIState({ signedIn, allowed, reason }) {
  if (!signedIn) {
    tPortal.style.display = "none";
    tAuthCard.style.display = "";
    closeMenu();
    hideBanner();
    msg(tLoginMsg, "", "");
    return;
  }

  if (!allowed) {
    // מחובר אבל לא מורשה — לא “להחזיר לטופס” כאילו לא מחובר
    tPortal.style.display = "none";
    tAuthCard.style.display = "";
    closeMenu();
    showBanner(
      reason ||
        "מחובר ✅ אבל אין הרשאה לפורטל מורים. אם אתה מורה — צריך role מתאים ב-adminUsers או active ב-teacherAllow."
    );
    return;
  }

  hideBanner();
  tAuthCard.style.display = "none";
  tPortal.style.display = "block";
  await loadPortalContent();
}

/* =========================
   Login
   ========================= */
teacherLoginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg(tLoginMsg, "", "");
  hideBanner();

  const email = ($("tEmail")?.value || "").trim();
  const password = $("tPass")?.value || "";

  if (!email || !password) {
    msg(tLoginMsg, "תמלא אימייל וסיסמה.", "err");
    return;
  }

  try {
    msg(tLoginMsg, "מתחבר...", "ok");
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    msg(tLoginMsg, "כניסה נכשלה: " + (err?.message || err?.code || "unknown"), "err");
  }
});

/* =========================
   Request access (teacherRequests)
   ========================= */
tOpenRequest?.addEventListener("click", () => {
  window.location.href = "register.html";
});


tBackToLogin?.addEventListener("click", () => {
  tRequestForm.style.display = "none";
  teacherLoginForm.style.display = "block";
  msg(tLoginMsg, "", "");
});

tRequestForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg(tReqMsg, "", "");

  const fullName = ($("rFullName")?.value || "").trim();
  const email = ($("rEmail")?.value || "").trim().toLowerCase();
  const role = ($("rRole")?.value || "").trim();
  const note = ($("rNote")?.value || "").trim();

  if (!fullName || !email || !role) {
    msg(tReqMsg, "חסר שם מלא / אימייל / תפקיד.", "err");
    return;
  }

  try {
    await addDoc(collection(db, "teacherRequests"), {
      fullName,
      email,
      role,
      note: note || "",
      status: "pending",
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent || "",
    });

    msg(tReqMsg, "נשלח לאישור ✅ (בדוק גם ספאם)", "ok");
    tRequestForm.reset();
  } catch (err) {
    console.error("REQUEST ERROR:", err);
    msg(
      tReqMsg,
      "לא הצלחתי לשלוח. כנראה Rules חוסמים כתיבה ל-teacherRequests.",
      "err"
    );
  }
});

/* =========================
   Logout
   ========================= */
tLogoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  closeMenu();
});

/* =========================
   Auth watcher
   ========================= */
onAuthStateChanged(auth, async (user) => {
  try {
    // אם לא מחובר -> מכבים realtime ומחזירים למסך התחברות
    if (!user) {
      try { if (dutiesUnsub) dutiesUnsub(); } catch {}
      dutiesUnsub = null;

      await setUIState({ signedIn: false, allowed: false });
      return;
    }

    // ✅ מורה ומעלה נכנס
    const allowed = await canEnterTeacherPortal(user);

    await setUIState({
      signedIn: true,
      allowed,
      reason: allowed
        ? ""
        : "מחובר ✅ אבל אין הרשאה לפורטל. צריך: (adminUsers.role = teacher/gradelead/counselor/principal/dev) או teacherAllow active:true."
    });

    // אם מותר -> מפעילים realtime
    if (allowed) {
      startDutiesRealtime();          // ✅ מאזין לעדכונים בלי F5
      renderDutiesForDay(selectedDay); // ✅ מציג ישר את היום שנבחר
    } else {
      // אם לא מותר -> לא מאזינים
      try { if (dutiesUnsub) dutiesUnsub(); } catch {}
      dutiesUnsub = null;
    }

  } catch (err) {
    console.error("AUTH WATCH ERROR:", err);

    // במקרה של שגיאה גם לא נשאיר מאזין פתוח
    try { if (dutiesUnsub) dutiesUnsub(); } catch {}
    dutiesUnsub = null;

    await setUIState({ signedIn: true, allowed: false });
    showBanner("מחובר, אבל לא הצלחתי לבדוק הרשאה (בדוק Rules/Console).");
  }
});

function startDutiesRealtime() {
  // אם כבר מאזין – סוגרים
  try { if (dutiesUnsub) dutiesUnsub(); } catch {}
  dutiesUnsub = null;

  const ref = doc(db, "teacherDuties", "main");

  dutiesUnsub = onSnapshot(ref, (snap) => {
    dutiesData = snap.exists() ? (snap.data() || {}) : {};
    renderDutiesForDay(selectedDay); // ✅ מתעדכן מיד בלי רענון
  }, (err) => {
    console.error("duties realtime error:", err);
  });
}


function renderDutiesForDay(day){
  if (!tDutiesWrap) return;

  tDutiesWrap.innerHTML = "";
  if (tDutiesEmpty) tDutiesEmpty.style.display = "none";

  const slots = Array.isArray(dutiesData?.slots) ? dutiesData.slots : ["בוקר","הפסקה 1","הפסקה 2","הפסקה 3"];
  const table = dutiesData?.table && typeof dutiesData.table === "object" ? dutiesData.table : {};

  let any = false;

  slots.forEach((slot) => {
    const cell = table?.[slot]?.[day];
    const duties = Array.isArray(cell?.duties) ? cell.duties : [];

    const clean = duties
      .map(d => ({
        location: String(d?.location || "").trim(),
        teacher:  String(d?.teacher  || "").trim(),
      }))
      .filter(d => d.location || d.teacher);

    if (!clean.length) return;

    any = true;

    const card = document.createElement("div");
    card.className = "t-duty-card";
    card.innerHTML = `
      <div class="t-duty-head">
        <div class="t-duty-slot">${escapeHtml(slot)}</div>
        <div class="t-duty-chip">יום ${escapeHtml(day)}׳</div>
      </div>
      <div class="t-duty-list">
        ${clean.map(d => `
          <div class="t-duty-item">
            <div class="t-duty-row">
              <div style="flex:1;">
                <div class="t-duty-label">מיקום</div>
                <div class="t-duty-val">${escapeHtml(d.location || "—")}</div>
              </div>
              <div style="flex:1;">
                <div class="t-duty-label">מורה</div>
                <div class="t-duty-val">${escapeHtml(d.teacher || "—")}</div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    tDutiesWrap.appendChild(card);
  });

  if (!any && tDutiesEmpty) tDutiesEmpty.style.display = "";
}
tDayBar?.addEventListener("click", (e) => {
  const btn = e.target.closest(".t-daybtn");
  if (!btn) return;

  selectedDay = btn.dataset.day || "א";

  tDayBar.querySelectorAll(".t-daybtn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  renderDutiesForDay(selectedDay);
});
