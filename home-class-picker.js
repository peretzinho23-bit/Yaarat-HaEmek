// home-class-picker.js
const CLASS_IDS_BY_GRADE = {
  z: [
    { id: "z1", label: "ז1" },
    { id: "z2", label: "ז2" },
    { id: "z3", label: "ז3" },
    { id: "z4", label: "ז4" },
    { id: "z5", label: "ז5" },
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

function $(id) {
  return document.getElementById(id);
}

document.addEventListener("DOMContentLoaded", () => {
  const gradeSel = $("home-grade");
  const classSel = $("home-class");
  const openBtn = $("home-open-class");

  if (!gradeSel || !classSel || !openBtn) return;

  function resetClasses() {
    classSel.innerHTML = `<option value="">בחר כיתה</option>`;
    classSel.disabled = true;
    openBtn.disabled = true;
  }

  function fillClasses(grade) {
    const list = CLASS_IDS_BY_GRADE[grade] || [];
    classSel.innerHTML = `<option value="">בחר כיתה</option>` + list
      .map((c) => `<option value="${c.id}">${c.label}</option>`)
      .join("");
    classSel.disabled = list.length === 0;
    openBtn.disabled = true;
  }

  gradeSel.addEventListener("change", () => {
    const g = gradeSel.value;
    if (!g) return resetClasses();
    fillClasses(g);
  });

  classSel.addEventListener("change", () => {
    openBtn.disabled = !classSel.value;
  });

  openBtn.addEventListener("click", () => {
    const classId = classSel.value;
    if (!classId) return;
    window.location.href = `class.html?class=${encodeURIComponent(classId)}`;
  });

  // התחלה
  resetClasses();
});
