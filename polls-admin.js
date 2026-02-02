// polls-admin.js – לוח ניהול סקרים (איפוס כולל מחיקת pollVotes)

import { db, auth } from "./firebase-config.js";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  query,
  where,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const authStatusEl = document.getElementById("auth-status");
const loginSectionEl = document.getElementById("login-section");
const loginFormEl = document.getElementById("login-form");
const pollsSectionEl = document.getElementById("polls-admin-section");
const logoutBtnEl = document.getElementById("logout-btn");

const pollFormEl = document.getElementById("poll-form");
const pollsListEl = document.getElementById("admin-polls");

const pollsColRef = collection(db, "polls");

let pollsData = [];
let unsubscribePolls = null;

// ===== AUTH =====
function setLoggedOutUI() {
  if (authStatusEl) authStatusEl.textContent = "יש להתחבר כדי לנהל את הסקרים.";
  if (loginSectionEl) loginSectionEl.style.display = "block";
  if (pollsSectionEl) pollsSectionEl.style.display = "none";
}

function setLoggedInUI(user) {
  if (authStatusEl) authStatusEl.textContent = `מחובר/ת: ${user?.email || "אדמין"}`;
  if (loginSectionEl) loginSectionEl.style.display = "none";
  if (pollsSectionEl) pollsSectionEl.style.display = "block";
}

async function handleLoginSubmit(evt) {
  evt.preventDefault();
  const email = loginFormEl?.email?.value?.trim();
  const password = loginFormEl?.password?.value;

  if (!email || !password) {
    alert("יש למלא אימייל וסיסמה.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginFormEl.reset();
  } catch (err) {
    console.error("שגיאה בהתחברות:", err);
    alert("התחברות נכשלה. בדוק אימייל וסיסמה.");
  }
}

async function handleLogoutClick() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("שגיאה בהתנתקות:", err);
  }
}

function setupAuth() {
  if (loginFormEl) loginFormEl.addEventListener("submit", handleLoginSubmit);
  if (logoutBtnEl) logoutBtnEl.addEventListener("click", handleLogoutClick);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setLoggedOutUI();
      if (unsubscribePolls) unsubscribePolls();
      unsubscribePolls = null;
      return;
    }

    setLoggedInUI(user);
    listenToPolls();
  });
}

// ===== HELPERS =====
function safeStr(v, maxLen = 140) {
  const s = (v ?? "").toString().trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function makeOption(text, idx) {
  // id קצר ויציב (כדי שיהיה key ל-counts)
  const id = `opt${idx}_${Math.random().toString(36).slice(2, 8)}`;
  return { id, text: safeStr(text, 80) };
}

function countsMap(data) {
  return data && typeof data === "object" && data.counts && typeof data.counts === "object"
    ? data.counts
    : {};
}

function getVotesForOption(poll, optId) {
  const counts = countsMap(poll || {});
  const v = counts?.[optId];
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

// ===== RENDER =====
function renderPolls() {
  if (!pollsListEl) return;

  if (!pollsData.length) {
    pollsListEl.innerHTML = `<p class="empty-msg">אין סקרים עדיין.</p>`;
    return;
  }

  const html = pollsData
    .map((poll) => {
      const createdAt = poll.createdAt?.toDate
        ? poll.createdAt.toDate().toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })
        : "—";

      const statusLabel = poll.isActive ? "פעיל" : "מושהה";
      const question = poll.question || "";

      const optionsHtml = (poll.options || [])
        .map((opt, idx) => {
          const votes = getVotesForOption(poll, opt.id);
          const text = opt.text || "";
          return `
            <li>
              <strong>${idx + 1}.</strong>
              <span>${text}</span>
              <span style="opacity:0.8;">
                (<span dir="ltr">${votes}</span>&nbsp;<span>קולות</span>)
              </span>
            </li>
          `;
        })
        .join("");

      return `
        <div class="admin-item" data-poll-id="${poll.id}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="badge">${statusLabel}</span>
                <span style="opacity:0.8;font-size:0.8rem;">נוצר: <span dir="ltr">${createdAt}</span></span>
              </div>
              <div style="margin-top:6px;font-weight:700;">${question}</div>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              <button class="btn-outline" data-action="toggle" data-id="${poll.id}">
                ${poll.isActive ? "השהיית סקר" : "הפיכת סקר לפעיל"}
              </button>
              <button class="btn-outline" data-action="reset" data-id="${poll.id}">
                איפוס הצבעות
              </button>
              <button class="admin-remove" data-action="delete" data-id="${poll.id}">
                מחיקת סקר
              </button>
            </div>
          </div>

          <ul style="margin-top:6px;font-size:0.85rem;display:flex;flex-direction:column;gap:2px;">
            ${optionsHtml}
          </ul>
        </div>
      `;
    })
    .join("");

  pollsListEl.innerHTML = html;
}

