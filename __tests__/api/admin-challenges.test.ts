import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAdminBearerTokenMock = vi.hoisted(() => vi.fn());
const checkServerRateLimitMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const challengeSetMock = vi.hoisted(() => vi.fn());
const challengeGetMock = vi.hoisted(() => vi.fn());
const activeChallengeGetMock = vi.hoisted(() => vi.fn());
const eventSetMock = vi.hoisted(() => vi.fn());
const runTransactionMock = vi.hoisted(() => vi.fn());
const batchSetMock = vi.hoisted(() => vi.fn());
const batchCommitMock = vi.hoisted(() => vi.fn());

const challengeDocMock = vi.hoisted(() =>
  vi.fn(() => ({
    id: "challenge-1",
    set: challengeSetMock,
    get: challengeGetMock,
  }))
);

const eventDocMock = vi.hoisted(() =>
  vi.fn(() => ({
    id: "event-1",
    set: eventSetMock,
  }))
);

const challengeWhereMock = vi.hoisted(() =>
  vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: activeChallengeGetMock,
      })),
    })),
  }))
);

const collectionMock = vi.hoisted(() =>
  vi.fn((collectionName: string) => {
    if (collectionName === "challenges") {
      return {
        doc: challengeDocMock,
        where: challengeWhereMock,
      };
    }

    return {
      doc: eventDocMock,
    };
  })
);

vi.mock("@/lib/server/requestAuth", () => ({
  verifyAdminBearerToken: verifyAdminBearerTokenMock,
}));

vi.mock("@/lib/server/rateLimitServer", () => ({
  checkServerRateLimit: checkServerRateLimitMock,
}));

vi.mock("@/lib/server/auditLog", () => ({
  logAuditEvent: logAuditEventMock,
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: collectionMock,
    runTransaction: runTransactionMock,
    batch: vi.fn(() => ({
      set: batchSetMock,
      commit: batchCommitMock,
    })),
  },
}));

import { PATCH, POST } from "@/app/api/admin/challenges/route";

function createRequest(method: "POST" | "PATCH", body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/challenges", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/challenges", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyAdminBearerTokenMock.mockResolvedValue({
      ok: true,
      uid: "admin-1",
    });

    checkServerRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60_000,
    });

    challengeSetMock.mockResolvedValue(undefined);
    challengeGetMock.mockResolvedValue({
      exists: true,
      data: () => ({ eventId: "event-1" }),
    });
    activeChallengeGetMock.mockResolvedValue({ docs: [] });
    runTransactionMock.mockResolvedValue(undefined);
    batchCommitMock.mockResolvedValue(undefined);
  });

  it("creates a challenge successfully", async () => {
    const response = await POST(
      createRequest("POST", {
        eventId: "event-1",
        title: "Spread now",
        description: "Move to target zones",
        targetSpreadPercentage: 70,
        targetZoneCount: 3,
        durationMinutes: 10,
        rewardType: "Food Credit",
        rewardDescription: "Free snack",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("challenge-1");
    expect(challengeSetMock).toHaveBeenCalled();
    expect(logAuditEventMock).toHaveBeenCalledWith(
      "challenge.created",
      "admin-1",
      expect.objectContaining({ targetId: "challenge-1" })
    );
  });

  it("returns conflict when another challenge is active", async () => {
    activeChallengeGetMock.mockResolvedValue({ docs: [{ id: "challenge-2" }] });

    const response = await PATCH(
      createRequest("PATCH", {
        action: "setLive",
        challengeId: "challenge-1",
        eventId: "event-1",
        durationMinutes: 10,
      })
    );

    expect(response.status).toBe(409);
  });

  it("returns 404 when completing a missing challenge", async () => {
    challengeGetMock.mockResolvedValue({ exists: false });

    const response = await PATCH(
      createRequest("PATCH", {
        action: "complete",
        challengeId: "missing-challenge",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Challenge not found");
  });
});
