// home-poll-mini.js – מיני-סקר בעמוד הבית

import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const pollsColRef = collection(db, "polls");

// אלמנטים מה-HTML של הבית
const statusEl = document.getElementById("home-poll-status");
const rootEl = document.getElementById("home-poll-root");
const totalEl = document.getElementById("home-poll-total");

if (rootEl) {
  // מאזין בזמן אמת לשינויים בסקרים
  onSnapshot(
    pollsColRef,
    (snap) => {
      const polls = [];
      snap.forEach((docSnap) => {
        polls.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      renderHomeMiniPoll(polls);
    },
    (err) => {
      console.error("שגיאה בטעינת מיני-סקר:", err);
      if (statusEl) statusEl.textContent = "שגיאה בטעינת הסקר";
      if (rootEl) {
        rootEl.innerHTML =
          '<p class="empty-msg">לא הצלחנו לטעון את סקר השבוע. נסו לרענן את הדף.</p>';
      }
    }
  );
}

// בוחר איזה סקר להציג בעמוד הבית
function pickPollForHome(polls) {
  if (!polls || !polls.length) return null;

  // מחשב הצבעות לכל סקר
  const withTotals = polls.map((p) => {
    const total =
      (p.options || []).reduce((sum, o) => sum + (o.votes || 0), 0) || 0;
    return { ...p, _totalVotes: total };
  });

  const active = withTotals.filter((p) => p.isActive);
  if (active.length) {
    // אם יש פעילים – מציג את זה עם הכי הרבה הצבעות
    active.sort((a, b) => b._totalVotes - a._totalVotes);
    return active[0];
  }

  // אין פעילים – מציג את זה עם הכי הרבה הצבעות בכלל
  withTotals.sort((a, b) => b._totalVotes - a._totalVotes);
  return withTotals[0] || null;
}

function renderHomeMiniPoll(polls) {
  if (!rootEl || !statusEl || !totalEl) return;

  const poll = pickPollForHome(polls);

  if (!poll) {
    statusEl.textContent = "אין כרגע סקר זמין";
    rootEl.innerHTML =
      '<p class="empty-msg">כרגע אין סקר להצבעה. ברגע שייפתח – הוא יופיע כאן 🙂</p>';
    totalEl.textContent = "0 הצבעות עד עכשיו";
    return;
  }

  const options = poll.options || [];
  const totalVotes = options.reduce(
    (sum, o) => sum + (o.votes || 0),
    0
  );

  // סטטוס למעלה
  statusEl.textContent = poll.isActive
    ? "סקר פעיל כרגע"
    : "הסקר נסגר – מציגים את התוצאות";

  totalEl.textContent = `${totalVotes} הצבעות עד עכשיו`;

  if (!options.length) {
    rootEl.innerHTML =
      '<p class="empty-msg">אין אפשרויות לסקר הזה כרגע.</p>';
    return;
  }

  // מציג עד 4 אופציות (במקום 3) – או פחות אם יש פחות
  const limitedOptions = options.slice(0, 4);

  const html = limitedOptions
    .map((opt) => {
      const votes = opt.votes || 0;
      const percent =
        totalVotes > 0
          ? Math.round((votes / totalVotes) * 100)
          : 0;

      const votesText =
        totalVotes === 0
          ? "0 קולות"
          : `${votes} קולות (${percent}%)`;

      return `
        <div class="home-poll-option">
          <span class="home-poll-option-label">${escapeHtml(
            opt.text || ""
          )}</span>
          <span class="home-poll-option-votes">${votesText}</span>
        </div>
      `;
    })
    .join("");

  rootEl.innerHTML = html;
}

// הגנה קטנה מטקסט בעייתי
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
