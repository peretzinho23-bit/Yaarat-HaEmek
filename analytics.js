// analytics.js – ספירת צפיות בדפים

import { db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

function getPageId() {
  try {
    const body = document.body;
    if (body && body.dataset && body.dataset.page) {
      return body.dataset.page; // למשל: "home", "class-exams", "admin"
    }
  } catch (e) {}

  // fallback – לפי ה־URL
  return window.location.pathname.replace(/\//g, "_") || "unknown";
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`; // למשל: 2025-12-07
}

async function trackPageViewOnce() {
  const pageId = getPageId();
  const dateKey = getTodayKey();
  const docId = `${pageId}_${dateKey}`;

  try {
    const ref = doc(db, "analytics_pageViews", docId);
    await setDoc(
      ref,
      {
        pageId,
        dateKey,
        views: increment(1),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.error("שגיאה באנליטיקות:", err);
  }
}

// נריץ כשדף נטען
document.addEventListener("DOMContentLoaded", () => {
  trackPageViewOnce();
});
