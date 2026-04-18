import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdTokenMock = vi.hoisted(() => vi.fn());
const createSessionCookieMock = vi.hoisted(() => vi.fn());
const checkServerRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: verifyIdTokenMock,
    createSessionCookie: createSessionCookieMock,
  },
}));

vi.mock("@/lib/server/rateLimitServer", () => ({
  checkServerRateLimit: checkServerRateLimitMock,
}));

import { DELETE, POST } from "@/app/api/auth/session/route";

function createRequest(method: "POST" | "DELETE", token?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/session", {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("/api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
    createSessionCookieMock.mockResolvedValue("header.payload.signature");
    checkServerRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 99,
      resetAt: Date.now() + 60_000,
    });
  });

  it("POST returns 401 when bearer token is missing", async () => {
    const response = await POST(createRequest("POST"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Missing bearer token");
  });

  it("POST returns 401 for invalid bearer token", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("bad-token"));

    const response = await POST(createRequest("POST", "bad-token"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid bearer token");
  });

  it("POST returns 429 when session creation is rate-limited", async () => {
    checkServerRateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const response = await POST(createRequest("POST", "token-1"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many requests");
  });

  it("POST sets an HttpOnly session cookie on success", async () => {
    const response = await POST(createRequest("POST", "token-1"));

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain("__session=header.payload.signature");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("DELETE clears session cookie even with invalid token", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("bad-token"));

    const response = await DELETE(createRequest("DELETE", "bad-token"));

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain("__session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
