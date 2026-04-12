import { describe, expect, it } from "vitest";
import {
  getBearerToken,
  getErrorMessage,
  isAdminLikeValue,
} from "@/lib/shared/authUtils";

function createRequest(authorization?: string) {
  return {
    headers: new Headers(
      authorization ? { authorization } : undefined
    ),
  } as import("next/server").NextRequest;
}

describe("getBearerToken", () => {
  it("extracts token from valid Bearer header", () => {
    expect(getBearerToken(createRequest("Bearer abc.def"))).toBe("abc.def");
  });

  it("is case-insensitive for scheme", () => {
    expect(getBearerToken(createRequest("bearer abc"))).toBe("abc");
    expect(getBearerToken(createRequest("BEARER abc"))).toBe("abc");
  });

  it("returns null when no header present", () => {
    expect(getBearerToken(createRequest())).toBeNull();
  });

  it("returns null for non-Bearer schemes", () => {
    expect(getBearerToken(createRequest("Basic abc"))).toBeNull();
    expect(getBearerToken(createRequest("Token abc"))).toBeNull();
  });

  it("returns null when token part is missing", () => {
    expect(getBearerToken(createRequest("Bearer"))).toBeNull();
    expect(getBearerToken(createRequest("Bearer "))).toBeNull();
  });
});

describe("isAdminLikeValue", () => {
  it("returns true for boolean true", () => {
    expect(isAdminLikeValue(true)).toBe(true);
  });

  it("returns false for boolean false", () => {
    expect(isAdminLikeValue(false)).toBe(false);
  });

  it("returns true for number 1", () => {
    expect(isAdminLikeValue(1)).toBe(true);
  });

  it("returns false for number 0", () => {
    expect(isAdminLikeValue(0)).toBe(false);
  });

  it("returns false for other numbers", () => {
    expect(isAdminLikeValue(2)).toBe(false);
    expect(isAdminLikeValue(-1)).toBe(false);
  });

  it.each(["true", "1", "yes", "admin", "staff"])(
    'returns true for string "%s"',
    (value) => {
      expect(isAdminLikeValue(value)).toBe(true);
    }
  );

  it.each(["TRUE", "Admin", "STAFF", " Yes "])(
    'handles case-insensitive and whitespace for "%s"',
    (value) => {
      expect(isAdminLikeValue(value)).toBe(true);
    }
  );

  it.each(["false", "0", "no", "attendee", "viewer"])(
    'returns false for string "%s"',
    (value) => {
      expect(isAdminLikeValue(value)).toBe(false);
    }
  );

  it("returns false for null, undefined, objects", () => {
    expect(isAdminLikeValue(null)).toBe(false);
    expect(isAdminLikeValue(undefined)).toBe(false);
    expect(isAdminLikeValue({})).toBe(false);
    expect(isAdminLikeValue([])).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error instances", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("returns fallback for non-Error values", () => {
    expect(getErrorMessage("string")).toBe("An unexpected error occurred.");
    expect(getErrorMessage(42)).toBe("An unexpected error occurred.");
    expect(getErrorMessage(null)).toBe("An unexpected error occurred.");
  });

  it("uses custom fallback when provided", () => {
    expect(getErrorMessage("oops", "custom fallback")).toBe("custom fallback");
  });
});
