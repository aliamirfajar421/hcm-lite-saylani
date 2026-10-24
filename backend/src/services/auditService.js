import { AuditLog, Notification } from "../models/CommsAudit.js";

export async function recordAudit({
  actor,
  action,
  entityType,
  entityId = "",
  summary = "",
  before = null,
  after = null,
}) {
  if (!actor) return null;
  try {
    return await AuditLog.create({
      actorId: actor._id || actor.userId,
      actorEmail: actor.email || "system",
      actorRole: actor.role || "system",
      action,
      entityType,
      entityId: String(entityId || ""),
      summary,
      before,
      after,
    });
  } catch (err) {
    console.error("Audit log error:", err.message);
    return null;
  }
}

export async function sendNotification({
  userId,
  title,
  message,
  type = "announcement",
  link = "/dashboard",
}) {
  if (!userId) return null;
  try {
    return await Notification.create({
      userId,
      title,
      message,
      type,
      link,
    });
  } catch (err) {
    console.error("Notification error:", err.message);
    return null;
  }
}

