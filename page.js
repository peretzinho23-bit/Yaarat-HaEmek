import { app, auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* =========================
   Settings
========================= */
const DEV_EMAILS = ["nadavp1119@gmail.com", "peretzinho23@gmail.com"].map(e => e.toLowerCase());

/* =========================
   Helpers
========================= */
const $ = (id) => document.getElementById(id);

function normEmail(email){
  return String(email || "").trim().toLowerCase();
}

function escapeHtml(str){
  return String(str ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function safeTextToHtml(text){
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function pickSlug(){
  const url = new URL(location.href);
  return (url.searchParams.get("p") || "").trim();
}

function initialsFromEmail(email){
  const e = normEmail(email);
  if (!e) return "--";
  const name = e.split("@")[0] || e;
  const parts = name.replace(/[^a-z0-9]+/gi, " ").trim().split(/\s+/).filter(Boolean);
  const a = (parts[0] || "x")[0] || "X";
  const b = (parts[1] || parts[0] || "y")[0] || "Y";
  return (a + b).toUpperCase();
}

/* =========================
   Theme
========================= */
function initTheme(){
  const root = document.documentElement;
  const btn = $("theme-toggle");

  function setTheme(next){
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch {}
    if (btn) btn.textContent = next === "dark" ? "🌙" : "☀️";
  }

  let saved = "dark";
  try { saved = localStorage.getItem("theme") || "dark"; } catch {}
  setTheme(saved);

  if (btn){
    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || "dark";
      setTheme(cur === "dark" ? "light" : "dark");
    });
  }
}

/* =========================
   Permissions
========================= */
async function getMyRole(){
  const user = auth.currentUser;
  if (!user) return "";
  try{
    const snap = await getDoc(doc(db, "adminUsers", user.uid));
    if (!snap.exists()) return "";
    return String(snap.data()?.role || "").trim().toLowerCase();
  }catch{
    return "";
  }
}

async function computeIsDev(){
  const user = auth.currentUser;
  if (!user) return false;

  const email = normEmail(user.email);
  if (DEV_EMAILS.includes(email)) return true;

  const role = await getMyRole();
  return role === "dev";
}

/* =========================
   UI helpers
========================= */
function showError(msg){
  document.title = "שגיאה – יערת העמק";
  $("page-title").textContent = "שגיאה";
  $("page-sub").textContent = msg;

  const content = $("page-content");
  if (content){ content.style.display = "none"; content.innerHTML = ""; }

  const empty = $("page-empty");
  if (empty){
    empty.style.display = "block";
    empty.textContent = msg;
  }
}

function setDevDebug(isDev, text){
  const badge = $("page-status");
  if (!badge) return;
  if (!isDev){
    badge.style.display = "none";
    badge.textContent = "";
    return;
  }
  badge.style.display = "inline-flex";
  badge.textContent = text || "";
}

function setEditLink(isDev, slug){
  const btn = $("edit-btn");
  if (!btn) return;
  if (!isDev){
    btn.style.display = "none";
    btn.href = "#";
    return;
  }
  btn.style.display = "inline-flex";
  btn.href = `dev.html?edit=${encodeURIComponent(slug)}`;
}

function setupLogout(){
  const btn = $("dev-logout");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try { await signOut(auth); } catch {}
    location.href = "page.html?p=" + encodeURIComponent(pickSlug());
  });
}

/* =========================
   Render blocks
========================= */
function renderHeroFromBlock(block){
  const badge = $("hero-badge");
  const titleEl = $("page-title");
  const subEl = $("page-sub");

  const icon = String(block.icon || "✨").trim();
  const title = String(block.title || "").trim();
  const subtitle = String(block.subtitle || "").trim();

  if (badge){
    badge.style.display = "inline-flex";
    badge.textContent = `${icon} דף דינמי`;
  }
  if (titleEl && title) titleEl.textContent = title;
  if (subEl) subEl.innerHTML = subtitle ? safeTextToHtml(subtitle) : "";
}

