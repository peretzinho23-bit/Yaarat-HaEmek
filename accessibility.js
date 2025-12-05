// accessibility.js – סרגל נגישות בסיסי לכל האתר

(function () {
  const STORAGE_KEY = "yaarat-accessibility";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // לא קריטי אם נכשל
    }
  }

  function applyStateToHtml(state) {
    const html = document.documentElement;

    html.classList.remove("access-font-lg", "access-font-xl");
    html.classList.remove("access-contrast");
    html.classList.remove("access-links");

    if (state.font === "lg") {
      html.classList.add("access-font-lg");
    } else if (state.font === "xl") {
      html.classList.add("access-font-xl");
    }

    if (state.contrast) {
      html.classList.add("access-contrast");
    }

    if (state.links) {
      html.classList.add("access-links");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const state = loadState();
    applyStateToHtml(state);

    const btn = document.createElement("button");
    btn.id = "accessibility-btn";
    btn.className = "accessibility-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "תפריט נגישות");
    btn.title = "תפריט נגישות";
    btn.textContent = "♿";

    const panel = document.createElement("div");
    panel.id = "accessibility-panel";
    panel.className = "accessibility-panel";

    panel.innerHTML = `
      <div class="accessibility-panel-header">
        <div class="accessibility-panel-title">הגדרות נגישות</div>
        <button type="button" class="accessibility-panel-close" aria-label="סגירת תפריט">✕</button>
      </div>

      <div class="accessibility-option">
        <input type="radio" name="access-font" id="access-font-normal" value="normal">
        <label for="access-font-normal">גודל טקסט רגיל</label>
      </div>
      <div class="accessibility-option">
        <input type="radio" name="access-font" id="access-font-lg" value="lg">
        <label for="access-font-lg">טקסט גדול</label>
      </div>
      <div class="accessibility-option">
        <input type="radio" name="access-font" id="access-font-xl" value="xl">
        <label for="access-font-xl">טקסט גדול מאוד</label>
      </div>

      <div class="accessibility-option">
        <input type="checkbox" id="access-contrast">
        <label for="access-contrast">קונטרסט גבוה</label>
      </div>

      <div class="accessibility-option">
        <input type="checkbox" id="access-links">
        <label for="access-links">הדגשת קישורים</label>
      </div>

      <button type="button" class="accessibility-reset-btn">
        איפוס הגדרות נגישות
      </button>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    const closeBtn = panel.querySelector(".accessibility-panel-close");
    const resetBtn = panel.querySelector(".accessibility-reset-btn");
    const fontRadios = panel.querySelectorAll("input[name='access-font']");
    const contrastCheckbox = panel.querySelector("#access-contrast");
    const linksCheckbox = panel.querySelector("#access-links");

    if (state.font === "lg") {
      panel.querySelector("#access-font-lg").checked = true;
    } else if (state.font === "xl") {
      panel.querySelector("#access-font-xl").checked = true;
    } else {
      panel.querySelector("#access-font-normal").checked = true;
    }

    contrastCheckbox.checked = !!state.contrast;
    linksCheckbox.checked = !!state.links;

    function togglePanel(open) {
      if (open) {
        panel.classList.add("open");
      } else {
        panel.classList.remove("open");
      }
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.classList.toggle("open");
    });

    closeBtn.addEventListener("click", () => {
      togglePanel(false);
    });

    document.addEventListener("click", (e) => {
      if (!panel.contains(e.target) && e.target !== btn) {
        togglePanel(false);
      }
    });

    fontRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        const newState = loadState();
        newState.font = radio.value === "normal" ? null : radio.value;
        saveState(newState);
        applyStateToHtml(newState);
      });
    });

    contrastCheckbox.addEventListener("change", () => {
      const newState = loadState();
      newState.contrast = contrastCheckbox.checked;
      saveState(newState);
      applyStateToHtml(newState);
    });

    linksCheckbox.addEventListener("change", () => {
      const newState = loadState();
      newState.links = linksCheckbox.checked;
      saveState(newState);
      applyStateToHtml(newState);
    });

    resetBtn.addEventListener("click", () => {
      const cleared = {};
      saveState(cleared);
      applyStateToHtml(cleared);

      panel.querySelector("#access-font-normal").checked = true;
      contrastCheckbox.checked = false;
      linksCheckbox.checked = false;
    });
  });
})();
