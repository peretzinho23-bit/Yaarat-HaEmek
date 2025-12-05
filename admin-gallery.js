// admin-gallery.js – העלאת תמונות ל־Firebase Storage + שמירה ב־Firestore

import { db, storage } from "./firebase-config.js";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

document.addEventListener("DOMContentLoaded", () => {
  const form        = document.getElementById("gallery-form");
  const listEl      = document.getElementById("gallery-list");
  const statusEl    = document.getElementById("gallery-status");
  const fileInput   = document.getElementById("galleryFile");
  const titleInput  = document.getElementById("galleryTitle");
  const descInput   = document.getElementById("galleryDesc");

  if (!form || !listEl) {
    console.warn("גלריה: לא נמצאו אלמנטים בדף (form או list).");
    return;
  }

  // ---------- האזנה בזמן אמת לגלריה (Firestore) ----------
  const galleryRef  = collection(db, "gallery");
  const galleryQ    = query(galleryRef, orderBy("createdAt", "desc"));

  onSnapshot(
    galleryQ,
    (snap) => {
      if (snap.empty) {
        listEl.innerHTML = `<p class="empty-msg">אין עדיין תמונות בגלריה.</p>`;
        return;
      }

      const itemsHtml = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const title = data.title || "ללא כותרת";
        const desc  = data.description || "";
        const url   = data.imageUrl || "";
        const createdAt = data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleString("he-IL")
          : "";

        itemsHtml.push(`
          <div class="admin-item">
            <div class="admin-item-main">
              <div>
                <strong>${escapeHtml(title)}</strong>
                ${
                  createdAt
                    ? `<div class="admin-item-meta">${escapeHtml(createdAt)}</div>`
                    : ""
                }
              </div>
            </div>
            ${
              desc
                ? `<div class="admin-item-body">${escapeHtml(desc)}</div>`
                : ""
            }
            ${
              url
                ? `<img src="${escapeHtml(url)}"
                         alt="${escapeHtml(title)}"
                         class="admin-gallery-thumb">`
                : ""
            }
          </div>
        `);
      });

      listEl.innerHTML = itemsHtml.join("");
    },
    (err) => {
      console.error("שגיאה בטעינת גלריה:", err);
      listEl.innerHTML = `<p class="empty-msg">שגיאה בטעינת הגלריה.</p>`;
    }
  );

  // ---------- שליחת טופס: העלאת קובץ + שמירה ב־Firestore ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!statusEl) return;

    statusEl.textContent = "מעלה תמונה... רגע.";
    statusEl.style.color = "#e5e7eb";

    const file = fileInput.files[0];
    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (!file) {
      statusEl.textContent = "צריך לבחור קובץ תמונה.";
      statusEl.style.color = "#fecaca";
      return;
    }

    try {
      // בדיקת סוג קובץ בסיסית
      if (!file.type.startsWith("image/")) {
        statusEl.textContent = "הקובץ חייב להיות תמונה.";
        statusEl.style.color = "#fecaca";
        return;
      }

      // נתיב בתוך Firebase Storage
      const fileNameSafe = file.name.replace(/\s+/g, "_");
      const storagePath = `gallery/${Date.now()}_${fileNameSafe}`;
      const storageRef = ref(storage, storagePath);

      // העלאה ל־Storage
      await uploadBytes(storageRef, file);

      // קבלת קישור ציבורי
      const downloadUrl = await getDownloadURL(storageRef);

      // שמירת מטה־דאטה ב־Firestore
      await addDoc(galleryRef, {
        title: title || "",
        description: description || "",
        imageUrl: downloadUrl,
        storagePath,
        createdAt: serverTimestamp()
      });

      // ניקוי טופס
      form.reset();
      statusEl.textContent = "התמונה הועלתה ונשמרה בהצלחה!";
      statusEl.style.color = "#bbf7d0";
    } catch (err) {
      console.error("שגיאה בהעלאת תמונה:", err);
      statusEl.textContent =
        "אירעה שגיאה בהעלאת התמונה. בדוק את החיבור או את הגדרות Firebase.";
      statusEl.style.color = "#fecaca";
    }
  });
});

// פונקציה קטנה למניעת XSS
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
