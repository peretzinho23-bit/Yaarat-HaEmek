// polls.js – הצגת סקרים לתלמידים

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const pollsCol = collection(db, "polls");
const pollsListEl = document.getElementById("polls-list");

// מזהה "אנונימי" של התלמיד (localStorage, לא באמת משתמש)
function getLocalUserId() {
  const key = "yaarat_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2);
    localStorage.setItem(key, id);
  }
  return id;
}

async function loadPolls() {
  try {
    pollsListEl.innerHTML = `<p class="class-empty-msg">טוען סקרים...</p>`;

    const snap = await getDocs(pollsCol);
    const polls = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isActive) {
        polls.push({
          id: docSnap.id,
          ...data
        });
      }
    });

    if (!polls.length) {
      pollsListEl.innerHTML =
        `<p class="class-empty-msg">כרגע אין סקרים פעילים.</p>`;
      return;
    }

    pollsListEl.innerHTML = "";

    polls.forEach((poll) => {
      const totalVotes = (poll.options || []).reduce(
        (sum, opt) => sum + (opt.votes || 0),
        0
      );

      const optionsHtml = (poll.options || [])
        .map((opt, idx) => {
          const votes = opt.votes || 0;
          const percent =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

          return `
            <button
              class="poll-option-btn"
              data-poll-id="${poll.id}"
              data-index="${idx}"
            >
              <span>${opt.text}</span>
              <span class="poll-option-meta">
                ${votes} קולות (${percent}%)
              </span>
            </button>
          `;
        })
        .join("");

      const card = document.createElement("div");
      card.className = "exam-card"; // שימוש בעיצוב קיים
      card.innerHTML = `
        <div>
          <div class="exam-main-title">${poll.question}</div>
          <div class="exam-meta">
            ${totalVotes} קולות בסה"כ
          </div>
        </div>
        <div class="exam-topic">
          ${optionsHtml}
        </div>
      `;
      pollsListEl.appendChild(card);
    });
  } catch (err) {
    console.error("שגיאה בטעינת סקרים:", err);
    pollsListEl.innerHTML =
      `<p class="class-empty-msg">אירעה שגיאה בטעינת הסקרים. נסו מאוחר יותר.</p>`;
  }
}

async function handleVote(pollId, optionIndex) {
  try {
    const userId = getLocalUserId();

    // נשמור בקולקציה נפרדת מי הצביע למה כדי לא לאפשר אלף הצבעות מאותו מחשב
    const votedDocRef = doc(db, "pollVotes", `${pollId}_${userId}`);
    const votedSnap = await getDoc(votedDocRef);
    if (votedSnap.exists()) {
      alert("כבר הצבעת בסקר הזה.");
      return;
    }

    const pollDocRef = doc(db, "polls", pollId);
    const pollSnap = await getDoc(pollDocRef);
    if (!pollSnap.exists()) {
      alert("הסקר כבר לא קיים.");
      return;
    }

    const poll = pollSnap.data();
    if (!poll.isActive) {
      alert("הסקר כבר לא פעיל.");
      return;
    }

    const options = poll.options || [];
    if (!options[optionIndex]) {
      alert("שגיאה באפשרות.");
      return;
    }

    options[optionIndex].votes = (options[optionIndex].votes || 0) + 1;

    await setDoc(pollDocRef, {
      ...poll,
      options
    });

    await setDoc(votedDocRef, {
      pollId,
      userId,
      votedAt: new Date().toISOString()
    });

    await loadPolls();
  } catch (err) {
    console.error("שגיאה בהצבעה:", err);
    alert("שגיאה בהצבעה. נסו שוב.");
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".poll-option-btn");
  if (!btn) return;

  const pollId = btn.dataset.pollId;
  const index = Number(btn.dataset.index);
  if (!pollId || Number.isNaN(index)) return;

  handleVote(pollId, index);
});

document.addEventListener("DOMContentLoaded", () => {
  loadPolls();
});
