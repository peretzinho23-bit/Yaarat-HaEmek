// admin.js – לוח ניהול יערת העמק

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const GRADES = ["z", "h", "t"];

let newsData = { z: [], h: [], t: [] };
let examsData = { z: [], h: [], t: [] };
let boardData = [];
let siteContent = {};

/* ------------ helpers ------------ */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function getDocSafe(pathArr, def) {
  const refDoc = doc(db, ...pathArr);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return def;
  return snap.data() || def;
}

/* ------------ auth ------------ */

function initAuth() {
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const loginSection = document.getElementById("login-section");
  const adminSection = document.getElementById("admin-section");
  const statusEl = document.getElementById("auth-status");

  if (!loginForm || !logoutBtn || !loginSection || !adminSection || !statusEl) {
    console.error("auth elements missing in admin.html");
    return;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      statusEl.textContent = "מתחבר...";
    } catch (err) {
      console.error(err);
      alert("כניסה נכשלה: " + (err.message || err.code));
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      statusEl.textContent = "מחובר כ: " + (user.email || "");
      loginSection.style.display = "none";
      adminSection.style.display = "block";
      loadAllData();
    } else {
      statusEl.textContent = "לא מחובר";
      loginSection.style.display = "block";
      adminSection.style.display = "none";
    }
  });
}

/* ------------ load everything ------------ */

async function loadAllData() {
  // חדשות
  for (const g of GRADES) {
    const res = await getDocSafe(["news", g], { items: [] });
    newsData[g] = res.items || [];
  }
  renderNewsAdmin();

  // מבחנים
  for (const g of GRADES) {
    const res = await getDocSafe(["exams", g], { items: [] });
    examsData[g] = res.items || [];
  }
  renderExamsAdmin();

  // לוח מודעות
  const b = await getDocSafe(["board", "general"], { items: [] });
  boardData = b.items || [];
  renderBoardAdmin();

  // תוכן אתר
  await loadSiteContent();
}

/* ------------ NEWS ------------ */

function renderNewsAdmin() {
  for (const g of GRADES) {
    const listEl = document.getElementById(`admin-news-${g}`);
    if (!listEl) continue;

    const items = newsData[g];
    if (!items.length) {
      listEl.innerHTML = `<p class="empty-msg">אין חדשות.</p>`;
      continue;
    }

    listEl.innerHTML = items
      .map((n, i) => {
        const imgHtml = n.imageUrl
          ? `<div style="margin-top:6px;">
               <img src="${escapeHtml(n.imageUrl)}"
                    style="max-width:100%;border-radius:8px;border:1px solid #1e293b;">
             </div>`
          : "";

        const colorStyle = n.color
          ? ` style="color:${escapeHtml(n.color)};"`
          : "";

        return `
          <div class="admin-item"${colorStyle}>
            <div class="admin-item-main">
              <strong>${escapeHtml(n.title)}</strong>
              <span class="admin-item-meta">${escapeHtml(n.meta || "")}</span>
            </div>
            <div class="admin-item-body">${escapeHtml(n.body)}</div>
            ${imgHtml}
            <button class="admin-remove" data-type="news" data-grade="${g}" data-index="${i}">
              מחיקה
            </button>
          </div>
        `;
      })
      .join("");
  }
}

async function saveNewsGrade(grade) {
  const refDoc = doc(db, "news", grade);
  await setDoc(refDoc, { items: newsData[grade] });
}

function setupNewsForms() {
  for (const g of GRADES) {
    const form = document.getElementById(`news-form-${g}`);
    if (!form) continue;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = form.title.value.trim();
      const meta = form.meta.value.trim();
      const body = form.body.value.trim();
      const imageUrl = (form.imageUrl && form.imageUrl.value.trim()) || "";
      const color =
        (form.color && form.color.value && form.color.value.trim()) ||
        "#ffffff";

      if (!title || !body) {
        alert("חובה למלא לפחות כותרת ותוכן.");
        return;
      }

      newsData[g].push({ title, meta, body, imageUrl, color });
      form.reset();
      renderNewsAdmin();
      await saveNewsGrade(g);
      alert("הידיעה נשמרה.");
    });
  }
}

/* ------------ EXAMS ------------ */

function renderExamsAdmin() {
  for (const g of GRADES) {
    const listEl = document.getElementById(`admin-exams-${g}`);
    if (!listEl) continue;

    const items = examsData[g];
    if (!items.length) {
      listEl.innerHTML = `<p class="empty-msg">אין מבחנים.</p>`;
      continue;
    }

    listEl.innerHTML = items
      .map(
        (ex, i) => `
        <div class="admin-item">
          <div class="admin-item-main">
            <strong>${escapeHtml(ex.subject)}</strong>
            <span class="admin-item-meta">${escapeHtml(ex.date || "")}</span>
          </div>
          <div class="admin-item-body">${escapeHtml(ex.topic || "")}</div>
          <button class="admin-remove" data-type="exam" data-grade="${g}" data-index="${i}">
            מחיקה
          </button>
        </div>
      `
      )
      .join("");
  }
}

async function saveExamsGrade(grade) {
  const refDoc = doc(db, "exams", grade);
  await setDoc(refDoc, { items: examsData[grade] });
}

