// register.js – שמירת בקשות הרשמה בפיירבייס

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  const statusEl = document.getElementById("register-status");

  if (!form) {
    console.error("לא נמצא form עם id=register-form");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";
    statusEl.style.color = "#e5e7eb";

    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const role = form.role.value.trim();
    const reason = form.reason.value.trim();
    const message = form.message.value.trim();

    if (!fullName || !email || !role || !reason) {
      statusEl.textContent = "יש למלא את כל השדות החובה.";
      statusEl.style.color = "#fecaca";
      return;
    }

    try {
      await addDoc(collection(db, "adminRequests"), {
        fullName,
        email,
        role,
        reason,
        message,
        createdAt: serverTimestamp(),
        handled: false
      });

      form.reset();
      statusEl.textContent = "הבקשה נשלחה ונשמרה בהצלחה. תודה!";
      statusEl.style.color = "#bbf7d0";
    } catch (err) {
      console.error("Error saving request:", err);
      statusEl.textContent =
        "אירעה שגיאה בשמירת הבקשה. נסה/י שוב או עדכן/י את מנהל האתר.";
      statusEl.style.color = "#fecaca";
    }
  });
});
