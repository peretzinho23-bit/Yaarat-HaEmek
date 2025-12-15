// home-class-picker.js

const CLASS_IDS_BY_GRADE = {
  z: [
    { id: "z1", label: "ז1" },
    { id: "z2", label: "ז2" },
    { id: "z3", label: "ז3" },
    { id: "z4", label: "ז4" },
    { id: "z5", label: "ז5/7" },
  ],
  h: [
    { id: "h1", label: "ח1/7" },
    { id: "h4", label: "ח4/8" },
    { id: "h5", label: "ח5/9" },
    { id: "h6", label: "ח6/10" },
  ],
  t: [
    { id: "t1", label: "ט1" },
    { id: "t2", label: "ט2" },
    { id: "t3", label: "ט3" },
    { id: "t4", label: "ט4" },
    { id: "t5", label: "ט5" },
  ],
};

function initHomeClassPicker() {
  const gradeSel = document.getElementById("home-grade");
  const classSel = document.getElementById("home-class");
  const openBtn = document.getElementById("home-open-class");

  // אם אחד מהם חסר – אין מה לעשות, אבל לפחות תדע למה
  if (!gradeSel || !classSel || !openBtn) {
    console.error("[home-class-picker] Missing elements:", {
      gradeSel: !!gradeSel,
      classSel: !!classSel,
      openBtn: !!openBtn,
    });
    return;
  }

  // חשוב אם הכפתור בתוך FORM
  openBtn.type = "button";

  function resetClasses() {
    classSel.innerHTML = `<option value="">בחר כיתה</option>`;
    classSel.disabled = true;
    openBtn.disabled = true;
  }

  function fillClasses(grade) {
    const list = CLASS_IDS_BY_GRADE[grade] || [];
    classSel.innerHTML =
      `<option value="">בחר כיתה</option>` +
      list.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");

    classSel.disabled = list.length === 0;
    openBtn.disabled = true;
  }

  gradeSel.addEventListener("change", () => {
    const g = (gradeSel.value || "").trim();
    if (!g) return resetClasses();
    fillClasses(g);
  });

  classSel.addEventListener("change", () => {
    openBtn.disabled = !classSel.value;
  });

  openBtn.addEventListener("click", (e) => {
    e.preventDefault(); // מגן מפני submit/התנהגות של form

    const classId = (classSel.value || "").trim();
    if (!classId) return;

    const url = `class.html?class=${encodeURIComponent(classId)}`;
    console.log("[home-class-picker] Navigating to:", url);
    window.location.assign(url);
  });

  // start
  resetClasses();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomeClassPicker);
} else {
  initHomeClassPicker();
}
