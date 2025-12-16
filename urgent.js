// urgent.js
import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const wrap = document.getElementById("urgent-wrap");

function escapeHtml(str) {
  return String(str ?? "")
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

// נכניס CSS פעם אחת (מהירות + טיקר בלי כפילות)
function ensureUrgentStyles() {
  if (document.getElementById("urgent-inline-styles")) return;

  const style = document.createElement("style");
  style.id = "urgent-inline-styles";
  style.textContent = `
    .urgent-bar{
      border-radius: 16px;
      padding: 10px 12px;
      border: 1px solid rgba(148,163,184,.35);
      background: rgba(255,255,255,.7);
      overflow: hidden;
    }
    html[data-theme="dark"] .urgent-bar{
      background: rgba(2,6,23,.22);
    }

    .urgent-inner{
      display:flex;
      align-items:center;
      gap:10px;
      min-width:0;
    }

    .urgent-badge{
      font-weight: 900;
      padding: 6px 10px;
      border-radius: 999px;
      white-space: nowrap;
      border: 1px solid rgba(148,163,184,.35);
      background: rgba(148,163,184,.12);
    }

    .urgent-bar[data-type="danger"]{ background: rgba(239,68,68,.12); }
    .urgent-bar[data-type="warn"]{ background: rgba(245,158,11,.14); }
    .urgent-bar[data-type="info"]{ background: rgba(59,130,246,.12); }

    .urgent-track{
      position: relative;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
    }

    /* רק טקסט אחד – לא יראו “כפול” */
    .urgent-text{
      display:inline-block;
      padding-inline-start: 12px;
      font-weight: 800;
      will-change: transform;
      animation: urgentMarquee var(--urgent-speed, 10s) linear infinite;
    }

    @keyframes urgentMarquee{
      from { transform: translateX(100%); }
      to   { transform: translateX(-110%); }
    }

    /* אם המשתמש מעדיף בלי אנימציות */
    @media (prefers-reduced-motion: reduce){
      .urgent-text{ animation: none; }
    }
  `;
  document.head.appendChild(style);
}

function hideTicker() {
  if (!wrap) return;
  wrap.style.display = "none";
  wrap.innerHTML = "";
}

function showTicker() {
  if (!wrap) return;
  wrap.style.display = "";
}

// חישוב מהירות: טקסט ארוך -> יותר זמן, קצר -> יותר מהיר.
// (יותר “מהר” = זמן קטן יותר)
function calcSpeedSeconds(text) {
  const len = String(text || "").length;
  // בסיס מהיר:
  // קצר מאוד: ~6s, בינוני: 8-10s, ארוך מאוד: עד 16s
  const s = 5.5 + Math.min(10.5, len / 18);
  return Math.max(5.5, Math.min(16, s));
}

// כדי לא לרנדר מחדש בלי צורך (מונע “כפול” בגלל רענונים)
let lastKey = "";

function renderTicker(text, type) {
  if (!wrap) return;

  ensureUrgentStyles();

  const safeText = escapeHtml(text);
  const safeType = ["info", "warn", "danger"].includes(type) ? type : "info";

  const key = `${safeType}::${safeText}`;
  if (key === lastKey) return; // אין שינוי -> לא מרנדר
  lastKey = key;

  const speed = calcSpeedSeconds(text);

  wrap.innerHTML = `
    <div class="urgent-bar" data-type="${safeType}" role="status" aria-live="polite" style="--urgent-speed:${speed}s;">
      <div class="urgent-inner">
        <div class="urgent-badge">${typeToBadge(safeType)}</div>
        <div class="urgent-track">
          <span class="urgent-text">${safeText}</span>
        </div>
      </div>
    </div>
  `;
}

function bootUrgent() {
  if (!wrap) return;

  const ref = doc(db, "site", "urgent");

  onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        lastKey = "";
        hideTicker();
        return;
      }

      const data = snap.data() || {};
      const active = !!data.active;
      const text = String(data.text || "").trim();
      const type = String(data.type || "info");

      if (!active || !text) {
        lastKey = "";
        hideTicker();
        return;
      }

      showTicker();
      renderTicker(text, type);
    },
    (err) => {
      console.error("urgent ticker snapshot error:", err);
      lastKey = "";
      hideTicker();
    }
  );
}

bootUrgent();
