// admin.js – לוח ניהול יערת העמק

import { auth, db, storage } from "./firebase-config.js";
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
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

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
      const manualImageUrl = (form.imageUrl && form.imageUrl.value.trim()) || "";
      const color =
        (form.color && form.color.value && form.color.value.trim()) ||
        "#ffffff";
      const fileInput = form.imageFile;
      const file = fileInput && fileInput.files && fileInput.files[0];

      if (!title || !body) {
        alert("חובה למלא לפחות כותרת ותוכן.");
        return;
      }

      try {
        let finalImageUrl = manualImageUrl;

        // אם יש קובץ – מעלים אותו ל-Firebase Storage
        if (file) {
          const filePath = `news/${g}/${Date.now()}_${file.name}`;
          const storageRef = ref(storage, filePath);
          await uploadBytes(storageRef, file);
          finalImageUrl = await getDownloadURL(storageRef);
        }

        newsData[g].push({ title, meta, body, imageUrl: finalImageUrl, color });

        // ניקוי הטופס
        form.reset();
        renderNewsAdmin();
        await saveNewsGrade(g);
        alert("הידיעה נשמרה.");
      } catch (err) {
        console.error("שגיאה בהעלאת תמונה/שמירת חדשות:", err);
        alert("הייתה שגיאה בשמירת הידיעה. נסה שוב.");
      }
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

/* ------------ REGISTER REQUESTS (בקשות הרשמת אדמין) ------------ */

function setupRegisterRequestForm() {
  const form = document.getElementById("register-request-form");
  const statusEl = document.getElementById("register-status");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const role = form.role.value.trim();
    const message = form.message.value.trim();

    if (!fullName || !email) {
      alert("חובה למלא שם מלא ואימייל.");
      return;
    }

    try {
      const id = Date.now().toString();

      const refDoc = doc(db, "adminRequests", id);
      await setDoc(refDoc, {
        fullName,
        email,
        role,
        message,
        createdAt: new Date().toISOString()
      });

      form.reset();
      if (statusEl) {
        statusEl.textContent = "הבקשה נשלחה. לאחר אישור ידני תקבלו גישה.";
      }
      alert("הבקשה נשלחה בהצלחה. לאחר אישור ידני תקבלו גישה.");
    } catch (err) {
      console.error(err);
      alert("הייתה שגיאה בשליחת הבקשה. נסו שוב מאוחר יותר.");
      if (statusEl) {
        statusEl.textContent = "שגיאה בשליחה. נסו שוב מאוחר יותר.";
      }
    }
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

/* ------------ GRADE FILTER (ז / ח / ט) ------------ */

function setupGradeFilter() {
  const buttons = document.querySelectorAll(".grade-filter-btn");
  const sections = document.querySelectorAll(".admin-grade-section");

  if (!buttons.length || !sections.length) {
    return;
  }

  function setActiveGrade(grade) {
    buttons.forEach((btn) => {
      const btnGrade = btn.getAttribute("data-grade") || "all";
      btn.classList.toggle("active", btnGrade === grade);
      if (grade === "all" && btnGrade === "all") {
        btn.classList.add("active");
      }
    });

    sections.forEach((sec) => {
      const secGrade = sec.getAttribute("data-grade");
      if (grade === "all" || secGrade === grade) {
        sec.style.display = "";
      } else {
        sec.style.display = "none";
      }
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const grade = btn.getAttribute("data-grade") || "all";
      setActiveGrade(grade);
    });
  });

  setActiveGrade("all");
}

/* ------------ MAIN ------------ */

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  setupNewsForms();
  setupExamForms();
  setupBoardForm();
  setupDeleteHandler();
  setupSiteContentForm();
  setupGradeFilter();
  setupRegisterRequestForm();
});
