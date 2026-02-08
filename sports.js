// sports.js – דף ספורט ציבורי
import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/**
 * DB MODEL (פשוט):
 * classes/{classId} -> { name, grade, logoUrl }
 * sportsTournaments/{tid} -> { name, sport, grade, isActive, createdAt }
 * sportsMatches/{mid} -> {
 *   tournamentId, grade,
 *   homeClassId, awayClassId,
 *   scheduledAt, status, score:{home,away}, venue, round, createdAt
 * }
 *
 * סטטוסים: scheduled | live | finished | canceled
 */

const els = {
  next: document.getElementById("sports-next"),
  recent: document.getElementById("sports-recent"),
  table: document.getElementById("sports-standings"),
  tournamentSelect: document.getElementById("sports-tournamentSelect"),
  gradeSelect: document.getElementById("sports-gradeSelect")
};

const CLASSES_COL = collection(db, "classes");
const TOURN_COL = collection(db, "sportsTournaments");
const MATCHES_COL = collection(db, "sportsMatches");

let classesMap = new Map(); // classId -> {name, grade, logoUrl}
let activeTournamentId = null;
let matchesUnsub = null;
let tournamentsUnsub = null;

function safeText(v, fallback = "") {
  return (v ?? fallback).toString();
}

function fmtDateTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    if (!d) return "—";
    return d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function getClass(classId) {
  const c = classesMap.get(classId);
  if (c) return c;
  // fallback אם אין מסמך
  return { id: classId, name: classId, grade: "", logoUrl: "" };
}

function statusPill(status) {
  if (status === "live") return `<span class="pill live">LIVE</span>`;
  if (status === "finished") return `<span class="pill finished">נגמר</span>`;
  if (status === "scheduled") return `<span class="pill scheduled">קרוב</span>`;
  if (status === "canceled") return `<span class="pill">בוטל</span>`;
  return `<span class="pill">—</span>`;
}

function miniStatus(status) {
  if (status === "live") return `<span class="miniPill" style="color:#fff;background:rgba(37,99,235,.65);border-color:rgba(37,99,235,.35)">LIVE</span>`;
  if (status === "finished") return `<span class="miniPill" style="color:#fff;background:rgba(22,163,74,.65);border-color:rgba(22,163,74,.35)">נגמר</span>`;
  if (status === "scheduled") return `<span class="miniPill">קרוב</span>`;
  if (status === "canceled") return `<span class="miniPill">בוטל</span>`;
  return `<span class="miniPill">—</span>`;
}

function logoHtml(logoUrl, fallbackLetter) {
  if (logoUrl) return `<div class="logo"><img alt="" src="${logoUrl}"></div>`;
  return `<div class="logo" aria-hidden="true" style="font-weight:900;opacity:.75">${fallbackLetter}</div>`;
}

function firstLetter(name) {
  const s = safeText(name).trim();
  return s ? s[0] : "•";
}

/* =========================
   LOAD CLASSES MAP
   ========================= */

async function loadClassesOnce() {
  // פה אין onSnapshot כי זה לא קריטי בלייב; אם אתה רוצה—נעשה אחר כך.
  const snap = await getDocs(CLASSES_COL);
  classesMap = new Map();
  snap.forEach((d) => {
    const data = d.data() || {};
    classesMap.set(d.id, {
      id: d.id,
      name: safeText(data.name, d.id),
      grade: safeText(data.grade, ""),
      logoUrl: safeText(data.logoUrl, "")
    });
  });
}

/* =========================
   TOURNAMENTS LISTEN
   ========================= */

function listenTournaments() {
  if (tournamentsUnsub) tournamentsUnsub();

  const grade = els.gradeSelect?.value || "all";

  const qBase = grade === "all"
    ? query(TOURN_COL, where("isActive", "==", true), orderBy("createdAt", "desc"), limit(20))
    : query(TOURN_COL, where("isActive", "==", true), where("grade", "==", grade), orderBy("createdAt", "desc"), limit(20));

  tournamentsUnsub = onSnapshot(qBase, (snap) => {
    const tournaments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    renderTournamentSelect(tournaments);

    // בוחר אוטומטית ראשון אם אין בחירה
    const selected = els.tournamentSelect?.value || "";
    const exists = tournaments.some((t) => t.id === selected);

    if (!selected || !exists) {
      activeTournamentId = tournaments[0]?.id || null;
      if (els.tournamentSelect) els.tournamentSelect.value = activeTournamentId || "";
    } else {
      activeTournamentId = selected;
    }

    listenMatchesForTournament(activeTournamentId);
  });
}

function renderTournamentSelect(tournaments) {
  if (!els.tournamentSelect) return;

  if (!tournaments.length) {
    els.tournamentSelect.innerHTML = `<option value="">אין טורניר פעיל</option>`;
    return;
  }

  const options = tournaments.map((t) => {
    const name = safeText(t.name, "טורניר");
    const sport = safeText(t.sport, "");
    const label = sport ? `${name} · ${sport}` : name;
    return `<option value="${t.id}">${label}</option>`;
  }).join("");

  els.tournamentSelect.innerHTML = options;
}

