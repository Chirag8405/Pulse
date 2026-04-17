import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAdminBearerTokenMock = vi.hoisted(() => vi.fn());
const checkServerRateLimitMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const eventSetMock = vi.hoisted(() => vi.fn());
const eventGetMock = vi.hoisted(() => vi.fn());
const whereGetMock = vi.hoisted(() => vi.fn());
const docMock = vi.hoisted(() =>
  vi.fn(() => ({
    id: "event-1",
    set: eventSetMock,
    get: eventGetMock,
  }))
);
const whereMock = vi.hoisted(() =>
  vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: whereGetMock,
      })),
    })),
    limit: vi.fn(() => ({
      get: whereGetMock,
    })),
  }))
);
const collectionMock = vi.hoisted(() =>
  vi.fn(() => ({
    doc: docMock,
    where: whereMock,
  }))
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
  },
}));

import { PATCH, POST } from "@/app/api/admin/events/route";

function createRequest(method: "POST" | "PATCH", body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/events", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/events", () => {
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

    whereGetMock.mockResolvedValue({ docs: [] });
    eventGetMock.mockResolvedValue({ exists: true });
    eventSetMock.mockResolvedValue(undefined);
  });

  it("returns auth response when admin verification fails", async () => {
    verifyAdminBearerTokenMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
      }),
    });

    const response = await POST(
      createRequest("POST", {
        homeTeam: "A",
        awayTeam: "B",
        startTimeIso: new Date().toISOString(),
        matchDay: "Demo",
      })
    );

    expect(response.status).toBe(403);
  });

  it("creates an event successfully", async () => {
    const response = await POST(
      createRequest("POST", {
        homeTeam: "Mumbai",
        awayTeam: "Chennai",
        startTimeIso: "2026-04-20T12:00:00.000Z",
        matchDay: "Matchday 1",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("event-1");
    expect(eventSetMock).toHaveBeenCalled();
    expect(logAuditEventMock).toHaveBeenCalledWith(
      "admin.action",
      "admin-1",
      expect.objectContaining({ targetId: "event-1" })
    );
  });

  it("blocks go-live when another event is active", async () => {
    whereGetMock
      .mockResolvedValueOnce({ docs: [{ id: "event-2" }] })
      .mockResolvedValueOnce({ docs: [] });

    const response = await PATCH(
      createRequest("PATCH", {
        eventId: "event-1",
        status: "live",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("Another event is already live");
  });

  it("updates event status successfully", async () => {
    const response = await PATCH(
      createRequest("PATCH", {
        eventId: "event-1",
        status: "completed",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(eventSetMock).toHaveBeenCalled();
    expect(logAuditEventMock).toHaveBeenCalledWith(
      "event.status_changed",
      "admin-1",
      expect.objectContaining({ targetId: "event-1" })
    );
  });
});