function setupExamForms() {
  for (const g of GRADES) {
    const form = document.getElementById(`exams-form-${g}`);
    if (!form) continue;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const date = form.date.value.trim();
      const subject = form.subject.value.trim();
      const topic = form.topic.value.trim();

      if (!date || !subject) {
        alert("חובה למלא תאריך ומקצוע.");
        return;
      }

      examsData[g].push({ date, subject, topic });
      form.reset();
      renderExamsAdmin();
      await saveExamsGrade(g);
      alert("המבחן נשמר.");
    });
  }
}

/* ------------ BOARD ------------ */

function renderBoardAdmin() {
  const listEl = document.getElementById("admin-board");
  if (!listEl) return;

  if (!boardData.length) {
    listEl.innerHTML = `<p class="empty-msg">אין מודעות.</p>`;
    return;
  }

  listEl.innerHTML = boardData
    .map((b, i) => {
      const colorStyle = b.color ? ` style="color:${escapeHtml(b.color)}"` : "";
      const imgHtml = b.imageUrl
        ? `<div style="margin-top:6px;">
             <img src="${escapeHtml(b.imageUrl)}"
                  style="max-width:100%;border-radius:8px;border:1px solid #1e293b;">
           </div>`
        : "";

      return `
      <div class="admin-item"${colorStyle}>
        <div class="admin-item-main">
          <strong>${escapeHtml(b.title)}</strong>
          <span class="admin-item-meta">${escapeHtml(b.meta || "")}</span>
        </div>
        <div class="admin-item-body">${escapeHtml(b.body)}</div>
        ${imgHtml}
        <button class="admin-remove" data-type="board" data-index="${i}">
          מחיקה
        </button>
      </div>
    `;
    })
    .join("");
}

async function saveBoard() {
  const refDoc = doc(db, "board", "general");
  await setDoc(refDoc, { items: boardData });
}

function setupBoardForm() {
  const form = document.getElementById("board-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    const meta = form.meta.value.trim();
    const body = form.body.value.trim();
    const imageUrl =
      (form.imageUrl && form.imageUrl.value && form.imageUrl.value.trim()) || "";
    const color =
      (form.color && form.color.value && form.color.value.trim()) ||
      "#ffffff";

    if (!title || !body) {
      alert("חובה למלא כותרת ותוכן.");
      return;
    }

    boardData.push({ title, meta, body, imageUrl, color });
    form.reset();
    renderBoardAdmin();
    await saveBoard();
    alert("המודעה נשמרה.");
  });
}

/* ------------ SITE CONTENT (about / home / contact / important / theming) ------------ */

async function loadSiteContent() {
  const data = await getDocSafe(["siteContent", "main"], {});
  siteContent = data || {};
  fillSiteContentForm();
}

function fillSiteContentForm() {
  const form = document.getElementById("site-content-form");
  if (!form) return;

  const fields = [
    // HERO
    "homeHeroTitle",
    "homeHeroSubtitle",

    // ABOUT
    "aboutTitle",
    "aboutBody",

    // IMPORTANT SECTION (חשוב לדעת)
    "importantTitle",
    "importantSubtitle",
    "importantCard1Title",
    "importantCard1Body",
    "importantCard2Title",
    "importantCard2Body",
    "importantCard3Title",
    "importantCard3Body",

    // GRADES SECTION
    "gradesSectionTitle",
    "gradesSectionSubtitle",
    "zDescription",
    "hDescription",
    "tDescription",

    // REQUESTS
    "requestsTitle",
    "requestsSubtitle",
    "requestsBody",

    // CONTACT
    "contactSectionTitle",
    "contactSectionSubtitle",
    "contactPhone",
    "contactEmail",
    "contactAddress",

    // FOOTER
    "footerText",

    // IMAGES (לוגו, הירו, רקעים וכו')
    "logoUrl",
    "heroImageUrl",
    "cardBgImageUrl",

    // THEME / COLORS
    "primaryColor",
    "buttonColor",
    "cardBgColor",
    "fontColor"
  ];

  for (const name of fields) {
    if (form[name]) {
      form[name].value = siteContent[name] || "";
    }
  }
}

function setupSiteContentForm() {
  const form = document.getElementById("site-content-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const updated = {};

    formData.forEach((value, key) => {
      updated[key] = value.toString();
    });

    siteContent = { ...siteContent, ...updated };

    const refDoc = doc(db, "siteContent", "main");
    await setDoc(refDoc, siteContent);

    alert("תוכן האתר נשמר בהצלחה.");
  });
}

/* ------------ DELETE HANDLER ------------ */

function setupDeleteHandler() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".admin-remove");
    if (!btn) return;

    const type = btn.dataset.type;
    const grade = btn.dataset.grade;
    const index = Number(btn.dataset.index);

    if (!confirm("למחוק את הפריט הזה?")) return;

    if (type === "news") {
      newsData[grade].splice(index, 1);
      renderNewsAdmin();
      await saveNewsGrade(grade);
    } else if (type === "exam") {
      examsData[grade].splice(index, 1);
      renderExamsAdmin();
      await saveExamsGrade(grade);
    } else if (type === "board") {
      boardData.splice(index, 1);
      renderBoardAdmin();
      await saveBoard();
    }
  });
}

/* ------------ MAIN ------------ */

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  setupNewsForms();
  setupExamForms();
  setupBoardForm();
  setupDeleteHandler();
  setupSiteContentForm();
});
