import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { apiLogger } from "@/lib/google/logging";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { logAuditEvent } from "@/lib/server/auditLog";
import { rateLimitHeaders } from "@/lib/server/rateLimit";
import { checkServerRateLimit } from "@/lib/server/rateLimitServer";
import { verifyBearerToken } from "@/lib/server/requestAuth";

interface UserDeleteDoc {
  teamId?: unknown;
}

function isFirebaseUserNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.trim().toLowerCase();

  return (
    normalizedMessage.includes("user") &&
    normalizedMessage.includes("not") &&
    normalizedMessage.includes("found")
  );
}

export async function DELETE(request: NextRequest) {
  const authResult = await verifyBearerToken(request);

  if (!authResult.ok || !authResult.uid) {
    return authResult.response!;
  }

  try {
    const uid = authResult.uid;

    const rateCheck = await checkServerRateLimit(`delete:${uid}`, 3, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const userReference = adminDb.collection("users").doc(uid);
    const userSnapshot = await userReference.get();
    const userData = userSnapshot.exists ? (userSnapshot.data() as UserDeleteDoc) : null;
    const teamId =
      typeof userData?.teamId === "string" && userData.teamId.trim().length > 0
        ? userData.teamId
        : null;

    const batch = adminDb.batch();
    batch.delete(userReference);

    if (teamId) {
      const teamReference = adminDb.collection("teams").doc(teamId);
      const teamSnapshot = await teamReference.get();

      if (teamSnapshot.exists) {
        batch.update(teamReference, {
          memberIds: FieldValue.arrayRemove(uid),
        });
      }

      const memberLocationReference = teamReference.collection("memberLocations").doc(uid);
      batch.delete(memberLocationReference);
    }

    await batch.commit();
    await adminAuth.deleteUser(uid);

    logAuditEvent("user.deleted", uid);
    apiLogger.info("Account deleted", { uid });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isFirebaseUserNotFoundError(error)) {
      return NextResponse.json({ success: true });
    }

    return internalApiErrorResponse(
      "Failed to delete account",
      error,
      "Delete account API failed"
    );
  }
}
