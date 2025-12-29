const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// ❗הכנס כאן את ה-Webhook שלך (עדיף בהמשך לשים כ-secrets, אבל עכשיו שיהיה פשוט)
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

exports.notifyOnNewLog = functions
  .region("europe-west1") // ישראל לרוב טוב עם europe-west1. אם הפרויקט שלך על אזור אחר תגיד לי.
  .firestore
  .document("exams_logs/{logId}")
  .onCreate(async (snap, context) => {
    const log = snap.data() || {};
    const when = toILTime(log.createdAt);

    const entity = humanEntity(log.entity);
    const action = humanAction(log.action);

    const grade = log.grade || "-";
    const classId = log.classId || "-";
    const subject = log.subject || "-";
    const adminEmail = log.adminEmail || "-";

    // info נוסף כמו אצלך
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
**Doc:** ${context.params.logId}`;

    try {
      const res = await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Discord webhook failed:", res.status, txt);
      }
    } catch (e) {
      console.error("Discord webhook error:", e);
    }
  });
