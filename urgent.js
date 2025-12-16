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

function ensureUrgentStyles() {
  if (document.getElementById("urgent-inline-styles")) return;

  const style = document.createElement("style");
  style.id = "urgent-inline-styles";
  style.textContent = `
    /* מרכז + רוחב נעים */
    #urgent-wrap{ width:100%; }

    .urgent-bar{
      width: min(1200px, calc(100% - 28px));
      margin: 18px auto;
      border-radius: 16px;
      padding: 10px 12px;
      border: 1px solid rgba(148,163,184,.35);
      overflow: hidden;
      direction: rtl; /* badge מימין */
      box-shadow: 0 10px 30px rgba(2,6,23,.06);
      background: rgba(255,255,255,.75);
    }
    html[data-theme="dark"] .urgent-bar{
      background: rgba(2,6,23,.22);
      box-shadow: 0 10px 30px rgba(0,0,0,.22);
    }

    .urgent-bar[data-type="danger"]{ background: rgba(239,68,68,.12); }
    .urgent-bar[data-type="warn"]{ background: rgba(245,158,11,.14); }
    .urgent-bar[data-type="info"]{ background: rgba(59,130,246,.12); }

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
      flex: 0 0 auto;
    }

    /* הטריק: שולטים באנימציה ב-LTR כדי שהמרקיי יזוז חלק, אבל הטקסט עצמו נשאר RTL */
    .urgent-track{
      position: relative;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      direction: ltr;
    }

    .urgent-runner{
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      will-change: transform;
      animation: urgentMarquee var(--urgent-speed, 10s) linear infinite;
    }

    .urgent-item{
      display: inline-flex;
      align-items: center;
      direction: rtl;
      unicode-bidi: plaintext;
      font-weight: 900;
      opacity: .92;
      padding-right: 44px; /* רווח לפני “הסיבוב הבא” */
    }

    @keyframes urgentMarquee{
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }

    @media (prefers-reduced-motion: reduce){
      .urgent-runner{ animation: none; }
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

// מהירות: קצר = מהיר יותר, ארוך = קצת יותר זמן כדי שיהיה קריא
function calcSpeedSeconds(text) {
  const len = String(text || "").length;
  // בערך: 7–16 שניות
  const s = 7 + Math.min(9, len / 14);
  return Math.max(7, Math.min(16, s));
}

let lastKey = "";

function renderTicker(text, type) {
  if (!wrap) return;

  ensureUrgentStyles();

  const safeType = ["info", "warn", "danger"].includes(type) ? type : "info";
  const safeText = escapeHtml(text);

  const key = `${safeType}::${safeText}`;
  if (key === lastKey) return;
  lastKey = key;

  const speed = calcSpeedSeconds(text);

wrap.innerHTML = `
  <div class="urgent-bar"
       data-type="${safeType}"
       role="status"
       aria-live="polite"
       style="--urgent-speed:${speed}s; --urgent-speed-mobile:${Math.max(speed + 3, 11)}s;">
       
    <div class="urgent-inner">
      <div class="urgent-badge">
        ${typeToBadge(safeType)}
      </div>

      <div class="urgent-track" aria-label="הודעה דחופה">
        <span class="urgent-text">
          ${safeText}
        </span>
      </div>
    </div>
  </div>
`;


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
