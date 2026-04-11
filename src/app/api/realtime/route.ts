import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ZONES } from "@/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const ResourceSchema = z.enum([
  "events",
  "challenges",
  "teamsByEvent",
  "zoneOccupancy",
  "challengeTeamProgress",
]);

const QuerySchema = z.object({
  resource: ResourceSchema,
  limit: z.coerce.number().int().min(1).max(300).optional(),
  eventId: z.string().trim().min(1).optional(),
  challengeId: z.string().trim().min(1).optional(),
});

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

function timestampToMillis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return 0;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }

  return fallback;
}

function toOptionalStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toBooleanValue(value: unknown): boolean {
  return value === true;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function serializeEvent(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    id,
    title: toOptionalStringValue(data.title),
    venueName: toStringValue(data.venueName),
    venueCity: toStringValue(data.venueCity),
    homeTeam: toStringValue(data.homeTeam),
    awayTeam: toStringValue(data.awayTeam),
    startTimeMillis: timestampToMillis(data.startTime),
    status: toStringValue(data.status, "upcoming"),
    currentChallengeId: toOptionalStringValue(data.currentChallengeId),
    matchDay: toStringValue(data.matchDay),
    attendeeCount: toNumberValue(data.attendeeCount, 0),
    totalAttendees: toNumberValue(data.totalAttendees, 0),
  };
}

function serializeChallenge(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const reward =
    data.reward && typeof data.reward === "object"
      ? (data.reward as Record<string, unknown>)
      : {};

  return {
    id,
    eventId: toStringValue(data.eventId),
    title: toStringValue(data.title),
    description: toStringValue(data.description),
    targetSpreadPercentage: toNumberValue(data.targetSpreadPercentage, 0),
    targetZoneCount: toNumberValue(data.targetZoneCount, 0),
    durationMinutes: toNumberValue(data.durationMinutes, 0),
    startTimeMillis: timestampToMillis(data.startTime),
    endTimeMillis: timestampToMillis(data.endTime),
    status: toStringValue(data.status, "pending"),
    reward: {
      type: toStringValue(reward.type),
      description: toStringValue(reward.description),
      unlockedAtMillis: reward.unlockedAt ? timestampToMillis(reward.unlockedAt) : null,
    },
    participatingTeamIds: toStringArray(data.participatingTeamIds),
  };
}

function serializeTeam(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    id,
    name: toStringValue(data.name),
    colorHex: toStringValue(data.colorHex),
    emoji: toStringValue(data.emoji),
    venueId: toStringValue(data.venueId),
    eventId: toStringValue(data.eventId),
    memberIds: toStringArray(data.memberIds),
    currentSpreadScore: toNumberValue(data.currentSpreadScore, 0),
    lastCalculatedAtMillis: timestampToMillis(data.lastCalculatedAt),
    totalChallengesWon: toNumberValue(data.totalChallengesWon, 0),
    sectionIds: toStringArray(data.sectionIds),
  };
}

function serializeTeamProgress(
  challengeId: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    challengeId,
    teamId: toStringValue(data.teamId),
    spreadScore: toNumberValue(data.spreadScore, 0),
    activeZones: toStringArray(data.activeZones),
    completedAtMillis: data.completedAt ? timestampToMillis(data.completedAt) : null,
    isCompleted: toBooleanValue(data.isCompleted),
    memberCount: toNumberValue(data.memberCount, 0),
  };
}

