import { db, auth } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const statusPill = document.getElementById("statusPill");
const loginCard = document.getElementById("loginCard");
const editor = document.getElementById("editor");
const loginMsg = document.getElementById("loginMsg");
const saveMsg = document.getElementById("saveMsg");

const emailEl = document.getElementById("email");
const passEl = document.getElementById("pass");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const weekStartEl = document.getElementById("weekStart");
const loadBtn = document.getElementById("loadBtn");
const saveBtn = document.getElementById("saveBtn");

const fields = ["sun","mon","tue","wed","thu","fri"].reduce((acc,k)=>{
  acc[k] = document.getElementById(k);
  return acc;
},{});

function isoToSundayId(isoDateStr){
  // מקבל YYYY-MM-DD (מה-input date)
  return isoDateStr;
}

function getThisSundayISO(date = new Date()){
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

async function isAdmin(user){
  if (!user) return false;
  try{
    const snap = await getDoc(doc(db, "adminUsers", user.uid));
    return snap.exists(); // אצלך זה כבר עובד ככה בדפים אחרים
  }catch(e){
    console.error("admin check failed:", e);
    return false;
  }
}

function showEditor(ok){
  editor.classList.toggle("hide", !ok);
  logoutBtn.style.display = ok ? "" : "none";
}

function setStatus(text){
  if (statusPill) statusPill.textContent = text;
}

function clearForm(){
  Object.values(fields).forEach(el => el.value = "");
}

async function loadWeek(weekId){
  saveMsg.textContent = "";
  clearForm();
  setStatus("טוען שבוע…");

  const snap = await getDoc(doc(db, "weeklyPlans", weekId));
  if (!snap.exists()){
    setStatus(`שבוע ${weekId} (חדש)`);
    return;
  }

  const data = snap.data() || {};
  for (const k of Object.keys(fields)){
    fields[k].value = String(data[k] || "");
  }
  setStatus(`שבוע ${weekId} נטען`);
}

async function saveWeek(weekId, uid){
  saveMsg.textContent = "";
  const payload = {
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  for (const k of Object.keys(fields)){
    payload[k] = String(fields[k].value || "").trim();
  }

  await setDoc(doc(db, "weeklyPlans", weekId), payload, { merge: true });
  saveMsg.textContent = "✅ נשמר בהצלחה. האינדקס יציג אוטומטית את התוכנית של היום.";
  setStatus(`שבוע ${weekId} נשמר`);
}

loginBtn?.addEventListener("click", async () => {
  loginMsg.textContent = "";
  try{
    await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
  }catch(e){
    console.error(e);
    loginMsg.textContent = "❌ התחברות נכשלה (בדוק אימייל/סיסמה).";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

loadBtn?.addEventListener("click", async () => {
  const id = isoToSundayId(weekStartEl.value);
  if (!id) return;
  await loadWeek(id);
});

saveBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const id = isoToSundayId(weekStartEl.value);
  if (!id) return;
  try{
    await saveWeek(id, user.uid);
  }catch(e){
    console.error(e);
    saveMsg.textContent = "❌ שגיאה בשמירה (בדוק Rules / Console).";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user){
    setStatus("לא מחובר");
    showEditor(false);
    loginCard.classList.remove("hide");
    weekStartEl.value = getThisSundayISO();
    return;
  }

  setStatus("בודק הרשאות…");
  const ok = await isAdmin(user);

  if (!ok){
    setStatus("מחובר אבל לא אדמין");
    showEditor(false);
    loginCard.classList.remove("hide");
    loginMsg.textContent = "❌ אין הרשאת אדמין למשתמש הזה.";
    return;
  }

  setStatus(`מחובר כאדמין`);
  showEditor(true);
  loginCard.classList.add("hide");

  // ברירת מחדל: השבוע הנוכחי
  weekStartEl.value = getThisSundayISO();
  await loadWeek(weekStartEl.value);
});
