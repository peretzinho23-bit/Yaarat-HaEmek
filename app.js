// app.js – אתר יערת העמק

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ------------ CONSTS ------------ */

const GRADES = ["z", "h", "t"];
const GRADE_LABELS = {
  z: "ז׳",
  h: "ח׳",
  t: "ט׳"
};

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
function shortenText(str, maxLen = 140) {
  const s = String(str || "").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}
// ממיר כל ערך תאריך ל-Date (תומך גם ב-Firestore Timestamp)
function toJsDate(raw) {
  if (!raw) return null;

  // Firestore Timestamp
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    try {
      return raw.toDate();
    } catch {
      return null;
    }
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/* ------------ עזר למבחנים + ספירה לאחור ------------ */
function timeAgo(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "לפני רגע";
  if (seconds < 3600) return `לפני ${Math.floor(seconds / 60)} דקות`;
  if (seconds < 86400) return `לפני ${Math.floor(seconds / 3600)} שעות`;
  if (seconds < 604800) return `לפני ${Math.floor(seconds / 86400)} ימים`;
  if (seconds < 2592000) return `לפני ${Math.floor(seconds / 604800)} שבועות`;
  if (seconds < 31536000) return `לפני ${Math.floor(seconds / 2592000)} חודשים`;

  return `לפני ${Math.floor(seconds / 31536000)} שנים`;
}

// מזהה אינטרוואל גלובלי כדי שלא יווצרו מיליון אינטרוואלים
let examCountdownIntervalId = null;

// ממיר מחרוזת תאריך של המבחן לאובייקט Date
// תומך ב: "22/10/2025", "22/10/25", "2025-10-22", "2025-10-22 08:30"
// ויכול לקבל שעת מבחן נפרדת מהשדה time ("08:30")
function parseExamDateToDateObj(dateStr, timeStr) {
  if (!dateStr) return null;
  let s = String(dateStr).trim();
  if (!s) return null;

  // שעת ברירת מחדל 08:00 – ואם יש time תקין מחליפים
  let hh = 8;
  let mm = 0;

  if (timeStr) {
    const tm = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (tm) {
      hh = Number(tm[1]);
      mm = Number(tm[2]);
    }
  }

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

    return new Date(year, month - 1, day, hh, mm);
  }

  // ✔ פורמט רגיל: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, hh, mm);
  }

  // ✔ תאריך + שעה: YYYY-MM-DD HH:MM או YYYY-MM-DDTHH:MM
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh2 = Number(m[4]);
    const mm2 = Number(m[5]);
    return new Date(y, mo - 1, d, hh2, mm2);
  }

  // ✔ ניסיון אחרון – שיזרום אם הכנסת משהו מוזר
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