function renderBlocks(page, isDev){
  const host = $("page-content");
  const empty = $("page-empty");
  if (!host) return;

  host.innerHTML = "";
  host.style.display = "block";
  if (empty) empty.style.display = "none";

  const blocks = Array.isArray(page.contentBlocks) ? page.contentBlocks : [];

  if (!blocks.length){
    if (empty){
      empty.style.display = "block";
      empty.textContent = "אין תוכן עדיין. כשתוסיף contentBlocks — זה יופיע פה.";
    }
    host.style.display = "none";
    return;
  }

  for (const b of blocks){
    const type = String(b?.type || "text").toLowerCase();

    // HERO (special – affects hero header, not body)
    if (type === "hero"){
      renderHeroFromBlock(b || {});
      continue;
    }

    const wrap = document.createElement("section");
    wrap.className = "card block";

    // TEXT
    if (type === "text"){
      const title = b.title ? `<h3>${escapeHtml(b.title)}</h3>` : "";
      const body = b.text ? `<p>${safeTextToHtml(b.text)}</p>` : "<p></p>";
      wrap.innerHTML = `${title}${body}`;
      host.appendChild(wrap);
      continue;
    }

    // IMAGE
    if (type === "image"){
      const url = String(b.src || b.url || "").trim();
      if (!url) continue;
      const alt = escapeHtml(b.alt || "");
      const cap = b.caption ? `<div class="cap">${safeTextToHtml(b.caption)}</div>` : "";
      wrap.innerHTML = `
        <img class="img" alt="${alt}" src="${escapeHtml(url)}" loading="lazy" />
        ${cap}
      `;
      host.appendChild(wrap);
      continue;
    }

    // BUTTON
    if (type === "button"){
      const href = String(b.href || b.url || "").trim();
      const label = String(b.text || b.label || "פתח").trim();
      const style = String(b.style || "primary").toLowerCase();
      if (!href) continue;

      const cls = style === "danger" ? "btn danger" : (style === "primary" ? "btn primary" : "btn");
      wrap.innerHTML = `
        <div style="display:flex;justify-content:flex-start;gap:10px;flex-wrap:wrap">
          <a class="${cls}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>
        </div>
      `;
      host.appendChild(wrap);
      continue;
    }

    // LINKS LIST
    if (type === "links"){
      const title = String(b.title || "קישורים").trim();
      const items = Array.isArray(b.items) ? b.items : [];

      const itemsHtml = items.map((it) => {
        const href = String(it.href || it.url || "").trim();
        const text = String(it.text || it.label || href || "קישור").trim();
        if (!href) return "";
        return `
          <div class="links-item">
            <div>
              <div class="links-title">${escapeHtml(text)}</div>
              <div class="links-url">${escapeHtml(href)}</div>
            </div>
            <a class="btn" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">פתח</a>
          </div>
        `;
      }).join("");

      wrap.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        <div class="links">${itemsHtml || "<div class='muted'>אין קישורים להצגה.</div>"}</div>
      `;
      host.appendChild(wrap);
      continue;
    }

    // DIVIDER
    if (type === "divider"){
      wrap.innerHTML = `<div class="divider"></div>`;
      host.appendChild(wrap);
      continue;
    }

    // EMBED (dev only)
    if (type === "embed"){
      const url = String(b.url || b.src || "").trim();
      if (!url) continue;

      if (!isDev){
        wrap.innerHTML = `<p>תוכן embed זמין רק ל-DEV.</p>`;
        host.appendChild(wrap);
        continue;
      }

      wrap.innerHTML = `
        <h3>${escapeHtml(b.title || "Embed")}</h3>
        <iframe
          src="${escapeHtml(url)}"
          style="width:100%;min-height:520px;border:1px solid rgba(148,163,184,.18);border-radius:18px;background:#000"
          loading="lazy"
        ></iframe>
      `;
      host.appendChild(wrap);
      continue;
    }

    // HTML (unsafe) – dev only with allowUnsafeHtml: true
    if (type === "html"){
      if (!isDev){
        wrap.innerHTML = `<p>תוכן HTML זמין רק ל-DEV.</p>`;
        host.appendChild(wrap);
        continue;
      }
      const html = String(b.html || "").trim();
      const allow = b.allowUnsafeHtml === true;
      if (!allow){
        wrap.innerHTML = `
          <h3>HTML (חסום)</h3>
          <p>כדי לאפשר HTML, שים בבלוק <b>allowUnsafeHtml: true</b>.</p>
        `;
        host.appendChild(wrap);
        continue;
      }
      wrap.innerHTML = html;
      host.appendChild(wrap);
      continue;
    }

    // FALLBACK
    wrap.innerHTML = `
      <h3>בלוק לא מוכר: ${escapeHtml(type)}</h3>
      <div class="mono" style="direction:ltr;text-align:left;opacity:.85">${escapeHtml(JSON.stringify(b || {}))}</div>
    `;
    host.appendChild(wrap);
  }
}

/* =========================
   Main
========================= */
async function main(){
  initTheme();
  setupLogout();

  const slug = pickSlug();
  if (!slug) return showError("חסר slug. פתח ככה: page.html?p=temp-event-jan");

  $("page-title").textContent = "טוען…";
  $("page-sub").textContent = "";
  $("page-meta").textContent = "";
  $("page-meta").classList.remove("dev-show");

  onAuthStateChanged(auth, async (user) => {
    const isDev = await computeIsDev();

    // user pill
    const userLabel = $("user-label");
    const avatar = $("user-avatar");
    if (user){
      if (userLabel) userLabel.textContent = "צפייה";
      if (avatar) avatar.textContent = initialsFromEmail(user.email);
    }else{
      if (userLabel) userLabel.textContent = "אורח";
      if (avatar) avatar.textContent = "GH";
    }

    // logout button only if signed in
    const logoutBtn = $("dev-logout");
    if (logoutBtn) logoutBtn.style.display = user ? "inline-flex" : "none";

    setEditLink(isDev, slug);

    const ref = doc(db, "pages", slug);
    onSnapshot(ref, (snap) => {
      if (!snap.exists()) return showError("דף לא נמצא (slug: " + slug + ")");

      const page = snap.data() || {};
      const status = String(page.status || "draft").toLowerCase();
      const visibility = String(page.visibility || "public").toLowerCase();

      // Basic client-side guards (server rules are the real guard)
      const loggedIn = !!auth.currentUser;
      const staffOk = loggedIn;

      if (visibility === "dev" && !isDev) return showError("אין הרשאה (dev only)");
      if (visibility === "staff" && !staffOk && !isDev) return showError("אין הרשאה (staff only)");
      if ((status === "draft" || status === "archived") && !isDev) return showError("הדף עדיין לא פורסם");

      // Title
      const title = String(page.title || slug).trim();
      document.title = `${title} – יערת העמק`;
      $("page-title").textContent = title;

      // Meta line (only if exists)
      const metaBits = [];
      if (page.updatedAt?.toDate) metaBits.push("עודכן: " + page.updatedAt.toDate().toLocaleString("he-IL"));
      if (page.updatedBy) metaBits.push("ע\"י: " + page.updatedBy);

      const metaEl = $("page-meta");
      if (metaEl){
        if (isDev && metaBits.length){
          metaEl.textContent = metaBits.join(" | ");
          metaEl.classList.add("dev-show");
        }else{
          metaEl.textContent = "";
          metaEl.classList.remove("dev-show");
        }
      }

      // DEV debug badge (small, not the ugly giant line)
      setDevDebug(isDev, `slug=${slug} · status=${status} · visibility=${visibility}`);

      // Render blocks (hero can override title/sub)
      renderBlocks(page, isDev);
    }, (err) => {
      console.error("page onSnapshot error:", err);
      showError("שגיאה בטעינה. בדוק Console.");
    });
  });
}

main();
