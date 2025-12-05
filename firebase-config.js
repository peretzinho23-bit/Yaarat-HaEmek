// firebase-config.js
// קובץ הגדרה אחד לכל האתר (תלמידים + אדמין + הרשמה + גלריה)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// ===== הגדרות הפרויקט שלך בפיירבייס =====
// שים לב: storageBucket צריך להיות בדיוק כמו שמופיע לך ב-Firebase Console
// בדרך כלל זה projectId + ".appspot.com"
const firebaseConfig = {
  apiKey: "AIzaSyApQJiqGAjb6Rz9wkf2vgWWM96I3zKaNYI",
  authDomain: "yaarat-haemek.firebaseapp.com",
  projectId: "yaarat-haemek",
  storageBucket: "yaarat-haemek.appspot.com", // ← אם בקונסול כתוב משהו אחר – תחליף לזה
  messagingSenderId: "202134140284",
  appId: "1:202134140284:web:e6d2fa02b2906d50b2e0f9",
  measurementId: "G-20XXKFF4WV"
};

// ===== חיבור פיירבייס =====
const app = initializeApp(firebaseConfig);

// Firestore — בסיס הנתונים
const db = getFirestore(app);

// Auth — התחברות אדמין
const auth = getAuth(app);

// Storage — אחסון קבצים (תמונות גלריה וכו')
const storage = getStorage(app);

// ===== ייצוא לשאר הקבצים =====
export { app, db, auth, storage };