// בונה מחרוזת "תאריך · שעה" (אם יש שעה)
function buildDateTimeLabel(ex, dObjOverride) {
  const dObj = dObjOverride || parseExamDateToDateObj(ex.date, ex.time);
  const baseLabel = dObj
    ? formatLocalDate(dObj)
    : escapeHtml(ex.date || "");

  if (ex.time) {
    return `${baseLabel} · ${escapeHtml(ex.time)}`;
  }
  return baseLabel;
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

    el.textContent = ` המבחן בעוד: ${parts.join(" · ")}`;
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
    // NEWS – לכל שכבה
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

    // BOARD – לוח מודעות
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

// לייב
// לייב – גם לדף הבית וגם לדף כל החדשות
function subscribeRealtimeHome() {
  const isNewsPage = document.body.dataset.page === "news";

  // NEWS
  for (const g of GRADES) {
    onSnapshot(doc(db, "news", g), (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      homeNews[g] = data.items || [];

      if (isNewsPage) {
        // בדף כל החדשות – מעדכן את הגריד
        renderAllNewsPage();
      } else {
        // בדף הבית – מעדכן את התיבות של החדשות
        renderHomeNews();
      }
    });
  }

  // EXAMS
  for (const g of GRADES) {
    onSnapshot(doc(db, "exams", g), (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      homeExams[g] = data.items || [];

      if (!isNewsPage) {
        // בדף הבית יש מבחנים; ב-news.html אין
        renderHomeExams();
      }
    });
  }

  // BOARD (לוח מודעות)
  onSnapshot(doc(db, "board", "general"), (snap) => {
    const data = snap.exists() ? snap.data() : { items: [] };
    boardData = data.items || [];

    if (isNewsPage) {
      // בדף כל החדשות לוח מודעות מופיע בתוך הרשימה
      renderAllNewsPage();
    } else {
      // בדף הבית – קופסה של לוח מודעות
      renderHomeBoard();
    }
  });
}

/* ------------ RENDER HOME NEWS (לדף הבית) ------------ */

function renderHomeNews() {
  for (const g of GRADES) {
    const listEl = document.getElementById(`home-news-${g}`);
    if (!listEl) continue;

    const items = homeNews[g] || [];
    if (!items.length) {
      listEl.innerHTML = `<p class="empty-msg">אין עדיין חדשות לשכבה זו.</p>`;
      continue;
    }

    listEl.innerHTML = items
      .slice(0, 3)
      .map((n) => {
        // 🔥 תמיכה בכמה תמונות: imageUrls (מערך) או imageUrl יחיד
        const images = Array.isArray(n.imageUrls) && n.imageUrls.length
          ? n.imageUrls
          : (n.imageUrl ? [n.imageUrl] : []);

        const hasImages = images.length > 0;
        const colorStyle = n.color ? ` style="color:${escapeHtml(n.color)}"` : "";

        if (hasImages) {
          const imgsHtml = images
            .slice(0, 2) // עד 2 תמונות
            .map(
              (url) => `
                <div class="home-news-image-wrap-multi">
                  <img src="${escapeHtml(url)}" alt="${escapeHtml(
                    n.title || ""
                  )}" />
                </div>
              `
            )
            .join("");

          return `
            <article class="home-news-item home-news-item-with-image"${colorStyle}>
              <div class="home-news-images-row">
                ${imgsHtml}
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
}

function renderAllNewsPage() {
  const container = document.getElementById("all-news-list");
  if (!container) return;

  const allItems = [];

  // חדשות לפי שכבות
  for (const g of GRADES) {
    const items = homeNews[g] || [];
    items.forEach((item, index) => {
      allItems.push({
        ...item,
        _grade: g,
        _index: index,
        _type: "news"
      });
    });
  }

  // לוח מודעות
  (boardData || []).forEach((item, index) => {
    allItems.push({
      ...item,
      _grade: "board",
      _index: index,
      _type: "board"
    });
  });

  if (!allItems.length) {
    container.innerHTML = `<p class="empty-msg">אין חדשות באתר כרגע.</p>`;
    return;
  }

  // מהחדש לישן
  const sorted = allItems.slice().reverse();

  container.innerHTML = sorted
    .map((n) => {
      // תמונות
      const images = Array.isArray(n.imageUrls) && n.imageUrls.length
        ? n.imageUrls
        : (n.imageUrl ? [n.imageUrl] : []);
      const hasImages = images.length > 0;

      const colorStyle = n.color ? ` style="color:${escapeHtml(n.color)}"` : "";

      // מטא (שכבה / לוח מודעות / תאריך)
      const metaPieces = [];

      if (n._type === "news") {
        const gradeLabel = GRADE_LABELS[n._grade] || "";
        if (gradeLabel) metaPieces.push(`שכבה ${gradeLabel}`);
      } else if (n._type === "board") {
        metaPieces.push("לוח מודעות");
      }

      // 🕒 תאריך – לוקח קודם כל createdAt ואם אין אז date
      const rawDate = n.createdAt || n.date;
      const d = toJsDate(rawDate);
      if (d) {
        const iso = d.toISOString();
        const rel = timeAgo(iso);        // למשל: "לפני 3 שעות"
        const abs = formatLocalDate(d);  // למשל: "10.12.2025"

        if (rel && abs) {
          metaPieces.push(`${rel} (${abs})`);
        } else if (abs) {
          metaPieces.push(abs);
        }
      }

      if (n.meta) metaPieces.push(n.meta);

      const metaHtml = metaPieces.length
        ? `<div class="home-news-meta">${escapeHtml(metaPieces.join(" · "))}</div>`
        : "";

      // לינק לכתבה
      const url =
        n._type === "board"
          ? `article.html?type=board&index=${n._index}`
          : `article.html?type=news&grade=${encodeURIComponent(
              n._grade
            )}&index=${n._index}`;

      const fullBody = n.body || "";
      const isLong = fullBody.length > 260;
      const shortBody = isLong
        ? escapeHtml(fullBody.slice(0, 260)) + "..."
        : escapeHtml(fullBody);

      const readMoreHtml = `
        <div class="news-details">
          <a class="read-more-link" href="${url}">להמשך קריאה »</a>
        </div>
      `;

      const imagesHtml = hasImages
        ? `
          <div class="home-news-images-row">
            <div class="home-news-image-wrap-multi">
              <img src="${escapeHtml(images[0])}" alt="${escapeHtml(
                n.title || ""
              )}">
            </div>
          </div>
        `
        : "";

      return `
        <article class="home-news-item all-news-item"${colorStyle}>
          ${imagesHtml}
          <div class="home-news-text">
            <h4 class="home-news-title">${escapeHtml(n.title || "")}</h4>
            ${metaHtml}
            <div class="home-news-body">
              ${shortBody}
              ${readMoreHtml}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}







function renderArticlePage() {
  const container = document.getElementById("article-container");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const articleId = params.get("id");

  if (!articleId) {
    container.innerHTML = `<p class="article-empty">לא נמצאה כתבה להצגה.</p>`;
    return;
  }

  // מאחדים את כל החדשות מכל השכבות + לוח מודעות
  const allItems = [];

  for (const g of GRADES) {
    const items = homeNews[g] || [];
    items.forEach((item) => {
      allItems.push({
        ...item,
        _grade: g,
        _type: "news"
      });
    });
  }

  boardData.forEach((b) => {
    allItems.push({
      ...b,
      _type: "board"
    });
  });

  const article = allItems.find((x) => x.id === articleId);

  if (!article) {
    container.innerHTML = `<p class="article-empty">הכתבה שביקשת לא נמצאה.</p>`;
    return;
  }

  // תמונות
  const images = Array.isArray(article.imageUrls) && article.imageUrls.length
    ? article.imageUrls
    : (article.imageUrl ? [article.imageUrl] : []);

  const gradeLabel = article._grade ? (GRADE_LABELS[article._grade] || "") : "";
  const metaPieces = [];

  if (article._type === "board") {
    metaPieces.push("לוח מודעות");
  } else if (gradeLabel) {
    metaPieces.push(`שכבה ${gradeLabel}`);
  }
  if (article.meta) metaPieces.push(article.meta);

  const metaHtml = metaPieces.length
    ? `<div class="article-meta">${escapeHtml(metaPieces.join(" · "))}</div>`
    : "";

  const imagesHtml = images.length
    ? `
      <div class="article-images">
        <img src="${escapeHtml(images[0])}" alt="${escapeHtml(article.title || "")}">
      </div>
    `
    : "";

  container.innerHTML = `
    <article class="article-card">
      <a href="news.html" class="article-back-link">« חזרה לכל החדשות</a>
      <h1 class="article-title">${escapeHtml(article.title || "")}</h1>
      ${metaHtml}
      ${imagesHtml}
      <div class="article-body">
        ${escapeHtml(article.body || "")}
      </div>
    </article>
  `;

  // כותרת טאב
  if (article.title) {
    document.title = `${article.title} – יערת העמק`;
  }
}

/* ------------ RENDER HOME EXAMS (עם מבחן הבא + מבחנים שהיו + ספירה לאחור) ------------ */

function renderHomeExams() {
  GRADES.forEach((g) => {
    const listEl = document.getElementById(`home-exams-${g}`);
    if (!listEl) return;

    const rawItems = homeExams[g] || [];

    // לוקחים רק מבחנים "שכבתיים" – בלי classId, או classId מיוחד כמו 'grade' / 'all'
    const gradeItems = rawItems.filter((ex) => {
      if (!ex) return false;
      const cid = (ex.classId || "").toLowerCase();
      return !cid || cid === "grade" || cid === "all";
    });

    const itemsWithDates = gradeItems
      .map((ex) => ({
        ...ex,
        _dateObj: parseExamDateToDateObj(ex.date, ex.time),
      }))
      .filter((ex) => ex._dateObj);

    if (!itemsWithDates.length) {
      listEl.innerHTML = `
        <p class="empty-msg">
          כדי לראות את לוח המבחנים – בחרו את הכיתה שלכם למעלה.
        </p>
      `;
      return;
    }

    // מיון לפי תאריך
    itemsWithDates.sort((a, b) => a._dateObj - b._dateObj);

    const now = new Date();
    const upcoming = itemsWithDates.filter((ex) => ex._dateObj >= now);
    const past = itemsWithDates.filter((ex) => ex._dateObj < now);

    let html = "";

    // מבחן הבא + ספירה לאחור
    if (upcoming.length) {
      const next = upcoming[0];
      const ts = next._dateObj.getTime();

      html += `
        <div class="home-exam-next">
          <article class="home-exam-item home-exam-item-next">
            <div class="home-exam-top">
              <span class="home-exam-date">${buildDateTimeLabel(
                next,
                next._dateObj
              )}</span>
              <span class="home-exam-subject">${escapeHtml(next.subject)}</span>
            </div>
            ${
              next.topic
                ? `<div class="home-exam-topic">${escapeHtml(next.topic)}</div>`
                : ""
            }
            <div class="home-exam-countdown" data-exam-timestamp="${ts}"></div>
          </article>
        </div>
      `;

      const moreUpcoming = upcoming.slice(1);
      if (moreUpcoming.length) {
        html += `<div class="home-exam-list-upcoming">`;
        html += moreUpcoming
          .map((ex) => {
            const ts2 = ex._dateObj.getTime();
            return `
              <article class="home-exam-item">
                <div class="home-exam-top">
                  <span class="home-exam-date">${buildDateTimeLabel(
                    ex,
                    ex._dateObj
                  )}</span>
                  <span class="home-exam-subject">${escapeHtml(ex.subject)}</span>
                </div>
                ${
                  ex.topic
                    ? `<div class="home-exam-topic">${escapeHtml(ex.topic)}</div>`
                    : ""
                }
                <div class="home-exam-countdown" data-exam-timestamp="${ts2}"></div>
              </article>
            `;
          })
          .join("");
        html += `</div>`;
      }
    } else {
      html += `<p class="empty-msg">  כדי לראות את לוח המבחנים – בחרו את הכיתה שלכם למעלה.</p>`;
    }

    // מבחנים שהיו
    if (past.length) {
      html += `
        <div class="home-exam-past-block">
          <h4 class="home-exam-past-title">מבחנים שהיו</h4>
      `;
      html += past
        .map(
          (ex) => `
            <article class="home-exam-item home-exam-item-past">
              <div class="home-exam-top">
                <span class="home-exam-date">${buildDateTimeLabel(
                  ex,
                  ex._dateObj
                )}</span>
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
      html += `</div>`;
    }

    listEl.innerHTML = html;
  });

  // ספירה לאחור
  updateExamCountdownElements();
  startExamCountdownLoop();
}

function renderHomeBoard() {
  const listEl = document.getElementById("home-board");
  if (!listEl) return;

  if (!boardData.length) {
    listEl.innerHTML = `<p class="empty-msg">אין מודעות כרגע.</p>`;
    return;
  }

  // ✅ לוקחים את העדכנית ביותר – מניחים שהאחרונה במערך היא החדשה
  const items = boardData.slice().reverse(); // חדשים קודם
  const b = items[0];

  const colorStyle = b.color ? ` style="color:${escapeHtml(b.color)}"` : "";

  // 🕒 בניית שורת מטא (תאריך יחסי + תאריך רגיל + מטא רגילה)
  const metaPieces = [];

  if (b.date) {
    const d = new Date(b.date);
    if (!isNaN(d.getTime())) {
      const rel = timeAgo(b.date);       // "לפני X ימים"
      const abs = formatLocalDate(d);    // "DD.MM.YYYY"
      if (rel && abs) {
        metaPieces.push(`${rel} (${abs})`);
      } else if (abs) {
        metaPieces.push(abs);
      }
    }
  }

  if (b.meta) {
    metaPieces.push(b.meta);
  }

  const metaHtml = metaPieces.length
    ? `<div class="board-item-meta">${escapeHtml(metaPieces.join(" · "))}</div>`
    : "";

  // 🎨 תמונות (עד 3 כמו שהיה)
  const imgs = [];
  if (b.imageUrl) {
    imgs.push(`
      <div class="board-item-image">
        <img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(b.title || "")}">
      </div>
    `);
  }
  if (b.imageUrl2) {
    imgs.push(`
      <div class="board-item-image">
        <img src="${escapeHtml(b.imageUrl2)}" alt="${escapeHtml(b.title || "")}">
      </div>
    `);
  }
  if (b.imageUrl3) {
    imgs.push(`
      <div class="board-item-image">
        <img src="${escapeHtml(b.imageUrl3)}" alt="${escapeHtml(b.title || "")}">
      </div>
    `);
  }

  const hasMany = imgs.length > 1;
  const imgsHtml = imgs.join("");

  listEl.innerHTML = `
    <article class="board-item"${colorStyle}>
      <div class="board-item-title">${escapeHtml(b.title)}</div>
      ${metaHtml}
      <div class="board-item-body">${escapeHtml(b.body)}</div>

      ${
        imgs.length
          ? `
          <div class="board-item-images" data-images-count="${imgs.length}">
            ${imgsHtml}
            ${
              hasMany
                ? `
                  <div class="board-slider-controls">
                    <button type="button" class="board-slider-prev">◀</button>
                    <button type="button" class="board-slider-next">▶</button>
                  </div>
                `
                : ""
            }
          </div>
        `
          : ""
      }
    </article>
  `;

  // שומר לך את הסליידר אם יש כמה תמונות
  setupBoardSliders();
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
      const images = Array.isArray(n.imageUrls) && n.imageUrls.length
        ? n.imageUrls
        : (n.imageUrl ? [n.imageUrl] : []);
      const hasImages = images.length > 0;
      const colorStyle = n.color ? ` style="color:${escapeHtml(n.color)}"` : "";

      if (hasImages) {
        const imgsHtml = images
          .slice(0, 2)
          .map(
            (url) => `
              <div class="home-news-image-wrap-multi">
                <img src="${escapeHtml(url)}" alt="${escapeHtml(
                  n.title || ""
                )}" />
              </div>
            `
          )
          .join("");

        return `
          <article class="home-news-item home-news-item-with-image"${colorStyle}>
            <div class="home-news-images-row">
              ${imgsHtml}
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

  const rawItems = homeExams[grade] || [];

  const itemsWithDates = rawItems
    .map((ex) => ({
      ...ex,
      _dateObj: parseExamDateToDateObj(ex.date, ex.time)
    }))
    .filter((ex) => ex._dateObj);

  if (!itemsWithDates.length) {
    listEl.innerHTML = "";
    return;
  }

  itemsWithDates.sort((a, b) => a._dateObj - b._dateObj);

  listEl.innerHTML = itemsWithDates
    .map((ex) => {
      const ts = ex._dateObj.getTime();
      return `
        <article class="home-exam-item">
          <div class="home-exam-top">
            <span class="home-exam-date">${buildDateTimeLabel(
              ex,
              ex._dateObj
            )}</span>
            <span class="home-exam-subject">${escapeHtml(ex.subject)}</span>
          </div>
          ${
            ex.topic
              ? `<div class="home-exam-topic">${escapeHtml(ex.topic)}</div>`
              : ""
          }
          <div class="home-exam-countdown" data-exam-timestamp="${ts}"></div>
        </article>
      `;
    })
    .join("");

  updateExamCountdownElements();
  startExamCountdownLoop();
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

      const imgs = [];
      if (b.imageUrl) {
        imgs.push(`
          <div class="board-item-image">
            <img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(b.title || "")}">
          </div>
        `);
      }
      if (b.imageUrl2) {
        imgs.push(`
          <div class="board-item-image">
            <img src="${escapeHtml(b.imageUrl2)}" alt="${escapeHtml(b.title || "")}">
          </div>
        `);
      }
      if (b.imageUrl3) {
        imgs.push(`
          <div class="board-item-image">
            <img src="${escapeHtml(b.imageUrl3)}" alt="${escapeHtml(b.title || "")}">
          </div>
        `);
      }

      const hasMany = imgs.length > 1;
      const imgsHtml = imgs.join("");

      return `
        <article class="board-item"${colorStyle}>
          <div class="board-item-title">${escapeHtml(b.title)}</div>
          ${
            b.meta
              ? `<div class="board-item-meta">${escapeHtml(b.meta)}</div>`
              : ""
          }
          <div class="board-item-body">${escapeHtml(b.body)}</div>

          ${
            imgs.length
              ? `
              <div class="board-item-images" data-images-count="${imgs.length}">
                ${imgsHtml}
                ${
                  hasMany
                    ? `
                      <div class="board-slider-controls">
                        <button type="button" class="board-slider-prev">◀</button>
                        <button type="button" class="board-slider-next">▶</button>
                      </div>
                    `
                    : ""
                }
              </div>
            `
              : ""
          }
        </article>
      `;
    })
    .join("");

  setupBoardSliders();
}

/* ------------ SLIDER LOGIC FOR BOARD ------------ */

function setupBoardSliders() {
  const wrappers = document.querySelectorAll(".board-item-images");
  if (!wrappers.length) return;

  wrappers.forEach((wrap) => {
    const imgs = Array.from(wrap.querySelectorAll(".board-item-image"));
    if (!imgs.length) return;

    let current = 0;

    function showImage(idx) {
      if (!imgs.length) return;
      current = ((idx % imgs.length) + imgs.length) % imgs.length; // מודולו חיובי
      imgs.forEach((img, i) => {
        img.classList.toggle("active", i === current);
      });
    }

    // מציגים את הראשונה
    showImage(0);

    const prevBtn = wrap.querySelector(".board-slider-prev");
    const nextBtn = wrap.querySelector(".board-slider-next");

    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showImage(current - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showImage(current + 1);
      });
    }
  });
}

