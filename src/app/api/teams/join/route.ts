import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

interface TeamJoinPayload {
  teamId?: unknown;
}

interface UserJoinDoc {
  teamId?: unknown;
}

function getBearerToken(request: NextRequest): string | null {
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

function parseTeamId(payload: TeamJoinPayload | null): string | null {
  if (!payload || typeof payload.teamId !== "string") {
    return null;
  }

  const normalized = payload.teamId.trim();

  return normalized.length > 0 ? normalized : null;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as TeamJoinPayload | null;
  const teamId = parseTeamId(payload);

  if (!teamId) {
    return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userReference = adminDb.collection("users").doc(uid);
    const teamReference = adminDb.collection("teams").doc(teamId);

    await adminDb.runTransaction(async (transaction) => {
      const [userSnapshot, teamSnapshot] = await Promise.all([
        transaction.get(userReference),
        transaction.get(teamReference),
      ]);

      if (!userSnapshot.exists) {
        throw new Error("User document not found");
      }

      if (!teamSnapshot.exists) {
        throw new Error("Team document not found");
      }

      const userData = userSnapshot.data() as UserJoinDoc;
      const currentTeamId =
        typeof userData?.teamId === "string" ? userData.teamId : null;

      if (currentTeamId && currentTeamId !== teamId) {
        transaction.update(adminDb.collection("teams").doc(currentTeamId), {
          memberIds: FieldValue.arrayRemove(uid),
        });
      }

      transaction.update(teamReference, {
        memberIds: FieldValue.arrayUnion(uid),
      });

      transaction.set(
        userReference,
        {
          teamId,
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true, teamId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join team";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
