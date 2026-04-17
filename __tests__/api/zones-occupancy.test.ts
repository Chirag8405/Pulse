import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBearerTokenMock = vi.hoisted(() => vi.fn());
const readIsAdminMock = vi.hoisted(() => vi.fn());
const readEventMemberLocationsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/requestAuth", () => ({
  verifyBearerToken: verifyBearerTokenMock,
  readIsAdmin: readIsAdminMock,
}));

vi.mock("@/lib/server/zoneOccupancy", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/zoneOccupancy")>(
    "@/lib/server/zoneOccupancy"
  );

  return {
    ...actual,
    readEventMemberLocations: readEventMemberLocationsMock,
  };
});

import { GET } from "@/app/api/zones/occupancy/route";

function createRequest(eventId?: string): NextRequest {
  const url = new URL("http://localhost:3000/api/zones/occupancy");

  if (eventId) {
    url.searchParams.set("eventId", eventId);
  }

  return new NextRequest(url, {
    headers: {
      authorization: "Bearer token",
    },
  });
}

describe("GET /api/zones/occupancy", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyBearerTokenMock.mockResolvedValue({ ok: true, uid: "admin-1" });
    readIsAdminMock.mockResolvedValue(true);
  });

  it("returns auth response when bearer verification fails", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const response = await GET(createRequest("event-1"));

    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    readIsAdminMock.mockResolvedValue(false);

    const response = await GET(createRequest("event-1"));

    expect(response.status).toBe(403);
  });

  it("returns 400 when eventId is missing", async () => {
    const response = await GET(createRequest());

    expect(response.status).toBe(400);
  });

  it("returns occupancy zones with trend and percentages", async () => {
    const now = Date.now();

    readEventMemberLocationsMock.mockResolvedValue([
      {
        userId: "u1",
        teamId: "t1",
        zoneId: "zone-east",
        timestampMillis: now - 2 * 60 * 1000,
      },
      {
        userId: "u2",
        teamId: "t1",
        zoneId: "zone-east",
        timestampMillis: now - 7 * 60 * 1000,
      },
      {
        userId: "u3",
        teamId: "t2",
        zoneId: "zone-west",
        timestampMillis: now - 1 * 60 * 1000,
      },
    ]);

    const response = await GET(createRequest("event-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.zones["zone-east"].count).toBe(1);
    expect(body.zones["zone-east"].trend).toBe("steady");
    expect(body.zones["zone-west"].count).toBe(1);
    expect(body.zones["zone-west"].trend).toBe("up");
    expect(body.zones["zone-east"].percentage).toBe(50);
    expect(typeof body.generatedAt).toBe("string");
  });
});
