import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/requestAuth", () => ({
  verifyBearerToken: vi.fn(async (req: NextRequest) => {
    const auth = req.headers.get("authorization");
    if (!auth) return { ok: false, response: new Response(JSON.stringify({ error: "Missing bearer token" }), { status: 401 }) };
    if (auth === "Bearer valid") return { ok: true, uid: "user-1" };
    return { ok: false, response: new Response(JSON.stringify({ error: "Invalid" }), { status: 401 }) };
  }),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() =>
                Promise.resolve({
                  docs: [
                    {
                      id: "challenge-1",
                      data: () => ({
                        id: "challenge-1",
                        eventId: "event-1",
                        title: "Spread Challenge",
                        description: "Spread out!",
                        targetSpreadPercentage: 70,
                        targetZoneCount: 3,
                        durationMinutes: 10,
                        status: "active",
                        startTime: { toDate: () => new Date("2026-01-01T00:00:00Z") },
                        endTime: { toDate: () => new Date("2026-01-01T00:10:00Z") },
                        reward: { type: "Food Credit", description: "Free snacks", unlockedAt: null },
                        participatingTeamIds: ["team-1"],
                      }),
                    },
                  ],
                })
              ),
            })),
          })),
        })),
      })),
    })),
  },
}));

import { GET } from "@/app/api/challenges/active/route";

function createRequest(eventId?: string, token = "valid"): NextRequest {
  const url = new URL("http://localhost:3000/api/challenges/active");
  if (eventId) url.searchParams.set("eventId", eventId);

  return new NextRequest(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("GET /api/challenges/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost:3000/api/challenges/active?eventId=e1");
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it("returns 400 without eventId", async () => {
    const response = await GET(createRequest());
    expect(response.status).toBe(400);
  });

  it("returns challenge data successfully", async () => {
    const response = await GET(createRequest("event-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.challenge).toBeDefined();
    expect(body.challenge.title).toBe("Spread Challenge");
  });
});
