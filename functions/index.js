const admin = require("firebase-admin");
admin.initializeApp();

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// ❗ שים פה WEBHOOK חדש (אחרי שהחלפת בדיסקורד)
const DISCORD_WEBHOOK =
  "https://discord.com/api/webhooks/1455214180289478889/bgpwyd738OErSZL9x9A3wxW2RbMA-GJe5OsZrLVAJ_PrXJCsC1LzHCgx8TUr0bn7wro0";

function toILTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date();
    return d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  } catch {
    return "";
  }
}

function humanEntity(entity) {
  switch (entity) {
    case "exam": return "מבחן";
    case "news": return "חדשות";
    case "board": return "לוח מודעות";
    case "siteContent": return "תוכן אתר";
    case "adminRequest": return "בקשת אדמין";
    default: return entity || "-";
  }
}

function humanAction(action) {
  if (action === "create") return "יצירה";
  if (action === "update") return "עדכון";
  if (action === "delete") return "מחיקה";
  return action || "-";
}

// =========================
// 1) Discord notify על exams_logs (כמו שהיה)
// =========================
exports.notifyOnNewLog = onDocumentCreated(
  {
    region: "europe-west1",
    document: "exams_logs/{logId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const log = snap.data() || {};
    const when = toILTime(log.createdAt);

    const entity = humanEntity(log.entity);
    const action = humanAction(log.action);

    const grade = log.grade || "-";
    const classId = log.classId || "-";
    const subject = log.subject || "-";
    const adminEmail = log.adminEmail || "-";

    const extraInfo =
      log.entity === "exam"
        ? (log.date || "-")
        : (log.entity === "news" || log.entity === "board" || log.entity === "adminRequest")
          ? (log.topic ? String(log.topic).slice(0, 120) : "-")
          : log.entity === "siteContent"
            ? "עדכון תוכן האתר"
            : (log.date || "-");

    const content =
`🧾 **לוג חדש באתר**
**סוג:** ${entity}
**פעולה:** ${action}
**שכבה/כיתה:** ${grade} / ${classId}
**כותרת:** ${subject}
**מידע:** ${extraInfo}
**בוצע ע"י:** ${adminEmail}
**זמן:** ${when || "-"}
**Doc:** ${event.params.logId}`;

    try {
      const res = await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        logger.error("Discord webhook failed:", res.status, txt);
      } else {
        logger.info("Discord webhook sent ✅");
      }
    } catch (e) {
      logger.error("Discord webhook error:", e);
    }
  }
);

// =========================
// 2) ✅ הדבר שאתה רוצה: לוג על "שלח איפוס סיסמה"
// =========================
exports.logResetRequest = onRequest(
  { region: "europe-west1" },
  async (req, res) => {
    // CORS בסיסי
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).send("");

    if (req.method !== "POST") return res.status(405).json({ ok: false });

    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return res.status(400).json({ ok: false });

      // IP אמיתי
      const xff = req.headers["x-forwarded-for"];
      const ip = Array.isArray(xff)
        ? xff[0]
        : String(xff || "").split(",")[0].trim() || req.ip || "";

      await admin.firestore().collection("password_reset_requests").add({
        email,
        ip,
        path: String(req.body?.path || ""),
        userAgent: String(req.body?.userAgent || ""),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({ ok: true });
    } catch (e) {
      logger.error("logResetRequest error:", e);
      return res.status(500).json({ ok: false });
    }
  }
);
