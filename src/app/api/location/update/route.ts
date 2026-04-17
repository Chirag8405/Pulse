import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ZONES } from "@/constants";
import { adminDb } from "@/lib/firebase/admin";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { rateLimitHeaders } from "@/lib/server/rateLimit";
import { checkServerRateLimit } from "@/lib/server/rateLimitServer";
import { verifyBearerToken } from "@/lib/server/requestAuth";
import {
  buildEmptyZoneCounts,
  getEventOccupancyDocRef,
  normalizeZoneCounts,
} from "@/lib/server/zoneOccupancy";

const ZoneIdSchema = z.enum(ZONES.map((zone) => zone.id) as [string, ...string[]]);

const PayloadSchema = z.object({
  zoneId: ZoneIdSchema,
});

interface UserLocationUpdateDoc {
  teamId?: unknown;
}

interface TeamLocationUpdateDoc {
  eventId?: unknown;
}

interface ExistingMemberLocationDoc {
  zoneId?: unknown;
  isActive?: unknown;
}

interface ExistingOccupancyDoc {
  byZone?: unknown;
  totalActiveMembers?: unknown;
}

function toSafeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toSafeTotalCount(value: unknown, fallbackByZone: Record<string, number>): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  return Object.values(fallbackByZone).reduce((sum, count) => sum + count, 0);
}

export async function POST(request: NextRequest) {
  const authResult = await verifyBearerToken(request);

  if (!authResult.ok || !authResult.uid) {
    return authResult.response!;
  }

  const rateCheck = await checkServerRateLimit(
    `location-update:${authResult.uid}`,
    120,
    60_000
  );

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateCheck) }
    );
  }

  const parsed = PayloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid location payload" }, { status: 400 });
  }

  try {
    const uid = authResult.uid;
    const userReference = adminDb.collection("users").doc(uid);
    const userSnapshot = await userReference.get();

    if (!userSnapshot.exists) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    const userData = userSnapshot.data() as UserLocationUpdateDoc;
    const teamId = toSafeString(userData.teamId);

    if (!teamId) {
      return NextResponse.json({ error: "No team assigned for user" }, { status: 400 });
    }

    const teamReference = adminDb.collection("teams").doc(teamId);
    const teamSnapshot = await teamReference.get();

    if (!teamSnapshot.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const teamData = teamSnapshot.data() as TeamLocationUpdateDoc;
    const eventId = toSafeString(teamData.eventId);

    if (!eventId) {
      return NextResponse.json(
        { error: "Team is not attached to an active event" },
        { status: 400 }
      );
    }

    const teamLocationReference = teamReference.collection("memberLocations").doc(uid);
    const eventLocationReference = adminDb
      .collection("events")
      .doc(eventId)
      .collection("memberLocations")
      .doc(uid);
    const eventOccupancyReference = getEventOccupancyDocRef(eventId);

    await adminDb.runTransaction(async (transaction) => {
      const [existingLocationSnapshot, existingOccupancySnapshot] = await Promise.all([
        transaction.get(teamLocationReference),
        transaction.get(eventOccupancyReference),
      ]);

      const existingLocation = existingLocationSnapshot.exists
        ? (existingLocationSnapshot.data() as ExistingMemberLocationDoc)
        : null;

      const previousZone =
        existingLocation &&
        existingLocation.isActive === true &&
        typeof existingLocation.zoneId === "string"
          ? existingLocation.zoneId
          : null;

      const occupancyData = existingOccupancySnapshot.exists
        ? (existingOccupancySnapshot.data() as ExistingOccupancyDoc)
        : null;

      const byZone = normalizeZoneCounts(occupancyData?.byZone ?? buildEmptyZoneCounts());
      let totalActiveMembers = toSafeTotalCount(occupancyData?.totalActiveMembers, byZone);

      if (previousZone && byZone[previousZone] && previousZone !== parsed.data.zoneId) {
        byZone[previousZone] = Math.max(0, (byZone[previousZone] ?? 0) - 1);
      }

      if (previousZone !== parsed.data.zoneId) {
        byZone[parsed.data.zoneId] = (byZone[parsed.data.zoneId] ?? 0) + 1;
      }

      if (!previousZone) {
        totalActiveMembers += 1;
      }

      const locationPayload = {
        userId: uid,
        teamId,
        eventId,
        zoneId: parsed.data.zoneId,
        timestamp: new Date(),
        isActive: true,
      };

      transaction.set(teamLocationReference, locationPayload, { merge: true });
      transaction.set(eventLocationReference, locationPayload, { merge: true });
      transaction.set(
        eventOccupancyReference,
        {
          byZone,
          totalActiveMembers: Math.max(0, totalActiveMembers),
          updatedAt: new Date(),
          source: "location_update_api",
        },
        { merge: true }
      );
    });

    return NextResponse.json(
      {
        success: true,
        zoneId: parsed.data.zoneId,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return internalApiErrorResponse(
      "Failed to update location",
      error,
      "Location update API failed"
    );
  }
}
