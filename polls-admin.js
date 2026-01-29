// polls-admin.js – לוח ניהול סקרים חדש (FIXED for counts-map voting)

import { db, auth } from "./firebase-config.js";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  doc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const pollsColRef = collection(db, "polls");

// ===== DOM =====
const authStatusEl = document.getElementById("auth-status");
const loginSectionEl = document.getElementById("login-section");
const loginFormEl = document.getElementById("login-form");
const pollsSectionEl = document.getElementById("polls-admin-section");
const logoutBtnEl = document.getElementById("logout-btn");

const pollFormEl = document.getElementById("poll-form");
const pollsListEl = document.getElementById("admin-polls");

let pollsData = [];
let unsubscribePolls = null;

// ===== AUTH =====
function setLoggedOutUI() {
  if (authStatusEl) authStatusEl.textContent = "יש להתחבר כדי לנהל את הסקרים.";
  if (loginSectionEl) loginSectionEl.style.display = "block";
  if (pollsSectionEl) pollsSectionEl.style.display = "none";
}

function setLoggedInUI(user) {
  if (authStatusEl) authStatusEl.textContent = `מחובר כ: ${user.email || "מנהל"}`;
  if (loginSectionEl) loginSectionEl.style.display = "none";
  if (pollsSectionEl) pollsSectionEl.style.display = "block";
}

async function handleLoginSubmit(evt) {
  evt.preventDefault();
  if (!loginFormEl) return;

  const email = loginFormEl.email.value.trim();
  const password = loginFormEl.password.value.trim();

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
    if (user) {
      setLoggedInUI(user);
      subscribeRealtimePolls();
    } else {
      setLoggedOutUI();
      if (unsubscribePolls) {
        unsubscribePolls();
        unsubscribePolls = null;
      }
    }
  });
}

// ===== POLLS LOGIC =====
function getVotesForOption(poll, optionId) {
  const v = poll?.counts?.[optionId];
  return typeof v === "number" ? v : 0;
}

function calcTotalVotes(poll) {
  if (!poll || !Array.isArray(poll.options)) return 0;
  return poll.options.reduce((sum, opt) => sum + getVotesForOption(poll, opt.id), 0);
}

function renderPolls() {
  if (!pollsListEl) return;

  if (!pollsData.length) {
    pollsListEl.innerHTML =
      '<p class="empty-msg">אין סקרים עדיין. לאחר יצירת סקר ראשון, הוא יופיע כאן.</p>';
    return;
  }

  const html = pollsData
    .map((poll) => {
      const totalVotes = calcTotalVotes(poll);

      const createdAt =
        poll.createdAt && typeof poll.createdAt.toDate === "function"
          ? poll.createdAt.toDate()
          : null;

      const createdStr = createdAt
        ? createdAt.toLocaleDateString("he-IL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          })
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
          <div class="admin-item-main">
            <div>
              <div style="font-weight:700;margin-bottom:4px;">${question}</div>
              <div style="font-size:0.8rem;opacity:0.8;">
                נוצר בתאריך ${createdStr} · מצב: ${statusLabel} · סה"כ קולות: <span dir="ltr">${totalVotes}</span>
              </div>
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

async function handlePollFormSubmit(evt) {
  evt.preventDefault();
  if (!pollFormEl) return;

  const form = pollFormEl;

  const question = form.question.value.trim();
  const opt1 = form.option1.value.trim();
  const opt2 = form.option2.value.trim();
  const opt3 = form.option3.value.trim();
  const opt4 = form.option4.value.trim();
  const isActive = form.isActive.checked;

  if (!question || !opt1 || !opt2) {
    alert("חובה למלא שאלה + לפחות שתי אפשרויות.");
    return;
  }

  // options בלי votes — הקולות נשמרים ב-counts.<id>
  const options = [];
  if (opt1) options.push({ id: "a", text: opt1 });
  if (opt2) options.push({ id: "b", text: opt2 });
  if (opt3) options.push({ id: "c", text: opt3 });
  if (opt4) options.push({ id: "d", text: opt4 });

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
    alert("שגיאה ביצירת סקר חדש.");
  }
}

function setupPollForm() {
  if (!pollFormEl) return;
  pollFormEl.addEventListener("submit", handlePollFormSubmit);
}

async function togglePollActive(pollId) {
  const poll = pollsData.find((p) => p.id === pollId);
  if (!poll) return;

  try {
    await updateDoc(doc(pollsColRef, pollId), {
      isActive: !poll.isActive
    });
  } catch (err) {
    console.error("שגיאה בשינוי סטטוס סקר:", err);
    alert("שגיאה בשינוי סטטוס הסקר.");
  }
}

async function resetPollVotes(pollId) {
  const poll = pollsData.find((p) => p.id === pollId);
  if (!poll) return;

  const confirmReset = confirm("לאפס את כל ההצבעות לסקר הזה? אי אפשר לבטל לאחר מכן.");
  if (!confirmReset) return;

  const counts = {};
  (poll.options || []).forEach((o) => (counts[o.id] = 0));

  try {
    await updateDoc(doc(pollsColRef, pollId), { counts });
  } catch (err) {
    console.error("שגיאה באיפוס הצבעות:", err);
    alert("שגיאה באיפוס הצבעות.");
  }
}

async function deletePoll(pollId) {
  const confirmDelete = confirm("למחוק את הסקר הזה? אי אפשר לבטל.");
  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(pollsColRef, pollId));
  } catch (err) {
    console.error("שגיאה במחיקת סקר:", err);
    alert("שגיאה במחיקת הסקר.");
  }
}

function setupPollsListEvents() {
  if (!pollsListEl) return;

  pollsListEl.addEventListener("click", (evt) => {
    const btn = evt.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!id) return;

    if (action === "toggle") togglePollActive(id);
    else if (action === "reset") resetPollVotes(id);
    else if (action === "delete") deletePoll(id);
  });
}

function subscribeRealtimePolls() {
  if (unsubscribePolls) unsubscribePolls();

  unsubscribePolls = onSnapshot(
    pollsColRef,
    (snap) => {
      pollsData = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      // מיון לפי createdAt מהחדש לישן
      pollsData.sort((a, b) => {
        const ta =
          a.createdAt && typeof a.createdAt.toDate === "function"
            ? a.createdAt.toDate().getTime()
            : 0;
        const tb =
          b.createdAt && typeof b.createdAt.toDate === "function"
            ? b.createdAt.toDate().getTime()
            : 0;
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
