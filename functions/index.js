const admin = require("firebase-admin");
admin.initializeApp();

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

// ❗ שים פה WEBHOOK חדש (אחרי שהחלפת בדיסקורד)
const DISCORD_WEBHOOK =
  "https://discord.com/api/webhooks/XXXX/XXXX";

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
