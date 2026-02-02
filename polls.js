// polls.js
import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  doc,
  serverTimestamp,
  increment,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

/* =========================
   AUTH (Anonymous) + UID
   ========================= */

const auth = getAuth();

let authReadyResolve;
const authReady = new Promise((res) => (authReadyResolve = res));

onAuthStateChanged(auth, (user) => {
  if (user) {
    // שומרים UID מקומית כדי להציג "נעול" מהר בלי לחכות בכל פעם
    try { localStorage.setItem("yaarat_anon_uid", user.uid); } catch {}
    authReadyResolve();
  }
});

// מתחילים אנונימי אם אין משתמש
if (!auth.currentUser) {
  signInAnonymously(auth).catch((e) => console.error("anon auth failed:", e));
}

async function getUidGuaranteed() {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  await authReady;
  return auth.currentUser?.uid || null;
}

/* =========================
   LOCAL VOTES (UI Lock)
   ========================= */

const LOCAL_KEY = "yaarat_polls_votes";
let localVotes = {};

function loadLocalVotes() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    localVotes = raw ? (JSON.parse(raw) || {}) : {};
    if (!localVotes || typeof localVotes !== "object") localVotes = {};
  } catch {
    localVotes = {};
  }
}

function saveLocalVotes() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(localVotes)); } catch {}
}

// אם מישהו מחק localStorage אבל כבר הצביע בעבר, ה־Rules יחסמו.
// במקרה כזה אנחנו “נועלים” מקומית אחרי permission-denied.
function lockPollLocally(pollId, optionIdOrUnknown = "__locked") {
  localVotes[pollId] = optionIdOrUnknown;
  saveLocalVotes();
}

/* =========================
   POLLS LIST PAGE (polls.html)
   ========================= */

const pollsListEl = document.getElementById("polls-list");
const activeStatsEl = document.getElementById("stats-active-polls");
const totalVotesStatsEl = document.getElementById("stats-total-votes");

const filterActiveBtn = document.getElementById("filter-active");
const filterAllBtn = document.getElementById("filter-all");
const showAllHeroBtn = document.getElementById("show-all-polls");

const pollsColRef = collection(db, "polls");

let pollsRaw = [];
let showOnlyActive = true;

function calcStats() {
  let activeCount = 0;
  let totalVotes = 0;

  pollsRaw.forEach((poll) => {
    if (poll.isActive) activeCount++;

    const pollVotes = (poll.options || []).reduce((sum, opt) => {
      const v = poll.counts?.[opt.id] || 0;
      return sum + v;
    }, 0);

    totalVotes += pollVotes;
  });

  if (activeStatsEl) activeStatsEl.textContent = String(activeCount);
  if (totalVotesStatsEl) totalVotesStatsEl.textContent = String(totalVotes);
}

function renderPolls() {
  if (!pollsListEl) return;

  loadLocalVotes(); // ✅ תמיד לפני שימוש ב-localVotes

const pollsToShow = showOnlyActive
  ? pollsRaw.filter((p) => p.isActive)
  : pollsRaw.slice().sort((a, b) => {
      const aActive = a.isActive ? 1 : 0;
      const bActive = b.isActive ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime; // חדש למעלה
    });


  if (!pollsToShow.length) {
    pollsListEl.innerHTML = `
      <p class="poll-empty-msg">
        כרגע אין סקרים להצבעה. חכו קצת – יעלו סקר חדש 😉
      </p>
    `;
    return;
  }

  pollsListEl.innerHTML = "";
  pollsToShow.forEach((poll) => pollsListEl.appendChild(createPollCard(poll)));
}

