import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import {
  getBearerToken,
  isAdminLikeValue,
} from "@/lib/shared/authUtils";

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

export { getBearerToken } from "@/lib/shared/authUtils";

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

export async function verifyAdminBearerToken(
  request: NextRequest
): Promise<VerifyRequestResult> {
  const authResult = await verifyBearerToken(request);

  if (!authResult.ok || !authResult.uid) {
    return authResult;
  }

  const isAdmin = await readIsAdmin(authResult.uid);

  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return authResult;
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