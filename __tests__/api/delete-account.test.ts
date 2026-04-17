import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdTokenMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const commitMock = vi.hoisted(() => vi.fn());
const deleteUserMock = vi.hoisted(() => vi.fn());

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayRemove: vi.fn((v: string) => ({ __arrayRemove: v })),
  },
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: verifyIdTokenMock,
    deleteUser: deleteUserMock,
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: getMock,
        collection: vi.fn(() => ({
          doc: vi.fn(() => "member-loc-ref"),
        })),
      })),
    })),
    batch: vi.fn(() => ({
      delete: deleteMock,
      update: updateMock,
      commit: commitMock,
    })),
  },
}));

import { DELETE } from "@/app/api/auth/delete-account/route";

function createRequest(token?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/delete-account", {
    method: "DELETE",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("DELETE /api/auth/delete-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no bearer token", async () => {
    const response = await DELETE(createRequest());
    expect(response.status).toBe(401);
  });

  it("returns 401 for invalid token", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("invalid"));

    const response = await DELETE(createRequest("bad-token"));
    expect(response.status).toBe(401);
  });

  it("returns success when user has no team", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ teamId: null }),
    });
    commitMock.mockResolvedValue(undefined);
    deleteUserMock.mockResolvedValue(undefined);

    const response = await DELETE(createRequest("valid-token"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("handles firebase user-not-found gracefully", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "user-gone" });
    getMock.mockResolvedValue({
      exists: false,
      data: () => null,
    });
    commitMock.mockResolvedValue(undefined);
    deleteUserMock.mockRejectedValue(
      new Error("There is no user record corresponding to the provided identifier. User not found.")
    );

    const response = await DELETE(createRequest("valid-token"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
