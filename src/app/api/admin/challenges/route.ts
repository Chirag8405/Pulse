import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { logAuditEvent } from "@/lib/server/auditLog";
import { rateLimitHeaders } from "@/lib/server/rateLimit";
import { checkServerRateLimit } from "@/lib/server/rateLimitServer";
import { verifyAdminBearerToken } from "@/lib/server/requestAuth";
import { AdminChallengeSchema } from "@/lib/schemas";

const CHALLENGE_NOT_FOUND = "CHALLENGE_NOT_FOUND";

const CreateChallengeSchema = AdminChallengeSchema.extend({
  eventId: z.string().trim().min(1),
});

const SetLivePayloadSchema = z.object({
  action: z.literal("setLive"),
  challengeId: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  durationMinutes: z.number().int().min(1).max(60),
});

const CompletePayloadSchema = z.object({
  action: z.literal("complete"),
  challengeId: z.string().trim().min(1),
});

const ChallengeMutationSchema = z.discriminatedUnion("action", [
  SetLivePayloadSchema,
  CompletePayloadSchema,
]);

async function readJsonBody(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminBearerToken(request);

  if (!authResult.ok || !authResult.uid) {
    return authResult.response!;
  }

  const rateCheck = await checkServerRateLimit(
    `admin-challenges:create:${authResult.uid}`,
    30,
    60_000
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateCheck) }
    );
  }

  const parsed = CreateChallengeSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid challenge payload" },
      { status: 400 }
    );
  }

  try {
    const challengeRef = adminDb.collection("challenges").doc();

    await challengeRef.set({
      id: challengeRef.id,
      eventId: parsed.data.eventId,
      title: parsed.data.title,
      description: parsed.data.description,
      targetSpreadPercentage: parsed.data.targetSpreadPercentage,
      targetZoneCount: parsed.data.targetZoneCount,
      durationMinutes: parsed.data.durationMinutes,
      startTime: new Date(),
      endTime: new Date(Date.now() + parsed.data.durationMinutes * 60_000),
      status: "pending",
      reward: {
        type: parsed.data.rewardType,
        description: parsed.data.rewardDescription,
        unlockedAt: null,
      },
      participatingTeamIds: [],
      createdBy: authResult.uid,
    });

    logAuditEvent("challenge.created", authResult.uid, {
      targetId: challengeRef.id,
      metadata: {
        eventId: parsed.data.eventId,
      },
    });

    return NextResponse.json({ id: challengeRef.id });
  } catch (error) {
    return internalApiErrorResponse(
      "Could not create challenge",
      error,
      "Admin challenges create failed"
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await verifyAdminBearerToken(request);

  if (!authResult.ok || !authResult.uid) {
    return authResult.response!;
  }

  const rateCheck = await checkServerRateLimit(
    `admin-challenges:update:${authResult.uid}`,
    60,
    60_000
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateCheck) }
    );
  }

  const parsed = ChallengeMutationSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid challenge mutation payload" },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.action === "setLive") {
      const { challengeId, eventId, durationMinutes } = parsed.data;

      const activeChallengeSnapshot = await adminDb
        .collection("challenges")
        .where("eventId", "==", eventId)
        .where("status", "==", "active")
        .limit(1)
        .get();

      const activeChallenge = activeChallengeSnapshot.docs[0];

      if (activeChallenge && activeChallenge.id !== challengeId) {
        return NextResponse.json(
          { error: "Another challenge is already active for this event" },
          { status: 409 }
        );
      }

      const challengeRef = adminDb.collection("challenges").doc(challengeId);
      const challengeSnapshot = await challengeRef.get();

      if (!challengeSnapshot.exists) {
        return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
      }

      const eventRef = adminDb.collection("events").doc(eventId);

      await adminDb.runTransaction(async (transaction) => {
        const now = new Date();

        transaction.set(
          challengeRef,
          {
            status: "active",
            startTime: now,
            endTime: new Date(now.getTime() + durationMinutes * 60_000),
          },
          { merge: true }
        );

        transaction.set(
          eventRef,
          {
            currentChallengeId: challengeId,
          },
          { merge: true }
        );
      });

      logAuditEvent("admin.action", authResult.uid, {
        targetId: challengeId,
        metadata: {
          action: "challenge.set_live",
          eventId,
        },
      });

      return NextResponse.json({ success: true as const });
    }

    const challengeRef = adminDb.collection("challenges").doc(parsed.data.challengeId);
    const challengeSnapshot = await challengeRef.get();

    if (!challengeSnapshot.exists) {
      throw new Error(CHALLENGE_NOT_FOUND);
    }

    const challengeData = challengeSnapshot.data() as { eventId?: unknown };
    const eventId =
      typeof challengeData.eventId === "string" && challengeData.eventId.trim().length > 0
        ? challengeData.eventId
        : null;

    const batch = adminDb.batch();
    batch.set(
      challengeRef,
      {
        status: "completed",
        endTime: new Date(),
      },
      { merge: true }
    );

    if (eventId) {
      batch.set(
        adminDb.collection("events").doc(eventId),
        {
          currentChallengeId: null,
        },
        { merge: true }
      );
    }

    await batch.commit();

    logAuditEvent("challenge.completed", authResult.uid, {
      targetId: parsed.data.challengeId,
      metadata: {
        endedEarly: true,
      },
    });

    return NextResponse.json({ success: true as const });
  } catch (error) {
    if (error instanceof Error && error.message === CHALLENGE_NOT_FOUND) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    return internalApiErrorResponse(
      "Could not update challenge",
      error,
      "Admin challenges mutation failed"
    );
  }
}
