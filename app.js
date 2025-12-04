// app.js – אתר התלמידים, עם עדכונים בזמן אמת (Realtime)

import { db } from "./firebase-config.js";
import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const GRADES = ["z", "h", "t"];
const currentGrade = document.body?.dataset?.grade || null; // "z" | "h" | "t" או null בדף הבית

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ------------ חדשות בדף הבית (Realtime) ------------ */

function subscribeHomeNews() {
  // אם אנחנו לא בדף הבית – אין אלמנטים האלה, אז לא לעשות כלום
  if (!document.getElementById("home-news-z")) return;

  for (const g of GRADES) {
    const box = document.getElementById(`home-news-${g}`);
    if (!box) continue;

    const ref = doc(db, "news", g);

    onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : { items: [] };
        const items = data.items || [];

        if (!items.length) {
          box.innerHTML = `<p class="empty-msg">אין עדיין חדשות לשכבה זו.</p>`;
          return;
        }

        const latest = items.slice(-3).reverse();

        box.innerHTML = latest
          .map((n) => {
            const title = escapeHtml(n.title || "");
            const meta = escapeHtml(n.meta || "");
            const body = escapeHtml(n.body || "");
            const img = n.imageUrl ? String(n.imageUrl) : "";
            const colorStyle = n.color
              ? ` style="color:${escapeHtml(n.color)}"`
              : "";

            // אם יש תמונה – כרטיס עם תמונה בצד
            if (img) {
              return `
                <div class="home-news-item home-news-item-with-image">
                  <div class="home-news-image-wrap">
                    <img src="${escapeHtml(img)}" alt="תמונה לחדשות" loading="lazy">
                  </div>
                  <div class="home-news-text"${colorStyle}>
                    <div class="home-news-title">${title}</div>
                    ${meta ? `<div class="home-news-meta">${meta}</div>` : ""}
                    <div class="home-news-body">${body}</div>
                  </div>
                </div>
              `;
            }

            // בלי תמונה – כרטיס רגיל
            return `
              <div class="home-news-item"${colorStyle}>
                <div class="home-news-title">${title}</div>
                ${meta ? `<div class="home-news-meta">${meta}</div>` : ""}
                <div class="home-news-body">${body}</div>
              </div>
            `;
          })
          .join("");
      },
      (err) => {
        console.error("Error subscribing to home news for grade", g, err);
        box.innerHTML = `<p class="empty-msg">שגיאה בטעינת החדשות.</p>`;
      }
    );
  }
}

/* ------------ מבחנים בדף הבית (Realtime) ------------ */

function subscribeHomeExams() {
  if (!document.getElementById("home-exams-z")) return;

  for (const g of GRADES) {
    const box = document.getElementById(`home-exams-${g}`);
    if (!box) continue;

    const ref = doc(db, "exams", g);

    onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : { items: [] };
        const items = data.items || [];

        if (!items.length) {
          box.innerHTML = `<p class="empty-msg">אין מבחנים לשכבה זו.</p>`;
          return;
        }

        const latest = items.slice(-5).reverse();

        box.innerHTML = latest
          .map((ex) => {
            const subject = escapeHtml(ex.subject || "");
            const date = escapeHtml(ex.date || "");
            const topic = escapeHtml(ex.topic || "");

            return `
              <div class="home-exam-item">
                <div class="home-exam-top">
                  <span class="home-exam-subject">${subject}</span>
                  <span class="home-exam-date">${date}</span>
                </div>
                <div class="home-exam-topic">${topic}</div>
              </div>
            `;
          })
          .join("");
      },
      (err) => {
        console.error("Error subscribing to home exams for grade", g, err);
        box.innerHTML = `<p class="empty-msg">שגיאה בטעינת המבחנים.</p>`;
      }
    );
  }
}

/* ------------ חדשות בדפי שכבות (z/h/t) – Realtime ------------ */

function subscribeGradeNews() {
  if (!currentGrade) return;
  const box = document.getElementById("grade-news");
  if (!box) return;

  const ref = doc(db, "news", currentGrade);

  onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      const items = data.items || [];

      if (!items.length) {
        box.innerHTML = `<p class="empty-msg">אין עדיין חדשות לשכבה זו.</p>`;
        return;
      }

      const list = items.slice().reverse();

      box.innerHTML = list
        .map((n) => {
          const title = escapeHtml(n.title || "");
          const meta = escapeHtml(n.meta || "");
          const body = escapeHtml(n.body || "");
          const img = n.imageUrl ? String(n.imageUrl) : "";
          const colorStyle = n.color
            ? ` style="color:${escapeHtml(n.color)}"`
            : "";

          if (img) {
            return `
              <div class="home-news-item home-news-item-with-image">
                <div class="home-news-image-wrap">
                  <img src="${escapeHtml(img)}" alt="תמונה לחדשות" loading="lazy">
                </div>
                <div class="home-news-text"${colorStyle}>
                  <div class="home-news-title">${title}</div>
                  ${meta ? `<div class="home-news-meta">${meta}</div>` : ""}
                  <div class="home-news-body">${body}</div>
                </div>
              </div>
            `;
          }

          return `
            <div class="home-news-item"${colorStyle}>
              <div class="home-news-title">${title}</div>
              ${meta ? `<div class="home-news-meta">${meta}</div>` : ""}
              <div class="home-news-body">${body}</div>
            </div>
          `;
        })
        .join("");
    },
    (err) => {
      console.error("Error subscribing to grade news", err);
      box.innerHTML = `<p class="empty-msg">שגיאה בטעינת החדשות.</p>`;
    }
  );
}

