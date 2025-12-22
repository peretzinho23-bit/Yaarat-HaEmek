// reset-password.js
import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

console.log("✅ reset-password.js loaded");

const form = document.getElementById("reset-form");
const emailInput = document.getElementById("reset-email");
const statusEl = document.getElementById("reset-status");

function setStatus(text, type = "") {
  if (!statusEl) return;
  statusEl.textContent = text || "";
  statusEl.classList.remove("loading", "success", "error");
  if (type) statusEl.classList.add(type);
}

if (!form || !emailInput || !statusEl) {
  console.error("❌ Missing elements:", { form, emailInput, statusEl });
} else {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (emailInput.value || "").trim().toLowerCase();
    if (!email) {
      setStatus("תכניס אימייל.", "error");
      return;
    }

    try {
      setStatus("שולח קישור איפוס...", "loading");
      console.log("➡️ sending reset to:", email);

      await sendPasswordResetEmail(auth, email);

      setStatus("✅ אם האימייל קיים – נשלח קישור (בדוק ספאם)", "success");
      console.log("✅ reset email sent");
    } catch (err) {
      console.error("❌ reset error:", err);

      // הודעה “נקייה” למשתמש
      let msg = "שגיאה בשליחה. בדוק את האימייל ונסה שוב.";
      const code = err?.code || "";

      if (code === "auth/invalid-email") msg = "האימייל לא תקין.";
      else if (code === "auth/missing-email") msg = "חסר אימייל.";
      else if (code === "auth/user-not-found") {
        // עדיף לא לחשוף אם קיים/לא קיים, אבל אתה ביקשת בדיקה:
        msg = "האימייל הזה לא נמצא במערכת.";
      } else if (code === "auth/too-many-requests") msg = "יותר מדי ניסיונות. חכה קצת ונסה שוב.";
      else if (code === "auth/network-request-failed") msg = "בעיה ברשת. נסה שוב.";
      else if (code === "auth/operation-not-allowed") msg = "איפוס סיסמה לא מופעל בפיירבייס.";

      setStatus(msg, "error");
    }
  });
}
