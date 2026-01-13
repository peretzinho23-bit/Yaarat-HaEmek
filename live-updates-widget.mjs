/* =========================================================
   Live Updates Widget (Firebase v11 modular)
   - Uses ./firebase-config.js exports: db, auth
   ========================================================= */

import { db, auth } from "./firebase-config.js";
import {
  collection, query, orderBy, limit, onSnapshot, doc, getDoc,
  runTransaction, serverTimestamp, increment, updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

(function () {
  const CFG = {
    liveCollection: "liveUpdates",
    archiveCollection: "updateArchive",
    position: "left",
    maxLive: 30,
    maxArchive: 50,
    textMaxLen: 2500,
  };

  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  };

  const fmtTime = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      if (!d) return "";
      return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  const fmtDate = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      if (!d) return "";
      return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch { return ""; }
  };

  const escapeHtml = (s) =>
    (s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const injectStyles = () => {
    if (document.getElementById("liveUpdatesWidgetStyles")) return;
const css = `
#lu-fab{
  position:fixed;
  top:140px;
  ${CFG.position}:14px;
  z-index:999999;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
  direction:rtl;
}
#lu-fab button{
  display:flex;align-items:center;gap:10px;
  border:1px solid rgba(0,0,0,.12);
  background:rgba(255,255,255,.92);
  backdrop-filter:blur(10px);
  border-radius:14px;
  padding:10px 12px;
  cursor:pointer;
  box-shadow:0 10px 25px rgba(0,0,0,.12);
  font-weight:800;
}
#lu-badge{
  min-width:22px;height:22px;padding:0 7px;
  border-radius:999px;
  display:flex;align-items:center;justify-content:center;
  font-size:12px;
  border:1px solid rgba(0,0,0,.12);
  background:rgba(220,38,38,.10);
}

#lu-modal{position:fixed;inset:0;display:none;z-index:999999;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;direction:rtl;}
#lu-modal[open]{display:block;}
#lu-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);}

#lu-panel{
  position:absolute;
  top:6vh;
  ${CFG.position}:16px;
  width:min(420px,calc(100vw - 32px));
  height:88vh;
  background:rgba(255,255,255,.96);
  border:1px solid rgba(0,0,0,.10);
  border-radius:18px;
  box-shadow:0 20px 60px rgba(0,0,0,.35);
  overflow:hidden;
  display:flex;
  flex-direction:column;
}

#lu-head{padding:12px 12px 10px;background:linear-gradient(180deg,rgba(248,250,252,.9),rgba(255,255,255,.9));border-bottom:1px solid rgba(0,0,0,.08);}
#lu-toprow{display:flex;align-items:center;justify-content:space-between;gap:10px;}

/* ✅ כותרת + לוגו לחיץ */
#lu-title{font-weight:900;font-size:16px;display:flex;align-items:center;gap:10px;}
#lu-title a{
  display:flex;align-items:center;gap:10px;
  color:inherit;
  text-decoration:none;
}
#lu-title a:hover{opacity:.9;}
#lu-title img{
  width:26px;height:26px;border-radius:8px;object-fit:cover;
  border:1px solid rgba(0,0,0,.10);
  background:#fff;
}

#lu-close{border:1px solid rgba(0,0,0,.12);background:white;border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:800;}

#lu-tabs{margin-top:10px;display:flex;gap:8px;}
.lu-tab{flex:1;border:1px solid rgba(0,0,0,.10);background:rgba(2,6,23,.04);border-radius:12px;padding:10px 0;cursor:pointer;font-weight:900;}
.lu-tab[aria-selected="true"]{background:rgba(220,38,38,.12);border-color:rgba(220,38,38,.22);}

#lu-list{padding:12px;overflow:auto;flex:1;}

.lu-card{border:1px solid rgba(0,0,0,.10);border-radius:16px;background:rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(0,0,0,.08);padding:10px;margin-bottom:10px;}
.lu-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
.lu-author{display:flex;align-items:center;gap:8px;font-weight:900;}
.lu-avatar{width:28px;height:28px;border-radius:999px;background:rgba(2,6,23,.08);overflow:hidden;display:flex;align-items:center;justify-content:center;}
.lu-avatar img{width:100%;height:100%;object-fit:cover;}
.lu-time{font-size:12px;opacity:.75;font-weight:700;}
.lu-text{font-size:14px;line-height:1.35;white-space:pre-wrap;word-break:break-word;}
.lu-imgs{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}
.lu-imgs img{width:100%;max-height:230px;border-radius:14px;object-fit:cover;border:1px solid rgba(0,0,0,.10);cursor:zoom-in;}

.lu-actions{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:10px;}
.lu-likeBtn{border:1px solid rgba(0,0,0,.12);background:white;border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:900;display:flex;align-items:center;gap:8px;}
.lu-likeBtn[aria-pressed="true"]{background:rgba(220,38,38,.12);border-color:rgba(220,38,38,.22);}
.lu-muted{font-size:12px;opacity:.75;font-weight:700;}

#lu-footer{
  padding:10px 12px;
  border-top:1px solid rgba(0,0,0,.08);
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  background:rgba(248,250,252,.85);
}
#lu-refresh{border:1px solid rgba(0,0,0,.12);background:white;border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:900;}
#lu-note{font-size:12px;opacity:.75;font-weight:700;}

/* ✅ כפתור הוספה (כבר קיים אצלך #lu-add) */
#lu-add{
  border:1px solid rgba(220,38,38,.25);
  background:rgba(220,38,38,.12);
  border-radius:12px;
  padding:8px 10px;
  cursor:pointer;
  font-weight:900;
}
#lu-add:hover{filter:brightness(.98);}

/* ✅ מובייל: הכפתור יורד למטה ולא נתקע למעלה */
@media (max-width: 800px){
  #lu-fab{
    top:auto !important;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 88px) !important;
    left: 12px !important;
    right: auto !important;
  }
  #lu-panel{
    left: 12px !important;
    right: 12px !important;
    width: auto !important;
  }
}

/* ✅ אם התפריט הצדדי פתוח והוא מכסה: תוכל להפעיל body.menu-open ואז זה יחביא */
body.menu-open #lu-fab{display:none !important;}
`;

    document.head.appendChild(el("style", { id: "liveUpdatesWidgetStyles", html: css }));
  };

  const zoomImage = (src) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<img src="${src}" style="max-width:100%;height:auto;display:block;margin:0 auto" />`);
    w.document.title = "תמונה";
  };

  let state = { user: null, tab: "live", unsub: null, badgeUnsub: null };

  const ensureAnonAuth = async () => {
    if (state.user) return state.user;
    if (auth.currentUser) { state.user = auth.currentUser; return state.user; }
    await signInAnonymously(auth);
    state.user = auth.currentUser;
    return state.user;
  };

  const setBadge = (n) => {
    const b = document.getElementById("lu-badge");
    if (b) b.textContent = String(n ?? 0);
  };

  const setListHtml = (nodeOrHtml) => {
    const list = document.getElementById("lu-list");
    if (!list) return;
    list.innerHTML = "";
    if (typeof nodeOrHtml === "string") list.innerHTML = nodeOrHtml;
    else list.appendChild(nodeOrHtml);
  };

  const openModal = () => {
    const m = document.getElementById("lu-modal");
    if (!m) return;
    m.setAttribute("open", "");
    reloadCurrentTab();
  };

  const closeModal = () => {
    const m = document.getElementById("lu-modal");
    if (!m) return;
    m.removeAttribute("open");
  };



  const switchTab = (tab) => {
    state.tab = tab;
    const tabs = document.querySelectorAll(".lu-tab");
    tabs.forEach((t) => t.setAttribute("aria-selected", "false"));
    if (tab === "live") tabs[0]?.setAttribute("aria-selected", "true");
    if (tab === "archive") tabs[1]?.setAttribute("aria-selected", "true");
    reloadCurrentTab();
  };

  const reloadCurrentTab = () => {
    if (state.unsub) { try { state.unsub(); } catch {} state.unsub = null; }
    if (state.tab === "live") listenLive();
    else listenArchive();
  };
const STAFF_ROLES = ["teacherpanel","teacher","gradelead","counselor","principal","dev","admin"];

const isTeacherUser = async (user) => {
  if (!user) return false;

  // role by uid
  try{
    const roleSnap = await getDoc(doc(db, "adminUsers", user.uid));
    const role = roleSnap.exists() ? String(roleSnap.data().role || "").toLowerCase() : "";
    if (STAFF_ROLES.includes(role)) return true;
  }catch{}

  // teacherAllow by email (למי שאין role)
  try{
    const email = user.email ? String(user.email).toLowerCase() : "";
    if (!email) return false;
    const allowSnap = await getDoc(doc(db, "teacherAllow", email));
    return allowSnap.exists() && allowSnap.data().active === true;
  }catch{
    return false;
  }
};

  const buildWidget = () => {
    if (document.getElementById("lu-fab")) return;

    const badge = el("span", { id: "lu-badge" }, ["0"]);
    const btn = el("button", { type: "button", onclick: () => openModal(), title: "עדכונים חיים" }, [
      el("span", {}, ["📰"]), el("span", {}, ["עדכונים חיים"]), badge,
    ]);

    const fab = el("div", { id: "lu-fab" }, [btn]);
    const overlay = el("div", { id: "lu-overlay", onclick: () => closeModal() });
    const closeBtn = el("button", { id: "lu-close", type: "button", onclick: () => closeModal() }, ["סגור"]);

    const tabLive = el("button", { class: "lu-tab", type: "button", "aria-selected": "true", onclick: () => switchTab("live") }, ["לייב"]);
    const tabArchive = el("button", { class: "lu-tab", type: "button", "aria-selected": "false", onclick: () => switchTab("archive") }, ["ארכיון"]);

    const head = el("div", { id: "lu-head" }, [
      el("div", { id: "lu-toprow" }, [
el("div", { id: "lu-title" }, [
  el("a", { href: "/", title: "חזרה לדף הבית" }, [
    el("img", { src: "/favicon-192x192.png", alt: "לוגו", onerror: function(){ this.style.display="none"; } }),
    el("span", {}, ["עדכונים חיים"])
  ])
]),
        closeBtn,
      ]),
      el("div", { id: "lu-tabs" }, [tabLive, tabArchive]),
    ]);

    const list = el("div", { id: "lu-list" }, [el("div", { class: "lu-muted" }, ["טוען..."])]);
    const refreshBtn = el("button", { id: "lu-refresh", type: "button", onclick: () => reloadCurrentTab() }, ["רענן"]);
    const note = el("div", { id: "lu-note" }, ["לייקים מופיעים רק בלייב"]);
const addBtn = el("button", {
  id: "lu-add",
  type: "button",
  style: "display:none;",
  onclick: () => (location.href = "/add-update.html"),
}, ["✍️ הוסף עדכון"]);

const footer = el("div", { id: "lu-footer" }, [refreshBtn, note, addBtn]);

    const panel = el("div", { id: "lu-panel" }, [head, list, footer]);
    const modal = el("div", { id: "lu-modal" }, [overlay, panel]);

    document.body.appendChild(fab);
    document.body.appendChild(modal);
// ✅ להראות "הוסף עדכון" רק לצוות
(async () => {
  try{
    await ensureAnonAuth();
    const ok = await isTeacherUser(auth.currentUser);
    const btn = document.getElementById("lu-add");
    if (btn && ok) btn.style.display = "";
  }catch{}
})();

    window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  };

  const markViewedOnce = async (postId) => {
    try {
      await ensureAnonAuth();
      const uid = state.user?.uid;
      if (!uid) return;
      const key = `lu_viewed_${postId}_${uid}`;
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
      await updateDoc(doc(db, CFG.liveCollection, postId), { viewsCount: increment(1) });
    } catch {}
  };

  const toggleLike = async (postId) => {
    await ensureAnonAuth();
    const uid = state.user.uid;
    const postRef = doc(db, CFG.liveCollection, postId);
    const likeRef = doc(db, CFG.liveCollection, postId, "likes", uid);

    await runTransaction(db, async (tx) => {
      const likeSnap = await tx.get(likeRef);
      const postSnap = await tx.get(postRef);
      if (!postSnap.exists()) return;

      if (likeSnap.exists()) {
        tx.delete(likeRef);
        tx.update(postRef, { likesCount: increment(-1) });
      } else {
        tx.set(likeRef, { createdAt: serverTimestamp(), uid });
        tx.update(postRef, { likesCount: increment(1) });
      }
    });
  };

  const renderCardLive = async (d) => {
    const data = d.data() || {};
    const postId = d.id;

    markViewedOnce(postId);

const rawAuthor = (data.authorName || "דסק החינוך").trim();
const authorName = rawAuthor.includes("@") ? "צוות בית הספר" : rawAuthor;
    const authorPhoto = data.authorPhoto || "";
    const text = (data.text || "").slice(0, CFG.textMaxLen);
    const createdAt = data.createdAt;
    const likesCount = Number(data.likesCount || 0);
    const viewsCount = Number(data.viewsCount || 0);

    await ensureAnonAuth();
    let liked = false;
    try {
      const likeDocSnap = await getDoc(doc(db, CFG.liveCollection, postId, "likes", state.user.uid));
      liked = likeDocSnap.exists();
    } catch {}

    const avatar = el("div", { class: "lu-avatar" }, [
      authorPhoto ? el("img", { src: authorPhoto, alt: "avatar" }) : el("span", {}, ["👤"]),
    ]);
    const metaLeft = el("div", { class: "lu-author" }, [avatar, el("span", {}, [authorName])]);
    const metaRight = el("div", { class: "lu-time" }, [`${fmtTime(createdAt)} • ${fmtDate(createdAt)}`]);

    const textNode = el("div", { class: "lu-text", html: escapeHtml(text) });

    const imgsWrap = el("div", { class: "lu-imgs" }, []);
    const urls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
    urls.forEach((u) => { if (u) imgsWrap.appendChild(el("img", { src: u, alt: "image", onclick: () => zoomImage(u) })); });

    const likeBtn = el("button", {
      class: "lu-likeBtn",
      type: "button",
      "aria-pressed": liked ? "true" : "false",
      onclick: async () => { try { await toggleLike(postId); } catch { alert("לא הצלחתי לשמור לייק."); } },
      title: "לייק",
    }, [el("span", {}, ["❤️"]), el("span", {}, [String(likesCount)])]);

    const hint = el("div", { class: "lu-muted" }, [`👁️ ${viewsCount}`]);
    const actions = el("div", { class: "lu-actions" }, [likeBtn, hint]);

    return el("div", { class: "lu-card" }, [
      el("div", { class: "lu-meta" }, [metaLeft, metaRight]),
      textNode,
      urls.length ? imgsWrap : el("div"),
      actions,
    ]);
  };

  const renderCardArchive = (d) => {
    const data = d.data() || {};
    const authorName = data.authorName || "דסק החינוך";
    const authorPhoto = data.authorPhoto || "";
    const text = (data.text || "").slice(0, CFG.textMaxLen);
    const createdAt = data.createdAt;

    const avatar = el("div", { class: "lu-avatar" }, [
      authorPhoto ? el("img", { src: authorPhoto, alt: "avatar" }) : el("span", {}, ["👤"]),
    ]);
    const metaLeft = el("div", { class: "lu-author" }, [avatar, el("span", {}, [authorName])]);
    const metaRight = el("div", { class: "lu-time" }, [`${fmtTime(createdAt)} • ${fmtDate(createdAt)}`]);

    const textNode = el("div", { class: "lu-text", html: escapeHtml(text) });

    const imgsWrap = el("div", { class: "lu-imgs" }, []);
    const urls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
    urls.forEach((u) => { if (u) imgsWrap.appendChild(el("img", { src: u, alt: "image", onclick: () => zoomImage(u) })); });

    return el("div", { class: "lu-card" }, [
      el("div", { class: "lu-meta" }, [metaLeft, metaRight]),
      textNode,
      urls.length ? imgsWrap : el("div"),
      el("div", { class: "lu-muted", style: "margin-top:10px" }, ["הודעה מארכיון"]),
    ]);
  };

  const listenBadgeLiveCount = () => {
    const qy = query(collection(db, CFG.liveCollection), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(qy, (snap) => setBadge(snap.size), () => setBadge(0));
  };

  const listenLive = async () => {
    setListHtml(el("div", { class: "lu-muted" }, ["טוען לייב..."]));
    await ensureAnonAuth();

    const qy = query(collection(db, CFG.liveCollection), orderBy("createdAt", "desc"), limit(CFG.maxLive));
    state.unsub = onSnapshot(qy, async (snap) => {
      if (snap.empty) { setListHtml(el("div", { class: "lu-muted" }, ["אין עדכונים כרגע."])); return; }
      const wrap = el("div", {}, []);
      for (const d of snap.docs) wrap.appendChild(await renderCardLive(d));
      setListHtml(wrap);
    }, () => setListHtml(el("div", { class: "lu-muted" }, ["שגיאה בטעינת לייב."])));
  };

  const listenArchive = async () => {
    setListHtml(el("div", { class: "lu-muted" }, ["טוען ארכיון..."]));
    try { await ensureAnonAuth(); } catch {}
    // אם אתה רוצה סינון 24 שעות גם בארכיון, תעשה את זה בצד שרת/דאטה.
    const qy = query(collection(db, CFG.archiveCollection), orderBy("createdAt", "desc"), limit(CFG.maxArchive));
    state.unsub = onSnapshot(qy, (snap) => {
      if (snap.empty) { setListHtml(el("div", { class: "lu-muted" }, ["הארכיון עדיין ריק."])); return; }
      const wrap = el("div", {}, []);
      snap.docs.forEach((d) => wrap.appendChild(renderCardArchive(d)));
      setListHtml(wrap);
    }, () => setListHtml(el("div", { class: "lu-muted" }, ["שגיאה בטעינת ארכיון."])));
  };

  async function initLiveUpdatesWidget() {
    injectStyles();
    buildWidget();
    try { await ensureAnonAuth(); } catch {}
    try { state.badgeUnsub = listenBadgeLiveCount(); } catch {}

    window.__liveUpdatesCleanup = () => {
      try { state.badgeUnsub && state.badgeUnsub(); } catch {}
      try { state.unsub && state.unsub(); } catch {}
    };
  }

  window.initLiveUpdatesWidget = initLiveUpdatesWidget;
})();
