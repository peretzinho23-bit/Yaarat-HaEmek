import { auth } from "./firebase-config.js";
import {
  verifyPasswordResetCode,
  confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

console.log("✅ reset-confirm.js loaded");

const form = document.getElementById("confirm-form");
const p1 = document.getElementById("new-pass");
const p2 = document.getElementById("new-pass2");
const statusEl = document.getElementById("status");
const btn = document.getElementById("btn");
const emailPill = document.getElementById("email-pill");

const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const oobCode = params.get("oobCode");

const LOG_ENDPOINT = "https://europe-west1-yaarat-haemek.cloudfunctions.net/logPasswordReset"; // לשים אחרי שתיצור

let resolvedEmail = "";

function setStatus(text, type = "") {
  statusEl.textContent = text || "";
  statusEl.classList.remove("loading", "success", "error");
  if (type) statusEl.classList.add(type);
}

function maskEmail(email) {
  const [u, d] = String(email || "").split("@");
  if (!u || !d) return email || "";
  const head = u.slice(0, 2);
  return `${head}***@${d}`;
}

async function postLog(payload) {
  // בלי להפיל את התהליך אם הלוג נכשל
  try {
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("logPasswordReset fetch failed:", e);
  }
}

(async () => {
  if (mode !== "resetPassword" || !oobCode) {
    setStatus("❌ קישור לא תקין (חסר mode/oobCode).", "error");
    return;
  }

  try {
    setStatus("מאמת קישור איפוס...", "loading");
    resolvedEmail = await verifyPasswordResetCode(auth, oobCode);

    emailPill.style.display = "inline-block";
    emailPill.textContent = maskEmail(resolvedEmail);

    setStatus("✅ קישור תקין. בחר סיסמה חדשה.", "success");
    btn.disabled = false;
  } catch (err) {
    console.error("verifyPasswordResetCode error:", err);
    const code = err?.code || "";
    let msg = "❌ הקישור לא תקין או פג תוקף. בקש איפוס מחדש.";
    if (code === "auth/expired-action-code") msg = "❌ הקישור פג תוקף. בקש איפוס מחדש.";
    if (code === "auth/invalid-action-code") msg = "❌ הקישור לא תקין. בקש איפוס מחדש.";
    setStatus(msg, "error");
  }
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const pass1 = String(p1.value || "");
  const pass2 = String(p2.value || "");

  if (pass1.length < 6) {
    setStatus("סיסמה קצרה מדי (מינימום 6).", "error");
    return;
  }
  if (pass1 !== pass2) {
    setStatus("הסיסמאות לא תואמות.", "error");
    return;
  }

  btn.disabled = true;

  try {
    setStatus("מאפס סיסמה...", "loading");

    await confirmPasswordReset(auth, oobCode, pass1);

    setStatus("✅ הסיסמה עודכנה בהצלחה. אפשר להתחבר עכשיו.", "success");

    // לוג (בלי סיסמאות!)
    await postLog({
      type: "passwordReset",
      email: resolvedEmail || null,
      when: Date.now(),
      userAgent: navigator.userAgent,
      path: location.pathname,
    });

  } catch (err) {
    console.error("confirmPasswordReset error:", err);
    btn.disabled = false;

    const code = err?.code || "";
    let msg = "❌ שגיאה באיפוס. נסה שוב או בקש קישור חדש.";
    if (code === "auth/weak-password") msg = "❌ סיסמה חלשה מדי.";
    if (code === "auth/expired-action-code") msg = "❌ הקישור פג תוקף. בקש איפוס מחדש.";
    if (code === "auth/invalid-action-code") msg = "❌ הקישור לא תקין. בקש איפוס מחדש.";
    setStatus(msg, "error");
  }
});
