import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBearerTokenMock = vi.hoisted(() => vi.fn());
const readIsAdminMock = vi.hoisted(() => vi.fn());
const checkServerRateLimitMock = vi.hoisted(() => vi.fn());
const resolveActiveEventIdMock = vi.hoisted(() => vi.fn());
const readEventZoneOccupancySummaryMock = vi.hoisted(() => vi.fn());
const refreshEventZoneOccupancySummaryMock = vi.hoisted(() => vi.fn());
const buildEmptyZoneCountsMock = vi.hoisted(() => vi.fn(() => ({ "zone-east": 0 })));
const collectionMock = vi.hoisted(() => vi.fn());
const collectionGroupMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/requestAuth", () => ({
  verifyBearerToken: verifyBearerTokenMock,
  readIsAdmin: readIsAdminMock,
}));

vi.mock("@/lib/server/rateLimitServer", () => ({
  checkServerRateLimit: checkServerRateLimitMock,
}));

vi.mock("@/lib/server/zoneOccupancy", () => ({
  resolveActiveEventId: resolveActiveEventIdMock,
  readEventZoneOccupancySummary: readEventZoneOccupancySummaryMock,
  refreshEventZoneOccupancySummary: refreshEventZoneOccupancySummaryMock,
  buildEmptyZoneCounts: buildEmptyZoneCountsMock,
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: collectionMock,
    collectionGroup: collectionGroupMock,
  },
}));

import { GET } from "@/app/api/realtime/route";

function createRequest(params: Record<string, string>, hasAuth = true): NextRequest {
  const url = new URL("http://localhost:3000/api/realtime");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  return new NextRequest(url, {
    method: "GET",
    headers: hasAuth ? { authorization: "Bearer valid" } : {},
  });
}

describe("GET /api/realtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyBearerTokenMock.mockResolvedValue({ ok: true, uid: "user-1" });
    readIsAdminMock.mockResolvedValue(true);
    checkServerRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 100,
      resetAt: Date.now() + 60_000,
    });
    resolveActiveEventIdMock.mockResolvedValue(null);
    readEventZoneOccupancySummaryMock.mockResolvedValue(null);
    refreshEventZoneOccupancySummaryMock.mockResolvedValue({
      byZone: { "zone-east": 1 },
      totalActiveMembers: 1,
      updatedAtMillis: Date.now(),
    });

    const mockSnapshot = {
      docs: [
        {
          id: "event-1",
          data: () => ({
            title: "Match",
            venueName: "Wankhede",
            venueCity: "Mumbai",
            homeTeam: "MI",
            awayTeam: "CSK",
            startTime: { toMillis: () => 1700000000000 },
            status: "live",
            currentChallengeId: null,
            matchDay: "2026-01-01",
          }),
        },
      ],
    };

    collectionMock.mockReturnValue({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve(mockSnapshot)),
        })),
      })),
      where: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({ docs: [] })),
      })),
      doc: vi.fn(() => ({
        collection: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ docs: [] })),
        })),
      })),
    });

    collectionGroupMock.mockReturnValue({
      where: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({ docs: [] })),
      })),
    });
  });

  it("returns 401 when no auth header", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const req = createRequest({ resource: "events" }, false);
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid resource param", async () => {
    const response = await GET(createRequest({ resource: "invalid" }));
    expect(response.status).toBe(400);
  });

  it("returns events data successfully", async () => {
    const response = await GET(createRequest({ resource: "events" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 400 for teamsByEvent without eventId", async () => {
    const response = await GET(createRequest({ resource: "teamsByEvent" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for challengeTeamProgress without challengeId", async () => {
    const response = await GET(createRequest({ resource: "challengeTeamProgress" }));
    expect(response.status).toBe(400);
  });

  it("returns zone occupancy using helper when requested", async () => {
    resolveActiveEventIdMock.mockResolvedValue("event-1");
    readEventZoneOccupancySummaryMock.mockResolvedValue({
      byZone: { "zone-east": 2, "zone-west": 1 },
      totalActiveMembers: 3,
      updatedAtMillis: Date.now(),
    });

    const response = await GET(createRequest({ resource: "zoneOccupancy" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.totalActiveMembers).toBe(3);
    expect(body.data.byZone["zone-east"]).toBe(2);
  });
});
