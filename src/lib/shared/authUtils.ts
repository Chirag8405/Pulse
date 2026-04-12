import type { NextRequest } from "next/server";

/**
 * Extracts a Bearer token from the Authorization header of a NextRequest.
 * Shared across all API routes to avoid duplication.
 */
export function getBearerToken(request: NextRequest): string | null {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

/**
 * Checks whether a value represents an admin-like role.
 * Handles boolean, numeric, and string representations.
 * Shared across client helpers, server auth, and bootstrap route.
 */
export function isAdminLikeValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    return (
      normalizedValue === "true" ||
      normalizedValue === "1" ||
      normalizedValue === "yes" ||
      normalizedValue === "admin" ||
      normalizedValue === "staff"
    );
  }

  return false;
}

/**
 * Extracts an error message from an unknown thrown value.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred."
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
