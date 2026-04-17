import "server-only";
import { createHash } from "node:crypto";
import { BigQuery } from "@google-cloud/bigquery";
import { createLogger } from "@/lib/google/logging";
import { getErrorMessage } from "@/lib/shared/errorUtils";

const logger = createLogger("bigquery");

const BIGQUERY_DATASET_ID =
  process.env.GOOGLE_BIGQUERY_DATASET?.trim() ?? "";
const BIGQUERY_AUDIT_TABLE_ID =
  process.env.GOOGLE_BIGQUERY_AUDIT_TABLE?.trim() ?? "";
const ENABLE_BIGQUERY_AUDIT = process.env.ENABLE_BIGQUERY_AUDIT !== "false";

let bigQueryClient: BigQuery | null = null;

function isConfigured(): boolean {
  return (
    ENABLE_BIGQUERY_AUDIT &&
    BIGQUERY_DATASET_ID.length > 0 &&
    BIGQUERY_AUDIT_TABLE_ID.length > 0
  );
}

function getBigQueryClient(): BigQuery | null {
  if (!isConfigured()) {
    return null;
  }

  if (bigQueryClient) {
    return bigQueryClient;
  }

  bigQueryClient = new BigQuery({
    projectId:
      process.env.GCLOUD_PROJECT ??
      process.env.FIREBASE_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT,
  });

  return bigQueryClient;
}

export interface BigQueryAuditEvent {
  action: string;
  actorUid: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  occurredAtIso: string;
  ipAddress?: string;
}

function buildInsertId(event: BigQueryAuditEvent): string {
  return createHash("sha256")
    .update(
      [
        event.action,
        event.actorUid,
        event.targetId ?? "",
        event.occurredAtIso,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 40);
}

export function isBigQueryAuditEnabled(): boolean {
  return isConfigured();
}

export async function writeAuditEventToBigQuery(
  event: BigQueryAuditEvent
): Promise<boolean> {
  const client = getBigQueryClient();

  if (!client) {
    return false;
  }

  try {
    const table = client
      .dataset(BIGQUERY_DATASET_ID)
      .table(BIGQUERY_AUDIT_TABLE_ID);

    await table.insert(
      [
        {
          insertId: buildInsertId(event),
          json: {
            action: event.action,
            actor_uid: event.actorUid,
            target_id: event.targetId ?? null,
            metadata: JSON.stringify(event.metadata ?? {}),
            occurred_at: event.occurredAtIso,
            ip_address: event.ipAddress ?? null,
            ingested_at: new Date().toISOString(),
          },
        },
      ],
      {
        ignoreUnknownValues: true,
        skipInvalidRows: true,
      }
    );

    return true;
  } catch (error) {
    logger.warn("Failed to write audit event to BigQuery", {
      action: event.action,
      actorUid: event.actorUid,
      error: getErrorMessage(error),
    });

    return false;
  }
}
