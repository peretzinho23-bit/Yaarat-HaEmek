import { auth } from "./firebase-config.js";
import {
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const form = document.getElementById("reset-form");
const statusEl = document.getElementById("reset-status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("reset-email").value.trim();

  statusEl.textContent = "שולח מייל...";

  try {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin + "/admin.html"
    });

    statusEl.textContent =
      "אם האימייל קיים במערכת – נשלח אליך קישור לאיפוס סיסמה 📩";
  } catch (err) {
    console.error(err);

    statusEl.textContent =
      "אם האימייל קיים במערכת – נשלח אליך קישור לאיפוס סיסמה 📩";
  }
});
