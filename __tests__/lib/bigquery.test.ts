import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.hoisted(() => vi.fn());
const tableMock = vi.hoisted(() => vi.fn(() => ({ insert: insertMock })));
const datasetMock = vi.hoisted(() => vi.fn(() => ({ table: tableMock })));
const bigQueryCtorMock = vi.hoisted(() =>
  vi.fn(function MockBigQuery() {
    return {
      dataset: datasetMock,
    };
  })
);
const loggerWarnMock = vi.hoisted(() => vi.fn());

vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: bigQueryCtorMock,
}));

vi.mock("@/lib/google/logging", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: loggerWarnMock,
    error: vi.fn(),
    critical: vi.fn(),
  })),
}));

describe("BigQuery audit sink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    delete process.env.GOOGLE_BIGQUERY_DATASET;
    delete process.env.GOOGLE_BIGQUERY_AUDIT_TABLE;
    delete process.env.ENABLE_BIGQUERY_AUDIT;
  });

  it("is disabled when dataset/table are not configured", async () => {
    const {
      isBigQueryAuditEnabled,
      writeAuditEventToBigQuery,
    } = await import("@/lib/google/bigquery");

    expect(isBigQueryAuditEnabled()).toBe(false);

    const wrote = await writeAuditEventToBigQuery({
      action: "team.joined",
      actorUid: "user-1",
      occurredAtIso: "2026-01-01T00:00:00.000Z",
    });

    expect(wrote).toBe(false);
    expect(bigQueryCtorMock).not.toHaveBeenCalled();
  });

  it("writes audit events with deterministic insertId when configured", async () => {
    process.env.GOOGLE_BIGQUERY_DATASET = "pulse_analytics";
    process.env.GOOGLE_BIGQUERY_AUDIT_TABLE = "audit_events";
    process.env.ENABLE_BIGQUERY_AUDIT = "true";

    insertMock.mockResolvedValue(undefined);

    const {
      isBigQueryAuditEnabled,
      writeAuditEventToBigQuery,
    } = await import("@/lib/google/bigquery");

    expect(isBigQueryAuditEnabled()).toBe(true);

    const wrote = await writeAuditEventToBigQuery({
      action: "team.joined",
      actorUid: "user-1",
      targetId: "team-4",
      metadata: { source: "join_api" },
      occurredAtIso: "2026-01-01T00:00:00.000Z",
      ipAddress: "10.10.0.1",
    });

    expect(wrote).toBe(true);
    expect(bigQueryCtorMock).toHaveBeenCalledTimes(1);
    expect(datasetMock).toHaveBeenCalledWith("pulse_analytics");
    expect(tableMock).toHaveBeenCalledWith("audit_events");
    expect(insertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          insertId: expect.any(String),
          json: expect.objectContaining({
            action: "team.joined",
            actor_uid: "user-1",
            target_id: "team-4",
            metadata: JSON.stringify({ source: "join_api" }),
          }),
        }),
      ],
      {
        ignoreUnknownValues: true,
        skipInvalidRows: true,
      }
    );
  });

  it("logs warning and returns false when insert fails", async () => {
    process.env.GOOGLE_BIGQUERY_DATASET = "pulse_analytics";
    process.env.GOOGLE_BIGQUERY_AUDIT_TABLE = "audit_events";
    process.env.ENABLE_BIGQUERY_AUDIT = "true";

    insertMock.mockRejectedValue(new Error("insert_failed"));

    const { writeAuditEventToBigQuery } = await import("@/lib/google/bigquery");

    const wrote = await writeAuditEventToBigQuery({
      action: "user.deleted",
      actorUid: "user-1",
      occurredAtIso: "2026-01-01T00:00:00.000Z",
    });

    expect(wrote).toBe(false);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "Failed to write audit event to BigQuery",
      expect.objectContaining({
        action: "user.deleted",
        actorUid: "user-1",
      })
    );
  });
});
