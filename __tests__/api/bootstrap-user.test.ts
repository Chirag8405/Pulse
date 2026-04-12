import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdTokenMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const setMock = vi.hoisted(() => vi.fn());
const docMock = vi.hoisted(() => vi.fn(() => ({ get: getMock, set: setMock })));
const collectionMock = vi.hoisted(() =>
  vi.fn(() => ({
    doc: docMock,
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({ empty: false, docs: [] })),
      })),
    })),
  }))
);

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { verifyIdToken: verifyIdTokenMock },
  adminDb: {
    collection: collectionMock,
  },
}));

import { POST } from "@/app/api/auth/bootstrap-user/route";

function createRequest(token?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/bootstrap-user", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("POST /api/auth/bootstrap-user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no bearer token provided", async () => {
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Missing bearer token");
  });

  it("returns 401 when token verification fails", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const response = await POST(createRequest("bad-token"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("invalid token");
  });

  it("returns isAdmin and teamId for existing user", async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: "user-1",
      email: "test@example.com",
      name: "Test",
      picture: null,
    });

    getMock.mockResolvedValue({
      exists: true,
      data: () => ({
        isAdmin: true,
        teamId: "team-a",
      }),
    });

    setMock.mockResolvedValue(undefined);

    const response = await POST(createRequest("valid-token"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isAdmin).toBe(true);
    expect(body.teamId).toBe("team-a");
  });

  it("creates new user when document does not exist", async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: "new-user",
      email: "new@example.com",
      name: "New User",
      picture: null,
    });

    getMock.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    setMock.mockResolvedValue(undefined);

    const response = await POST(createRequest("valid-token"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("isAdmin");
    expect(body).toHaveProperty("teamId");
  });
});
