import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getBearerToken } from "@/lib/shared/authUtils";

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
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isFirebaseUserNotFoundError(error)) {
      return NextResponse.json({ success: true });
    }

    const message = error instanceof Error ? error.message : "Failed to delete account";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
