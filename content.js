import { db } from "./firebase-config.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// טענת טקסטים כלליים (אודות, טלפון, תיאורי שכבות וכו')
async function loadSiteContent() {
  try {
    const ref = doc(db, "siteContent", "main");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};

    const mapping = [
      ["home-hero-title", "homeHeroTitle"],
      ["home-hero-subtitle", "homeHeroSubtitle"],
      ["about-title", "aboutTitle"],
      ["about-text", "aboutBody"],
      ["contact-phone", "contactPhone"],
      ["contact-email", "contactEmail"],
      ["contact-address", "contactAddress"],
      ["footer-text", "footerText"],
      ["grade-z-text", "zDescription"],
      ["grade-h-text", "hDescription"],
      ["grade-t-text", "tDescription"]
    ];

    for (const [id, key] of mapping) {
      const el = document.getElementById(id);
      if (el && data[key]) {
        el.textContent = data[key];
      }
    }
  } catch (err) {
    console.error("Error loading site content", err);
  }
}

// חדשות ומבחנים לדף הבית
async function loadHomeLists() {
  try {
    const grades = ["z", "h", "t"];

    for (const g of grades) {
      // חדשות
      const newsRef = doc(db, "news", g);
      const newsSnap = await getDoc(newsRef);
      if (newsSnap.exists()) {
        const newsData = newsSnap.data().items || [];
        const target = document.getElementById(`home-news-${g}`);
        if (target) {
          if (!newsData.length) {
            target.innerHTML = `<p class="empty-msg">אין עדיין חדשות לשכבה זו.</p>`;
          } else {
            target.innerHTML = newsData
              .slice(0, 3)
              .map(
                (n) => `
                  <div class="home-news-item">
                    <div class="home-news-title">${escapeHtml(n.title)}</div>
                    <div class="home-news-meta">${escapeHtml(n.meta || "")}</div>
                    <div class="home-news-body">${escapeHtml(n.body || "")}</div>
                  </div>
                `
              )
              .join("");
          }
        }
      }

      // מבחנים
      const examsRef = doc(db, "exams", g);
      const examsSnap = await getDoc(examsRef);
      if (examsSnap.exists()) {
        const examsData = examsSnap.data().items || [];
        const targetEx = document.getElementById(`home-exams-${g}`);
        if (targetEx) {
          if (!examsData.length) {
            targetEx.innerHTML = `<p class="empty-msg">אין עדיין מבחנים לשכבה זו.</p>`;
          } else {
            targetEx.innerHTML = examsData
              .slice(0, 3)
              .map(
                (ex) => `
                  <div class="home-exam-item">
                    <div class="home-exam-top">
                      <span class="home-exam-date">${escapeHtml(ex.date || "")}</span>
                      <span class="home-exam-subject">${escapeHtml(ex.subject || "")}</span>
                    </div>
                    <div class="home-exam-topic">${escapeHtml(ex.topic || "")}</div>
                  </div>
                `
              )
              .join("");
          }
        }
      }
    }
  } catch (err) {
    console.error("Error loading home lists", err);
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", () => {
  loadSiteContent();
  loadHomeLists();
});
