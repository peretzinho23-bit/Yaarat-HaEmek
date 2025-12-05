// app.js – אתר יערת העמק

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ------------ CONSTS ------------ */

const GRADES = ["z", "h", "t"];

/* ------------ STATE ------------ */

let homeNews = { z: [], h: [], t: [] };
let homeExams = { z: [], h: [], t: [] };
let boardData = [];
let siteContent = {};

/* ------------ HELPERS ------------ */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ------------ LOAD HOME DATA (ONE SHOT) ------------ */

async function loadHomeDataOnce() {
  try {
    // NEWS
    for (const g of GRADES) {
      const snap = await getDoc(doc(db, "news", g));
      const data = snap.exists() ? snap.data() : { items: [] };
      homeNews[g] = data.items || [];
    }

    // EXAMS
    for (const g of GRADES) {
      const snap = await getDoc(doc(db, "exams", g));
      const data = snap.exists() ? snap.data() : { items: [] };
      homeExams[g] = data.items || [];
    }

    // BOARD
    const boardSnap = await getDoc(doc(db, "board", "general"));
    const b = boardSnap.exists() ? boardSnap.data() : { items: [] };
    boardData = b.items || [];

    renderHomeNews();
    renderHomeExams();
    renderHomeBoard();
  } catch (err) {
    console.error("שגיאה בטעינת הדף הראשי:", err);
  }
}

// לייב (לא חובה אבל נחמד)
function subscribeRealtimeHome() {
  // NEWS
  for (const g of GRADES) {
    onSnapshot(doc(db, "news", g), (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      homeNews[g] = data.items || [];
      renderHomeNews();
    });
  }

  // EXAMS
  for (const g of GRADES) {
    onSnapshot(doc(db, "exams", g), (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      homeExams[g] = data.items || [];
      renderHomeExams();
    });
  }

  // BOARD
  onSnapshot(doc(db, "board", "general"), (snap) => {
    const data = snap.exists() ? snap.data() : { items: [] };
    boardData = data.items || [];
    renderHomeBoard();
  });
}

/* ------------ RENDER HOME NEWS (לדף הבית) ------------ */

function renderHomeNews() {
  GRADES.forEach((g) => {
    const listEl = document.getElementById(`home-news-${g}`);
    if (!listEl) return;

    const items = homeNews[g] || [];
    if (!items.length) {
      listEl.innerHTML = `<p class="empty-msg">אין חדשות בשכבה זו כרגע.</p>`;
      return;
    }

    listEl.innerHTML = items
      .map((n) => {
        const colorStyle = n.color
          ? ` style="color:${escapeHtml(n.color)}"`
          : "";
        const hasImage = !!n.imageUrl;

        if (hasImage) {
          return `
            <article class="home-news-item home-news-item-with-image"${colorStyle}>
              <div class="home-news-image-wrap">
                <img src="${escapeHtml(n.imageUrl)}" alt="${escapeHtml(
                  n.title || ""
                )}" />
              </div>
              <div class="home-news-text">
                <h4 class="home-news-title">${escapeHtml(n.title)}</h4>
                ${
                  n.meta
                    ? `<div class="home-news-meta">${escapeHtml(n.meta)}</div>`
                    : ""
                }
                <div class="home-news-body">${escapeHtml(n.body)}</div>
              </div>
            </article>
          `;
        }

        return `
          <article class="home-news-item"${colorStyle}>
            <h4 class="home-news-title">${escapeHtml(n.title)}</h4>
            ${
              n.meta
                ? `<div class="home-news-meta">${escapeHtml(n.meta)}</div>`
                : ""
            }
            <div class="home-news-body">${escapeHtml(n.body)}</div>
          </article>
        `;
      })
      .join("");
  });
}

/* ------------ RENDER HOME EXAMS ------------ */

function renderHomeExams() {
  GRADES.forEach((g) => {
    const listEl = document.getElementById(`home-exams-${g}`);
    if (!listEl) return;

    const items = homeExams[g] || [];
    if (!items.length) {
      listEl.innerHTML = `<p class="empty-msg">אין מבחנים קרובים לשכבה זו.</p>`;
      return;
    }

    listEl.innerHTML = items
      .map(
        (ex) => `
        <article class="home-exam-item">
          <div class="home-exam-top">
            <span class="home-exam-date">${escapeHtml(ex.date)}</span>
            <span class="home-exam-subject">${escapeHtml(ex.subject)}</span>
          </div>
          ${
            ex.topic
              ? `<div class="home-exam-topic">${escapeHtml(ex.topic)}</div>`
              : ""
          }
        </article>
      `
      )
      .join("");
  });
}

/* ------------ RENDER HOME BOARD ------------ */

