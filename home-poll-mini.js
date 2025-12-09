// home-poll-mini.js – סקר השבוע בדף הבית

import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const pollsColRef = collection(db, "polls");

const rootEl = document.getElementById("home-poll-root");
const statusEl = document.getElementById("home-poll-status");
const totalEl = document.getElementById("home-poll-total");

function getTotalVotes(poll) {
  return (poll.options || []).reduce(
    (sum, opt) => sum + (opt.votes || 0),
    0
  );
}

function renderEmpty() {
  if (statusEl) statusEl.textContent = "אין כרגע סקר פעיל";
  if (rootEl) {
    rootEl.innerHTML = `
      <p class="empty-msg">
        כרגע אין סקר פעיל. אפשר להיכנס לעמוד הסקרים כדי לראות סקרים קודמים 🙂
      </p>
    `;
  }
  if (totalEl) totalEl.textContent = "0\u00A0הצבעות עד עכשיו";
}

function renderMiniPoll(poll) {
  const totalVotes = getTotalVotes(poll);

  if (statusEl) statusEl.textContent = "סקר פעיל כרגע";

  if (totalEl) {
    totalEl.textContent = `${totalVotes}\u00A0הצבעות עד עכשיו`;
  }

  if (!rootEl) return;

  const options = (poll.options || []).slice(0, 3); // מציגים עד 3 תשובות בדף הבית

  const optionsHtml = options
    .map(opt => {
      const votes = opt.votes || 0;
      const percent =
        totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      return `
        <li class="home-poll-option">
          <span class="home-poll-option-label">${opt.text || ""}</span>
          <span class="home-poll-option-votes">
            ${votes}\u00A0קולות (${percent}%)
          </span>
        </li>
      `;
    })
    .join("");

  rootEl.innerHTML = `
    <div class="home-poll-question">
      <div class="home-poll-question-text">
        ${poll.question || "סקר ללא כותרת"}
      </div>
    </div>
    <ul class="home-poll-options">
      ${optionsHtml || `<li class="home-poll-option">אין עדיין תשובות מוגדרות לסקר הזה.</li>`}
    </ul>
  `;
}

// מאזין בזמן אמת לסקרים
onSnapshot(
  pollsColRef,
  (snap) => {
    const polls = [];
    snap.forEach(docSnap => {
      polls.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    // רק סקרים פעילים
    const activePolls = polls.filter(p => p.isActive);

    if (!activePolls.length) {
      renderEmpty();
      return;
    }

    // לוקחים את הסקר עם הכי הרבה הצבעות (ה"ראשי")
    activePolls.sort((a, b) => getTotalVotes(b) - getTotalVotes(a));
    const featured = activePolls[0];

    renderMiniPoll(featured);
  },
  (err) => {
    console.error("שגיאה בטעינת סקר הבית:", err);
    if (rootEl) {
      rootEl.innerHTML = `
        <p class="empty-msg">
          הייתה בעיה בטעינת הסקר. נסו לרענן את הדף.
        </p>
      `;
    }
    if (statusEl) statusEl.textContent = "שגיאה בטעינת הסקר";
  }
);
