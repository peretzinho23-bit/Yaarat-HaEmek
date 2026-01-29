// polls.js – "סקר השבוע" (מותאם לחוקים שלך: pollVotes + counts)
import { db } from "./firebase-config.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const auth = getAuth();
signInAnonymously(auth).catch((e) => console.error("anon auth failed:", e));

function getUid() {
  return auth.currentUser?.uid || null;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const pollsCol = collection(db, "polls");
let activePoll = null;

async function loadWeeklyPoll() {
  const box = document.getElementById("poll-box");
  if (!box) return;

  try {
    const q = query(
      pollsCol,
      where("isActive", "==", true),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      box.innerHTML = `<p class="empty-msg">כרגע אין סקר פעיל.</p>`;
      activePoll = null;
      return;
    }

    const docSnap = snap.docs[0];
    activePoll = { id: docSnap.id, ...docSnap.data() }; // ✅ FIX

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

  const totalVotes = (activePoll.options || []).reduce((sum, opt) => {
    const v = activePoll.counts?.[opt.id] || 0;
    return sum + v;
  }, 0);

  const optionsHtml = (activePoll.options || [])
    .map(
      (opt) => `
      <label class="poll-option">
        <input type="radio" name="pollOption" value="${escapeHtml(opt.id)}" ${alreadyVoted ? "disabled" : ""} />
        <span>${escapeHtml(opt.text || "")}</span>
      </label>
    `
    )
    .join("");

  const resultsHtml = (activePoll.options || [])
    .map((opt) => {
      const votes = activePoll.counts?.[opt.id] || 0;
      const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
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
    if (btn) btn.addEventListener("click", handleVote);
  }
}

async function handleVote() {
  if (!activePoll) return;

  const box = document.getElementById("poll-box");
  const chosen =
    Array.from(document.querySelectorAll('input[name="pollOption"]')).find((r) => r.checked)?.value || null;

  if (!chosen) {
    alert("בחר אפשרות לפני ההצבעה.");
    return;
  }

  const uid = getUid();
  if (!uid) {
    alert("התחברות אנונימית עדיין נטענת… נסה שוב עוד רגע.");
    return;
  }

  try {
    const pollId = activePoll.id;
    const pollRef = doc(db, "polls", pollId);
    const voteRef = doc(db, "pollVotes", `${pollId}__${uid}`);

    const batch = writeBatch(db);
    batch.set(voteRef, {
      pollId,
      optionId: chosen,
      uid,
      createdAt: serverTimestamp()
    });
    batch.update(pollRef, {
      [`counts.${chosen}`]: increment(1)
    });

    await batch.commit();

    localStorage.setItem("poll_voted_" + pollId, "1");
    await loadWeeklyPoll();
  } catch (err) {
    console.error("שגיאה בהצבעה לסקר:", err);
    alert("שגיאה בהצבעה. נסו שוב מאוחר יותר.");
    if (box) renderPoll(box);
  }
}

document.addEventListener("DOMContentLoaded", loadWeeklyPoll);
