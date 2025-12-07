// exam.js – דף לוח מבחנים לפי כיתה

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const CLASS_LABELS = {
  z1: "ז1",
  z2: "ז2",
  z3: "ז3",
  z4: "ז4",
  z5: "ז5",
  h1: "ח1",
  h2: "ח2",
  h3: "ח3",
  h4: "ח4",
  h5: "ח5",
  h6: "ח6",
  t1: "ט1",
  t2: "ט2",
  t3: "ט3",
  t4: "ט4",
  t5: "ט5",
};

const GRADE_TITLES = {
  z: "שכבת ז'",
  h: "שכבת ח'",
  t: "שכבת ט'",
};

function getParams() {
  const usp = new URLSearchParams(window.location.search);
  const grade = usp.get("grade");
  const classId = usp.get("class");

  if (!grade || !classId) return null;
  if (!["z", "h", "t"].includes(grade)) return null;
  if (!CLASS_LABELS[classId]) return null;

  // התאמה סבירה: z1 שייך ל־z, h3 ל־h וכו'
  if (grade !== classId[0]) return null;

  return { grade, classId };
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderError() {
  const titleEl = document.getElementById("class-title");
  const subtitleEl = document.getElementById("class-subtitle");
  const chipEl = document.getElementById("class-chip");
  const inlineName = document.getElementById("class-name-inline");
  const helpText = document.getElementById("class-help-text");
  const listEl = document.getElementById("class-exams-list");

  if (titleEl)
    titleEl.textContent = "שגיאה בנתוני הכתובת";
  if (subtitleEl)
    subtitleEl.textContent = "הקישור אינו תקין. חזרו לעמוד המבחנים הראשי ובחרו כיתה מחדש.";
  if (chipEl)
    chipEl.textContent = "?";
  if (inlineName)
    inlineName.textContent = "כיתה לא ידועה";
  if (helpText)
    helpText.textContent = "לחצו על כפתור החזרה למעלה כדי לבחור שוב כיתה.";

  if (listEl) {
    listEl.innerHTML = `
      <p class="empty-msg">
        לא הצלחנו להבין מאיזו כיתה הגעתם.
        <br>
        חזרו לעמוד הראשי ובחרו מחדש את הכיתה שלכם.
      </p>
    `;
  }
}

function renderNoExams(listEl) {
  listEl.innerHTML = `
    <p class="empty-msg">
      עדיין לא הוזנו מבחנים לכיתה זו במערכת.
      <br>
      ברגע שמורה יוסיף מבחן – הוא יופיע כאן.
    </p>
  `;
}

async function loadClassExams() {
  const params = getParams();
  if (!params) {
    renderError();
    return;
  }

  const { grade, classId } = params;
  const niceClass = CLASS_LABELS[classId];
  const gradeTitle = GRADE_TITLES[grade] || "";

  const titleEl = document.getElementById("class-title");
  const subtitleEl = document.getElementById("class-subtitle");
  const chipEl = document.getElementById("class-chip");
  const inlineName = document.getElementById("class-name-inline");
  const helpText = document.getElementById("class-help-text");
  const listEl = document.getElementById("class-exams-list");

  if (titleEl)
    titleEl.textContent = `לוח מבחנים – כיתה ${niceClass}`;
  if (subtitleEl)
    subtitleEl.textContent = `${gradeTitle}, כיתה ${niceClass} · המבחנים שנשמרו במערכת לכיתה זו.`;
  if (chipEl)
    chipEl.textContent = niceClass;
  if (inlineName)
    inlineName.textContent = `כיתה ${niceClass}`;
  if (helpText)
    helpText.textContent =
      "המבחנים מסודרים לפי תאריך. אם אין עדיין מבחנים – תראו כאן הודעה מתאימה.";

  if (!listEl) return;
  listEl.innerHTML = `<p class="empty-msg">טוען מבחנים...</p>`;

  try {
    const refDoc = doc(db, "exams", grade);
    const snap = await getDoc(refDoc);
    const data = snap.exists() ? snap.data() : { items: [] };
    const allExams = data.items || [];

    const classExams = allExams
      .filter((ex) => ex.classId === classId)
      .map((ex) => ({
        ...ex,
        _sortDate: ex.date || "",
      }));

    if (!classExams.length) {
      renderNoExams(listEl);
      return;
    }

    classExams.sort((a, b) => (a._sortDate > b._sortDate ? 1 : -1));

    listEl.innerHTML = classExams
      .map((ex) => {
        const metaParts = [];
        if (ex.date) metaParts.push(escapeHtml(ex.date));
        if (ex.time) metaParts.push(escapeHtml(ex.time));
        const metaText = metaParts.join(" · ");

        return `
          <div class="exam-item">
            <div class="exam-main-row">
              <span class="exam-subject">${escapeHtml(ex.subject || "ללא מקצוע")}</span>
              ${metaText ? `<span class="exam-meta">${metaText}</span>` : ""}
            </div>
            ${
              ex.topic
                ? `<div class="exam-topic">${escapeHtml(ex.topic)}</div>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("שגיאה בטעינת מבחנים לכיתה:", err);
    listEl.innerHTML = `
      <p class="empty-msg">
        חלה שגיאה בטעינת המבחנים. נסו לרענן את הדף,
        ואם זה ממשיך – פנו למנהל המערכת.
      </p>
    `;
  }
}

document.addEventListener("DOMContentLoaded", loadClassExams);
