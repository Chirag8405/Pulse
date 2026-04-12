import { describe, expect, it } from "vitest";
import { getErrorMessage, getErrorDetails } from "@/lib/shared/errorUtils";

describe("getErrorMessage", () => {
  it("extracts message from Error instances", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("extracts message from TypeError instances", () => {
    expect(getErrorMessage(new TypeError("type error"))).toBe("type error");
  });

  it("returns non-empty strings directly", () => {
    expect(getErrorMessage("string error")).toBe("string error");
  });

  it("returns fallback for empty strings", () => {
    expect(getErrorMessage("")).toBe("An unexpected error occurred.");
  });

  it("returns fallback for null", () => {
    expect(getErrorMessage(null)).toBe("An unexpected error occurred.");
  });

  it("returns fallback for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("An unexpected error occurred.");
  });

  it("returns fallback for numbers", () => {
    expect(getErrorMessage(42)).toBe("An unexpected error occurred.");
  });

  it("returns fallback for objects", () => {
    expect(getErrorMessage({ code: 404 })).toBe("An unexpected error occurred.");
  });

  it("uses custom fallback when provided", () => {
    expect(getErrorMessage(null, "Custom fallback")).toBe("Custom fallback");
  });

  it("uses custom fallback for empty strings", () => {
    expect(getErrorMessage("", "Custom")).toBe("Custom");
  });
});

describe("getErrorDetails", () => {
  it("extracts details from Error instances", () => {
    const error = new Error("detailed error");
    const details = getErrorDetails(error);

    expect(details.message).toBe("detailed error");
    expect(details.name).toBe("Error");
    expect(details.stack).toBeDefined();
  });

  it("extracts details from TypeError instances", () => {
    const error = new TypeError("type issue");
    const details = getErrorDetails(error);

    expect(details.message).toBe("type issue");
    expect(details.name).toBe("TypeError");
  });

  it("handles non-Error values", () => {
    const details = getErrorDetails("string error");

    expect(details.message).toBe("string error");
    expect(details.name).toBe("UnknownError");
    expect(details.stack).toBeUndefined();
  });

  it("handles null values", () => {
    const details = getErrorDetails(null);

    expect(details.message).toBe("null");
    expect(details.name).toBe("UnknownError");
  });

  it("handles object values", () => {
    const details = getErrorDetails({ code: 500 });

    expect(details.message).toBe("[object Object]");
    expect(details.name).toBe("UnknownError");
  });
});