/* =========================
   MATCHES LISTEN + RENDER
   ========================= */

function listenMatchesForTournament(tournamentId) {
  if (matchesUnsub) matchesUnsub();
  if (!tournamentId) {
    renderEmptyAll();
    return;
  }

  // כל המשחקים של הטורניר כדי לחשב טבלה + להציג next/recent
  const qM = query(
    MATCHES_COL,
    where("tournamentId", "==", tournamentId),
    orderBy("scheduledAt", "desc"),
    limit(400)
  );

  matchesUnsub = onSnapshot(qM, (snap) => {
    const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll(matches);
  }, (err) => {
    console.error("matches listen error:", err);
    renderErrorAll();
  });
}

function renderEmptyAll() {
  if (els.next) els.next.innerHTML = `<div class="empty">אין טורניר פעיל כרגע.</div>`;
  if (els.recent) els.recent.innerHTML = `<div class="empty">אין משחקים להצגה.</div>`;
  if (els.table) els.table.innerHTML = `<div class="empty">אין טבלה להצגה.</div>`;
}

function renderErrorAll() {
  if (els.next) els.next.innerHTML = `<div class="empty">שגיאה בטעינת משחקים. נסה לרענן.</div>`;
  if (els.recent) els.recent.innerHTML = `<div class="empty">שגיאה בטעינת משחקים.</div>`;
  if (els.table) els.table.innerHTML = `<div class="empty">שגיאה בטעינת הטבלה.</div>`;
}

function renderAll(matches) {
  const now = Date.now();

  // next = המשחק הקרוב (scheduledAt בעתיד) או LIVE אם יש
  const live = matches.find((m) => m.status === "live") || null;

  const upcoming = matches
    .filter((m) => m.status === "scheduled" && m.scheduledAt?.toDate && m.scheduledAt.toDate().getTime() >= now)
    .sort((a, b) => a.scheduledAt.toDate().getTime() - b.scheduledAt.toDate().getTime())[0] || null;

  const next = live || upcoming || null;
  renderNextMatch(next);

  // recent = 8 אחרונים שנגמרו/לייב/בוטלו (בפועל: הכי מעניינים)
  const recent = matches
    .filter((m) => ["finished", "live", "canceled"].includes(safeText(m.status)))
    .sort((a, b) => {
      const ta = a.scheduledAt?.seconds || 0;
      const tb = b.scheduledAt?.seconds || 0;
      return tb - ta;
    })
    .slice(0, 10);

  renderRecent(recent);

  // standings = מהמשחקים שנגמרו
  const finished = matches.filter((m) => m.status === "finished" && m.score && Number.isFinite(m.score.home) && Number.isFinite(m.score.away));
  const standings = computeStandings(finished);
  renderStandings(standings);
}

function renderNextMatch(m) {
  if (!els.next) return;

  if (!m) {
    els.next.innerHTML = `<div class="empty">אין משחק קרוב כרגע. תוסיף משחקים בלוח ניהול 😉</div>`;
    return;
  }

  const home = getClass(safeText(m.homeClassId));
  const away = getClass(safeText(m.awayClassId));

  const status = safeText(m.status);
  const when = fmtDateTime(m.scheduledAt);

  const hScore = Number.isFinite(m?.score?.home) ? m.score.home : "—";
  const aScore = Number.isFinite(m?.score?.away) ? m.score.away : "—";
  const scoreLine = (status === "finished" || status === "live") ? `${hScore} : ${aScore}` : "VS";

  const venue = safeText(m.venue, "");
  const round = m.round != null ? `מחזור ${m.round}` : "";

  els.next.innerHTML = `
    <div class="nextMatch">
      <div class="team">
        ${logoHtml(home.logoUrl, firstLetter(home.name))}
        <div style="min-width:0">
          <div class="nm">${safeText(home.name)}</div>
          <div class="sub">${safeText(home.grade)} ${round}</div>
        </div>
      </div>

      <div class="vs">
        <div class="time">${when}</div>
        <div class="score" dir="ltr">${scoreLine}</div>
        <div>${statusPill(status)}</div>
        <div class="pill" style="opacity:.85">${venue || "מיקום לא עודכן"}</div>
      </div>

      <div class="team" style="justify-content:flex-end;">
        <div style="min-width:0;text-align:left">
          <div class="nm">${safeText(away.name)}</div>
          <div class="sub">${safeText(away.grade)}</div>
        </div>
        ${logoHtml(away.logoUrl, firstLetter(away.name))}
      </div>
    </div>
    <div class="smallNote">הטבלה מתעדכנת אוטומטית רק ממשחקים בסטטוס <b>finished</b>.</div>
  `;
}