function renderHomeBoard() {
  const listEl = document.getElementById("home-board");
  if (!listEl) return;

  if (!boardData.length) {
    listEl.innerHTML = `<p class="empty-msg">אין מודעות כרגע.</p>`;
    return;
  }

  listEl.innerHTML = boardData
    .map((b) => {
      const colorStyle = b.color ? ` style="color:${escapeHtml(b.color)}"` : "";
      const imgHtml = b.imageUrl
        ? `
          <div class="board-item-image">
            <img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(
            b.title || ""
          )}">
          </div>
        `
        : "";

      return `
        <article class="board-item"${colorStyle}>
          <div class="board-item-title">${escapeHtml(b.title)}</div>
          ${
            b.meta
              ? `<div class="board-item-meta">${escapeHtml(b.meta)}</div>`
              : ""
          }
          <div class="board-item-body">${escapeHtml(b.body)}</div>
          ${imgHtml}
        </article>
      `;
    })
    .join("");
}

/* ------------ GRADE PAGES (NEWS / EXAMS / BOARD) ------------ */

function renderGradeNews(grade) {
  const listEl = document.getElementById("grade-news");
  if (!listEl) return;

  const items = homeNews[grade] || [];
  if (!items.length) {
    listEl.innerHTML = `<p class="empty-msg">אין חדשות בשכבה זו כרגע.</p>`;
    return;
  }

  // שים לב: כאן אנחנו משתמשים באותם classes כמו בדף הבית,
  // וה-CSS כבר דואג שב-body[data-grade] זה יהיה גדול ורחב.
  listEl.innerHTML = items
    .map((n) => {
      const hasImage = !!n.imageUrl;
      const colorStyle = n.color ? ` style="color:${escapeHtml(n.color)}"` : "";

      if (hasImage) {
        return `
          <article class="home-news-item home-news-item-with-image"${colorStyle}>
            <div class="home-news-image-wrap">
              <img src="${escapeHtml(n.imageUrl)}" alt="${escapeHtml(
          n.title || ""
        )}" />
            </div>
            <div class="home-news-text">
              <h4 class="home-news-title">${escapeHtml(n.title)}</h4>
              ${
                n.meta
                  ? `<div class="home-news-meta">${escapeHtml(n.meta)}</div>`
                  : ""
              }
              <div class="home-news-body">${escapeHtml(n.body)}</div>
            </div>
          </article>
        `;
      }

      return `
        <article class="home-news-item"${colorStyle}>
          <h4 class="home-news-title">${escapeHtml(n.title)}</h4>
          ${
            n.meta
              ? `<div class="home-news-meta">${escapeHtml(n.meta)}</div>`
              : ""
          }
          <div class="home-news-body">${escapeHtml(n.body)}</div>
        </article>
      `;
    })
    .join("");
}

