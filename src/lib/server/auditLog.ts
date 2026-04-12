/**
 * Server-side audit logging to Firestore.
 * Records admin actions and security-sensitive operations
 * for compliance and debugging.
 */
import { adminDb } from "@/lib/firebase/admin";
import { createLogger } from "@/lib/google/logging";

const logger = createLogger("audit");

export type AuditAction =
  | "user.created"
  | "user.deleted"
  | "user.promoted_admin"
  | "team.joined"
  | "team.left"
  | "challenge.created"
  | "challenge.completed"
  | "event.status_changed"
  | "auth.login"
  | "auth.logout"
  | "admin.action";

interface AuditEntry {
  action: AuditAction;
  actorUid: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
}

/**
 * Writes an audit log entry to Firestore and Google Cloud Logging.
 * Non-blocking — errors are logged but never thrown to callers.
 */
export async function writeAuditLog(
  action: AuditAction,
  actorUid: string,
  options: {
    targetId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  } = {}
): Promise<void> {
  const entry: AuditEntry = {
    action,
    actorUid,
    targetId: options.targetId,
    metadata: options.metadata,
    timestamp: new Date(),
    ipAddress: options.ipAddress,
  };

  // Log to Google Cloud Logging (structured JSON)
  logger.info(`Audit: ${action}`, {
    actorUid,
    targetId: options.targetId,
    ...options.metadata,
  });

  // Persist to Firestore audit_log collection
  try {
    await adminDb.collection("audit_log").add({
      ...entry,
      timestamp: entry.timestamp,
    });
  } catch (error) {
    // Audit logging should never break the request flow.
    logger.error("Failed to write audit log entry", {
      action,
      actorUid,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Fire-and-forget audit log — returns void immediately.
 */
export function logAuditEvent(
  action: AuditAction,
  actorUid: string,
  options: {
    targetId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  } = {}
): void {
  void writeAuditLog(action, actorUid, options);
}
