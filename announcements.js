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
      <div class="grade-card">
        <h3>אין הודעות הנהלה</h3>
        <p>כאשר תתפרסם הודעה – היא תופיע כאן.</p>
      </div>
    `;
    return;
  }

  snap.forEach(doc => {
    const d = doc.data();

    root.innerHTML += `
      <div class="grade-card">
        <h3>${d.title}</h3>
        <p style="font-size:.8rem; opacity:.7;">📅 ${d.date}</p>
        ${d.image ? `<img src="${d.image}" style="width:100%; border-radius:14px; margin:10px 0;">` : ""}
        <p>${d.body}</p>
      </div>
    `;
  });
});
