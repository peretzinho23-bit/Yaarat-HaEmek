// admin-urgent.js
import { db, auth } from "./firebase-config.js";
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const elActive = document.getElementById("urgentActive");
const elType = document.getElementById("urgentType");
const elText = document.getElementById("urgentText");
const elSave = document.getElementById("urgentSave");
const elClear = document.getElementById("urgentClear");
const elStatus = document.getElementById("urgentStatus");

function setStatus(msg) {
  if (elStatus) elStatus.textContent = msg || "";
}

function boot() {
  const ref = doc(db, "site", "urgent");

  onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      if (elActive) elActive.checked = false;
      if (elType) elType.value = "info";
      if (elText) elText.value = "";
      setStatus("אין הודעה כרגע.");
      return;
    }

    const data = snap.data() || {};
    if (elActive) elActive.checked = !!data.active;
    if (elType) elType.value = ["info","warn","danger"].includes(data.type) ? data.type : "info";
    if (elText) elText.value = String(data.text || "");
    setStatus("נטען מהשרת.");
  });

  elSave?.addEventListener("click", async () => {
    const active = !!elActive?.checked;
    const type = elType?.value || "info";
    const text = String(elText?.value || "").trim();

    if (active && !text) {
      setStatus("שים טקסט לפני שמפעילים.");
      return;
    }

    try {
      await setDoc(ref, {
        active,
        type,
        text,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setStatus("נשמר ✅");
    } catch (e) {
      console.error(e);
      setStatus("שגיאה בשמירה ❌ (בדוק Rules/Console)");
    }
  });

  elClear?.addEventListener("click", async () => {
    try {
      await deleteDoc(ref);
      setStatus("נמחק ✅");
    } catch (e) {
      console.error(e);
      setStatus("שגיאה במחיקה ❌ (בדוק Rules/Console)");
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    setStatus("לא מחובר. התחבר כדי לערוך.");
    return;
  }
  boot();
});