function createPollCard(poll) {
  const card = document.createElement("article");
  card.className = "poll-card";

  const options = poll.options || [];
  const counts = poll.counts || {};

  const totalVotes = options.reduce((sum, opt) => sum + (counts?.[opt.id] || 0), 0);

  const alreadyVotedOptionId = localVotes[poll.id] || null;
  const isClosed = !poll.isActive;

  const headerRow = document.createElement("div");
  headerRow.className = "poll-header-row";

  const left = document.createElement("div");
  const qEl = document.createElement("div");
  qEl.className = "poll-question";
  qEl.textContent = poll.question || "סקר ללא שאלה?";

  const meta = document.createElement("div");
  meta.className = "poll-meta";
  const votesSpanHeader = document.createElement("span");
  votesSpanHeader.innerHTML = `<span dir="ltr">${totalVotes}</span>&nbsp;הצבעות עד עכשיו`;
  meta.appendChild(votesSpanHeader);

  left.appendChild(qEl);
  left.appendChild(meta);

  const right = document.createElement("div");
  const statusPill = document.createElement("div");
  statusPill.className = "poll-status-pill" + (isClosed ? " closed" : "");
  statusPill.textContent = isClosed ? "סקר נסגר" : "סקר פעיל";
  right.appendChild(statusPill);

  headerRow.appendChild(left);
  headerRow.appendChild(right);

  const optionsContainer = document.createElement("div");
  optionsContainer.className = "poll-options";

  options.forEach((opt) => {
    const row = document.createElement("div");
    row.className = "poll-option-row";

    const bar = document.createElement("div");
    bar.className = "poll-option-bar";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "poll-option-btn";

    const labelSpan = document.createElement("span");
    labelSpan.className = "poll-option-label";
    labelSpan.textContent = opt.text || "";

    const votesSpan = document.createElement("span");
    votesSpan.className = "poll-option-votes";

    const votes = counts?.[opt.id] || 0;
    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

    votesSpan.innerHTML =
      totalVotes === 0
        ? `<span dir="ltr">${votes}</span>&nbsp;<span>קולות</span>`
        : `<span dir="ltr">${votes}</span>&nbsp;<span>קולות</span>&nbsp;(<span dir="ltr">${percent}%</span>)`;

    btn.appendChild(labelSpan);
    btn.appendChild(votesSpan);

    const canVote = poll.isActive && !alreadyVotedOptionId;

    if (!canVote) btn.classList.add("disabled");

    // ברים רק כשנעול/נסגר ויש הצבעות
    if (!canVote && totalVotes > 0) {
      bar.style.transformOrigin = "right center";
      bar.style.transform = "scaleX(" + Math.max(percent / 100, 0.05) + ")";
      bar.classList.add("visible");
    }

    if (canVote) {
      btn.addEventListener("click", () => handleVote(poll.id, opt.id));
    }

    row.appendChild(bar);
    row.appendChild(btn);
    optionsContainer.appendChild(row);
  });

  const footerRow = document.createElement("div");
  footerRow.className = "poll-cta-row";

  const leftSide = document.createElement("div");
  if (alreadyVotedOptionId) {
    const selected = options.find((o) => o.id === alreadyVotedOptionId);
    leftSide.innerHTML = selected
      ? `כבר הצבעת בסקר הזה ל: <strong>${selected.text}</strong>`
      : `כבר הצבעת בסקר הזה <strong>(לא ניתן לדעת למה)</strong>`;
  } else if (!poll.isActive) {
    leftSide.innerHTML = '<span class="poll-locked">🔒 הסקר נסגר – הצבעות חדשות לא אפשריות.</span>';
  } else {
    leftSide.textContent = "בחר אפשרות ולחץ – ההצבעה נספרת מיד.";
  }

  const rightSide = document.createElement("div");
  if (alreadyVotedOptionId) {
    rightSide.innerHTML = '<span class="poll-locked">🔒 הצבעת כבר מהמכשיר הזה</span>';
  } else if (!poll.isActive) {
    rightSide.textContent = "אפשר לראות תוצאות, אבל לא להצביע.";
  } else {
    rightSide.textContent = "אפשר להצביע פעם אחת בלבד.";
  }

  footerRow.appendChild(leftSide);
  footerRow.appendChild(rightSide);

  card.appendChild(headerRow);
  card.appendChild(optionsContainer);
  card.appendChild(footerRow);

  return card;
}

