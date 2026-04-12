import { describe, expect, it, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit, rateLimitHeaders } from "@/lib/server/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimit("test-key");
    resetRateLimit("test-key-2");
  });

  it("allows the first request", () => {
    const result = checkRateLimit("test-key", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining count with each request", () => {
    checkRateLimit("test-key", 5, 60_000);
    const result = checkRateLimit("test-key", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("blocks requests exceeding the limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-key", 5, 60_000);
    }

    const result = checkRateLimit("test-key", 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-key", 5, 60_000);
    }

    const blockedResult = checkRateLimit("test-key", 5, 60_000);
    const allowedResult = checkRateLimit("test-key-2", 5, 60_000);

    expect(blockedResult.allowed).toBe(false);
    expect(allowedResult.allowed).toBe(true);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();

    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-key", 5, 1_000);
    }

    const blocked = checkRateLimit("test-key", 5, 1_000);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1_100);

    const allowed = checkRateLimit("test-key", 5, 1_000);
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(4);

    vi.useRealTimers();
  });

  it("provides a resetAt timestamp", () => {
    const result = checkRateLimit("test-key", 5, 60_000);

    expect(result.resetAt).toBeGreaterThan(Date.now());
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 60_000 + 100);
  });
});

describe("resetRateLimit", () => {
  it("clears the rate limit for a key", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-key", 5, 60_000);
    }

    const blocked = checkRateLimit("test-key", 5, 60_000);
    expect(blocked.allowed).toBe(false);

    resetRateLimit("test-key");

    const allowed = checkRateLimit("test-key", 5, 60_000);
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(4);
  });
});

describe("rateLimitHeaders", () => {
  it("returns expected header keys", () => {
    const result = checkRateLimit("test-key", 5, 60_000);
    const headers = rateLimitHeaders(result);

    expect(headers["X-RateLimit-Remaining"]).toBe(String(result.remaining));
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
  });

  it("returns '0' remaining when blocked", () => {
    for (let i = 0; i < 6; i++) {
      checkRateLimit("test-key", 5, 60_000);
    }

    const result = checkRateLimit("test-key", 5, 60_000);
    const headers = rateLimitHeaders(result);

    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });
});