/* ------------ מבחנים בדפי שכבות (z/h/t) – Realtime ------------ */

function subscribeGradeExams() {
  if (!currentGrade) return;
  const box = document.getElementById("grade-exams");
  if (!box) return;

  const ref = doc(db, "exams", currentGrade);

  onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      const items = data.items || [];

      if (!items.length) {
        box.innerHTML = `<p class="empty-msg">אין מבחנים לשכבה זו.</p>`;
        return;
      }

      const list = items.slice().reverse();

      box.innerHTML = list
        .map((ex) => {
          const subject = escapeHtml(ex.subject || "");
          const date = escapeHtml(ex.date || "");
          const topic = escapeHtml(ex.topic || "");

          return `
            <div class="home-exam-item">
              <div class="home-exam-top">
                <span class="home-exam-subject">${subject}</span>
                <span class="home-exam-date">${date}</span>
              </div>
              <div class="home-exam-topic">${topic}</div>
            </div>
          `;
        })
        .join("");
    },
    (err) => {
      console.error("Error subscribing to grade exams", err);
      box.innerHTML = `<p class="empty-msg">שגיאה בטעינת המבחנים.</p>`;
    }
  );
}

/* ------------ לוח מודעות – דף בית + דפי שכבות – Realtime ------------ */

function subscribeBoard() {
  const homeBoard = document.getElementById("home-board");
  const gradeBoard = document.getElementById("board-list");

  if (!homeBoard && !gradeBoard) return;

  const ref = doc(db, "board", "general");

  onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      const items = data.items || [];

      if (homeBoard) renderBoardList(homeBoard, items);
      if (gradeBoard) renderBoardList(gradeBoard, items);
    },
    (err) => {
      console.error("Error subscribing to board", err);
      if (homeBoard) {
        homeBoard.innerHTML = `<p class="empty-msg">שגיאה בטעינת לוח המודעות.</p>`;
      }
      if (gradeBoard) {
        gradeBoard.innerHTML = `<p class="empty-msg">שגיאה בטעינת לוח המודעות.</p>`;
      }
    }
  );
}

function renderBoardList(container, items) {
  if (!items.length) {
    container.innerHTML = `<p class="empty-msg">אין מודעות כרגע.</p>`;
    return;
  }

  const list = items.slice().reverse();

  container.innerHTML = list
    .map((b) => {
      const title = escapeHtml(b.title || "");
      const meta = escapeHtml(b.meta || "");
      const body = escapeHtml(b.body || "");
      const colorStyle = b.color ? ` style="color:${escapeHtml(b.color)}"` : "";
      const imgHtml = b.imageUrl
        ? `
          <div class="board-item-image">
            <img src="${escapeHtml(b.imageUrl)}" alt="${title}">
          </div>
        `
        : "";

      return `
        <div class="board-item"${colorStyle}>
          <div class="board-item-title">${title}</div>
          ${meta ? `<div class="board-item-meta">${meta}</div>` : ""}
          <div class="board-item-body">${body}</div>
          ${imgHtml}
        </div>
      `;
    })
    .join("");
}

/* ------------ תוכן כללי: אודות, יצירת קשר, תיאור שכבות – Realtime ------------ */

