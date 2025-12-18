import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const root = document.getElementById("announcements-list");

const q = query(
  collection(db, "announcements"),
  where("active", "==", true),
  orderBy("date", "desc")
);

onSnapshot(q, (snap) => {
  root.innerHTML = "";

  if (snap.empty) {
    root.innerHTML = `
      <div class="ann-card">
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

    root.innerHTML += `
      <div class="ann-card">
        <span class="ann-date">📅 ${d.date}</span>
        <div class="ann-title">${d.title}</div>

        ${d.image ? `
          <div class="ann-image">
            <img src="${d.image}" alt="">
          </div>
        ` : ""}

        <div class="ann-body">
          ${d.body}
        </div>
      </div>
    `;
  });
});
