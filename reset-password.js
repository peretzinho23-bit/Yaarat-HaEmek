// reset-password.js
import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

console.log("✅ reset-password.js loaded");

const form = document.getElementById("reset-form");
const emailInput = document.getElementById("reset-email");
const statusEl = document.getElementById("reset-status");

const LOG_ENDPOINT =
"https://europe-west1-yaarat-haemek.cloudfunctions.net/logResetRequest";

let submitting = false;

function setStatus(text, type = "") {
  if (!statusEl) return;
  statusEl.textContent = text || "";
  statusEl.classList.remove("loading", "success", "error");
  if (type) statusEl.classList.add(type);
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

async function postLog(email) {
  // לוג לא אמור להפיל את התהליך לעולם
  try {
    const payload = {
      email: normalizeEmail(email),
      // לא חובה, אבל סבבה שיהיה גם בצד שלך
      when: Date.now(),
      path: location.pathname,
      userAgent: navigator.userAgent,
    };

    // Keepalive = גם אם המשתמש עובר עמוד מהר, הבקשה תנסה לצאת
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (e) {
    console.warn("logResetRequest failed:", e);
  }
}

// אם חסרים אלמנטים, אל תפיל את כל האתר
if (!form || !emailInput || !statusEl) {
  console.error("❌ reset-password.js missing elements:", { form, emailInput, statusEl });
} else {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting) return;

    const email = normalizeEmail(emailInput.value);
    if (!email) {
      setStatus("תכניס אימייל.", "error");
      return;
    }

    submitting = true;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      setStatus("שולח קישור איפוס...", "loading");

      // שולח מייל איפוס (אם לא קיים -> יזרוק user-not-found אצלך)
      await sendPasswordResetEmail(auth, email);

      // רק אחרי הצלחה – לוג עם IP מהשרת
      postLog(email); // לא await בכוונה: שלא יעכב UI

  setStatus("✅ אם האימייל קיים במערכת – נשלח קישור איפוס (בדוק ספאם)", "success");
    } catch (err) {
      console.error("❌ reset error:", err);

      let msg = "שגיאה בשליחה. בדוק את האימייל ונסה שוב.";
      const code = err?.code || "";

      if (code === "auth/invalid-email") msg = "האימייל לא תקין.";
      else if (code === "auth/missing-email") msg = "חסר אימייל.";
      else if (code === "auth/user-not-found") msg = "האימייל הזה לא נמצא במערכת.";
      else if (code === "auth/too-many-requests") msg = "יותר מדי ניסיונות. חכה קצת ונסה שוב.";
      else if (code === "auth/network-request-failed") msg = "בעיה ברשת. נסה שוב.";

      setStatus(msg, "error");
    } finally {
      submitting = false;
      if (btn) btn.disabled = false;
    }
  });
}