async function handleVote(pollId, optionId) {
  loadLocalVotes();

  if (localVotes[pollId]) {
    alert("כבר הצבעת בסקר הזה מהמכשיר הזה.");
    return;
  }

  const uid = await getUidGuaranteed();
  if (!uid) {
    alert("ההתחברות עדיין נטענת… נסה שוב עוד רגע.");
    return;
  }

  try {
    const pollRef = doc(db, "polls", pollId);
    const voteRef = doc(db, "pollVotes", `${pollId}__${uid}`);

    const batch = writeBatch(db);

    // יוצרים vote doc
    batch.set(voteRef, {
      pollId,
      optionId,
      uid,
      createdAt: serverTimestamp()
    });

    // מעלים מונה
    batch.update(pollRef, {
      [`counts.${optionId}`]: increment(1)
    });

    await batch.commit();

    lockPollLocally(pollId, optionId);
    renderPolls(); // תצוגה מידית
  } catch (err) {
    console.error("vote error:", err);

    // אם כבר הצביע בעבר (על אותו uid) – rules יחזירו permission-denied / already-exists


    alert("הייתה בעיה בזמן ההצבעה. נסו שוב.");
  }
}

function setFilterMode(onlyActive) {
  showOnlyActive = onlyActive;

  if (filterActiveBtn && filterAllBtn) {
    if (onlyActive) {
      filterActiveBtn.classList.add("active");
      filterAllBtn.classList.remove("active");
    } else {
      filterActiveBtn.classList.remove("active");
      filterAllBtn.classList.add("active");
    }
  }
  renderPolls();
}

function initPollsListPage() {
  if (!pollsListEl) return;

  loadLocalVotes();

  if (filterActiveBtn && filterAllBtn) {
    filterActiveBtn.addEventListener("click", () => setFilterMode(true));
    filterAllBtn.addEventListener("click", () => setFilterMode(false));
  }

  if (showAllHeroBtn) {
    showAllHeroBtn.addEventListener("click", () => {
      setFilterMode(false);
      const target = document.getElementById("polls-section");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  onSnapshot(
    pollsColRef,
    (snap) => {
      pollsRaw = [];
      snap.forEach((docSnap) => pollsRaw.push({ id: docSnap.id, ...docSnap.data() }));
      calcStats();
      renderPolls();
    },
    (err) => {
      console.error("polls snapshot error:", err);
      pollsListEl.innerHTML = '<p class="poll-empty-msg">שגיאה בטעינת הסקרים. נסו לרענן.</p>';
    }
  );
}

/* =========================
   WEEKLY POLL BOX (optional)
   ========================= */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let activePoll = null;

async function loadWeeklyPollBox() {
  const box = document.getElementById("poll-box");
  if (!box) return;

  try {
    const pollsCol = collection(db, "polls");
    const q = query(pollsCol, where("isActive", "==", true), orderBy("createdAt", "desc"), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) {
      box.innerHTML = `<p class="empty-msg">כרגע אין סקר פעיל.</p>`;
      activePoll = null;
      return;
    }

    const docSnap = snap.docs[0];
    activePoll = { id: docSnap.id, ...docSnap.data() };
    renderWeeklyPollBox(box);
  } catch (err) {
    console.error("weekly poll load error:", err);
    box.innerHTML = `<p class="empty-msg">שגיאה בטעינת הסקר.</p>`;
  }
}

function renderWeeklyPollBox(box) {
  if (!activePoll) {
    box.innerHTML = `<p class="empty-msg">אין סקר פעיל.</p>`;
    return;
  }

  loadLocalVotes();
  const alreadyVoted = Boolean(localVotes[activePoll.id]);

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
    if (btn) btn.addEventListener("click", handleWeeklyVote);
  }
}

async function handleWeeklyVote() {
  if (!activePoll) return;

  const chosen =
    Array.from(document.querySelectorAll('input[name="pollOption"]'))
      .find((r) => r.checked)?.value || null;

  if (!chosen) {
    alert("בחר אפשרות לפני ההצבעה.");
    return;
  }

  const uid = await getUidGuaranteed();
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

    lockPollLocally(pollId, chosen);
    await loadWeeklyPollBox();

  } catch (err) {
    console.error("weekly vote error:", err);
    const msg = String(err?.message || "");
    if (msg.includes("permission") || msg.includes("PERMISSION_DENIED") || msg.includes("already exists")) {
      lockPollLocally(activePoll.id, "__locked");
      alert("כבר הצבעת בסקר הזה.");
      await loadWeeklyPollBox();
      return;
    }

    alert("שגיאה בהצבעה. נסו שוב מאוחר יותר.");
  }
}

/* =========================
   BOOT
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  initPollsListPage();
  loadWeeklyPollBox();
});
