import type { NextRequest } from "next/server";

const MAX_BEARER_TOKEN_LENGTH = 8_192;

/**
 * Extracts a Bearer token from the Authorization header of a NextRequest.
 * Shared across all API routes to avoid duplication.
 */
export function getBearerToken(request: NextRequest): string | null {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  if (token.length > MAX_BEARER_TOKEN_LENGTH) {
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
 * Re-export from the centralized error utility for backward compatibility.
 * @see getErrorMessage from @/lib/shared/errorUtils
 */
export { getErrorMessage } from "@/lib/shared/errorUtils";
