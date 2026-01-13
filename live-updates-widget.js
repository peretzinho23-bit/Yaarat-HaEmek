/* =========================================================
   Live Updates Widget (single-file JS) ✅ FIXED
   - Adds "עדכונים חיים" button
   - Live feed from: liveUpdates
   - Archive from: updateArchive (no likes)
   - Likes: liveUpdates/{postId}/likes/{uid}
   ========================================================= */

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
      return d ? d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";
    } catch { return ""; }
  };

  const fmtDate = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      return d ? d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
    } catch { return ""; }
  };

  const escapeHtml = (s) =>
    (s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const ensureFirebase = () => {
    if (!window.firebase) throw new Error("Firebase לא נטען (window.firebase חסר).");
    if (!firebase.firestore) throw new Error("Firestore לא נטען.");
    if (!firebase.auth) throw new Error("Auth לא נטען.");
  };

  const injectStyles = () => {
    if (document.getElementById("liveUpdatesWidgetStyles")) return;
    const css = `
#lu-fab{position:fixed;top:140px;${CFG.position}:14px;z-index:999999;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;direction:rtl}
#lu-fab button{display:flex;align-items:center;gap:10px;border:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-radius:14px;padding:10px 12px;cursor:pointer;box-shadow:0 10px 25px rgba(0,0,0,.12);font-weight:800}
#lu-badge{min-width:22px;height:22px;padding:0 7px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;border:1px solid rgba(0,0,0,.12);background:rgba(220,38,38,.10)}
#lu-modal{position:fixed;inset:0;display:none;z-index:999999;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;direction:rtl}
#lu-modal[open]{display:block}
#lu-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45)}
#lu-panel{position:absolute;top:6vh;${CFG.position}:16px;width:min(420px,calc(100vw - 32px));height:88vh;background:rgba(255,255,255,.96);border:1px solid rgba(0,0,0,.10);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column}
#lu-head{padding:12px 12px 10px;background:linear-gradient(180deg,rgba(248,250,252,.9),rgba(255,255,255,.9));border-bottom:1px solid rgba(0,0,0,.08)}
#lu-toprow{display:flex;align-items:center;justify-content:space-between;gap:10px}
#lu-title{font-weight:900;font-size:16px;display:flex;align-items:center;gap:10px}
#lu-close{border:1px solid rgba(0,0,0,.12);background:white;border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:800}
#lu-tabs{margin-top:10px;display:flex;gap:8px}
.lu-tab{flex:1;border:1px solid rgba(0,0,0,.10);background:rgba(2,6,23,.04);border-radius:12px;padding:10px 0;cursor:pointer;font-weight:900}
.lu-tab[aria-selected="true"]{background:rgba(220,38,38,.12);border-color:rgba(220,38,38,.22)}
#lu-list{padding:12px;overflow:auto;flex:1}
.lu-card{border:1px solid rgba(0,0,0,.10);border-radius:16px;background:rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(0,0,0,.08);padding:10px;margin-bottom:10px}
.lu-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.lu-author{display:flex;align-items:center;gap:8px;font-weight:900}
.lu-avatar{width:28px;height:28px;border-radius:999px;background:rgba(2,6,23,.08);overflow:hidden;display:flex;align-items:center;justify-content:center}
.lu-avatar img{width:100%;height:100%;object-fit:cover}
.lu-time{font-size:12px;opacity:.75;font-weight:700}
.lu-text{font-size:14px;line-height:1.35;white-space:pre-wrap;word-break:break-word}
.lu-imgs{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.lu-imgs img{width:100%;max-height:230px;border-radius:14px;object-fit:cover;border:1px solid rgba(0,0,0,.10);cursor:zoom-in}
.lu-actions{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:10px}
.lu-likeBtn{border:1px solid rgba(0,0,0,.12);background:white;border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:900;display:flex;align-items:center;gap:8px}
.lu-likeBtn[aria-pressed="true"]{background:rgba(220,38,38,.12);border-color:rgba(220,38,38,.22)}
.lu-muted{font-size:12px;opacity:.75;font-weight:700}
#lu-footer{padding:10px 12px;border-top:1px solid rgba(0,0,0,.08);display:flex;justify-content:space-between;align-items:center;gap:10px;background:rgba(248,250,252,.85)}
#lu-refresh,#lu-add{border:1px solid rgba(0,0,0,.12);background:white;border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:900}
#lu-note{font-size:12px;opacity:.75;font-weight:700}
`;
    document.head.appendChild(el("style", { id: "liveUpdatesWidgetStyles", html: css }));
  };

  const state = { user: null, tab: "live", unsub: null, db: null };

  const buildWidget = () => {
    if (document.getElementById("lu-fab")) return;

    const badge = el("span", { id: "lu-badge" }, ["0"]);
    const btn = el("button", { type: "button", onclick: () => openModal(), title: "עדכונים חיים" }, [
      el("span", {}, ["📰"]),
      el("span", {}, ["עדכונים חיים"]),
      badge,
    ]);

    const fab = el("div", { id: "lu-fab" }, [btn]);
    const overlay = el("div", { id: "lu-overlay", onclick: () => closeModal() });
    const closeBtn = el("button", { id: "lu-close", type: "button", onclick: () => closeModal() }, ["סגור"]);

    const tabLive = el("button", { class: "lu-tab", type: "button", "aria-selected": "true", onclick: () => switchTab("live") }, ["לייב"]);
    const tabArchive = el("button", { class: "lu-tab", type: "button", "aria-selected": "false", onclick: () => switchTab("archive") }, ["ארכיון"]);

    const head = el("div", { id: "lu-head" }, [
      el("div", { id: "lu-toprow" }, [
        el("div", { id: "lu-title" }, [el("span", {}, ["🗞️"]), el("span", {}, ["עדכונים חיים"])]),
        closeBtn,
      ]),
      el("div", { id: "lu-tabs" }, [tabLive, tabArchive]),
    ]);

    const list = el("div", { id: "lu-list" }, [el("div", { class: "lu-muted" }, ["טוען..."])]);
    const addBtn = el("button", { id: "lu-add", type: "button", style: "display:none;", onclick: () => (location.href = "add-update.html") }, ["✏️ הוסף עדכון"]);
    const refreshBtn = el("button", { id: "lu-refresh", type: "button", onclick: () => reloadCurrentTab() }, ["רענן"]);
    const note = el("div", { id: "lu-note" }, ["לייקים מופיעים רק בלייב"]);
    const footer = el("div", { id: "lu-footer" }, [refreshBtn, addBtn, note]);

    const panel = el("div", { id: "lu-panel" }, [head, list, footer]);
    const modal = el("div", { id: "lu-modal" }, [overlay, panel]);

    document.body.appendChild(fab);
    document.body.appendChild(modal);

    window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  };

  const setBadge = (n) => { const b = document.getElementById("lu-badge"); if (b) b.textContent = String(n ?? 0); };
  const setListHtml = (nodeOrHtml) => {
    const list = document.getElementById("lu-list");
    if (!list) return;
    list.innerHTML = "";
    if (typeof nodeOrHtml === "string") list.innerHTML = nodeOrHtml;
    else list.appendChild(nodeOrHtml);
  };

  const openModal = () => { const m = document.getElementById("lu-modal"); if (!m) return; m.setAttribute("open", ""); reloadCurrentTab(); };
  const closeModal = () => { const m = document.getElementById("lu-modal"); if (!m) return; m.removeAttribute("open"); };

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

  const ensureAnonAuth = async () => {
    if (state.user) return state.user;
    const auth = firebase.auth();
    if (auth.currentUser) { state.user = auth.currentUser; return state.user; }
    await auth.signInAnonymously();
    state.user = auth.currentUser;
    return state.user;
  };

  async function isTeacherUser(user) {
    try {
      const roleSnap = await state.db.collection("adminUsers").doc(user.uid).get();
      const role = (roleSnap.exists && roleSnap.data().role) ? String(roleSnap.data().role).toLowerCase() : "";
      const staffRoles = ["teacherpanel","teacher","gradelead","counselor","principal","dev","admin"];
      if (staffRoles.includes(role)) return true;

      const email = user.email ? String(user.email).toLowerCase() : "";
      if (!email) return false;
      const allowSnap = await state.db.collection("teacherAllow").doc(email).get();
      return allowSnap.exists && allowSnap.data().active === true;
    } catch { return false; }
  }

  const listenBadgeLiveCount = () => {
    const q = state.db.collection(CFG.liveCollection).orderBy("createdAt", "desc").limit(50);
    return q.onSnapshot((snap) => setBadge(snap.size), () => setBadge(0));
  };

  const zoomImage = (src) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<img src="${src}" style="max-width:100%;height:auto;display:block;margin:0 auto" />`);
    w.document.title = "תמונה";
  };

const markViewedOnce = async (postId) => {
  try {
    await ensureAnonAuth();
    const uid = state.user?.uid;
    if (!uid) return;

    const key = `lu_viewed_${postId}_${uid}`;
    if (localStorage.getItem(key) === "1") return;

    const ref = state.db.collection(CFG.liveCollection).doc(postId);

    await state.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const cur = Number(snap.data().viewsCount || 0);
      tx.update(ref, { viewsCount: cur + 1 }); // ✅ זה בדיוק מה שהחוקים דורשים
    });

    localStorage.setItem(key, "1");
  } catch (e) {
    // אל תעצור את ה־UI בגלל views
    console.warn("views update blocked:", e?.message || e);
  }
};


  const toggleLike = async (postId) => {
    try {
      await ensureAnonAuth();
      const uid = state.user.uid;

      const postRef = state.db.collection(CFG.liveCollection).doc(postId);
      const likeRef = postRef.collection("likes").doc(uid);

      await state.db.runTransaction(async (tx) => {
        const likeSnap = await tx.get(likeRef);
        const postSnap = await tx.get(postRef);
        if (!postSnap.exists) return;

        const inc = firebase.firestore.FieldValue.increment;
        if (likeSnap.exists) {
          tx.delete(likeRef);
          tx.update(postRef, { likesCount: inc(-1) });
        } else {
          tx.set(likeRef, { createdAt: firebase.firestore.FieldValue.serverTimestamp(), uid });
          tx.update(postRef, { likesCount: inc(1) });
        }
      });
    } catch (e) {
      console.warn("Like failed:", e);
      alert("לא הצלחתי לשמור לייק. נסה שוב.");
    }
  };

  const renderCardLive = async (docSnap) => {
    const data = docSnap.data() || {};
    const postId = docSnap.id;
    markViewedOnce(postId);

    const authorName = data.authorName || "דסק החינוך";
    const authorPhoto = data.authorPhoto || "";
    const text = (data.text || "").slice(0, CFG.textMaxLen);
    const createdAt = data.createdAt;

    const likesCount = Number(data.likesCount || 0);
    const viewsCount = Number(data.viewsCount || 0);

    const uid = state.user?.uid;
    let liked = false;
    if (uid) {
      try {
        const likeDoc = await state.db.collection(CFG.liveCollection).doc(postId).collection("likes").doc(uid).get();
        liked = likeDoc.exists;
      } catch {}
    }

    const avatar = el("div", { class: "lu-avatar" }, [
      authorPhoto ? el("img", { src: authorPhoto, alt: "avatar" }) : el("span", {}, ["👤"]),
    ]);

    const metaLeft = el("div", { class: "lu-author" }, [avatar, el("span", {}, [authorName])]);
    const metaRight = el("div", { class: "lu-time" }, [`${fmtTime(createdAt)} • ${fmtDate(createdAt)}`]);

    const textNode = el("div", { class: "lu-text", html: escapeHtml(text) });

    const imgsWrap = el("div", { class: "lu-imgs" }, []);
    const urls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
    urls.filter(Boolean).forEach((u) => imgsWrap.appendChild(el("img", { src: u, alt: "image", onclick: () => zoomImage(u) })));

    const likeBtn = el("button", {
      class: "lu-likeBtn",
      type: "button",
      "aria-pressed": liked ? "true" : "false",
      onclick: async () => { await toggleLike(postId); },
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

  const renderCardArchive = (docSnap) => {
    const data = docSnap.data() || {};
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
    urls.filter(Boolean).forEach((u) => imgsWrap.appendChild(el("img", { src: u, alt: "image", onclick: () => zoomImage(u) })));

    return el("div", { class: "lu-card" }, [
      el("div", { class: "lu-meta" }, [metaLeft, metaRight]),
      textNode,
      urls.length ? imgsWrap : el("div"),
      el("div", { class: "lu-muted", style: "margin-top:10px" }, ["הודעה מארכיון"]),
    ]);
  };

  const listenLive = async () => {
    setListHtml(el("div", { class: "lu-muted" }, ["טוען לייב..."]));
    await ensureAnonAuth();

    // כפתור "הוסף עדכון" רק לצוות
    try {
      const ok = await isTeacherUser(state.user);
      const btn = document.getElementById("lu-add");
      if (btn) btn.style.display = ok ? "" : "none";
    } catch {}

    const q = state.db.collection(CFG.liveCollection).orderBy("createdAt", "desc").limit(CFG.maxLive);

    state.unsub = q.onSnapshot(async (snap) => {
      if (snap.empty) {
        setListHtml(el("div", { class: "lu-muted" }, ["אין עדכונים כרגע."]));
        return;
      }

      const wrap = el("div", {}, []);
      for (const d of snap.docs) {
        const card = await renderCardLive(d);
        wrap.appendChild(card);
      }
      setListHtml(wrap);
}, (err) => {
  console.warn("LIVE SNAPSHOT ERROR:", err);
  setListHtml(el("div", { class: "lu-muted" }, [
    "שגיאה בטעינת לייב: ",
    (err?.message || String(err))
  ]));
});

  };

  const listenArchive = async () => {
    setListHtml(el("div", { class: "lu-muted" }, ["טוען ארכיון..."]));
    try { await ensureAnonAuth(); } catch {}

    // כפתור "הוסף עדכון" רק לצוות
    try {
      const ok = await isTeacherUser(state.user);
      const btn = document.getElementById("lu-add");
      if (btn) btn.style.display = ok ? "" : "none";
    } catch {}

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const q = state.db
      .collection(CFG.archiveCollection)
      .where("createdAt", "<", cutoff)
      .orderBy("createdAt", "desc")
      .limit(CFG.maxArchive);

    state.unsub = q.onSnapshot((snap) => {
      if (snap.empty) {
        setListHtml(el("div", { class: "lu-muted" }, ["הארכיון עדיין ריק."]));
        return;
      }

      const wrap = el("div", {}, []);
      snap.docs.forEach((d) => wrap.appendChild(renderCardArchive(d)));
      setListHtml(wrap);
    }, (err) => {
      console.warn(err);
      setListHtml(el("div", { class: "lu-muted" }, ["שגיאה בטעינת ארכיון."]));
    });
  };

  async function initLiveUpdatesWidget() {
    ensureFirebase();
    injectStyles();
    buildWidget();

    state.db = firebase.firestore();

    try { await ensureAnonAuth(); } catch {}

    let badgeUnsub = null;
    try { badgeUnsub = listenBadgeLiveCount(); } catch {}

    window.__liveUpdatesCleanup = () => {
      try { badgeUnsub && badgeUnsub(); } catch {}
      try { state.unsub && state.unsub(); } catch {}
    };
  }

  window.initLiveUpdatesWidget = initLiveUpdatesWidget;
})();
