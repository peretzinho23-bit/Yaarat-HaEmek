import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

document.getElementById("add-announcement")?.addEventListener("click", async () => {
  const title = document.getElementById("ann-title").value.trim();
  const body = document.getElementById("ann-body").value.trim();
  const date = document.getElementById("ann-date").value;
  const image = document.getElementById("ann-image").value.trim();

  if (!title || !body || !date) {
    alert("יש למלא כותרת, תאריך ותוכן");
    return;
  }

  await addDoc(collection(db, "announcements"), {
    title,
    body,
    date,
    image,
    active: true,
    createdAt: serverTimestamp()
  });

  alert("ההודעה פורסמה");
  location.reload();
});