function renderRecent(list) {
  if (!els.recent) return;

  if (!list.length) {
    els.recent.innerHTML = `<div class="empty">אין משחקים אחרונים להצגה עדיין.</div>`;
    return;
  }

  els.recent.innerHTML = `
    <div class="list">
      ${list.map((m) => {
        const home = getClass(safeText(m.homeClassId));
        const away = getClass(safeText(m.awayClassId));
        const when = fmtDateTime(m.scheduledAt);
        const status = safeText(m.status);

        const hScore = Number.isFinite(m?.score?.home) ? m.score.home : "—";
        const aScore = Number.isFinite(m?.score?.away) ? m.score.away : "—";
        const score = (status === "finished" || status === "live") ? `${hScore}:${aScore}` : "—";

        return `
          <div class="matchRow">
            <div class="left">
              <div class="names">${safeText(home.name)} · ${safeText(away.name)}</div>
              <div class="meta">${when}${m.venue ? ` · ${safeText(m.venue)}` : ""}</div>
            </div>
            <div class="right">
              <div class="scoreMini" dir="ltr">${score}</div>
              ${miniStatus(status)}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* =========================
   STANDINGS (AUTO)
   ========================= */

function makeRow(teamId) {
  return { teamId, p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0 };
}

function ensureTeamRow(map, teamId) {
  if (!map.has(teamId)) map.set(teamId, makeRow(teamId));
  return map.get(teamId);
}

function computeStandings(finishedMatches) {
  // scoring קבוע בינתיים (אחרי זה נעשה לפי טורניר)
  const WIN = 3, DRAW = 1, LOSS = 0;

  const table = new Map();

  for (const m of finishedMatches) {
    const homeId = safeText(m.homeClassId);
    const awayId = safeText(m.awayClassId);
    const hs = Number(m?.score?.home ?? NaN);
    const as = Number(m?.score?.away ?? NaN);
    if (!homeId || !awayId) continue;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;

    const h = ensureTeamRow(table, homeId);
    const a = ensureTeamRow(table, awayId);

    h.p += 1; a.p += 1;
    h.gf += hs; h.ga += as;
    a.gf += as; a.ga += hs;

    if (hs > as) {
      h.w += 1; h.pts += WIN;
      a.l += 1; a.pts += LOSS;
    } else if (hs < as) {
      a.w += 1; a.pts += WIN;
      h.l += 1; h.pts += LOSS;
    } else {
      h.d += 1; a.d += 1;
      h.pts += DRAW; a.pts += DRAW;
    }
  }

  const rows = Array.from(table.values()).map((r) => ({ ...r, gd: r.gf - r.ga }));

  rows.sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.gd !== x.gd) return y.gd - x.gd;
    if (y.gf !== x.gf) return y.gf - x.gf;
    // יציבות
    return safeText(getClass(x.teamId).name).localeCompare(safeText(getClass(y.teamId).name), "he");
  });

  return rows;
}

function renderStandings(rows) {
  if (!els.table) return;

  if (!rows.length) {
    els.table.innerHTML = `<div class="empty">עדיין אין משחקים שנגמרו. הטבלה תופיע אחרי שתסמן משחקים כ־finished.</div>`;
    return;
  }

  els.table.innerHTML = `
    <div class="tableWrap">
      <table class="standings">
        <thead>
          <tr>
            <th>#</th>
            <th style="text-align:right">כיתה</th>
            <th>מש</th>
            <th>נ</th>
            <th>ת</th>
            <th>ה</th>
            <th>הבק</th>
            <th>ספג</th>
            <th>הפרש</th>
            <th>נק׳</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, idx) => {
            const c = getClass(r.teamId);
            return `
              <tr>
                <td>${idx + 1}</td>
                <td class="teamCell">
                  <div class="t">
                    ${logoHtml(c.logoUrl, firstLetter(c.name))}
                    <span>${safeText(c.name)}</span>
                  </div>
                </td>
                <td>${r.p}</td>
                <td>${r.w}</td>
                <td>${r.d}</td>
                <td>${r.l}</td>
                <td>${r.gf}</td>
                <td>${r.ga}</td>
                <td>${r.gd}</td>
                <td style="font-weight:900">${r.pts}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* =========================
   UI EVENTS
   ========================= */

function wireUI() {
  if (els.gradeSelect) {
    els.gradeSelect.addEventListener("change", () => {
      listenTournaments(); // יביא מחדש טורנירים פעילים לפי שכבה
    });
  }

  if (els.tournamentSelect) {
    els.tournamentSelect.addEventListener("change", () => {
      activeTournamentId = els.tournamentSelect.value || null;
      listenMatchesForTournament(activeTournamentId);
    });
  }
}

/* =========================
   BOOT
   ========================= */

document.addEventListener("DOMContentLoaded", async () => {
  wireUI();
  await loadClassesOnce();
  listenTournaments();
});