function renderGradeExams(grade) {
  const listEl = document.getElementById("grade-exams");
  if (!listEl) return;

  const items = homeExams[grade] || [];
  if (!items.length) {
    listEl.innerHTML = `<p class="empty-msg">אין מבחנים קרובים לשכבה זו.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map(
      (ex) => `
      <article class="home-exam-item">
        <div class="home-exam-top">
          <span class="home-exam-date">${escapeHtml(ex.date)}</span>
          <span class="home-exam-subject">${escapeHtml(ex.subject)}</span>
        </div>
        ${
          ex.topic
            ? `<div class="home-exam-topic">${escapeHtml(ex.topic)}</div>`
            : ""
        }
      </article>
    `
    )
    .join("");
}

function renderGradeBoard() {
  const listEl = document.getElementById("board-list");
  if (!listEl) return;

  if (!boardData.length) {
    listEl.innerHTML = `<p class="empty-msg">אין מודעות כרגע.</p>`;
    return;
  }

  listEl.innerHTML = boardData
    .map((b) => {
      const colorStyle = b.color ? ` style="color:${escapeHtml(b.color)}"` : "";
      const imgHtml = b.imageUrl
        ? `
        <div class="board-item-image">
          <img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(
          b.title || ""
        )}">
        </div>
      `
        : "";

      return `
        <article class="board-item"${colorStyle}>
          <div class="board-item-title">${escapeHtml(b.title)}</div>
          ${
            b.meta
              ? `<div class="board-item-meta">${escapeHtml(b.meta)}</div>`
              : ""
          }
          <div class="board-item-body">${escapeHtml(b.body)}</div>
          ${imgHtml}
        </article>
      `;
    })
    .join("");
}

async function loadGradePage(grade) {
  try {
    // נטען את כל הדאטה (אותו מודל כמו הבית)
    await loadHomeDataOnce();

    // נרנדר לדף שכבה
    renderGradeNews(grade);
    renderGradeExams(grade);
    renderGradeBoard();

    initTheme();
    setupMobileNav();
    setupScrollToTop();
  } catch (err) {
    console.error("שגיאה בטעינת דף שכבה:", err);
  }
}

/* ------------ SITE CONTENT (HOME TEXTS) ------------ */

async function loadSiteContentForHome() {
  try {
    const snap = await getDoc(doc(db, "siteContent", "main"));
    siteContent = snap.exists() ? snap.data() : {};

    applySiteContentToDom();
  } catch (err) {
    console.error("שגיאה בטעינת תוכן האתר:", err);
  }
}

// טעינת טקסט האודות מהמסמך siteContent/main
async function loadAboutSectionFromSiteContent() {
  const titleEl = document.getElementById("about-title");
  const bodyEl = document.getElementById("about-body");

  // אם זה לא דף הבית – לא עושים כלום
  if (!titleEl || !bodyEl) return;

  try {
    const snap = await getDoc(doc(db, "siteContent", "main"));
    if (!snap.exists()) {
      return; // אין מסמך עדיין – נשאר טקסט ברירת מחדל
    }

    const data = snap.data() || {};

    if (data.aboutTitle && data.aboutTitle.trim()) {
      titleEl.textContent = data.aboutTitle.trim();
    }

    if (data.aboutBody && data.aboutBody.trim()) {
      bodyEl.textContent = data.aboutBody.trim();
    }
  } catch (err) {
    console.error("Error loading about section:", err);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.textContent = value;
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.innerHTML = value;
}

function setImageSrc(id, url, alt) {
  const img = document.getElementById(id);
  if (!img || !url) return;
  img.src = url;
  if (alt) img.alt = alt;
}

function applySiteContentToDom() {
  if (!siteContent) return;

  // HERO (כותרת למעלה ליד הלוגו)
  setText("home-hero-title", siteContent.homeHeroTitle);
  setText("home-hero-subtitle", siteContent.homeHeroSubtitle);

  // ABOUT – אודות בית הספר
  setText("about-title", siteContent.aboutTitle);
  setHtml("about-body", siteContent.aboutBody);

  // IMPORTANT SECTION – "חשוב לדעת"
  setText("important-title", siteContent.importantTitle);
  setText("important-subtitle", siteContent.importantSubtitle);
  setText("important-card-1-title", siteContent.importantCard1Title);
  setHtml("important-card-1-body", siteContent.importantCard1Body);
  setText("important-card-2-title", siteContent.importantCard2Title);
  setHtml("important-card-2-body", siteContent.importantCard2Body);
  setText("important-card-3-title", siteContent.importantCard3Title);
  setHtml("important-card-3-body", siteContent.importantCard3Body);

  // GRADES SECTION – טקסט על השכבות
  setText("grades-section-title", siteContent.gradesSectionTitle);
  setText("grades-section-subtitle", siteContent.gradesSectionSubtitle);
  setHtml("grade-z-text", siteContent.zDescription);
  setHtml("grade-h-text", siteContent.hDescription);
  setHtml("grade-t-text", siteContent.tDescription);

  // REQUESTS – תיבת בקשות
  setText("requests-title", siteContent.requestsTitle);
  setText("requests-subtitle", siteContent.requestsSubtitle);
  setHtml("requests-body", siteContent.requestsBody);

  // CONTACT
  setText("contact-section-title", siteContent.contactSectionTitle);
  setText("contact-section-subtitle", siteContent.contactSectionSubtitle);
  setText("contact-phone", siteContent.contactPhone);
  setText("contact-email", siteContent.contactEmail);
  setText("contact-address", siteContent.contactAddress);

  // FOOTER
  setText("footer-text", siteContent.footerText);

  // IMAGES (אם קיים id כזה ב־HTML)
  setImageSrc("logo-img", siteContent.logoUrl, "לוגו יערת העמק");
  setImageSrc("hero-image", siteContent.heroImageUrl, "בית הספר יערת העמק");
}


/* ------------ THEME TOGGLE ------------ */

const THEME_KEY = "yaarat-theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);

  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  btn.textContent = saved === "dark" ? "☀️" : "🌙";

  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
    btn.textContent = next === "dark" ? "☀️" : "🌙";
  });
}

/* ------------ NAV (MOBILE) ------------ */

function setupMobileNav() {
  const navToggle = document.querySelector(".nav-toggle");
  const navRight = document.querySelector(".nav-right");

  // ✨ מוסיפים לפני ה-if — ככה רצית
  if (navRight) {
    navRight.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navRight.classList.remove("open");
        navToggle?.classList.remove("open");
        navToggle?.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      });
    });
  }

  // אם אין תפריט או כפתור – יוצאים
  if (!navToggle || !navRight) return;

  function applyNavVisibility() {
    if (window.innerWidth > 900) {
      navRight.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    }
  }

  applyNavVisibility();
  window.addEventListener("resize", applyNavVisibility);

  navToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = navRight.classList.toggle("open");
    navToggle.classList.toggle("open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.body.classList.toggle("nav-open", isOpen);
  });

  document.addEventListener("click", (e) => {
    if (!navRight.contains(e.target) && !navToggle.contains(e.target)) {
      navRight.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    }
  });
}


/* ------------ SCROLL TO TOP ------------ */

function setupScrollToTop() {
  const btn = document.getElementById("to-top");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    } else {
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
    }
  });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ------------ INIT ------------ */

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const grade = document.body.dataset.grade;

  if (page === "home") {
    // דף הבית
    loadHomeDataOnce();
    subscribeRealtimeHome();
    loadSiteContentForHome();
    loadAboutSectionFromSiteContent();
    initTheme();
    setupMobileNav();
    setupScrollToTop();
  } else if (grade) {
    // דף שכבה (z / h / t)
    loadGradePage(grade);
  }
});
