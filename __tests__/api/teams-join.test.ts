import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdTokenMock = vi.hoisted(() => vi.fn());
const runTransactionMock = vi.hoisted(() => vi.fn());

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: vi.fn((v: string) => ({ __arrayUnion: v })),
    arrayRemove: vi.fn((v: string) => ({ __arrayRemove: v })),
  },
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { verifyIdToken: verifyIdTokenMock },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ id: "doc-ref" })),
    })),
    runTransaction: runTransactionMock,
  },
}));

import { POST } from "@/app/api/teams/join/route";

function createRequest(body: unknown, token?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/teams/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/teams/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth token", async () => {
    const response = await POST(createRequest({ teamId: "team-1" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for missing teamId", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });

    const response = await POST(createRequest({}, "valid-token"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid teamId");
  });

  it("returns 400 for empty teamId", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });

    const response = await POST(createRequest({ teamId: "  " }, "valid-token"));
    expect(response.status).toBe(400);
  });

  it("returns success when transaction completes", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
    runTransactionMock.mockResolvedValue(undefined);

    const response = await POST(createRequest({ teamId: "team-1" }, "valid-token"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.teamId).toBe("team-1");
  });

  it("returns 400 when transaction fails", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
    runTransactionMock.mockRejectedValue(new Error("Team document not found"));

    const response = await POST(createRequest({ teamId: "bad-team" }, "valid-token"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Team document not found");
  });
});
