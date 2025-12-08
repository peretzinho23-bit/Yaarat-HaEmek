// admin.js – לוח ניהול יערת העמק

import { db, auth, storage } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

const GRADES = ["z", "h", "t"];

// כיתות לכל שכבה
const CLASS_IDS_BY_GRADE = {
  z: ["z1", "z2", "z3", "z4", "z5"],
  h: ["h1", "h2", "h3", "h4", "h5", "h6"],
  t: ["t1", "t2", "t3", "t4", "t5"]
};

let newsData = { z: [], h: [], t: [] };
let examsData = { z: [], h: [], t: [] };
let boardData = [];
let siteContent = {};
let pollsData = [];

// קולקציה של סקרים
const pollsCollectionRef = collection(db, "polls");

/* ------------ LOGS – לוג כללי לכל הדברים ------------ */
async function logSystemChange(action, entity, payload = {}) {
  try {
    const logsRef = collection(db, "exams_logs");
    await addDoc(logsRef, {
      action,
      entity,
      grade: payload.grade || null,
      classId: payload.classId || null,
      subject: payload.subject || null,
      date: payload.date || null,
      time: payload.time || null,
      topic: payload.topic || null,
      itemsCount: payload.itemsCount ?? null,
      adminUid: auth.currentUser ? auth.currentUser.uid : null,
      adminEmail: auth.currentUser ? auth.currentUser.email : null,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("שגיאה בלוג של המערכת:", err);
  }
}

/* ------------ helpers ------------ */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// classId -> "ז1", "ח3" וכו'
function classIdToLabel(classId) {
  const map = {
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
  return map[classId] || "";
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
  // NEWS
  for (const g of GRADES) {
    const res = await getDocSafe(["news", g], { items: [] });
    newsData[g] = res.items || [];
  }
  renderNewsAdmin();

  // EXAMS
  for (const g of GRADES) {
    const res = await getDocSafe(["exams", g], { items: [] });
    examsData[g] = res.items || [];
  }
  renderExamsAdmin();

  // BOARD
  const b = await getDocSafe(["board", "general"], { items: [] });
  boardData = b.items || [];
  renderBoardAdmin();

  // POLLS
  await loadPolls();

  // תוכן אתר
  await loadSiteContent();

  // realtime listeners
  subscribeRealtimeAdmin();
}

/* ------------ realtime ------------ */

function subscribeRealtimeAdmin() {
  // NEWS
  for (const g of GRADES) {
    onSnapshot(doc(db, "news", g), (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      newsData[g] = data.items || [];
      renderNewsAdmin();
    });
  }

  // EXAMS
  for (const g of GRADES) {
    onSnapshot(doc(db, "exams", g), (snap) => {
      const data = snap.exists() ? snap.data() : { items: [] };
      examsData[g] = data.items || [];
      renderExamsAdmin();
    });
  }

  // BOARD
  onSnapshot(doc(db, "board", "general"), (snap) => {
    const data = snap.exists() ? snap.data() : { items: [] };
    boardData = data.items || [];
    renderBoardAdmin();
  });

  // POLLS
  onSnapshot(pollsCollectionRef, (snap) => {
    pollsData = [];
    snap.forEach((docSnap) => {
      pollsData.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    renderPollsAdmin();
  });
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

        const colorStyle = n.color ? ` style="color:${escapeHtml(n.color)};"` : "";

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
      const manualImageUrl =
        (form.imageUrl && form.imageUrl.value && form.imageUrl.value.trim()) || "";
      const color =
        (form.color && form.color.value && form.color.value.trim()) || "#ffffff";

      const fileInput = form.imageFile;
      const file = fileInput && fileInput.files && fileInput.files[0];

      if (!title || !body) {
        alert("חובה למלא לפחות כותרת ותוכן.");
        return;
      }

      try {
        let finalImageUrl = manualImageUrl;

        if (file) {
          const filePath = `news/${g}/${Date.now()}_${file.name}`;
          const fileRef = ref(storage, filePath);
          await uploadBytes(fileRef, file);
          finalImageUrl = await getDownloadURL(fileRef);
        }

        const newItem = {
          title,
          meta,
          body,
          imageUrl: finalImageUrl,
          color
        };

        newsData[g].push(newItem);

        form.reset();
        renderNewsAdmin();
        await saveNewsGrade(g);

        await logSystemChange("create", "news", {
          grade: g,
          subject: newItem.title,
          topic: newItem.body,
          itemsCount: newsData[g].length
        });

        alert("הידיעה נשמרה.");
      } catch (err) {
        console.error("שגיאה בהעלאת תמונה/שמירת חדשות:", err);
        alert(
          "שגיאה בשמירת הידיעה:\n" +
            (err.code ? err.code + " – " : "") +
            (err.message || JSON.stringify(err))
        );
      }
    });
  }
}

/* ------------ EXAMS ------------ */

async function saveExamsGrade(grade) {
  const items = examsData[grade] || [];
  const refDoc = doc(db, "exams", grade);
  await setDoc(refDoc, { items });
}

function renderExamsAdmin() {
  function parseDateForSort(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (!s) return null;

    const matchIL = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (matchIL) {
      let day = Number(matchIL[1]);
      let month = Number(matchIL[2]);
      let year = Number(matchIL[3]);
      if (year < 100) year = 2000 + year;
      return new Date(year, month - 1, day);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    }

    const dObj = new Date(s);
    return isNaN(dObj.getTime()) ? null : dObj;
  }

  for (const g of GRADES) {
    const listEl = document.getElementById(`admin-exams-${g}`);
    if (!listEl) continue;

    const items = examsData[g] || [];

    if (!items.length) {
      listEl.innerHTML = `<p class="empty-msg">אין מבחנים.</p>`;
      continue;
    }

    const parts = [];
    const classIdsForGrade = CLASS_IDS_BY_GRADE[g] || [];

    classIdsForGrade.forEach((classId) => {
      let examsForClass = items
        .map((ex, index) => ({
          ...ex,
          _index: index,
          _dateObj: parseDateForSort(ex.date)
        }))
        .filter((ex) => String(ex.classId).toLowerCase() === classId);

      if (!examsForClass.length) return;

      examsForClass.sort((a, b) => {
        const da = a._dateObj ? a._dateObj.getTime() : Infinity;
        const db = b._dateObj ? b._dateObj.getTime() : Infinity;
        return da - db;
      });

      const classLabel = classIdToLabel(classId);

      parts.push(`
        <h4 class="admin-class-title" style="margin-top:16px;margin-bottom:6px;">
          כיתה ${escapeHtml(classLabel)}
        </h4>
      `);

      examsForClass.forEach((ex) => {
        const metaParts = [];

        if (ex.date) metaParts.push(escapeHtml(ex.date));
        if (ex.time) metaParts.push(escapeHtml(ex.time));
        if (classLabel) metaParts.push("כיתה " + escapeHtml(classLabel));

        const metaText = metaParts.join(" · ");

        parts.push(`
          <div class="admin-item">
            <div class="admin-item-main">
              <strong>${escapeHtml(ex.subject || "")}</strong>
              <span class="admin-item-meta">${metaText}</span>
            </div>
            <div class="admin-item-body">${escapeHtml(ex.topic || "")}</div>
            <button class="admin-remove"
                    data-type="exam"
                    data-grade="${g}"
                    data-index="${ex._index}">
              מחיקה
            </button>
          </div>
        `);
      });
    });

    const knownIdsSet = new Set(classIdsForGrade);
    let unassigned = items
      .map((ex, index) => ({
        ...ex,
        _index: index,
        _dateObj: parseDateForSort(ex.date)
      }))
      .filter((ex) => !knownIdsSet.has(String(ex.classId).toLowerCase()));

    if (unassigned.length) {
      unassigned.sort((a, b) => {
        const da = a._dateObj ? a._dateObj.getTime() : Infinity;
        const db = b._dateObj ? b._dateObj.getTime() : Infinity;
        return da - db;
      });

      parts.push(`
        <h4 class="admin-class-title" style="margin-top:16px;margin-bottom:6px;">
          ללא כיתה מוכרת
        </h4>
      `);

      unassigned.forEach((ex) => {
        const metaParts = [];

        if (ex.date) metaParts.push(escapeHtml(ex.date));
        if (ex.time) metaParts.push(escapeHtml(ex.time));
        if (ex.classId) metaParts.push("classId=" + escapeHtml(ex.classId));

        const metaText = metaParts.join(" · ");

        parts.push(`
          <div class="admin-item">
            <div class="admin-item-main">
              <strong>${escapeHtml(ex.subject || "")}</strong>
              <span class="admin-item-meta">${metaText}</span>
            </div>
            <div class="admin-item-body">${escapeHtml(ex.topic || "")}</div>
            <button class="admin-remove"
                    data-type="exam"
                    data-grade="${g}"
                    data-index="${ex._index}">
              מחיקה
            </button>
          </div>
        `);
      });
    }

    listEl.innerHTML = parts.join("");
  }
}

function setupExamForms() {
  for (const g of GRADES) {
    const form = document.getElementById(`exams-form-${g}`);
    if (!form) continue;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const date = form.date.value.trim();
      const time = form.time ? form.time.value.trim() : "";
      const subject = form.subject.value.trim();
      const topic = form.topic.value.trim();
      const classIdRaw = form.classId ? form.classId.value.trim() : "";
      const classId = classIdRaw.toLowerCase();
      const imageUrl =
        (form.imageUrl && form.imageUrl.value && form.imageUrl.value.trim()) ||
        "";

      if (!date || !subject || !classId) {
        alert("חובה למלא תאריך, מקצוע וכיתה.");
        return;
      }

      if (!CLASS_IDS_BY_GRADE[g].includes(classId)) {
        alert("כיתה לא חוקית עבור השכבה הזאת.");
        return;
      }

      const newExam = {
        date,
        time,
        subject,
        topic,
        classId,
        imageUrl
      };

      if (!examsData[g]) examsData[g] = [];
      examsData[g].push(newExam);

      try {
        form.reset();
        renderExamsAdmin();
        await saveExamsGrade(g);

        await logSystemChange("create", "exam", {
          grade: g,
          classId: newExam.classId,
          subject: newExam.subject,
          date: newExam.date,
          time: newExam.time,
          topic: newExam.topic,
          itemsCount: examsData[g].length
        });

        alert("המבחן נשמר.");
      } catch (err) {
        console.error("שגיאה בשמירת מבחן:", err);
        alert("שגיאה בשמירת המבחן. נסו שוב.");
      }
    });
  }
}

