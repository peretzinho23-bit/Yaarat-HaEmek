import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const root = document.getElementById("announcements-list");

if (!root) {
  console.error("announcements-list not found");
}

/* ===============================
   Firestore Query
   =============================== */
const q = query(
  collection(db, "announcements"),
  where("active", "==", true),
  orderBy("date", "desc")
);

/* ===============================
   Render
   =============================== */
onSnapshot(q, (snap) => {
  root.innerHTML = "";

  if (snap.empty) {
    root.innerHTML = `
      <div class="ann-card ann-empty">
        <div class="ann-title">אין הודעות הנהלה</div>
        <div class="ann-body">
          כאשר תתפרסם הודעה רשמית – היא תופיע כאן.
        </div>
      </div>
    `;
    return;
  }

  snap.forEach(doc => {
    const d = doc.data();

    const dateText = d.date
      ? `📅 ${d.date}`
      : "";

    const imageBlock = d.image
      ? `
        <div class="ann-image">
          <img src="${d.image}" alt="תמונה להודעת הנהלה" loading="lazy">
        </div>
      `
      : "";

    root.insertAdjacentHTML("beforeend", `
      <article class="ann-card">
        ${dateText ? `<div class="ann-date">${dateText}</div>` : ""}

        <h3 class="ann-title">
          ${d.title || "הודעת הנהלה"}
        </h3>

        ${imageBlock}

        <div class="ann-body">
          ${d.body || ""}
        </div>
      </article>
    `);
  });
});
