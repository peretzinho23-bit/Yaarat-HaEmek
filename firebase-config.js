// firebase-config.js
// הגדרה אחת מסודרת לכל האפליקציה (Admin + Register + אתר)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// ===== הגדרות הפרויקט שלך בפיירבייס =====
const firebaseConfig = {
  apiKey: "AIzaSyApQJiqGAjb6Rz9wkf2vgWWM96I3zKaNYI",
  authDomain: "yaarat-haemek.firebaseapp.com",
  projectId: "yaarat-haemek",
  storageBucket: "yaarat-haemek.firebasestorage.app",
  messagingSenderId: "202134140284",
  appId: "1:202134140284:web:e66c683edd7091bfb2e0f9",
  measurementId: "G-K0BSXBWE1S"
};

// ===== חיבור פיירבייס =====
const app = initializeApp(firebaseConfig);

// Firestore — בסיס הנתונים
const db = getFirestore(app);

// Auth — מערכת התחברות
const auth = getAuth(app);

// Storage — אחסון קבצים (תמונות/קבצים בעתיד)
const storage = getStorage(app);

// ===== ייצוא לכל שאר הקבצים =====
export { app, db, auth, storage };
