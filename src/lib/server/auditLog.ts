/**
 * Server-side audit logging to Firestore.
 * Records admin actions and security-sensitive operations
 * for compliance and debugging.
 */
import { adminDb } from "@/lib/firebase/admin";
import {
  writeAuditEventToBigQuery,
} from "@/lib/google/bigquery";
import { createLogger } from "@/lib/google/logging";

const logger = createLogger("audit");
const BIGQUERY_AUDIT_OUTBOX_COLLECTION = "audit_log_outbox";

const MAX_METADATA_DEPTH = 3;
const MAX_METADATA_KEYS = 40;
const MAX_METADATA_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 300;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

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
  metadata?: JsonObject;
  timestamp: Date;
  ipAddress?: string;
}

interface AuditOutboxEntry {
  action: AuditAction;
  actorUid: string;
  targetId: string | null;
  metadata: JsonObject | null;
  timestamp: Date;
  ipAddress: string | null;
  reason: string;
  createdAt: Date;
  sink: "bigquery";
}

function sanitizeString(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...`
    : value;
}

function sanitizeMetadataValue(value: unknown, depth: number): JsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= MAX_METADATA_DEPTH) {
    return "[max-depth]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_METADATA_ARRAY_ITEMS)
      .map((entry) => sanitizeMetadataValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_METADATA_KEYS
    );

    const sanitizedObject: JsonObject = {};

    entries.forEach(([key, nestedValue]) => {
      const normalizedKey = key.trim().slice(0, 80);

      if (!normalizedKey) {
        return;
      }

      sanitizedObject[normalizedKey] = sanitizeMetadataValue(
        nestedValue,
        depth + 1
      );
    });

    return sanitizedObject;
  }

  return sanitizeString(String(value));
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>
): JsonObject | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized = sanitizeMetadataValue(metadata, 0);

  if (sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)) {
    return sanitized as JsonObject;
  }

  return undefined;
}

async function enqueueBigQueryOutboxEntry(
  entry: AuditEntry,
  reason: string
): Promise<void> {
  const outboxEntry: AuditOutboxEntry = {
    action: entry.action,
    actorUid: entry.actorUid,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    timestamp: entry.timestamp,
    ipAddress: entry.ipAddress ?? null,
    reason,
    createdAt: new Date(),
    sink: "bigquery",
  };

  await adminDb.collection(BIGQUERY_AUDIT_OUTBOX_COLLECTION).add(outboxEntry);
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
  const metadata = sanitizeMetadata(options.metadata);

  const entry: AuditEntry = {
    action,
    actorUid,
    targetId: options.targetId,
    metadata,
    timestamp: new Date(),
    ipAddress: options.ipAddress,
  };

  // Log to Google Cloud Logging (structured JSON)
  logger.info(`Audit: ${action}`, {
    actorUid,
    targetId: options.targetId ?? null,
    metadata: metadata ?? null,
  });

  let firestoreWrite: Promise<unknown>;

  try {
    const firestoreEntry: Record<string, unknown> = {
      action: entry.action,
      actorUid: entry.actorUid,
      timestamp: entry.timestamp,
      metadata: metadata ?? null,
    };

    if (entry.targetId !== undefined) {
      firestoreEntry.targetId = entry.targetId;
    }

    if (entry.ipAddress !== undefined) {
      firestoreEntry.ipAddress = entry.ipAddress;
    }

    firestoreWrite = adminDb.collection("audit_log").add(firestoreEntry);
  } catch (error) {
    logger.error("Failed to initialize audit log write", {
      action,
      actorUid,
      error: error instanceof Error ? error.message : String(error),
    });

    firestoreWrite = Promise.resolve(null);
  }

  let bigQueryWrite: Promise<boolean>;

  try {
    bigQueryWrite = writeAuditEventToBigQuery({
      action,
      actorUid,
      targetId: options.targetId,
      metadata,
      ipAddress: options.ipAddress,
      occurredAtIso: entry.timestamp.toISOString(),
    });
  } catch (error) {
    logger.error("Failed to initialize BigQuery audit write", {
      action,
      actorUid,
      error: error instanceof Error ? error.message : String(error),
    });

    bigQueryWrite = Promise.resolve(false);
  }

  const [firestoreResult, bigQueryResult] = await Promise.allSettled([
    firestoreWrite,
    bigQueryWrite,
  ]);

  if (firestoreResult.status === "rejected") {
    // Audit logging should never break the request flow.
    logger.error("Failed to write audit log entry", {
      action,
      actorUid,
      error:
        firestoreResult.reason instanceof Error
          ? firestoreResult.reason.message
          : String(firestoreResult.reason),
    });
  }

  if (bigQueryResult.status === "rejected") {
    logger.error("Unexpected BigQuery audit write failure", {
      action,
      actorUid,
      error:
        bigQueryResult.reason instanceof Error
          ? bigQueryResult.reason.message
          : String(bigQueryResult.reason),
    });

    try {
      await enqueueBigQueryOutboxEntry(
        entry,
        bigQueryResult.reason instanceof Error
          ? bigQueryResult.reason.message
          : String(bigQueryResult.reason)
      );
    } catch (outboxError) {
      logger.error("Failed to enqueue BigQuery outbox entry", {
        action,
        actorUid,
        error: outboxError instanceof Error ? outboxError.message : String(outboxError),
      });
    }
  }

  if (bigQueryResult.status === "fulfilled" && bigQueryResult.value === false) {
    try {
      await enqueueBigQueryOutboxEntry(entry, "BigQuery sink returned false");
    } catch (outboxError) {
      logger.error("Failed to enqueue BigQuery outbox entry", {
        action,
        actorUid,
        error: outboxError instanceof Error ? outboxError.message : String(outboxError),
      });
    }
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
