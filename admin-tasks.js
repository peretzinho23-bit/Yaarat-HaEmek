// admin-tasks.js
import { db } from "./firebase-config.js";
import {
  doc,
  onSnapshot,
  setDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

const TASKS_DOC_BY_GRADE = { z: "z", h: "h", t: "t" };
const storage = getStorage();

function esc(s){
  return String(s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function classIdToLabel(classId){
  const map = {
    z1:"ז1", z2:"ז2", z3:"ז3", z4:"ז4", z5:"ז5",
    h1:"ח1/7", h4:"ח4/8", h5:"ח5/9", h6:"ח6/10",
    t1:"ט1", t2:"ט2", t3:"ט3", t4:"ט4", t5:"ט5"
  };
  const k = String(classId||"").toLowerCase();
  return map[k] || classId || "";
}

function renderAdminTasksList(grade, items){
  const box = document.getElementById(`admin-tasks-${grade}`);
  if (!box) return;

  const arr = Array.isArray(items) ? items.slice().reverse().slice(0, 20) : [];
  if (!arr.length){
    box.innerHTML = `<div class="admin-item" style="opacity:.8;">אין משימות עדיין.</div>`;
    return;
  }

  box.innerHTML = arr.map(t => {
    const fileLink = (t.fileUrl || "").trim()
      ? `<div style="margin-top:6px;">
           📎 <a href="${esc(t.fileUrl)}" target="_blank" rel="noopener">
             ${esc(t.fileName || "פתח קובץ")}
           </a>
         </div>`
      : "";

    return `
      <div class="admin-item">
        <div style="font-weight:900;">${esc(t.title || "משימה")}</div>

        <div style="opacity:.8;font-size:.9rem;margin-top:2px;">
          כיתה: <b>${esc(classIdToLabel(t.classId||""))}</b>
          ${t.subject ? ` · מקצוע: <b>${esc(t.subject)}</b>` : ""}
        </div>

        <div style="opacity:.8;font-size:.9rem;margin-top:2px;">
          דדליין: <b>${esc(t.dueAt ? new Date(t.dueAt).toLocaleString("he-IL") : "")}</b>
        </div>

        <div class="admin-item-body" style="margin-top:6px;white-space:pre-wrap;">${esc(t.text || "")}</div>
        ${fileLink}
      </div>
    `;
  }).join("");
}

function extFromName(name){
  const n = String(name||"");
  const i = n.lastIndexOf(".");
  return i > -1 ? n.slice(i+1).toLowerCase() : "";
}

async function uploadTaskFile({ grade, classId, file }){
  // אפשר לשים מגבלות גודל (מומלץ)
  const maxMB = 20;
  if (file.size > maxMB * 1024 * 1024){
    throw new Error(`קובץ גדול מדי (מקסימום ${maxMB}MB)`);
  }

  const safeGrade = String(grade).toLowerCase();
  const safeClass = String(classId).toLowerCase();
  const id = crypto.randomUUID();
  const ext = extFromName(file.name);
  const cleanName = file.name.replace(/[^\w.\-\s()]/g, "_");

  // נתיב אחסון מסודר
  const path = `tasks/${safeGrade}/${safeClass}/${id}_${cleanName}`;
  const fileRef = sRef(storage, path);

  await uploadBytes(fileRef, file, {
    contentType: file.type || undefined,
    customMetadata: {
      grade: safeGrade,
      classId: safeClass,
      originalName: cleanName,
    }
  });

  const url = await getDownloadURL(fileRef);
  return { fileUrl: url, fileName: cleanName, storagePath: path, fileType: file.type || "", fileSize: file.size };
}

async function addTask({ grade, classId, subject, title, text, dueAt, fileMeta }) {
  const g = TASKS_DOC_BY_GRADE[grade];
  if (!g) throw new Error("Bad grade");

  const ref = doc(db, "tasks", g);

  const task = {
    id: crypto.randomUUID(),
    classId: String(classId).toLowerCase(),
    subject: subject || "",
    title: title || "משימה",
    text: text || "",
    dueAt: dueAt || null,
    createdAt: new Date().toISOString(),

    // קובץ (אופציונלי)
    fileUrl: fileMeta?.fileUrl || "",
    fileName: fileMeta?.fileName || "",
    storagePath: fileMeta?.storagePath || "",
    fileType: fileMeta?.fileType || "",
    fileSize: fileMeta?.fileSize || 0,
  };

  await setDoc(ref, { items: arrayUnion(task) }, { merge: true });
}

function hookForm(grade){
  const form = document.getElementById(`tasks-form-${grade}`);
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const classId = (fd.get("classId") || "").toString().trim();
    const subject = (fd.get("subject") || "").toString().trim();
    const title = (fd.get("title") || "").toString().trim();
    const text = (fd.get("text") || "").toString().trim();
    const dueAtLocal = (fd.get("dueAt") || "").toString().trim();

    const file = form.querySelector('input[type="file"][name="file"]')?.files?.[0] || null;

    if (!classId || !title || !text || !dueAtLocal){
      alert("חסר שדה חובה");
      return;
    }

    // datetime-local → ISO
    const iso = new Date(dueAtLocal).toISOString();

    try{
      if (submitBtn){
        submitBtn.disabled = true;
        submitBtn.textContent = "מעלה...";
      }

      let fileMeta = null;
      if (file){
        // 1) העלאה ל-Storage
        fileMeta = await uploadTaskFile({ grade, classId, file });
      }

      // 2) שמירה ל-Firestore עם קישור
      await addTask({ grade, classId, subject, title, text, dueAt: iso, fileMeta });

      form.reset();
      alert("המשימה נוספה ✅");
    }catch(err){
      console.error("add task error:", err);
      alert(err?.message || "שגיאה בהוספת משימה (בדוק Console/Rules)");
    }finally{
      if (submitBtn){
        submitBtn.disabled = false;
        submitBtn.textContent = "הוסף משימה";
      }
    }
  });
}

function startTasksRealtime(grade){
  const g = TASKS_DOC_BY_GRADE[grade];
  if (!g) return;

  const ref = doc(db, "tasks", g);
  onSnapshot(ref, (snap) => {
    const items = snap.exists() ? (snap.data()?.items || []) : [];
    renderAdminTasksList(grade, items);
  }, (err) => {
    console.error("tasks snapshot error:", err);
    renderAdminTasksList(grade, []);
  });
}

function init(){
  ["z","h","t"].forEach(g=>{
    hookForm(g);
    startTasksRealtime(g);
  });
}

document.addEventListener("DOMContentLoaded", init);
