// polls.js – סקר השבוע בדף התלמידים

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const pollsCol = collection(db, "polls");
let activePoll = null;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadWeeklyPoll() {
  const box = document.getElementById("poll-box");
  if (!box) return;

  try {
    // לוקח את הסקר הפעיל האחרון
    const q = query(
      pollsCol,
      where("isActive", "==", true),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      box.innerHTML = `<p class="empty-msg">כרגע אין סקר פעיל.</p>`;
      return;
    }

    const docSnap = snap.docs[0];
    activePoll = { id: docSnap.id, ...docSnap.data() };

    renderPoll(box);
  } catch (err) {
    console.error("שגיאה בטעינת סקר השבוע:", err);
    box.innerHTML = `<p class="empty-msg">שגיאה בטעינת הסקר.</p>`;
  }
}

function renderPoll(box) {
  if (!activePoll) {
    box.innerHTML = `<p class="empty-msg">אין סקר פעיל.</p>`;
    return;
  }

  const votedKey = "poll_voted_" + activePoll.id;
  const alreadyVoted = localStorage.getItem(votedKey) === "1";

  const optionsHtml = (activePoll.options || [])
    .map(
      (opt) => `
      <label class="poll-option">
        <input type="radio" name="pollOption" value="${escapeHtml(opt.id)}" ${
        alreadyVoted ? "disabled" : ""
      } />
        <span>${escapeHtml(opt.text || "")}</span>
      </label>
    `
    )
    .join("");

  const totalVotes = (activePoll.options || []).reduce(
    (sum, o) => sum + (o.votes || 0),
    0
  );

  const resultsHtml = (activePoll.options || [])
    .map((opt) => {
      const votes = opt.votes || 0;
      const percent =
        totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      return `
        <div class="poll-result-row">
          <span>${escapeHtml(opt.text || "")}</span>
          <span>${votes} קולות (${percent}%)</span>
        </div>
      `;
    })
    .join("");

  box.innerHTML = `
    <h3 style="margin-bottom:10px;">${escapeHtml(activePoll.question || "")}</h3>

    <div id="poll-form-area">
      ${optionsHtml}

      ${
        alreadyVoted
          ? `<p class="section-subtitle" style="margin-top:12px;">כבר הצבעת 😊</p>`
          : `<button id="poll-vote-btn" class="btn-primary" style="margin-top:12px;">הצבעה</button>`
      }
    </div>

    <hr style="margin:18px 0; opacity:0.25;">

    <div>
      <p class="section-subtitle" style="margin-bottom:6px;">
        תוצאות עדכניות · סה"כ ${totalVotes} קולות
      </p>
      ${resultsHtml}
    </div>
  `;

  if (!alreadyVoted) {
    const btn = document.getElementById("poll-vote-btn");
    if (btn) {
      btn.addEventListener("click", handleVote);
    }
  }
}

async function handleVote() {
  if (!activePoll) return;

  const box = document.getElementById("poll-box");
  const radios = document.querySelectorAll('input[name="pollOption"]');
  let chosen = null;
  radios.forEach((r) => {
    if (r.checked) chosen = r.value;
  });

  if (!chosen) {
    alert("בחר אפשרות לפני ההצבעה.");
    return;
  }

  try {
    const updatedOptions = (activePoll.options || []).map((opt) =>
      opt.id === chosen
        ? { ...opt, votes: (opt.votes || 0) + 1 }
        : { ...opt }
    );

    await updateDoc(doc(db, "polls", activePoll.id), {
      options: updatedOptions
    });

    activePoll.options = updatedOptions;

    localStorage.setItem("poll_voted_" + activePoll.id, "1");

    renderPoll(box);
  } catch (err) {
    console.error("שגיאה בהצבעה לסקר:", err);
    alert("שגיאה בהצבעה. נסו שוב מאוחר יותר.");
  }
}

document.addEventListener("DOMContentLoaded", loadWeeklyPoll);
