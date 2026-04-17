import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { verifyBearerToken } from "@/lib/server/requestAuth";

const QuerySchema = z.object({
  eventId: z.string().trim().min(1),
});

function toIsoOrNull(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return null;
}

function sanitizeChallenge(challenge: Record<string, unknown>) {
  return {
    id: String(challenge.id ?? ""),
    eventId: String(challenge.eventId ?? ""),
    title: String(challenge.title ?? ""),
    description: String(challenge.description ?? ""),
    targetSpreadPercentage: Number(challenge.targetSpreadPercentage ?? 0),
    targetZoneCount: Number(challenge.targetZoneCount ?? 0),
    durationMinutes: Number(challenge.durationMinutes ?? 0),
    status: String(challenge.status ?? "pending"),
    startTime: toIsoOrNull(challenge.startTime),
    endTime: toIsoOrNull(challenge.endTime),
    reward: {
      type: String((challenge.reward as { type?: unknown } | undefined)?.type ?? ""),
      description: String(
        (challenge.reward as { description?: unknown } | undefined)?.description ?? ""
      ),
      unlockedAt: toIsoOrNull(
        (challenge.reward as { unlockedAt?: unknown } | undefined)?.unlockedAt
      ),
    },
    participatingTeamIds: Array.isArray(challenge.participatingTeamIds)
      ? challenge.participatingTeamIds.map((teamId) => String(teamId))
      : [],
  };
}

export async function GET(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.ok) {
    return authResult.response!;
  }

  const parsed = QuerySchema.safeParse({
    eventId: request.nextUrl.searchParams.get("eventId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "eventId query param is required" },
      { status: 400 }
    );
  }

  const { eventId } = parsed.data;

  try {
    const activeChallengeSnapshot = await adminDb
      .collection("challenges")
      .where("eventId", "==", eventId)
      .where("status", "==", "active")
      .orderBy("startTime", "desc")
      .limit(1)
      .get();

    const challengeDocSnapshot = activeChallengeSnapshot.docs[0];

    const challenge = challengeDocSnapshot
      ? sanitizeChallenge(challengeDocSnapshot.data() as Record<string, unknown>)
      : null;

    return NextResponse.json(
      { challenge },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return internalApiErrorResponse(
      "Failed to fetch active challenge",
      error,
      "Challenges active API failed"
    );
  }
}