function createNoStoreResponse(data: unknown): NextResponse {
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function errorRequiresIndex(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return message.includes("requires an index") || message.includes("failed-precondition");
}

async function getEventsSnapshot(limitCount: number) {
  try {
    return await adminDb
      .collection("events")
      .orderBy("startTime", "desc")
      .limit(limitCount)
      .get();
  } catch (error) {
    if (!errorRequiresIndex(error)) {
      throw error;
    }

    return adminDb.collection("events").limit(limitCount).get();
  }
}

async function getChallengesSnapshot(limitCount: number) {
  try {
    return await adminDb
      .collection("challenges")
      .orderBy("startTime", "desc")
      .limit(limitCount)
      .get();
  } catch (error) {
    if (!errorRequiresIndex(error)) {
      throw error;
    }

    return adminDb.collection("challenges").limit(limitCount).get();
  }
}

async function getZoneOccupancyCounts(): Promise<Record<string, number>> {
  const byZone = ZONES.reduce<Record<string, number>>((acc, zone) => {
    acc[zone.id] = 0;
    return acc;
  }, {});

  try {
    const occupancySnapshot = await adminDb
      .collectionGroup("memberLocations")
      .where("isActive", "==", true)
      .get();

    occupancySnapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() as Record<string, unknown>;
      const zoneId = toStringValue(data.zoneId);

      if (!zoneId || !Object.hasOwn(byZone, zoneId)) {
        return;
      }

      byZone[zoneId] = (byZone[zoneId] ?? 0) + 1;
    });

    return byZone;
  } catch {
    const teamsSnapshot = await adminDb.collection("teams").get();

    const locationSnapshots = await Promise.all(
      teamsSnapshot.docs.map((teamDocSnapshot) =>
        teamDocSnapshot.ref.collection("memberLocations").get()
      )
    );

    locationSnapshots.forEach((snapshot) => {
      snapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data() as Record<string, unknown>;

        if (data.isActive !== true) {
          return;
        }

        const zoneId = toStringValue(data.zoneId);

        if (!zoneId || !Object.hasOwn(byZone, zoneId)) {
          return;
        }

        byZone[zoneId] = (byZone[zoneId] ?? 0) + 1;
      });
    });

    return byZone;
  }
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }

  const parsed = QuerySchema.safeParse({
    resource: request.nextUrl.searchParams.get("resource"),
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    eventId: request.nextUrl.searchParams.get("eventId") ?? undefined,
    challengeId: request.nextUrl.searchParams.get("challengeId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  }

  const { resource, limit, eventId, challengeId } = parsed.data;

  try {
    if (resource === "events") {
      const eventsSnapshot = await getEventsSnapshot(limit ?? 30);

      const serializedEvents = eventsSnapshot.docs
        .map((docSnapshot) =>
          serializeEvent(
            docSnapshot.id,
            docSnapshot.data() as Record<string, unknown>
          )
        )
        .sort(
          (left, right) =>
            toNumberValue(right.startTimeMillis) - toNumberValue(left.startTimeMillis)
        )
        .slice(0, limit ?? 30);

      return createNoStoreResponse(serializedEvents);
    }

    if (resource === "challenges") {
      const challengesSnapshot = await getChallengesSnapshot(limit ?? 100);

      const serializedChallenges = challengesSnapshot.docs
        .map((docSnapshot) =>
          serializeChallenge(
            docSnapshot.id,
            docSnapshot.data() as Record<string, unknown>
          )
        )
        .sort(
          (left, right) =>
            toNumberValue(right.startTimeMillis) - toNumberValue(left.startTimeMillis)
        )
        .slice(0, limit ?? 100);

      return createNoStoreResponse(serializedChallenges);
    }

    if (resource === "teamsByEvent") {
      if (!eventId) {
        return NextResponse.json(
          { error: "eventId is required for teamsByEvent" },
          { status: 400 }
        );
      }

      const teamsSnapshot = await adminDb
        .collection("teams")
        .where("eventId", "==", eventId)
        .get();

      return createNoStoreResponse(
        teamsSnapshot.docs.map((docSnapshot) =>
          serializeTeam(
            docSnapshot.id,
            docSnapshot.data() as Record<string, unknown>
          )
        )
      );
    }

    if (resource === "zoneOccupancy") {
      const byZone = await getZoneOccupancyCounts();

      const totalActiveMembers = Object.values(byZone).reduce(
        (sum, count) => sum + count,
        0
      );

      return createNoStoreResponse({
        byZone,
        totalActiveMembers,
        updatedAtMillis: Date.now(),
      });
    }

    if (!challengeId) {
      return NextResponse.json(
        { error: "challengeId is required for challengeTeamProgress" },
        { status: 400 }
      );
    }

    const teamProgressSnapshot = await adminDb
      .collection("challenges")
      .doc(challengeId)
      .collection("teamProgress")
      .get();

    return createNoStoreResponse(
      teamProgressSnapshot.docs.map((docSnapshot) =>
        serializeTeamProgress(
          challengeId,
          docSnapshot.data() as Record<string, unknown>
        )
      )
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch realtime resource",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
