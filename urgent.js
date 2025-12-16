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

function isValidHex(c) {
  return typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
}

function ensureUrgentStyles() {
  if (document.getElementById("urgent-inline-styles")) return;

  const style = document.createElement("style");
  style.id = "urgent-inline-styles";
  style.textContent = `
    #urgent-wrap{ width:100%; }

    .urgent-bar{
      width: min(1200px, calc(100% - 28px));
      margin: 18px auto;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.35);
      overflow: hidden;
      direction: rtl;
      box-shadow: 0 10px 30px rgba(2,6,23,.06);
      background: rgba(255,255,255,.72);
    }
    html[data-theme="dark"] .urgent-bar{
      background: rgba(2,6,23,.22);
      box-shadow: 0 10px 30px rgba(0,0,0,.22);
    }

    /* רקע לפי סוג (עדין, קצר ולא צועק) */
    .urgent-bar[data-type="danger"]{ background: rgba(239,68,68,.10); }
    .urgent-bar[data-type="warn"]{ background: rgba(245,158,11,.12); }
    .urgent-bar[data-type="info"]{ background: rgba(59,130,246,.10); }

    .urgent-inner{
      display:flex;
      align-items:center;
      gap:10px;
      padding: 10px 12px;
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

    /* המסילה */
    .urgent-track{
      position: relative;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      height: 26px;
      display:flex;
      align-items:center;
      justify-content:flex-start; /* בגלל RTL: זה צמוד לבאדג׳ */
    }

    /* הטקסט: עותק אחד, מתחיל ליד "דחוף" ונוסע שמאלה */
    .urgent-text{
      display:inline-block;
      direction: rtl;
      unicode-bidi: plaintext;
      font-weight: 900;
      opacity: .92;
      will-change: transform;
      transform: translateX(0);
      animation: urgentMove var(--urgent-speed, 10s) linear infinite;
      color: var(--urgent-text-color, #0f172a);
    }
    html[data-theme="dark"] .urgent-text{
      color: var(--urgent-text-color, rgba(255,255,255,.92));
    }

    @keyframes urgentMove{
      from { transform: translateX(0); }
      to   { transform: translateX(calc(-1 * var(--urgent-distance, 600px))); }
    }

    .urgent-bar:hover .urgent-text{ animation-play-state: paused; }

    @media (prefers-reduced-motion: reduce){
      .urgent-text{ animation:none; transform:none; }
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

// מהירות לפי "מרחק" בפיקסלים כדי שיהיה חלק תמיד
function calcDurationByDistancePx(distancePx) {
  const pxPerSec = 120; // יותר גבוה = יותר מהר
  const s = distancePx / pxPerSec;
  return Math.max(6, Math.min(18, s));
}

let lastKey = "";

function renderTicker(text, type, color) {
  if (!wrap) return;

  ensureUrgentStyles();

  const safeType = ["info", "warn", "danger"].includes(type) ? type : "info";
  const safeText = escapeHtml(text);
  const textColor = isValidHex(color) ? color.trim() : "";

  const key = `${safeType}::${safeText}::${textColor}`;
  if (key === lastKey) return;
  lastKey = key;

  wrap.innerHTML = `
    <div class="urgent-bar" data-type="${safeType}" role="status" aria-live="polite">
      <div class="urgent-inner">
        <div class="urgent-badge">${typeToBadge(safeType)}</div>

        <div class="urgent-track" aria-label="הודעה דחופה">
          <span class="urgent-text" style="${textColor ? `--urgent-text-color:${escapeHtml(textColor)};` : ""}">
            ${safeText}
          </span>
        </div>
      </div>
    </div>
  `;

  // מודדים מרחק כדי שייצא מהמסילה לגמרי ואז יחזור להתחלה
  requestAnimationFrame(() => {
    const track = wrap.querySelector(".urgent-track");
    const span = wrap.querySelector(".urgent-text");
    if (!track || !span) return;

    const trackW = track.getBoundingClientRect().width;
    const textW = span.getBoundingClientRect().width;

    // המרחק שצריך לעבור: רוחב הטקסט + רוחב המסילה + רווח קטן
    const distance = Math.ceil(textW + trackW + 40);

    const duration = calcDurationByDistancePx(distance);

    span.style.setProperty("--urgent-distance", `${distance}px`);
    span.style.setProperty("--urgent-speed", `${duration}s`);
  });
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
      const color = data.color;

      if (!active || !text) {
        lastKey = "";
        hideTicker();
        return;
      }

      showTicker();
      renderTicker(text, type, color);
    },
    (err) => {
      console.error("urgent ticker snapshot error:", err);
      lastKey = "";
      hideTicker();
    }
  );
}

bootUrgent();
