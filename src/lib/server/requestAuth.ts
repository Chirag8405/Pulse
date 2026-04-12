import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

interface VerifyRequestResult {
  ok: boolean;
  uid?: string;
  response?: NextResponse;
}

interface AdminRoleLikeFields {
  isAdmin?: unknown;
  role?: unknown;
  admin?: unknown;
  is_admin?: unknown;
  "is admin"?: unknown;
}

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

export async function verifyBearerToken(
  request: NextRequest
): Promise<VerifyRequestResult> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing bearer token" },
        { status: 401 }
      ),
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);

    return {
      ok: true,
      uid: decodedToken.uid,
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid bearer token" },
        { status: 401 }
      ),
    };
  }
}

function isAdminLikeValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    return (
      normalizedValue === "admin" ||
      normalizedValue === "staff" ||
      normalizedValue === "true" ||
      normalizedValue === "1" ||
      normalizedValue === "yes"
    );
  }

  return false;
}

export async function readIsAdmin(uid: string): Promise<boolean> {
  try {
    const userSnapshot = await adminDb.collection("users").doc(uid).get();

    if (!userSnapshot.exists) {
      return false;
    }

    const userData = userSnapshot.data() as AdminRoleLikeFields;

    return (
      isAdminLikeValue(userData.isAdmin) ||
      isAdminLikeValue(userData.role) ||
      isAdminLikeValue(userData.admin) ||
      isAdminLikeValue(userData.is_admin) ||
      isAdminLikeValue(userData["is admin"])
    );
  } catch {
    return false;
  }
}