/* ------------ POLLS (סקרים) ------------ */

async function loadPolls() {
  const listEl = document.getElementById("admin-polls");
  try {
    const snap = await getDocs(pollsCollectionRef);
    pollsData = [];
    snap.forEach((docSnap) => {
      pollsData.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    renderPollsAdmin();
  } catch (err) {
    console.error("שגיאה בטעינת סקרים:", err);
    if (listEl) {
      listEl.innerHTML =
        `<p class="empty-msg">שגיאה בטעינת הסקרים. בדוק את ה-console.</p>`;
    }
  }
}

function renderPollsAdmin() {
  const listEl = document.getElementById("admin-polls");
  if (!listEl) return;

  if (!pollsData.length) {
    listEl.innerHTML = `<p class="empty-msg">אין סקרים עדיין.</p>`;
    return;
  }

  listEl.innerHTML = pollsData
    .map((poll) => {
      const totalVotes = (poll.options || []).reduce(
        (sum, opt) => sum + (opt.votes || 0),
        0
      );

      const optionsHtml = (poll.options || [])
        .map((opt) => {
          const votes = opt.votes || 0;
          const percent =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

          return `
            <div class="poll-option-row">
              <span class="poll-option-text">${escapeHtml(opt.text || "")}</span>
              <span class="poll-option-votes">
                ${votes} קולות (${percent}%)
              </span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="admin-item">
          <div class="admin-item-main">
            <strong>${escapeHtml(poll.question || "")}</strong>
            <span class="admin-item-meta">
              ${poll.isActive ? "פעיל ✅" : "מושבת ⛔️"} · ${totalVotes} קולות
            </span>
          </div>
          <div class="admin-item-body">
            ${optionsHtml}
          </div>
          <div class="admin-item-actions">
            <button
              class="admin-remove"
              data-type="poll"
              data-id="${poll.id}"
            >
              מחיקת סקר
            </button>
            <button
              class="admin-toggle-poll"
              data-id="${poll.id}"
              data-active="${poll.isActive ? "1" : "0"}"
            >
              ${poll.isActive ? "הפוך ללא פעיל" : "הפוך לפעיל"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function setupPollForm() {
  const form = document.getElementById("poll-form");
  if (!form) {
    console.warn("poll-form not found in DOM");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const question = form.question.value.trim();
    const opt1 = form.option1.value.trim();
    const opt2 = form.option2.value.trim();
    const opt3 = form.option3.value.trim();
    const opt4 = form.option4.value.trim();
    const isActive = form.isActive.checked;

    if (!question || !opt1 || !opt2) {
      alert("חובה למלא שאלה + לפחות שתי אפשרויות.");
      return;
    }

    const options = [];
    if (opt1) options.push({ id: "a", text: opt1, votes: 0 });
    if (opt2) options.push({ id: "b", text: opt2, votes: 0 });
    if (opt3) options.push({ id: "c", text: opt3, votes: 0 });
    if (opt4) options.push({ id: "d", text: opt4, votes: 0 });

    try {
      await addDoc(pollsCollectionRef, {
        question,
        options,
        isActive,
        createdAt: serverTimestamp()
      });

      await logSystemChange("create", "poll", {
        subject: question,
        itemsCount: options.length
      });

      form.reset();
      form.isActive.checked = true;

      await loadPolls();
      alert("הסקר נוצר בהצלחה.");
    } catch (err) {
      console.error("שגיאה ביצירת סקר:", err);
      alert("שגיאה ביצירת הסקר. בדוק console.");
    }
  });
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
        <button class="admin-remove" data-type="board" data-index="${i}">מחיקה</button>
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
    const manualImageUrl =
      (form.imageUrl && form.imageUrl.value && form.imageUrl.value.trim()) || "";
    const color =
      (form.color && form.color.value && form.color.value.trim()) || "#ffffff";

    const fileInput = form.imageFile;
    const file = fileInput && fileInput.files && fileInput.files[0];

    if (!title || !body) {
      alert("חובה למלא כותרת ותוכן.");
      return;
    }

    try {
      let finalImageUrl = manualImageUrl;

      if (file) {
        const filePath = `board/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        await uploadBytes(fileRef, file);
        finalImageUrl = await getDownloadURL(fileRef);
      }

      const newBoardItem = {
        title,
        meta,
        body,
        imageUrl: finalImageUrl,
        color
      };

      boardData.push(newBoardItem);

      form.reset();
      renderBoardAdmin();
      await saveBoard();

      await logSystemChange("create", "board", {
        subject: newBoardItem.title,
        topic: newBoardItem.body,
        itemsCount: boardData.length
      });

      alert("המודעה נשמרה.");
    } catch (err) {
      console.error("שגיאה בהעלאת תמונה/שמירת מודעה:", err);
      alert("הייתה שגיאה בשמירת המודעה. נסו שוב.");
    }
  });
}

/* ------------ SITE CONTENT ------------ */

async function loadSiteContent() {
  const data = await getDocSafe(["siteContent", "main"], {});
  siteContent = data || {};
  fillSiteContentForm();
}

function fillSiteContentForm() {
  const form = document.getElementById("site-content-form");
  if (!form) return;

  const fields = [
    "homeHeroTitle",
    "homeHeroSubtitle",
    "heroSideTitle",
    "heroSideList",
    "aboutTitle",
    "aboutBody",
    "importantTitle",
    "importantSubtitle",
    "importantCard1Title",
    "importantCard1Body",
    "importantCard2Title",
    "importantCard2Body",
    "importantCard3Title",
    "importantCard3Body",
    "homeNewsTitle",
    "homeNewsSubtitle",
    "boardTitle",
    "boardSubtitle",
    "homeExamsTitle",
    "homeExamsSubtitle",
    "gradesSectionTitle",
    "gradesSectionSubtitle",
    "zDescription",
    "hDescription",
    "tDescription",
    "requestsTitle",
    "requestsSubtitle",
    "requestsBody",
    "contactSectionTitle",
    "contactSectionSubtitle",
    "contactPhone",
    "contactEmail",
    "contactAddress",
    "footerText",
    "logoUrl",
    "heroImageUrl",
    "cardBgImageUrl",
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

    await logSystemChange("update", "siteContent", {
      subject: "siteContent",
      topic: "עדכון תוכן האתר"
    });

    alert("תוכן האתר נשמר בהצלחה.");
  });
}

/* ------------ REGISTER REQUESTS ------------ */

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

      await logSystemChange("create", "adminRequest", {
        subject: fullName,
        topic: message
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

/* ------------ DELETE + TOGGLE HANDLER ------------ */

function setupDeleteHandler() {
  document.addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest(".admin-toggle-poll");
    if (toggleBtn) {
      const pollId = toggleBtn.dataset.id;
      const isActiveNow = toggleBtn.dataset.active === "1";
      if (!pollId) return;

      try {
        await updateDoc(doc(db, "polls", pollId), {
          isActive: !isActiveNow
        });

        const poll = pollsData.find((p) => p.id === pollId);
        await logSystemChange("update", "poll", {
          subject: poll ? poll.question : null,
          topic: !isActiveNow ? "הופעל" : "הופסק"
        });

        await loadPolls();
      } catch (err) {
        console.error("שגיאה בעדכון סטטוס סקר:", err);
        alert("שגיאה בעדכון סטטוס הסקר.");
      }
      return;
    }

    const btn = e.target.closest(".admin-remove");
    if (!btn) return;

    const type = btn.dataset.type;
    const grade = btn.dataset.grade;
    const index = Number(btn.dataset.index);

    if (!confirm("למחוק את הפריט הזה?")) return;

    if (type === "news") {
      const deletedNews = newsData[grade][index];
      newsData[grade].splice(index, 1);
      renderNewsAdmin();
      await saveNewsGrade(grade);

      if (deletedNews) {
        await logSystemChange("delete", "news", {
          grade,
          subject: deletedNews.title,
          topic: deletedNews.body,
          itemsCount: newsData[grade].length
        });
      }
    } else if (type === "exam") {
      if (!examsData[grade]) return;

      const deletedExam = examsData[grade][index];

      examsData[grade].splice(index, 1);
      renderExamsAdmin();
      await saveExamsGrade(grade);

      if (deletedExam) {
        await logSystemChange("delete", "exam", {
          grade,
          classId: deletedExam.classId,
          subject: deletedExam.subject,
          date: deletedExam.date,
          time: deletedExam.time,
          topic: deletedExam.topic,
          itemsCount: examsData[grade].length
        });
      }
    } else if (type === "board") {
      const deletedBoard = boardData[index];
      boardData.splice(index, 1);
      renderBoardAdmin();
      await saveBoard();

      if (deletedBoard) {
        await logSystemChange("delete", "board", {
          subject: deletedBoard.title,
          topic: deletedBoard.body,
          itemsCount: boardData.length
        });
      }
    } else if (type === "poll") {
      const pollId = btn.dataset.id;
      if (!pollId) return;

      const deletedPoll = pollsData.find((p) => p.id === pollId);

      try {
        await deleteDoc(doc(db, "polls", pollId));
        await loadPolls();

        await logSystemChange("delete", "poll", {
          subject: deletedPoll ? deletedPoll.question : null
        });

        alert("הסקר נמחק.");
      } catch (err) {
        console.error("שגיאה במחיקת סקר:", err);
        alert("שגיאה במחיקת הסקר.");
      }
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

/* ------------ MAIN INIT ------------ */

function initAdmin() {
  console.log("admin.js initAdmin()");
  initAuth();
  setupNewsForms();
  setupExamForms();
  setupBoardForm();
  setupPollForm();
  setupDeleteHandler();
  setupSiteContentForm();
  setupGradeFilter();
  setupRegisterRequestForm();
}

// לוודא שה־init רץ תמיד, גם אם DOMContentLoaded כבר קרה
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdmin);
} else {
  initAdmin();
}