/* ------------ LOAD GRADE PAGE ------------ */

async function loadGradePage(grade) {
  try {
    await loadHomeDataOnce();

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
  setHtml("about-body", siteContent.aboutBody || siteContent.aboutText);

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

/* ------------ NAV (מובייל) ------------ */

function setupMobileNav() {
  const navToggle = document.querySelector(".nav-toggle");
  const navRight = document.querySelector(".nav-right");

  if (!navToggle || !navRight) return;

  const pageType = document.body.dataset.page || "";
  if (pageType === "home") {
  navRight.innerHTML = `
      <a href="about.html">אודות</a>
      <a href="#home-news">חדשות</a>
      <a href="#home-exams">מבחנים</a>
      <a href="#grades">השכבות</a>
      <a href="polls.html">סקרים</a>
      <a href="#requests">תיבת בקשות</a>
      <a href="#contact">יצירת קשר</a>
      <a href="redirect-edu.html" class="personal-btn">למרחב האישי</a>
      <a href="admin.html" class="btn-outline">Admin</a>
  `;
}


  navRight.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navRight.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    });
  });

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

document.addEventListener("DOMContentLoaded", async () => {
  const grade = document.body.dataset.grade;
  const pageType = document.body.dataset.page || "";

  // דף שכבה
  if (grade) {
    await loadGradePage(grade);
    return;
  }

  // דף כל החדשות
    // דף כל החדשות
  if (pageType === "news") {
    await loadHomeDataOnce();      // טעינה ראשונית
    renderAllNewsPage();           // ציור ראשוני
    subscribeRealtimeHome();       // 🔥 חיבור ל-onSnapshot שירנדר שוב כשיש שינוי
    initTheme();
    setupMobileNav();
    setupScrollToTop();
    return;
  }


  // דף הבית (ברירת מחדל)
  loadHomeDataOnce();
  subscribeRealtimeHome();
  loadSiteContentForHome();
  loadAboutSectionFromSiteContent();
  initTheme();
  setupMobileNav();
  setupScrollToTop();
});

