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

/* ------------ עזר למבחנים + ספירה לאחור ------------ */

// מזהה אינטרוואל גלובלי כדי שלא יווצרו מיליון אינטרוואלים
let examCountdownIntervalId = null;

// ממיר מחרוזת תאריך של המבחן לאובייקט Date
// תומך ב: "2025-12-31" או "2025-12-31 08:30"
function parseExamDateToDateObj(dateStr) {
  if (!dateStr) return null;
  let s = String(dateStr).trim();
  if (!s) return null;

  // ✔ פורמט ישראלי: DD/MM/YYYY או DD/MM/YY
  const matchIL = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (matchIL) {
    let day = Number(matchIL[1]);
    let month = Number(matchIL[2]);
    let year = Number(matchIL[3]);

    // המרה של שנתיים לשנה מלאה
    if (year < 100) {
      year = 2000 + year; // 22 → 2022
    }

    return new Date(year, month - 1, day, 8, 0); 
  }

  // ✔ פורמט רגיל: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 8, 0);
  }

  // ✔ תאריך + שעה: YYYY-MM-DD HH:MM
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    return new Date(y, mo - 1, d, hh, mm);
  }

  // ✔ ניסיון אחרון
  const dObj = new Date(s);
  return isNaN(dObj.getTime()) ? null : dObj;
}


// פורמט נחמד לתאריך: DD.MM.YYYY
function formatLocalDate(d) {
  try {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return "";
  }
}

// מעדכן את כל האלמנטים עם data-exam-timestamp
function updateExamCountdownElements() {
  const els = document.querySelectorAll("[data-exam-timestamp]");
  if (!els.length) return;

  const now = Date.now();

  els.forEach((el) => {
    const ts = Number(el.dataset.examTimestamp);
    if (!ts || Number.isNaN(ts)) {
      el.textContent = "";
      return;
    }

    const diff = ts - now;

    if (diff <= 0) {
      el.textContent = "המבחן כבר היה או מתקיים עכשיו";
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];

    if (days > 0) parts.push(`${days} ימים`);
    if (hours > 0) parts.push(`${hours} שעות`);
    if (minutes > 0) parts.push(`${minutes} דקות`);

    parts.push(`${seconds} שניות`);

    el.textContent = `ספירה לאחור: ${parts.join(" · ")}`;
  });
}



// מפעיל אינטרוואל אחד גלובלי
function startExamCountdownLoop() {
  if (examCountdownIntervalId) return;
  examCountdownIntervalId = setInterval(updateExamCountdownElements, 1000);
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

/* ------------ RENDER HOME EXAMS (עם מבחן הבא + מבחנים שהיו + ספירה לאחור) ------------ */

function renderHomeExams() {
  GRADES.forEach((g) => {
    const listEl = document.getElementById(`home-exams-${g}`);
    if (!listEl) return;

    const items = homeExams[g] || [];
    if (!items.length) {
      listEl.innerHTML = `
        <div class="exam-card empty">
          אין מבחנים קרובים לשכבה זו.
        </div>`;
      return;
    }

    listEl.innerHTML = items
      .map((ex) => {
        const dateStr = escapeHtml(ex.date);
        const subject = escapeHtml(ex.subject);
        const topic = escapeHtml(ex.topic || "");
        const countdownSpan = ex.timestamp
          ? `<div class="exam-countdown" data-exam-timestamp="${ex.timestamp}"></div>`
          : "";

        return `
          <div class="exam-card">
            <div class="exam-card-top">
              <div class="exam-date">${dateStr}</div>
              <div class="exam-subject">${subject}</div>
            </div>

            ${
              topic
                ? `<div class="exam-topic">נושא: ${topic}</div>`
                : ""
            }

            ${countdownSpan}
          </div>
        `;
      })
      .join("");

    startExamCountdownLoop();
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
    .map((ex) => {
      const dObj = parseExamDateToDateObj(ex.date);
      const dateLabel = dObj ? formatLocalDate(dObj) : ex.date || "";

      return `
        <article class="home-exam-item">
          <div class="home-exam-top">
            <span class="home-exam-date">${escapeHtml(dateLabel)}</span>
            <span class="home-exam-subject">${escapeHtml(ex.subject)}</span>
          </div>
          ${
            ex.topic
              ? `<div class="home-exam-topic">${escapeHtml(ex.topic)}</div>`
              : ""
          }
        </article>
      `;
    })
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
    await loadHomeDataOnce();

    renderGradeNews(grade);
    renderGradeExams(grade);
    renderGradeBoard();

    initTheme();
    setupMobileNav();
    setupScrollToTop();
    startExamCountdownLoop();
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
  const bodyEl = document.getElementById("about-text"); // האינדקס שלך

  if (!titleEl || !bodyEl) return;

  try {
    const snap = await getDoc(doc(db, "siteContent", "main"));
    if (!snap.exists()) return;

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
  setHtml("about-text", siteContent.aboutBody || siteContent.aboutText);

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

  // סוגר תפריט אחרי לחיצה על לינק
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
  const grade = document.body.dataset.grade;

  // אם יש data-grade → דף שכבה (z / h / t)
  if (grade) {
    loadGradePage(grade);
    return;
  }

  // אחרת – זה דף הבית
  loadHomeDataOnce();
  subscribeRealtimeHome();
  loadSiteContentForHome();
  loadAboutSectionFromSiteContent();
  initTheme();
  setupMobileNav();
  setupScrollToTop();
});

