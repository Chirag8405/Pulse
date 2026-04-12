import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBearerTokenMock = vi.hoisted(() => vi.fn());
const readIsAdminMock = vi.hoisted(() => vi.fn());
const collectionMock = vi.hoisted(() => vi.fn());
const collectionGroupMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/requestAuth", () => ({
  verifyBearerToken: verifyBearerTokenMock,
  readIsAdmin: readIsAdminMock,
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
});
