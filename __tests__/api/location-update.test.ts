import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBearerTokenMock = vi.hoisted(() => vi.fn());
const checkServerRateLimitMock = vi.hoisted(() => vi.fn());
const userGetMock = vi.hoisted(() => vi.fn());
const teamGetMock = vi.hoisted(() => vi.fn());
const runTransactionMock = vi.hoisted(() => vi.fn());
const transactionGetMock = vi.hoisted(() => vi.fn());
const transactionSetMock = vi.hoisted(() => vi.fn());

const collectionMock = vi.hoisted(() =>
  vi.fn((collectionName: string) => {
    if (collectionName === "users") {
      return {
        doc: vi.fn(() => ({
          get: userGetMock,
        })),
      };
    }

    if (collectionName === "teams") {
      return {
        doc: vi.fn(() => ({
          get: teamGetMock,
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({})),
          })),
        })),
      };
    }

    if (collectionName === "events") {
      return {
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({})),
          })),
        })),
      };
    }

    return {
      doc: vi.fn(() => ({})),
    };
  })
);

vi.mock("@/lib/server/requestAuth", () => ({
  verifyBearerToken: verifyBearerTokenMock,
}));

vi.mock("@/lib/server/rateLimitServer", () => ({
  checkServerRateLimit: checkServerRateLimitMock,
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: collectionMock,
    runTransaction: runTransactionMock,
  },
}));

import { POST } from "@/app/api/location/update/route";

function createRequest(zoneId: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/location/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer token",
    },
    body: JSON.stringify({ zoneId }),
  });
}

describe("POST /api/location/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyBearerTokenMock.mockResolvedValue({ ok: true, uid: "user-1" });
    checkServerRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60_000,
    });

    userGetMock.mockResolvedValue({
      exists: true,
      data: () => ({ teamId: "team-1" }),
    });

    teamGetMock.mockResolvedValue({
      exists: true,
      data: () => ({ eventId: "event-1" }),
    });

    transactionGetMock
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ byZone: { "zone-east": 3 }, totalActiveMembers: 3 }),
      });

    runTransactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      await callback({
        get: transactionGetMock,
        set: transactionSetMock,
      });
    });
  });

  it("returns auth response when token verification fails", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const response = await POST(createRequest("zone-east"));
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(createRequest("bad-zone"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid location payload");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    checkServerRateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const response = await POST(createRequest("zone-east"));

    expect(response.status).toBe(429);
  });

  it("returns 404 when user does not exist", async () => {
    userGetMock.mockResolvedValue({ exists: false });

    const response = await POST(createRequest("zone-east"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("User account not found");
  });

  it("returns 400 when user has no team", async () => {
    userGetMock.mockResolvedValue({
      exists: true,
      data: () => ({ teamId: null }),
    });

    const response = await POST(createRequest("zone-east"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("No team assigned for user");
  });

  it("returns 404 when team does not exist", async () => {
    teamGetMock.mockResolvedValue({ exists: false });

    const response = await POST(createRequest("zone-east"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Team not found");
  });

  it("returns 400 when team has no event", async () => {
    teamGetMock.mockResolvedValue({
      exists: true,
      data: () => ({ eventId: null }),
    });

    const response = await POST(createRequest("zone-east"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Team is not attached to an active event");
  });

  it("updates location successfully", async () => {
    const response = await POST(createRequest("zone-east"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.zoneId).toBe("zone-east");
    expect(runTransactionMock).toHaveBeenCalledTimes(1);
    expect(transactionSetMock).toHaveBeenCalled();

    const occupancyWriteCall = transactionSetMock.mock.calls.find(
      (call) =>
        Boolean(call[1]) &&
        typeof call[1] === "object" &&
        "source" in (call[1] as Record<string, unknown>)
    );

    const occupancyPayload = occupancyWriteCall?.[1] as
      | {
          byZone?: Record<string, number>;
          totalActiveMembers?: number;
          source?: string;
        }
      | undefined;

    expect(occupancyPayload?.source).toBe("location_update_api");
    expect(occupancyPayload?.byZone?.["zone-east"]).toBe(4);
    expect(occupancyPayload?.totalActiveMembers).toBe(4);
  });
});
