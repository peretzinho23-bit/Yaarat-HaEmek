// exams.js – לוח מבחנים לפי כיתה (exams.html)

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// כיתות אפשריות
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
  t5: "ט5"
};

const GRADE_NAMES = {
  z: "שכבת ז׳",
  h: "שכבת ח׳",
  t: "שכבת ט׳"
};

function getClassFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const cls = (params.get("class") || "").toLowerCase().trim();
  if (!cls || !CLASS_LABELS[cls]) return null;
  return cls;
}

function getGradeFromClass(classId) {
  // z1 → z, h3 → h, t5 → t
  return classId[0]; // התו הראשון
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadClassExams(classId) {
  const listEl = document.getElementById("class-exams-list");
  const errorEl = document.getElementById("class-exams-error");

  if (!listEl) return;

  const grade = getGradeFromClass(classId);
  const gradeName = GRADE_NAMES[grade] || "";

  try {
    const refDoc = doc(db, "exams", grade);
    const snap = await getDoc(refDoc);
    const data = snap.exists() ? snap.data() : { items: [] };
    let items = data.items || [];

    // אם יש שדה classId – מסננים לפיו.
    // אם אין classId (מבחנים ישנים) – נציג אותם כחלק מהרשימה.
    const hasClassField = items.some((ex) => typeof ex.classId === "string");

    if (hasClassField) {
      items = items.filter(
        (ex) => !ex.classId || ex.classId === classId
      );
    }

    if (!items.length) {
      listEl.innerHTML =
        `<p class="empty-msg">אין מבחנים שמורים לכיתה זו.</p>`;
      return;
    }

    // מייצרים HTML
    const html = items
      .map((ex) => {
        const date = escapeHtml(ex.date || "");
        const time = escapeHtml(ex.time || "");
        const subject = escapeHtml(ex.subject || "");
        const topic = escapeHtml(ex.topic || "");

        const meta =
          date && time ? `${date} · ${time}` : date || time || "";

        return `
          <div class="exam-item card">
            <div class="exam-item-main">
              <strong>${subject}</strong>
              <span class="exam-item-meta">${meta}</span>
            </div>
            <div class="exam-item-body">
              ${topic || "<span style='opacity:.7'>ללא פירוט נושא</span>"}
            </div>
          </div>
        `;
      })
      .join("");

    listEl.innerHTML = html;

    // אם יש גם וגם (עם classId וללא) – אפשר להוסיף שורת הסבר קטנה
    if (hasClassField) {
      const extra = document.createElement("p");
      extra.className = "section-subtitle";
      extra.style.marginTop = "10px";
      extra.style.textAlign = "center";
      extra.textContent =
        "מוצגים מבחנים של כיתה זו וכן מבחנים כלליים לשכבה (ללא כיתה ספציפית).";
      listEl.parentElement.appendChild(extra);
    }
  } catch (err) {
    console.error("שגיאה בטעינת המבחנים:", err);
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.innerHTML =
        "<p>אירעה שגיאה בטעינת המבחנים. נסו לרענן את הדף מאוחר יותר.</p>";
    }
    listEl.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const classId = getClassFromUrl();
  const titleEl = document.getElementById("class-exams-title");
  const subtitleEl = document.getElementById("class-exams-subtitle");
  const errorEl = document.getElementById("class-exams-error");

  if (!classId) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.innerHTML = `
        <p>
          לא זוהתה כיתה מתאימה.<br>
          ודאו שהקישור כולל פרמטר כמו
          <code>?class=z1</code>
          או חזרו דרך דף הבית.
        </p>
      `;
    }
    const listEl = document.getElementById("class-exams-list");
    if (listEl) {
      listEl.innerHTML = `<p class="empty-msg">לא נבחרה כיתה.</p>`;
    }
    return;
  }

  const grade = getGradeFromClass(classId);
  const gradeName = GRADE_NAMES[grade] || "";

  if (titleEl) {
    titleEl.textContent = `לוח מבחנים – כיתה ${CLASS_LABELS[classId]} (${gradeName})`;
  }
  if (subtitleEl) {
    subtitleEl.textContent =
      "כאן תמצאו את כל המבחנים שנשמרו לכיתה שלכם במערכת.";
  }

  if (errorEl) {
    errorEl.style.display = "none";
  }

  loadClassExams(classId);
});
