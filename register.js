console.log("✅ register.js loaded");

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// עוזר להראות שגיאות גם במסך
function setStatus(msg, isError = false) {
  const el = document.getElementById("register-status");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "#ef4444" : "#22c55e";
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

window.addEventListener("error", (e) => {
  console.error("❌ window error:", e.message, e.filename, e.lineno);
  setStatus("שגיאה בדף: " + e.message, true);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("❌ unhandled rejection:", e.reason);
  setStatus("שגיאה: " + (e.reason?.message || e.reason), true);
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOMContentLoaded");

  const form = document.getElementById("register-form");
  console.log("✅ form found?", !!form, form);

  if (!form) {
    setStatus("שגיאה: הטופס לא נמצא בדף", true);
    return;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault(); // ⭐ קריטי
    setStatus("");

    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.7";
    }

    try {
      const fullName = form.fullName?.value?.trim() || "";
      const email = normEmail(form.email?.value);
      const password = form.password?.value || "";
      const role = form.role?.value?.trim() || "";
      const reason = form.reason?.value?.trim() || "";
      const message = form.message?.value?.trim() || "";

      // ולידציה בסיסית
      if (!fullName || !email || !password || !role || !reason) {
        throw new Error("חסר שדה חובה. מלא/י שם, אימייל, סיסמה, תפקיד וסיבה.");
      }
      if (!email.includes("@") || !email.includes(".")) {
        throw new Error("אימייל לא תקין.");
      }
      if (password.length < 6) {
        throw new Error("סיסמה קצרה מדי (מינימום 6 תווים).");
      }

      const docData = {
        fullName,
        email,
        password,          // שים לב: זה לא מאובטח לשמור ככה, אבל זה מה שביקשת כרגע.
        role,              // מה שהמורה כתבה (תפקיד/מחנכת וכו')
        reason,
        message,
        status: "pending", // כדי ש-DEV ידע שזה ממתין
        handled: false,
        createdAt: serverTimestamp()
      };

      console.log("➡️ writing adminRequests:", docData);

      const ref = await addDoc(collection(db, "adminRequests"), docData);

      console.log("✅ saved:", ref.id);
      setStatus("הבקשה נשלחה ונשמרה ✅");

      form.reset();
    } catch (err) {
      console.error("❌ submit error:", err);
      setStatus("לא נשלח: " + (err?.message || err), true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
      }
    }
  });
});
