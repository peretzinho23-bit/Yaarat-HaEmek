// urgent.js
import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const wrap = document.getElementById("urgent-wrap");

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typeToBadge(type) {
  if (type === "danger") return "🚨 דחוף";
  if (type === "warn") return "⚠️ שימו לב";
  return "📢 הודעה";
}

function renderTicker(text, type) {
  const safe = escapeHtml(text);

  wrap.innerHTML = `
    <div class="urgent-bar" data-type="${escapeHtml(type)}" role="status" aria-live="polite">
      <div class="urgent-inner">
        <div class="urgent-badge">${typeToBadge(type)}</div>

        <div class="urgent-track">
          <!-- שני עותקים לאפקט “ריצה” חלקה -->
          <div class="urgent-runner">
            <span class="urgent-text">${safe}</span>
            <span class="urgent-text">${safe}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function hideTicker() {
  wrap.style.display = "none";
  wrap.innerHTML = "";
}

function showTicker() {
  wrap.style.display = "";
}

function bootUrgent() {
  if (!wrap) return;

  const ref = doc(db, "site", "urgent");

  onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      hideTicker();
      return;
    }

    const data = snap.data() || {};
    const active = !!data.active;
    const text = String(data.text || "").trim();
    const type = ["info", "warn", "danger"].includes(data.type) ? data.type : "info";

    if (!active || !text) {
      hideTicker();
      return;
    }

    showTicker();
    renderTicker(text, type);
  }, (err) => {
    console.error("urgent ticker snapshot error:", err);
    hideTicker();
  });
}

bootUrgent();
