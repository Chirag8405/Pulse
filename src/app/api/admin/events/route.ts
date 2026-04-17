import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { VENUE_CITY, VENUE_NAME } from "@/constants";
import { adminDb } from "@/lib/firebase/admin";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { logAuditEvent } from "@/lib/server/auditLog";
import { rateLimitHeaders } from "@/lib/server/rateLimit";
import { checkServerRateLimit } from "@/lib/server/rateLimitServer";
import { verifyAdminBearerToken } from "@/lib/server/requestAuth";

const EventStatusSchema = z.enum(["upcoming", "live", "halftime", "completed"]);

const IsoDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid start time",
  });

const CreateEventSchema = z.object({
  homeTeam: z.string().trim().min(1).max(80),
  awayTeam: z.string().trim().min(1).max(80),
  startTimeIso: IsoDateSchema,
  matchDay: z.string().trim().min(1).max(80),
});

const UpdateEventStatusSchema = z.object({
  eventId: z.string().trim().min(1),
  status: EventStatusSchema,
});

async function readJsonBody(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminBearerToken(request);

  if (!authResult.ok || !authResult.uid) {
    return authResult.response!;
  }

  const rateCheck = await checkServerRateLimit(
    `admin-events:create:${authResult.uid}`,
    30,
    60_000
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateCheck) }
    );
  }

  const parsed = CreateEventSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event payload" },
      { status: 400 }
    );
  }

  try {
    const eventRef = adminDb.collection("events").doc();
    const startTime = new Date(parsed.data.startTimeIso);

    await eventRef.set({
      id: eventRef.id,
      venueName: VENUE_NAME,
      venueCity: VENUE_CITY,
      homeTeam: parsed.data.homeTeam,
      awayTeam: parsed.data.awayTeam,
      title: `${parsed.data.homeTeam} vs ${parsed.data.awayTeam}`,
      startTime,
      status: "upcoming",
      currentChallengeId: null,
      matchDay: parsed.data.matchDay,
    });

    logAuditEvent("admin.action", authResult.uid, {
      targetId: eventRef.id,
      metadata: {
        action: "event.created",
      },
    });

    return NextResponse.json({ id: eventRef.id });
  } catch (error) {
    return internalApiErrorResponse(
      "Could not create event",
      error,
      "Admin events create failed"
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await verifyAdminBearerToken(request);

  if (!authResult.ok || !authResult.uid) {
    return authResult.response!;
  }

  const rateCheck = await checkServerRateLimit(
    `admin-events:update:${authResult.uid}`,
    60,
    60_000
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateCheck) }
    );
  }

  const parsed = UpdateEventStatusSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event status payload" },
      { status: 400 }
    );
  }

  const { eventId, status } = parsed.data;

  try {
    if (status === "live") {
      const [liveSnapshot, halftimeSnapshot] = await Promise.all([
        adminDb.collection("events").where("status", "==", "live").limit(1).get(),
        adminDb.collection("events").where("status", "==", "halftime").limit(1).get(),
      ]);

      const conflictExists = [...liveSnapshot.docs, ...halftimeSnapshot.docs].some(
        (snapshot) => snapshot.id !== eventId
      );

      if (conflictExists) {
        return NextResponse.json(
          { error: "Another event is already live. End it before starting a new one." },
          { status: 409 }
        );
      }
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventSnapshot = await eventRef.get();

    if (!eventSnapshot.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const nextPayload: { status: z.infer<typeof EventStatusSchema>; currentChallengeId?: null } = {
      status,
    };

    if (status === "completed") {
      nextPayload.currentChallengeId = null;
    }

    await eventRef.set(nextPayload, { merge: true });

    logAuditEvent("event.status_changed", authResult.uid, {
      targetId: eventId,
      metadata: {
        status,
      },
    });

    return NextResponse.json({ success: true as const });
  } catch (error) {
    return internalApiErrorResponse(
      "Could not update event status",
      error,
      "Admin events status update failed"
    );
  }
}
