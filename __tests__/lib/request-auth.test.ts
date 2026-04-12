import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyIdTokenMock,
  getMock,
  docMock,
  collectionMock,
} = vi.hoisted(() => {
  const verifyIdTokenMock = vi.fn();
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));

  return {
    verifyIdTokenMock,
    getMock,
    docMock,
    collectionMock,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: verifyIdTokenMock,
  },
  adminDb: {
    collection: collectionMock,
  },
}));

import {
  getBearerToken,
  readIsAdmin,
  verifyBearerToken,
} from "@/lib/server/requestAuth";

function createRequest(authorization?: string): NextRequest {
  return {
    headers: new Headers(
      authorization ? { authorization } : undefined
    ),
  } as NextRequest;
}

describe("requestAuth", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    getMock.mockReset();
    docMock.mockClear();
    collectionMock.mockClear();
  });

  it("extracts bearer token from valid authorization header", () => {
    const token = getBearerToken(createRequest("Bearer abc.def.ghi"));
    expect(token).toBe("abc.def.ghi");
  });

  it("extracts token for lowercase bearer scheme", () => {
    const token = getBearerToken(createRequest("bearer token-lowercase"));
    expect(token).toBe("token-lowercase");
  });

  it("returns null for invalid authorization header format", () => {
    expect(getBearerToken(createRequest("Token abc"))).toBeNull();
    expect(getBearerToken(createRequest())).toBeNull();
  });

  it("verifyBearerToken returns 401 when token is missing", async () => {
    const result = await verifyBearerToken(createRequest());

    expect(result.ok).toBe(false);
    expect(result.response?.status).toBe(401);
    expect(await result.response?.json()).toEqual({
      error: "Missing bearer token",
    });
  });

  it("verifyBearerToken returns uid for a valid token", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "user-123" });

    const result = await verifyBearerToken(createRequest("Bearer token-123"));

    expect(verifyIdTokenMock).toHaveBeenCalledWith("token-123");
    expect(result).toEqual({ ok: true, uid: "user-123" });
  });

  it("verifyBearerToken returns 401 for invalid token", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("invalid"));

    const result = await verifyBearerToken(createRequest("Bearer bad-token"));

    expect(result.ok).toBe(false);
    expect(result.response?.status).toBe(401);
    expect(await result.response?.json()).toEqual({
      error: "Invalid bearer token",
    });
  });

  it("readIsAdmin returns true for admin-like values", async () => {
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ role: "admin" }),
    });

    const isAdmin = await readIsAdmin("uid-1");

    expect(collectionMock).toHaveBeenCalledWith("users");
    expect(docMock).toHaveBeenCalledWith("uid-1");
    expect(isAdmin).toBe(true);
  });

  it("readIsAdmin supports numeric admin-like values", async () => {
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ is_admin: 1 }),
    });

    const isAdmin = await readIsAdmin("uid-1b");

    expect(isAdmin).toBe(true);
  });

  it("readIsAdmin returns false when user does not exist", async () => {
    getMock.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    const isAdmin = await readIsAdmin("uid-2");

    expect(isAdmin).toBe(false);
  });

  it("readIsAdmin returns false for non-admin values", async () => {
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ role: "attendee" }),
    });

    const isAdmin = await readIsAdmin("uid-2b");

    expect(isAdmin).toBe(false);
  });

  it("readIsAdmin returns false when firestore read fails", async () => {
    getMock.mockRejectedValue(new Error("firestore-down"));

    const isAdmin = await readIsAdmin("uid-3");

    expect(isAdmin).toBe(false);
  });
});
