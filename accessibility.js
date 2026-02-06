// accessibility.js — A11Y Bar v6 (RTL) — HARD CLOSED BY DEFAULT + open-trace + duplicate killer
(() => {
  "use strict";

  const VERSION = "v6";
  const STORAGE_KEY = "yaarat-accessibility-v6";
  const ROOT = document.documentElement;

  // hard stop if loaded twice
  if (window.__YAARAT_A11Y_INIT__ === VERSION) return;
  window.__YAARAT_A11Y_INIT__ = VERSION;

  // ===== Utils =====
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const FONT_SCALE_VALUES = [1, 1.08, 1.16, 1.25];
  const LINE_HEIGHT_VALUES = [1.5, 1.7, 1.9];
  const LETTER_SPACE_VALUES = [0, 0.02, 0.04];

  const DEFAULT = {
    fontScale: 0,        // 0..3
    contrast: false,
    underlineLinks: false,
    bigCursor: false,
    lineHeight: 0,       // 0..2
    letterSpace: 0,      // 0..2
    grayscale: false,
    reduceMotion: false,
    focusRing: true,
  };

  function safeParse(raw) {
    try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : null; }
    catch { return null; }
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { ...DEFAULT, ...(raw ? (safeParse(raw) || {}) : {}) };
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  // ===== 1) Kill duplicates / old =====
  function killOld() {
    [
      "accessibility-btn","accessibility-panel",
      "a11yFab","a11yBar","a11yBackdrop"
    ].forEach((id) => document.getElementById(id)?.remove());

    [
      "a11y-styles-v3","a11y-styles-v4","a11y-styles-v5","a11y-styles-v6",
      "accessibility-styles"
    ].forEach((id) => document.getElementById(id)?.remove());

    ROOT.classList.remove(
      "a11y__open","a11y__contrast","a11y__underline","a11y__cursor",
      "a11y__gray","a11y__reduceMotion","a11y__focusRing"
    );
    ROOT.style.removeProperty("--a11y-font-scale");
    ROOT.style.removeProperty("--a11y-line-height");
    ROOT.style.removeProperty("--a11y-letter-space");
  }

  // ===== 2) Apply state =====
  function applyState(state) {
    ROOT.classList.toggle("a11y__contrast", !!state.contrast);
    ROOT.classList.toggle("a11y__underline", !!state.underlineLinks);
    ROOT.classList.toggle("a11y__cursor", !!state.bigCursor);
    ROOT.classList.toggle("a11y__gray", !!state.grayscale);
    ROOT.classList.toggle("a11y__reduceMotion", !!state.reduceMotion);
    ROOT.classList.toggle("a11y__focusRing", state.focusRing !== false);

    const fs = FONT_SCALE_VALUES[clamp(state.fontScale | 0, 0, 3)];
    const lh = LINE_HEIGHT_VALUES[clamp(state.lineHeight | 0, 0, 2)];
    const ls = LETTER_SPACE_VALUES[clamp(state.letterSpace | 0, 0, 2)];

    ROOT.style.setProperty("--a11y-font-scale", String(fs));
    ROOT.style.setProperty("--a11y-line-height", String(lh));
    ROOT.style.setProperty("--a11y-letter-space", String(ls));
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.id = "a11y-styles-v6";
    style.textContent = `
:root{ --a11y-font-scale:1; --a11y-line-height:1.5; --a11y-letter-space:0; }
html body{ line-height: var(--a11y-line-height); letter-spacing: calc(var(--a11y-letter-space) * 1em); }
html{ font-size: calc(16px * var(--a11y-font-scale)); }

html.a11y__contrast{ filter: contrast(1.18) saturate(1.05); }
html.a11y__gray{ filter: grayscale(1); }

html.a11y__underline a, html.a11y__underline a:visited{
  text-decoration: underline !important;
  text-underline-offset: 3px;
  text-decoration-thickness: 2px;
}

html.a11y__cursor, html.a11y__cursor *{
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect x='6' y='6' width='20' height='20' rx='6' fill='%23000000' fill-opacity='0.18'/%3E%3Crect x='11' y='11' width='10' height='10' rx='3' fill='%23000000'/%3E%3C/svg%3E") 16 16, auto !important;
}

html.a11y__reduceMotion *{
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
  scroll-behavior: auto !important;
}

html.a11y__focusRing :focus-visible{
  outline: 3px solid rgba(0, 120, 255, .85) !important;
  outline-offset: 3px !important;
  border-radius: 10px;
}

#a11yFab{
  position: fixed;

  /* מיקום — כמו הצהוב */
  top: 72px;
  right: 18px;

  /* מתחת לכפתור ירח אבל מעל האתר */
  z-index: 950;

  width: 54px;
  height: 54px;

  border-radius: 16px;
  border: 1px solid rgba(0,0,0,.10);
  background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.80));
  box-shadow:
    0 18px 60px rgba(0,0,0,.18),
    inset 0 1px 0 rgba(255,255,255,.85);

  backdrop-filter: blur(16px);
  display: grid;
  place-items: center;

  color: #0b1220;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  transition: transform .18s ease, box-shadow .18s ease;
}

#a11yFab:hover{
  transform: translateY(-2px);
  box-shadow:
    0 26px 80px rgba(0,0,0,.22),
    inset 0 1px 0 rgba(255,255,255,.90);
}

#a11yFab:active{
  transform: translateY(0px) scale(.96);
}

#a11yFab svg{
  width: 26px;
  height: 26px;
  filter: drop-shadow(0 6px 10px rgba(0,0,0,.18));
}

/* ===== מובייל ===== */
@media (max-width: 760px){
  #a11yFab{
    top: 86px;
    right: 12px;

    width: 52px;
    height: 52px;
    border-radius: 18px;
  }
}


#a11yBackdrop{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.25);
  z-index: 2147483646;
  opacity: 0;
  pointer-events: none;
  transition: opacity .18s ease;
}

/* IMPORTANT: bar is hidden via [hidden] attribute; CSS can't force-show it */
#a11yBar{
  position: fixed;
  top: 12px;
  right: 72px;
  z-index: 2147483647;
  width: min(920px, calc(100vw - 96px));
  direction: rtl;
  background: rgba(255,255,255,.92);
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 18px;
  box-shadow: 0 20px 70px rgba(0,0,0,.18);
  backdrop-filter: blur(16px);
  padding: 10px;
  transform-origin: top right;
  opacity: 1;
}

#a11yHeader{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:4px 6px 8px; }
#a11yTitle{ font-weight:900; font-size:15px; color:#0b1220; }
#a11yTitle small{ font-weight:700; opacity:.6; font-size:12px; margin-right:8px; }
#a11yClose{
  border:0;
  background: rgba(10, 20, 40, .06);
  border-radius: 12px;
  height: 36px; padding: 0 12px;
  cursor: pointer;
}

#a11yRow{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.a11yTile{
  min-width: 120px; height: 54px;
  display:flex; align-items:center; justify-content:center; gap: 8px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.85);
  box-shadow: 0 10px 30px rgba(0,0,0,.08);
  cursor:pointer;
  user-select:none;
}
.a11yTile[aria-pressed="true"]{
  background: rgba(0, 120, 255, .12);
  border-color: rgba(0, 120, 255, .35);
}
.a11yPill{
  height: 44px; border-radius: 14px;
  display:flex; align-items:center; gap: 8px;
  padding: 0 10px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(10,20,40,.04);
}
.a11yCounterBtn{
  width: 42px; height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.85);
  cursor: pointer;
  font-weight: 900;
  font-size: 18px;
}
.a11yValue{ min-width: 84px; text-align:center; font-weight: 900; font-size: 13px; opacity: .85; }
#a11yReset{
  height: 44px; padding: 0 12px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255, 70, 70, .10);
  color: #7a0f0f;
  cursor:pointer;
  font-weight: 900;
}

@media (max-width: 760px){
  #a11yFab{ top: 10px; right: 10px; }
  #a11yBar{ top: 70px; right: 10px; left: 10px; width: auto; }
  .a11yTile{ min-width: 48%; flex: 1; }
}
@media (max-width: 420px){
  .a11yTile{ min-width: 100%; }
}
    `;
    document.head.appendChild(style);
  }

  function cubeSvg() {
    const d = document.createElement("div");
    d.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l8 4v12l-8 4-8-4V6l8-4Zm0 2.2L6 7l6 2.8L18 7 12 4.2Zm7 4.4l-6 2.9v8.3l6-3V8.6Zm-8 11.2v-8.3L5 8.6v8.2l6 3Z"/></svg>`;
    return d.firstElementChild;
  }

  function makeTile(label, pressed, icon, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "a11yTile";
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    b.title = label;
    b.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
    b.addEventListener("click", onClick);
    return b;
  }

  function makeCounter(label, getText, decFn, incFn) {
    const wrap = document.createElement("div");
    wrap.className = "a11yPill";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", label);

    const dec = document.createElement("button");
    dec.type = "button";
    dec.className = "a11yCounterBtn";
    dec.textContent = "−";
    dec.addEventListener("click", decFn);

    const val = document.createElement("div");
    val.className = "a11yValue";
    val.textContent = getText();

    const inc = document.createElement("button");
    inc.type = "button";
    inc.className = "a11yCounterBtn";
    inc.textContent = "+";
    inc.addEventListener("click", incFn);

    wrap.append(dec, val, inc);
    return { wrap, val };
  }

  function boot() {
    killOld();
    injectStyles();

    let state = loadState();
    applyState(state);

    const fab = document.createElement("button");
    fab.id = "a11yFab";
    fab.type = "button";
    fab.setAttribute("aria-label", "נגישות");
    fab.title = "נגישות (Ctrl+Alt+A)";
    fab.appendChild(cubeSvg());

    const backdrop = document.createElement("div");
    backdrop.id = "a11yBackdrop";

    const bar = document.createElement("section");
    bar.id = "a11yBar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "תפריט נגישות");

    // HARD CLOSED DEFAULT (even if CSS/HTML class tries to show)
    function hardClose(reason) {
      bar.hidden = true;
      bar.setAttribute("aria-hidden", "true");
      bar.inert = true;
      backdrop.style.opacity = "0";
      backdrop.style.pointerEvents = "none";
      ROOT.classList.remove("a11y__open");
      // debug
      // console.log("[A11Y] closed:", reason);
    }

    function hardOpen(reason) {
      bar.hidden = false;
      bar.setAttribute("aria-hidden", "false");
      bar.inert = false;
      backdrop.style.opacity = "1";
      backdrop.style.pointerEvents = "auto";
      ROOT.classList.add("a11y__open");
      // debug
      // console.log("[A11Y] opened:", reason);
    }

    // Open-trace: if anything tries to unhide it, we print who
    const openTrace = () => {
      console.groupCollapsed("%c[A11Y] someone tried to open / unhide the bar", "color:#d11;font-weight:900");
      console.trace();
      console.groupEnd();
    };

    const observer = new MutationObserver(() => {
      // If something changes hidden/aria/inert/display etc.
      if (!bar.hidden && bar.getAttribute("aria-hidden") !== "false") {
        openTrace();
      }
    });

    // Header
    const header = document.createElement("div");
    header.id = "a11yHeader";

    const title = document.createElement("div");
    title.id = "a11yTitle";
    title.innerHTML = `נגישות <small>Ctrl+Alt+A · ESC</small>`;

    const close = document.createElement("button");
    close.id = "a11yClose";
    close.type = "button";
    close.textContent = "סגור ✕";

    header.append(title, close);

    // Rows
    const row1 = document.createElement("div");
    row1.id = "a11yRow";
    row1.className = "a11yRow";

    const row2 = document.createElement("div");
    row2.className = "a11yRow";
    row2.style.marginTop = "8px";

    const fontText = () => {
      const n = clamp(state.fontScale | 0, 0, 3);
      return n === 0 ? "טקסט רגיל" : `טקסט x${FONT_SCALE_VALUES[n].toFixed(2)}`;
    };
    const lhText = () => {
      const n = clamp(state.lineHeight | 0, 0, 2);
      return n === 0 ? "ריווח רגיל" : `ריווח ${LINE_HEIGHT_VALUES[n].toFixed(1)}`;
    };
    const lsText = () => {
      const n = clamp(state.letterSpace | 0, 0, 2);
      return n === 0 ? "אותיות רגיל" : `אותיות +${Math.round(LETTER_SPACE_VALUES[n] * 100)}%`;
    };

    const font = makeCounter("טקסט", fontText,
      () => { state.fontScale = clamp((state.fontScale | 0) - 1, 0, 3); saveState(state); applyState(state); font.val.textContent = fontText(); },
      () => { state.fontScale = clamp((state.fontScale | 0) + 1, 0, 3); saveState(state); applyState(state); font.val.textContent = fontText(); }
    );

    const lh = makeCounter("ריווח", lhText,
      () => { state.lineHeight = clamp((state.lineHeight | 0) - 1, 0, 2); saveState(state); applyState(state); lh.val.textContent = lhText(); },
      () => { state.lineHeight = clamp((state.lineHeight | 0) + 1, 0, 2); saveState(state); applyState(state); lh.val.textContent = lhText(); }
    );

    const ls = makeCounter("אותיות", lsText,
      () => { state.letterSpace = clamp((state.letterSpace | 0) - 1, 0, 2); saveState(state); applyState(state); ls.val.textContent = lsText(); },
      () => { state.letterSpace = clamp((state.letterSpace | 0) + 1, 0, 2); saveState(state); applyState(state); ls.val.textContent = lsText(); }
    );

    const btnContrast = makeTile("קונטרסט", state.contrast, "⚡", () => {
      state.contrast = !state.contrast; saveState(state); applyState(state);
      btnContrast.setAttribute("aria-pressed", state.contrast ? "true" : "false");
    });

    const btnUnderline = makeTile("הדגש קישורים", state.underlineLinks, "🔗", () => {
      state.underlineLinks = !state.underlineLinks; saveState(state); applyState(state);
      btnUnderline.setAttribute("aria-pressed", state.underlineLinks ? "true" : "false");
    });

    const btnCursor = makeTile("סמן גדול", state.bigCursor, "🖱️", () => {
      state.bigCursor = !state.bigCursor; saveState(state); applyState(state);
      btnCursor.setAttribute("aria-pressed", state.bigCursor ? "true" : "false");
    });

    const btnGray = makeTile("גווני אפור", state.grayscale, "🎚️", () => {
      state.grayscale = !state.grayscale; saveState(state); applyState(state);
      btnGray.setAttribute("aria-pressed", state.grayscale ? "true" : "false");
    });

    const btnMotion = makeTile("הפחת אנימציות", state.reduceMotion, "🧊", () => {
      state.reduceMotion = !state.reduceMotion; saveState(state); applyState(state);
      btnMotion.setAttribute("aria-pressed", state.reduceMotion ? "true" : "false");
    });

    const btnFocus = makeTile("טבעת פוקוס", state.focusRing !== false, "🎯", () => {
      state.focusRing = !state.focusRing; saveState(state); applyState(state);
      btnFocus.setAttribute("aria-pressed", state.focusRing ? "true" : "false");
    });

    const reset = document.createElement("button");
    reset.id = "a11yReset";
    reset.type = "button";
    reset.textContent = "איפוס";
    reset.addEventListener("click", () => {
      state = { ...DEFAULT };
      saveState(state);
      applyState(state);

      btnContrast.setAttribute("aria-pressed", "false");
      btnUnderline.setAttribute("aria-pressed", "false");
      btnCursor.setAttribute("aria-pressed", "false");
      btnGray.setAttribute("aria-pressed", "false");
      btnMotion.setAttribute("aria-pressed", "false");
      btnFocus.setAttribute("aria-pressed", state.focusRing ? "true" : "false");

      font.val.textContent = fontText();
      lh.val.textContent = lhText();
      ls.val.textContent = lsText();
    });

    row1.append(font.wrap, lh.wrap, ls.wrap);
    row2.append(btnContrast, btnUnderline, btnCursor, btnGray, btnMotion, btnFocus, reset);

    bar.append(header, row1, row2);

    document.body.append(backdrop, bar, fab);

    // Start closed ALWAYS
    hardClose("boot");

    // observe changes AFTER append
    observer.observe(bar, { attributes: true, attributeFilter: ["hidden","style","class","aria-hidden"] });

    function toggle() {
      if (bar.hidden) hardOpen("toggle");
      else hardClose("toggle");
    }

    fab.addEventListener("click", (e) => { e.preventDefault(); toggle(); });
    close.addEventListener("click", () => hardClose("close"));
    backdrop.addEventListener("click", () => hardClose("backdrop"));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !bar.hidden) {
        e.preventDefault();
        hardClose("esc");
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        toggle();
      }
    });

    // expose manual controls for testing
    window.YAARAT_A11Y_OPEN = () => hardOpen("manual");
    window.YAARAT_A11Y_CLOSE = () => hardClose("manual");

    // if something tries to auto-open on next tick, we close again
    setTimeout(() => hardClose("postTick"), 0);
    setTimeout(() => hardClose("postTick2"), 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
