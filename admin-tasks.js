// admin-tasks.js
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const TASKS_DOC_BY_GRADE = { z: "z", h: "h", t: "t" };

function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function renderAdminTasksList(grade, items){
  const box = document.getElementById(`admin-tasks-${grade}`);
  if (!box) return;

  const arr = Array.isArray(items) ? items.slice().reverse().slice(0, 20) : [];
  if (!arr.length){
    box.innerHTML = `<div class="admin-item" style="opacity:.8;">אין משימות עדיין.</div>`;
    return;
  }

  box.innerHTML = arr.map(t => `
    <div class="admin-item">
      <div style="font-weight:900;">${esc(t.title || "משימה")}</div>
      <div style="opacity:.8;font-size:.9rem;margin-top:2px;">
        כיתה: <b>${esc(t.classId||"")}</b>
        ${t.subject ? ` · מקצוע: <b>${esc(t.subject)}</b>` : ""}
      </div>
      <div style="opacity:.8;font-size:.9rem;margin-top:2px;">
        דדליין: <b>${esc(t.dueAt || "")}</b>
      </div>
      <div class="admin-item-body" style="margin-top:6px;white-space:pre-wrap;">${esc(t.text || "")}</div>
    </div>
  `).join("");
}

async function addTask({ grade, classId, subject, title, text, dueAt }) {
  const g = TASKS_DOC_BY_GRADE[grade];
  if (!g) throw new Error("Bad grade");

  // ✅ בדיוק כמו class.js: doc(db,"tasks",grade)
  const ref = doc(db, "tasks", g);

  const task = {
    id: crypto.randomUUID(),
    classId: String(classId).toLowerCase(),
    subject: subject || "",
    title: title || "משימה",
    text: text || "",
    dueAt: dueAt || null,          // נשמור ISO מה-input
    createdAt: new Date().toISOString()
  };

  await setDoc(ref, { items: arrayUnion(task) }, { merge: true });
}

function hookForm(grade){
  const form = document.getElementById(`tasks-form-${grade}`);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const classId = (fd.get("classId") || "").toString().trim();
    const subject = (fd.get("subject") || "").toString().trim();
    const title = (fd.get("title") || "").toString().trim();
    const text = (fd.get("text") || "").toString().trim();
    const dueAtLocal = (fd.get("dueAt") || "").toString().trim();

    if (!classId || !title || !text || !dueAtLocal){
      alert("חסר שדה חובה");
      return;
    }

    // datetime-local נותן "YYYY-MM-DDTHH:mm" — נשמור ISO אמיתי
    const iso = new Date(dueAtLocal).toISOString();

    try{
      await addTask({ grade, classId, subject, title, text, dueAt: iso });
      form.reset();
      alert("המשימה נוספה ✅");
    }catch(err){
      console.error("add task error:", err);
      alert("שגיאה בהוספת משימה (בדוק Console/Rules)");
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
