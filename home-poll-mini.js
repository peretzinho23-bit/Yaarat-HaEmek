// home-poll-mini.js – סקר השבוע בעמוד הבית

import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const pollsColRef = collection(db, "polls");

const questionEl = document.getElementById("home-poll-question");
const optionsEl = document.getElementById("home-poll-options");
const statusEl = document.getElementById("home-poll-status");
const votesEl = document.getElementById("home-poll-votes");

function renderNoPoll() {
  if (statusEl)
    statusEl.textContent = "כרגע אין סקר פעיל. כשייפתח סקר חדש – הוא יופיע כאן.";
  if (questionEl)
    questionEl.textContent = "אין כרגע סקר פעיל להצבעה.";
  if (optionsEl)
    optionsEl.innerHTML = "";
  if (votesEl)
    votesEl.textContent = "0 הצבעות עד עכשיו";
}

function renderPoll(poll) {
  if (!poll) {
    renderNoPoll();
    return;
  }

  const options = poll.options || [];
  const totalVotes = options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

  if (statusEl)
    statusEl.textContent = "הסקר הפעיל ביותר מהמערכת.";

  if (questionEl)
    questionEl.textContent = poll.question || "סקר ללא שאלה";

  if (votesEl)
    votesEl.textContent = `${totalVotes} הצבעות עד עכשיו`;

  if (!optionsEl) return;

  optionsEl.innerHTML = "";

  // מציגים עד 4 אפשרויות (אם יש יותר – זה כבר לשם בדף הסקרים המלא)
  options.slice(0, 4).forEach((opt) => {
    const li = document.createElement("li");
    li.className = "home-poll-option";

    const label = document.createElement("span");
    label.className = "home-poll-option-label";
    label.textContent = opt.text || "";

    const votes = opt.votes || 0;
    const percent =
      totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

    const votesSpan = document.createElement("span");
    votesSpan.className = "home-poll-option-votes";
    votesSpan.textContent =
      totalVotes === 0
        ? "0 קולות"
        : `${votes} קולות (${percent}%)`;

    li.appendChild(label);
    li.appendChild(votesSpan);
    optionsEl.appendChild(li);
  });

  // אם יש יותר מ־4 אפשרויות – נוסיף שורה קטנה
  if (options.length > 4) {
    const li = document.createElement("li");
    li.className = "home-poll-option";
    li.style.opacity = "0.75";

    const span = document.createElement("span");
    span.className = "home-poll-option-label";
    span.textContent = `ועוד ${options.length - 4} אפשרויות נוספות...`;

    li.appendChild(span);
    optionsEl.appendChild(li);
  }
}

// מאזין לכל קולקציית הסקרים ובוחר את הפעיל הכי חדש
onSnapshot(
  pollsColRef,
  (snap) => {
    let latestActive = null;

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.isActive) return;

      let ts = 0;
      if (data.createdAt && typeof data.createdAt.toMillis === "function") {
        ts = data.createdAt.toMillis();
      }

      if (!latestActive || ts > latestActive._ts) {
        latestActive = {
          id: docSnap.id,
          _ts: ts,
          ...data
        };
      }
    });

    if (!latestActive) {
      renderNoPoll();
    } else {
      renderPoll(latestActive);
    }
  },
  (err) => {
    console.error("שגיאה בטעינת סקר השבוע:", err);
    renderNoPoll();
  }
);
