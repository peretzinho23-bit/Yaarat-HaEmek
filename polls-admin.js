// polls-admin.js – לוח ניהול סקרים נפרד

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const pollsCollectionRef = collection(db, "polls");
let pollsData = [];

// ===== helpers =====
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== render =====
function renderPollsAdmin() {
  const listEl = document.getElementById("admin-polls");
  if (!listEl) return;

  if (!pollsData.length) {
    listEl.innerHTML = `<p class="empty-msg">אין סקרים עדיין.</p>`;
    return;
  }

  listEl.innerHTML = pollsData
    .map((poll) => {
      const totalVotes = (poll.options || []).reduce(
        (sum, opt) => sum + (opt.votes || 0),
        0
      );

      const optionsHtml = (poll.options || [])
        .map((opt) => {
          const votes = opt.votes || 0;
          const percent =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

          return `
            <div class="poll-option-row">
              <span class="poll-option-text">${escapeHtml(opt.text || "")}</span>
              <span class="poll-option-votes">
                ${votes} קולות (${percent}%)
              </span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="admin-item">
          <div class="admin-item-main">
            <strong>${escapeHtml(poll.question || "")}</strong>
            <span class="admin-item-meta">
              ${poll.isActive ? "פעיל ✅" : "מושבת ⛔️"} · ${totalVotes} קולות
            </span>
          </div>

          <div class="admin-item-body">
            ${optionsHtml}
          </div>

          <div class="admin-item-actions">
            <button
              class="admin-remove"
              data-type="poll"
              data-id="${poll.id}"
            >
              מחיקת סקר
            </button>
            <button
              class="admin-toggle-poll"
              data-id="${poll.id}"
              data-active="${poll.isActive ? "1" : "0"}"
            >
              ${poll.isActive ? "הפוך ללא פעיל" : "הפוך לפעיל"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

// ===== load & realtime =====
async function loadPollsOnce() {
  const listEl = document.getElementById("admin-polls");
  try {
    const snap = await getDocs(pollsCollectionRef);
    pollsData = [];
    snap.forEach((docSnap) => {
      pollsData.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    renderPollsAdmin();
  } catch (err) {
    console.error("שגיאה בטעינת סקרים:", err);
    if (listEl) {
      listEl.innerHTML =
        `<p class="empty-msg">שגיאה בטעינת הסקרים. בדוק את ה-console.</p>`;
    }
  }
}

function subscribeRealtimePolls() {
  onSnapshot(pollsCollectionRef, (snap) => {
    pollsData = [];
    snap.forEach((docSnap) => {
      pollsData.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    renderPollsAdmin();
  });
}

// ===== form =====
function setupPollForm() {
  const form = document.getElementById("poll-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

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

    const options = [];
    if (opt1) options.push({ id: "a", text: opt1, votes: 0 });
    if (opt2) options.push({ id: "b", text: opt2, votes: 0 });
    if (opt3) options.push({ id: "c", text: opt3, votes: 0 });
    if (opt4) options.push({ id: "d", text: opt4, votes: 0 });

    try {
      await addDoc(pollsCollectionRef, {
        question,
        options,
        isActive,
        createdAt: serverTimestamp()
      });

      form.reset();
      form.isActive.checked = true;
      alert("הסקר נוצר בהצלחה.");
    } catch (err) {
      console.error("שגיאה ביצירת סקר:", err);
      alert("שגיאה ביצירת הסקר. בדוק console.");
    }
  });
}

// ===== delete / toggle buttons =====
function setupButtonsHandler() {
  document.addEventListener("click", async (e) => {
    // toggle active
    const toggleBtn = e.target.closest(".admin-toggle-poll");
    if (toggleBtn) {
      const pollId = toggleBtn.dataset.id;
      const isActiveNow = toggleBtn.dataset.active === "1";
      if (!pollId) return;

      try {
        await updateDoc(doc(db, "polls", pollId), {
          isActive: !isActiveNow
        });
      } catch (err) {
        console.error("שגיאה בעדכון סטטוס סקר:", err);
        alert("שגיאה בעדכון סטטוס הסקר.");
      }
      return;
    }

    // delete
    const delBtn = e.target.closest(".admin-remove");
    if (!delBtn) return;

    const pollId = delBtn.dataset.id;
    if (!pollId) return;
    if (!confirm("למחוק את הסקר הזה?")) return;

    try {
      await deleteDoc(doc(db, "polls", pollId));
      alert("הסקר נמחק.");
    } catch (err) {
      console.error("שגיאה במחיקת סקר:", err);
      alert("שגיאה במחיקת הסקר.");
    }
  });
}

// ===== main =====
document.addEventListener("DOMContentLoaded", () => {
  setupPollForm();
  setupButtonsHandler();
  loadPollsOnce();
  subscribeRealtimePolls();
});
