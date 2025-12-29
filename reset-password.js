import { auth } from "./firebase-config.js";
import {
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

console.log("✅ reset-password.js loaded");

const form = document.getElementById("reset-form");
const emailInput = document.getElementById("reset-email");
const statusEl = document.getElementById("reset-status");

function setStatus(text, type = "") {
  statusEl.textContent = text || "";
  statusEl.classList.remove("loading", "success", "error");
  if (type) statusEl.classList.add(type);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = (emailInput.value || "").trim().toLowerCase();
  if (!email) return setStatus("תכניס אימייל.", "error");

  try {
    setStatus("בודק את האימייל...", "loading");

    // ✅ בדיקה שהמייל קיים במערכת (אתה ביקשת)
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (!methods || methods.length === 0) {
      setStatus("האימייל הזה לא נמצא במערכת.", "error");
      return;
    }

    setStatus("שולח קישור איפוס...", "loading");

    // ✅ שולח קישור לדף שלך (B)
    const actionCodeSettings = {
      url: `${location.origin}/reset-confirm.html`,
      handleCodeInApp: true,
    };

    await sendPasswordResetEmail(auth, email, actionCodeSettings);

    setStatus("✅ נשלח קישור איפוס למייל. בדוק ספאם.", "success");
  } catch (err) {
    console.error("❌ reset error:", err);
    const code = err?.code || "";
    let msg = "שגיאה בשליחה. נסה שוב.";
    if (code === "auth/invalid-email") msg = "האימייל לא תקין.";
    if (code === "auth/too-many-requests") msg = "יותר מדי ניסיונות. חכה קצת.";
    if (code === "auth/network-request-failed") msg = "בעיה ברשת. נסה שוב.";
    if (code === "auth/operation-not-allowed") msg = "איפוס סיסמה לא מופעל בפיירבייס.";
    setStatus(msg, "error");
  }
});