// ===== CREATE POLL =====
async function handlePollFormSubmit(evt) {
  evt.preventDefault();
  if (!pollFormEl) return;

  const form = pollFormEl;

  const question = safeStr(form.question.value, 200);
  const o1 = safeStr(form.option1.value, 80);
  const o2 = safeStr(form.option2.value, 80);
  const o3 = safeStr(form.option3.value, 80);
  const o4 = safeStr(form.option4.value, 80);
  const isActive = !!form.isActive.checked;

  if (!question || !o1 || !o2) {
    alert("יש למלא שאלה ושתי אפשרויות לפחות.");
    return;
  }

  const rawOptions = [o1, o2, o3, o4].filter(Boolean);
  const options = rawOptions.map((t, idx) => makeOption(t, idx + 1));

  const counts = {};
  for (const opt of options) counts[opt.id] = 0;

  try {
    await addDoc(pollsColRef, {
      question,
      options,
      counts,
      isActive,
      createdAt: serverTimestamp()
    });

    form.reset();
    form.isActive.checked = true;
  } catch (err) {
    console.error("שגיאה ביצירת סקר:", err);
    alert("שגיאה ביצירת סקר.");
  }
}

function setupPollForm() {
  if (!pollFormEl) return;
  pollFormEl.addEventListener("submit", handlePollFormSubmit);
}

// ===== ACTIONS =====
async function togglePollActive(pollId) {
  const poll = pollsData.find((p) => p.id === pollId);
  if (!poll) return;

  try {
    await updateDoc(doc(pollsColRef, pollId), {
      isActive: !poll.isActive
    });
  } catch (err) {
    console.error("שגיאה בשינוי סטטוס סקר:", err);
    alert("שגיאה בשינוי סטטוס.");
  }
}

async function resetPollVotes(pollId) {
  const poll = pollsData.find((p) => p.id === pollId);
  if (!poll) return;

  const confirmReset = confirm("לאפס את כל ההצבעות לסקר הזה? אי אפשר לבטל לאחר מכן.");
  if (!confirmReset) return;

  // 1) אפס מונים במסמך הסקר
  const counts = {};
  (poll.options || []).forEach((o) => (counts[o.id] = 0));

  try {
    await updateDoc(doc(pollsColRef, pollId), { counts });
  } catch (err) {
    console.error("שגיאה באיפוס מונים:", err);
    alert("שגיאה באיפוס מונים.");
    return;
  }

  // 2) מחיקת כל מסמכי ההצבעה של אותו סקר (pollVotes)
  // חשוב: זה יעבוד רק אם החוקים מאפשרים ל־admin/dev לבצע list+delete ל־pollVotes.
  try {
    const votesQ = query(collection(db, "pollVotes"), where("pollId", "==", pollId));
    const snap = await getDocs(votesQ);
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + 450);
      for (const d of chunk) batch.delete(d.ref);
      await batch.commit();
    }

    alert("הצבעות אופסו בהצלחה ✅");
  } catch (err) {
    console.error("שגיאה במחיקת pollVotes:", err);
    alert("המונים אופסו, אבל מחיקת ההצבעות נכשלה. כנראה חסרות הרשאות בחוקים.");
  }
}

async function deletePoll(pollId) {
  const confirmDelete = confirm("למחוק את הסקר הזה? אי אפשר לבטל.");
  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(pollsColRef, pollId));
  } catch (err) {
    console.error("שגיאה במחיקת סקר:", err);
    alert("שגיאה במחיקת סקר.");
  }
}

function setupPollsListEvents() {
  if (!pollsListEl) return;

  pollsListEl.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;

    if (action === "toggle") togglePollActive(id);
    if (action === "reset") resetPollVotes(id);
    if (action === "delete") deletePoll(id);
  });
}

// ===== FIRESTORE LISTEN =====
function listenToPolls() {
  if (unsubscribePolls) unsubscribePolls();

  unsubscribePolls = onSnapshot(
    pollsColRef,
    (snap) => {
      pollsData = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return tb - ta;
        });

      renderPolls();
    },
    (err) => {
      console.error("שגיאה בטעינת סקרים:", err);
    }
  );
}

// ===== MAIN =====
document.addEventListener("DOMContentLoaded", () => {
  setupAuth();
  setupPollForm();
  setupPollsListEvents();
});
