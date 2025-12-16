// admin-urgent.js
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const urgentActive = document.getElementById("urgentActive");
const urgentType   = document.getElementById("urgentType");
const urgentText   = document.getElementById("urgentText");
const urgentColor  = document.getElementById("urgentColor");

const urgentSave   = document.getElementById("urgentSave");
const urgentClear  = document.getElementById("urgentClear");
const urgentStatus = document.getElementById("urgentStatus");

const ref = doc(db, "site", "urgent");

function setStatus(msg) {
  if (!urgentStatus) return;
  urgentStatus.textContent = msg || "";
}

function isValidHex(c) {
  return typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
}

async function loadUrgent() {
  try {
    setStatus("טוען…");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // defaults
      urgentActive.checked = false;
      urgentType.value = "warn";
      urgentText.value = "";
      if (urgentColor) urgentColor.value = "#fbbf24";
      setStatus("אין הודעה שמורה כרגע.");
      return;
    }

    const d = snap.data() || {};
    urgentActive.checked = !!d.active;
    urgentType.value = ["info", "warn", "danger"].includes(d.type) ? d.type : "warn";
    urgentText.value = String(d.text || "");
    if (urgentColor) {
      const c = String(d.color || "").trim();
      urgentColor.value = isValidHex(c) ? c : "#fbbf24";
    }

    setStatus("נטען ✅");
  } catch (e) {
    console.error("loadUrgent error:", e);
    setStatus("שגיאה בטעינה (בדוק Console/Rules).");
  }
}

urgentSave?.addEventListener("click", async () => {
  try {
    setStatus("שומר…");

    const payload = {
      active: !!urgentActive.checked,
      type: urgentType.value || "warn",
      text: String(urgentText.value || "").trim(),
      updatedAt: Date.now()
    };

    // צבע אופציונלי
    if (urgentColor && isValidHex(urgentColor.value)) {
      payload.color = urgentColor.value.trim();
    } else {
      payload.color = "";
    }

    // אם אין טקסט – נשמור כלא פעיל כדי שלא “יחסום”
    if (!payload.text) payload.active = false;

    // setDoc עם merge כדי לא למחוק שדות אחרים בטעות
    await setDoc(ref, payload, { merge: true });

    setStatus("נשמר ✅");
  } catch (e) {
    console.error("saveUrgent error:", e);
    setStatus("שגיאה בשמירה (בדוק Console/Rules).");
  }
});

urgentClear?.addEventListener("click", async () => {
  try {
    setStatus("מוחק…");
    await deleteDoc(ref);

    urgentActive.checked = false;
    urgentType.value = "warn";
    urgentText.value = "";
    if (urgentColor) urgentColor.value = "#fbbf24";

    setStatus("נמחק ✅");
  } catch (e) {
    console.error("clearUrgent error:", e);
    setStatus("שגיאה במחיקה (בדוק Console/Rules).");
  }
});

// טוען כשדף האדמין נפתח
loadUrgent();
