// firebase-config.js
// קובץ הגדרה אחד לכל האתר (תלמידים + אדמין + הרשמה + גלריה)
// ✅ כולל App Check (reCAPTCHA v3) להגנה נגד ספאם/בוטים — לא פוגע בשום דבר קיים

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// ✅ App Check
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app-check.js";

// ===== הגדרות הפרויקט שלך בפיירבייס =====
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

// ===== 🔒 App Check (reCAPTCHA v3) =====
// ⚠️ לשים פה את ה-SITE KEY מה-Firebase Console -> App Check -> reCAPTCHA v3
// זה לא משנה כלום בפיצ'רים הקיימים — רק מוסיף שכבת הגנה.
// אם עוד לא הגדרת App Check בקונסול, האתר עדיין יעבוד (עד שתפעיל Enforcement).
try {
  const RECAPTCHA_V3_SITE_KEY = "6LecyTcsAAAAAMWJOkJ3vlnc2moBVC8EDgrWiOUJ";

  // אם לא החלפת את ה-placeholder, לא מפעילים כדי לא ליצור רעש בקונסול
  if (RECAPTCHA_V3_SITE_KEY && !RECAPTCHA_V3_SITE_KEY.includes("PASTE_YOUR")) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    console.log("🛡️ App Check enabled");
  } else {
    console.warn("🛡️ App Check not enabled: missing reCAPTCHA v3 site key");
  }
} catch (err) {
  console.warn("🛡️ App Check init skipped (non-breaking):", err);
}

// Firestore — בסיס הנתונים
const db = getFirestore(app);

// Auth — התחברות אדמין
const auth = getAuth(app);

// Storage — אחסון קבצים (תמונות וכו')
const storage = getStorage(app);

// ===== ייצוא לשאר הקבצים =====
export { app, db, auth, storage };
