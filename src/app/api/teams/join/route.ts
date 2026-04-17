import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { apiLogger } from "@/lib/google/logging";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { logAuditEvent } from "@/lib/server/auditLog";
import { rateLimitHeaders } from "@/lib/server/rateLimit";
import { checkServerRateLimit } from "@/lib/server/rateLimitServer";
import { verifyBearerToken } from "@/lib/server/requestAuth";

interface TeamJoinPayload {
  teamId?: unknown;
}

interface UserJoinDoc {
  teamId?: unknown;
}

const TEAM_JOIN_USER_NOT_FOUND = "TEAM_JOIN_USER_NOT_FOUND";
const TEAM_JOIN_TEAM_NOT_FOUND = "TEAM_JOIN_TEAM_NOT_FOUND";

function parseTeamId(payload: TeamJoinPayload | null): string | null {
  if (!payload || typeof payload.teamId !== "string") {
    return null;
  }

  const normalized = payload.teamId.trim();

  return normalized.length > 0 ? normalized : null;
}

export async function POST(request: NextRequest) {
  const authResult = await verifyBearerToken(request);

  if (!authResult.ok || !authResult.uid) {
    return authResult.response!;
  }

  const payload = (await request.json().catch(() => null)) as TeamJoinPayload | null;
  const teamId = parseTeamId(payload);

  if (!teamId) {
    return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
  }

  try {
    const uid = authResult.uid;

    const rateCheck = await checkServerRateLimit(`team-join:${uid}`, 10, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const userReference = adminDb.collection("users").doc(uid);
    const teamReference = adminDb.collection("teams").doc(teamId);

    await adminDb.runTransaction(async (transaction) => {
      const [userSnapshot, teamSnapshot] = await Promise.all([
        transaction.get(userReference),
        transaction.get(teamReference),
      ]);

      if (!userSnapshot.exists) {
        throw new Error(TEAM_JOIN_USER_NOT_FOUND);
      }

      if (!teamSnapshot.exists) {
        throw new Error(TEAM_JOIN_TEAM_NOT_FOUND);
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

    logAuditEvent("team.joined", uid, { targetId: teamId });
    apiLogger.info("User joined team", { uid, teamId });

    return NextResponse.json({ success: true, teamId });
  } catch (error) {
    if (error instanceof Error && error.message === TEAM_JOIN_USER_NOT_FOUND) {
      return NextResponse.json(
        { error: "User account not found" },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === TEAM_JOIN_TEAM_NOT_FOUND) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return internalApiErrorResponse(
      "Could not join team. Please try again.",
      error,
      "Team join API failed"
    );
  }
}
