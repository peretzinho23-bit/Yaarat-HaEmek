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

root.innerHTML = `
  <div class="ann-card">
    <div class="ann-title">טוען הודעות…</div>
  </div>
`;

const q = query(
  collection(db, "announcements"),
  where("active", "==", true),
  orderBy("date", "desc")
);

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

    let dateText = "";
    if (d.date?.toDate) {
      dateText = d.date.toDate().toLocaleDateString("he-IL");
    } else if (typeof d.date === "string") {
      dateText = d.date;
    }

    root.insertAdjacentHTML("beforeend", `
      <article class="ann-card">
        ${dateText ? `<div class="ann-date">📅 ${dateText}</div>` : ""}
        <h3 class="ann-title">${d.title || "הודעת הנהלה"}</h3>
        ${d.image ? `
          <div class="ann-image">
            <img src="${d.image}" loading="lazy">
          </div>` : ""}
        <div class="ann-body">${d.body || ""}</div>
      </article>
    `);
  });
});
