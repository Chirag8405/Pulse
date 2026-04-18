import { beforeEach, describe, expect, it, vi } from "vitest";

const addAuditLogMock = vi.hoisted(() => vi.fn());
const addOutboxMock = vi.hoisted(() => vi.fn());
const collectionMock = vi.hoisted(() => vi.fn((collectionName: string) => {
  if (collectionName === "audit_log_outbox") {
    return { add: addOutboxMock };
  }

  return { add: addAuditLogMock };
}));
const bigQueryWriteMock = vi.hoisted(() => vi.fn());
const loggerInfoMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: collectionMock,
  },
}));

vi.mock("@/lib/google/bigquery", () => ({
  writeAuditEventToBigQuery: bigQueryWriteMock,
}));

vi.mock("@/lib/google/logging", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: loggerInfoMock,
    warn: vi.fn(),
    error: loggerErrorMock,
    critical: vi.fn(),
  })),
}));

import { logAuditEvent, writeAuditLog } from "@/lib/server/auditLog";

describe("auditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addAuditLogMock.mockResolvedValue(undefined);
    addOutboxMock.mockResolvedValue(undefined);
    bigQueryWriteMock.mockResolvedValue(true);
  });

  it("writes sanitized metadata to Firestore and BigQuery", async () => {
    await writeAuditLog("team.joined", "user-1", {
      targetId: "team-7",
      metadata: {
        source: "teams-join",
        longText: "x".repeat(600),
        nested: {
          level1: {
            level2: {
              level3: {
                level4: "should-clamp-depth",
              },
            },
          },
        },
      },
    });

    expect(collectionMock).toHaveBeenCalledWith("audit_log");
    expect(addAuditLogMock).toHaveBeenCalledTimes(1);
    expect(addOutboxMock).not.toHaveBeenCalled();

    const firestorePayload = addAuditLogMock.mock.calls[0]?.[0] as {
      metadata?: {
        longText?: string;
        nested?: {
          level1?: {
            level2?: string;
          };
        };
      };
      action: string;
      actorUid: string;
    };

    expect(firestorePayload.action).toBe("team.joined");
    expect(firestorePayload.actorUid).toBe("user-1");
    expect(firestorePayload.metadata?.longText?.length).toBeLessThanOrEqual(303);
    expect(firestorePayload.metadata?.nested?.level1?.level2).toBe(
      "[max-depth]"
    );

    expect(bigQueryWriteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "team.joined",
        actorUid: "user-1",
        targetId: "team-7",
      })
    );
    expect(loggerInfoMock).toHaveBeenCalled();
  });

  it("does not throw when Firestore write fails", async () => {
    addAuditLogMock.mockRejectedValue(new Error("firestore_unavailable"));
    bigQueryWriteMock.mockResolvedValue(true);

    await expect(
      writeAuditLog("user.deleted", "user-2", { targetId: "user-2" })
    ).resolves.toBeUndefined();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Failed to write audit log entry",
      expect.objectContaining({
        action: "user.deleted",
        actorUid: "user-2",
      })
    );
  });

  it("logAuditEvent is fire-and-forget", async () => {
    logAuditEvent("auth.login", "user-3", {
      metadata: { via: "google" },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(addAuditLogMock).toHaveBeenCalledTimes(1);
    expect(bigQueryWriteMock).toHaveBeenCalledTimes(1);
  });

  it("queues an outbox entry when BigQuery sink returns false", async () => {
    bigQueryWriteMock.mockResolvedValue(false);

    await writeAuditLog("team.joined", "user-5", {
      targetId: "team-5",
      metadata: { source: "api" },
    });

    expect(addOutboxMock).toHaveBeenCalledTimes(1);
    expect(addOutboxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "team.joined",
        actorUid: "user-5",
        targetId: "team-5",
        sink: "bigquery",
      })
    );
  });

  it("queues an outbox entry when BigQuery write rejects", async () => {
    bigQueryWriteMock.mockRejectedValue(new Error("bq_down"));

    await writeAuditLog("user.deleted", "user-6", {
      targetId: "user-6",
    });

    expect(addOutboxMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Unexpected BigQuery audit write failure",
      expect.objectContaining({
        action: "user.deleted",
        actorUid: "user-6",
      })
    );
  });
});
