// firebase-config.js
// הגדרה אחת מסודרת לכל האפליקציה (Admin + Register + אתר)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// ===== הגדרות הפרויקט שלך בפיירבייס =====
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyApQJiqGAjb6Rz9wkf2vgWWM96I3zKaNYI",
  authDomain: "yaarat-haemek.firebaseapp.com",
  projectId: "yaarat-haemek",
  storageBucket: "yaarat-haemek.firebasestorage.app",
  messagingSenderId: "202134140284",
  appId: "1:202134140284:web:e6d2fa02b2906d50b2e0f9",
  measurementId: "G-20XXKFF4WV"
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
