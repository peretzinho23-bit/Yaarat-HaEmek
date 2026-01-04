import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const el = document.getElementById("todayPlanText");

function dayKeyToday() {
  const d = new Date().getDay(); // 0 Sun .. 6 Sat
  return ["sun","mon","tue","wed","thu","fri","sat"][d] || "sun";
}

function startOfWeekSundayId(date = new Date()) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const day = d.getDay();            // 0=Sun
  d.setDate(d.getDate() - day);      // back to Sunday
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function hebrewDayLabel(key){
  const map = {sun:"ראשון",mon:"שני",tue:"שלישי",wed:"רביעי",thu:"חמישי",fri:"שישי"};
  return map[key] || "";
}

async function loadTodayPlan() {
  if (!el) return;

  // fallback אם אין תוכנית
  const fallback = "א'–ה': 08:10–16:00 · ו': 08:10–12:00";

  try {
    const weekId = startOfWeekSundayId();
    const todayKey = dayKeyToday();

    // שבת? אין לימודים
    if (todayKey === "sat") {
      el.textContent = "שבת — אין לימודים 🙂";
      return;
    }

    const snap = await getDoc(doc(db, "weeklyPlans", weekId));
    if (!snap.exists()) {
      el.textContent = fallback;
      return;
    }

    const data = snap.data() || {};
    const text = String(data[todayKey] || "").trim();

    if (!text) {
      el.textContent = `${hebrewDayLabel(todayKey)}: אין עדכון להיום.`;
      return;
    }

    el.textContent = `${hebrewDayLabel(todayKey)}: ${text}`;
  } catch (e) {
    console.error("todayPlan error:", e);
    el.textContent = "שגיאה בטעינה (בדוק Console/Rules).";
  }
}

loadTodayPlan();
