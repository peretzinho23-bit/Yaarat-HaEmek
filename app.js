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

/* ------------ LOAD HOME DATA (NEWS / EXAMS / BOARD) ------------ */

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

// אם אתה רוצה לייב: אפשר להפעיל גם onSnapshot
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

/* ------------ RENDER HOME NEWS ------------ */

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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "";
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value || "";
}

function setImageSrc(id, url, fallbackAlt) {
  const el = document.getElementById(id);
  if (el && url) {
    el.src = url;
    if (fallbackAlt) el.alt = fallbackAlt;
  }
}

function applySiteContentToDom() {
  if (!siteContent) return;

  // HERO
  setText("home-hero-title", siteContent.homeHeroTitle);
  setText("home-hero-subtitle", siteContent.homeHeroSubtitle);

  // ABOUT
  setText("about-title", siteContent.aboutTitle);
  setHtml("about-body", siteContent.aboutBody);

  // IMPORTANT
  setText("important-title", siteContent.importantTitle);
  setText("important-subtitle", siteContent.importantSubtitle);
  setText("important-card1-title", siteContent.importantCard1Title);
  setHtml("important-card1-body", siteContent.importantCard1Body);
  setText("important-card2-title", siteContent.importantCard2Title);
  setHtml("important-card2-body", siteContent.importantCard2Body);
  setText("important-card3-title", siteContent.importantCard3Title);
  setHtml("important-card3-body", siteContent.importantCard3Body);

  // GRADES SECTION
  setText("grades-section-title", siteContent.gradesSectionTitle);
  setText("grades-section-subtitle", siteContent.gradesSectionSubtitle);
  setHtml("z-description", siteContent.zDescription);
  setHtml("h-description", siteContent.hDescription);
  setHtml("t-description", siteContent.tDescription);

  // REQUESTS
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

  // IMAGES
  setImageSrc("logo-img", siteContent.logoUrl, "לוגו יערת העמק");
  setImageSrc("hero-image", siteContent.heroImageUrl, "בית הספר יערת העמק");
}

/* ------------ THEME TOGGLE ------------ */

const THEME_KEY = "yaarat-theme";

function applyTheme(theme) {
  const html = document.documentElement;
  const body = document.body;
  const toggle = document.getElementById("theme-toggle");

  if (!toggle) return;

  if (theme === "light") {
    html.setAttribute("data-theme", "light");
    body.classList.add("theme-light");
    toggle.innerText = "☀️";
  } else {
    html.removeAttribute("data-theme");
    body.classList.remove("theme-light");
    toggle.innerText = "🌙";
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const systemPrefersLight =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;

  const initialTheme = stored || (systemPrefersLight ? "light" : "dark");
  applyTheme(initialTheme);

  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";
    const next = current === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

/* ------------ MOBILE NAV (המבורגר) ------------ */

function setupMobileNav() {
  const navToggle = document.querySelector(".nav-toggle");
  const navRight = document.querySelector(".nav-right");

  if (!navToggle || !navRight) return;

  // דואג שהכפתור יופיע תמיד במובייל גם אם ה-CSS עושה display:none
  function applyNavVisibility() {
    if (window.innerWidth <= 768) {
      navToggle.style.display = "flex";
    } else {
      navToggle.style.display = "";
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

  navRight.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navRight.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    });
  });

  document.addEventListener("click", (e) => {
    if (!navRight.classList.contains("open")) return;
    if (navRight.contains(e.target) || navToggle.contains(e.target)) return;
    navRight.classList.remove("open");
    navToggle.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
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
  // דף הבית
  if (document.body.dataset.page === "home") {
    loadHomeDataOnce();
    subscribeRealtimeHome();
    loadSiteContentForHome();
    initTheme();
    setupMobileNav();
    setupScrollToTop();
  }
});