function subscribeSiteContent() {
  const ref = doc(db, "siteContent", "main");

  onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};

      // HERO
      const heroTitleHeader = document.getElementById("home-hero-title");
      const heroSubHeader = document.getElementById("home-hero-subtitle");
      if (heroTitleHeader && data.homeHeroTitle)
        heroTitleHeader.textContent = data.homeHeroTitle;
      if (heroSubHeader && data.homeHeroSubtitle)
        heroSubHeader.textContent = data.homeHeroSubtitle;

      // ABOUT
      const aboutTitleEl = document.getElementById("about-title");
      const aboutTextEl = document.getElementById("about-text");
      if (aboutTitleEl && data.aboutTitle)
        aboutTitleEl.textContent = data.aboutTitle;
      if (aboutTextEl && data.aboutBody)
        aboutTextEl.textContent = data.aboutBody;

      // IMPORTANT SECTION
      const impTitleEl = document.getElementById("important-title");
      const impSubEl = document.getElementById("important-subtitle");
      if (impTitleEl && data.importantTitle)
        impTitleEl.textContent = data.importantTitle;
      if (impSubEl && data.importantSubtitle)
        impSubEl.textContent = data.importantSubtitle;

      const c1Title = document.getElementById("important-card-1-title");
      const c1Body = document.getElementById("important-card-1-body");
      const c2Title = document.getElementById("important-card-2-title");
      const c2Body = document.getElementById("important-card-2-body");
      const c3Title = document.getElementById("important-card-3-title");
      const c3Body = document.getElementById("important-card-3-body");

      if (c1Title && data.importantCard1Title)
        c1Title.textContent = data.importantCard1Title;
      if (c1Body && data.importantCard1Body)
        c1Body.textContent = data.importantCard1Body;
      if (c2Title && data.importantCard2Title)
        c2Title.textContent = data.importantCard2Title;
      if (c2Body && data.importantCard2Body)
        c2Body.textContent = data.importantCard2Body;
      if (c3Title && data.importantCard3Title)
        c3Title.textContent = data.importantCard3Title;
      if (c3Body && data.importantCard3Body)
        c3Body.textContent = data.importantCard3Body;

      // GRADES SECTION
      const gradesTitle = document.getElementById("grades-section-title");
      const gradesSub = document.getElementById("grades-section-subtitle");
      if (gradesTitle && data.gradesSectionTitle)
        gradesTitle.textContent = data.gradesSectionTitle;
      if (gradesSub && data.gradesSectionSubtitle)
        gradesSub.textContent = data.gradesSectionSubtitle;

      const zDesc = document.getElementById("grade-z-text");
      const hDesc = document.getElementById("grade-h-text");
      const tDesc = document.getElementById("grade-t-text");
      if (zDesc && data.zDescription) zDesc.textContent = data.zDescription;
      if (hDesc && data.hDescription) hDesc.textContent = data.hDescription;
      if (tDesc && data.tDescription) tDesc.textContent = data.tDescription;

      // REQUESTS
      const reqTitle = document.getElementById("requests-title");
      const reqSub = document.getElementById("requests-subtitle");
      const reqBody = document.getElementById("requests-body");
      if (reqTitle && data.requestsTitle)
        reqTitle.textContent = data.requestsTitle;
      if (reqSub && data.requestsSubtitle)
        reqSub.textContent = data.requestsSubtitle;
      if (reqBody && data.requestsBody)
        reqBody.textContent = data.requestsBody;

      // CONTACT
      const contactTitle = document.getElementById("contact-section-title");
      const contactSub = document.getElementById("contact-section-subtitle");
      const phoneEl = document.getElementById("contact-phone");
      const emailEl = document.getElementById("contact-email");
      const addrEl = document.getElementById("contact-address");

      if (contactTitle && data.contactSectionTitle)
        contactTitle.textContent = data.contactSectionTitle;
      if (contactSub && data.contactSectionSubtitle)
        contactSub.textContent = data.contactSectionSubtitle;
      if (phoneEl && data.contactPhone)
        phoneEl.textContent = data.contactPhone;
      if (emailEl && data.contactEmail)
        emailEl.textContent = data.contactEmail;
      if (addrEl && data.contactAddress)
        addrEl.textContent = data.contactAddress;

      // FOOTER
      const footerEl = document.getElementById("footer-text");
      if (footerEl && data.footerText) footerEl.textContent = data.footerText;
    },
    (err) => {
      console.error("Error subscribing to site content", err);
    }
  );
}

/* ------------ שנה בפוטר בדפי שכבות ------------ */

function setYear() {
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear().toString();
  }
}

/* ------------ כפתור חזרה לראש הדף בדפי שכבות ------------ */

function setupToTop() {
  const btn = document.getElementById("to-top");
  if (!btn) return;

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  btn.style.transition = "opacity 0.2s";
  window.addEventListener("scroll", () => {
    if (window.scrollY > 200) {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    } else {
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
    }
  });
}

/* ------------ תפריט מובייל (המבורגר) ------------ */

function setupMobileNav() {
  const navToggle = document.querySelector(".nav-toggle");
  const navRight = document.querySelector(".nav-right");

  if (!navToggle || !navRight) return;

  navToggle.addEventListener("click", () => {
    const isOpen = navRight.classList.toggle("open");
    navToggle.classList.toggle("open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.body.classList.toggle("nav-open", isOpen);
  });

  // סגירה אוטומטית כשבוחרים קישור
  navRight.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navRight.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    });
  });
}

/* ------------ INIT ------------ */

document.addEventListener("DOMContentLoaded", () => {
  // טקסטים כלליים (Hero, אודות, יצירת קשר, פוטר)
  subscribeSiteContent();

  // דף הבית – חדשות + מבחנים
  subscribeHomeNews();
  subscribeHomeExams();

  // דפי שכבות – חדשות + מבחנים
  subscribeGradeNews();
  subscribeGradeExams();

  // לוח מודעות – גם בית, גם שכבות
  subscribeBoard();

  // שנה בפוטר וכפתור לראש הדף
  setYear();
  setupToTop();

  // תפריט מובייל
  try {
    setupMobileNav();
  } catch (e) {
    console.error("Mobile nav error:", e);
  }
});
