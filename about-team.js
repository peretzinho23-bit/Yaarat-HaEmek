// about-team.js
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const fallbackMembers = [
  { name: "אורית", role: "מנהלת החטיבה", bio: "מובילה מצוינות + יחס אישי.", initials: "א", tags: ["מנהיגות","אכפתיות"] },
  { name: "דני", role: "רכז שכבה", bio: "שומר על שגרה חדה ועוזר לתלמידים.", initials: "ד", tags: ["סדר","ליווי"] },
  { name: "רחל", role: "יועצת", bio: "מקום בטוח לשיחה והכוונה.", initials: "ר", tags: ["תמיכה","הכוונה"] },
  { name: "נועה", role: "מחנכת", bio: "מחברת כיתה, שייכות והתקדמות.", initials: "נ", tags: ["כיתה","שייכות"] },
];

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderTeam(members){
  const grid = document.getElementById("teamGrid");
  if(!grid) return;

  const arr = Array.isArray(members) && members.length ? members : fallbackMembers;

  grid.innerHTML = arr.map(m => {
    const name = escapeHtml(m.name || "");
    const role = escapeHtml(m.role || "");
    const bio  = escapeHtml(m.bio  || "");
    const initials = escapeHtml(m.initials || (m.name||"").slice(0,1) || "•");
    const photoUrl = (m.photoUrl || "").trim();
    const tags = Array.isArray(m.tags) ? m.tags : [];

    const avatar = photoUrl
      ? `<div class="avatar"><img src="${escapeHtml(photoUrl)}" alt="${name}"></div>`
      : `<div class="avatar"><div class="circle">${initials}</div></div>`;

    const tagsHtml = tags.length
      ? `<div class="member-meta">${tags.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("")}</div>`
      : "";

    return `
      <div class="member reveal">
        ${avatar}
        <div class="m-body">
          <h3>${name}</h3>
          <div class="role">${role}</div>
          <p>${bio}</p>
          ${tagsHtml}
        </div>
      </div>
    `;
  }).join("");

  initReveal(grid.querySelectorAll(".reveal"));
}

function initReveal(nodeList){
  const els = Array.from(nodeList || []);
  if(!els.length) return;

  if(!("IntersectionObserver" in window)){
    els.forEach(el => el.classList.add("in"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if(en.isIntersecting){
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" });

  els.forEach(el => io.observe(el));
}

async function loadTeam(){
  try{
    const ref = doc(db, "siteContent", "about");
    const snap = await getDoc(ref);

    if(snap.exists()){
      const data = snap.data() || {};
      const members = data.team?.members;   // ✅ זה המבנה הנכון
      renderTeam(members);
      return;
    }

    renderTeam(fallbackMembers);
  }catch(e){
    console.error("Failed to load team:", e);
    renderTeam(fallbackMembers);
  }
}

loadTeam();
