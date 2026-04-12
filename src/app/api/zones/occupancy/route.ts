import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ZONES } from "@/constants";
import { adminDb } from "@/lib/firebase/admin";
import { readIsAdmin, verifyBearerToken } from "@/lib/server/requestAuth";

type Trend = "up" | "down" | "steady";

interface OccupancyZonePayload {
  count: number;
  percentage: number;
  trend: Trend;
}

interface OccupancyResponsePayload {
  zones: Record<string, OccupancyZonePayload>;
  generatedAt: string;
}

const OCCUPANCY_CACHE_TTL_MS = 15_000;
const occupancyCacheByEvent = new Map<
  string,
  { expiresAt: number; payload: OccupancyResponsePayload }
>();

const QuerySchema = z.object({
  eventId: z.string().trim().min(1),
});

function getTimestampMillis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  return 0;
}

export async function GET(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.ok || !authResult.uid) {
    return authResult.response!;
  }

  const isAdmin = await readIsAdmin(authResult.uid);
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
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

  const now = Date.now();
  const cachedResponse = occupancyCacheByEvent.get(eventId);
  if (cachedResponse && cachedResponse.expiresAt > now) {
    return NextResponse.json(cachedResponse.payload, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  }

  try {
    const teamsSnapshot = await adminDb
      .collection("teams")
      .where("eventId", "==", eventId)
      .get();

    const eventMemberIds = new Set<string>();
    const teamIds: string[] = [];

    teamsSnapshot.docs.forEach((teamDocSnapshot) => {
      teamIds.push(teamDocSnapshot.id);

      const team = teamDocSnapshot.data() as { memberIds?: string[] };
      team.memberIds?.forEach((memberId) => {
        if (memberId) {
          eventMemberIds.add(memberId);
        }
      });
    });

    const now = Date.now();
    const currentWindowStart = now - 5 * 60 * 1000;
    const previousWindowStart = now - 10 * 60 * 1000;

    const currentCounts = Object.fromEntries(
      ZONES.map((zone) => [zone.id, 0])
    ) as Record<string, number>;
    const previousCounts = Object.fromEntries(
      ZONES.map((zone) => [zone.id, 0])
    ) as Record<string, number>;

    const memberLocationSnapshots = await Promise.all(
      teamIds.map((teamId) =>
        adminDb
          .collection("teams")
          .doc(teamId)
          .collection("memberLocations")
          .where("isActive", "==", true)
          .get()
      )
    );

    memberLocationSnapshots.forEach((snapshot) => {
      snapshot.docs.forEach((locationDocSnapshot) => {
        const location = locationDocSnapshot.data() as {
          userId?: string;
          zoneId?: string;
          timestamp?: unknown;
        };

        if (!location.userId || !eventMemberIds.has(location.userId)) {
          return;
        }

        if (!location.zoneId || !Object.hasOwn(currentCounts, location.zoneId)) {
          return;
        }

        const timestampMillis = getTimestampMillis(location.timestamp);

        if (timestampMillis >= currentWindowStart) {
          currentCounts[location.zoneId] = (currentCounts[location.zoneId] ?? 0) + 1;
          return;
        }

        if (
          timestampMillis >= previousWindowStart &&
          timestampMillis < currentWindowStart
        ) {
          previousCounts[location.zoneId] = (previousCounts[location.zoneId] ?? 0) + 1;
        }
      });
    });

    const totalCurrentMembers = Object.values(currentCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    const zones: Record<string, OccupancyZonePayload> = {};

    ZONES.forEach((zone) => {
      const currentCount = currentCounts[zone.id] ?? 0;
      const previousCount = previousCounts[zone.id] ?? 0;

      const trend: Trend =
        currentCount > previousCount
          ? "up"
          : currentCount < previousCount
            ? "down"
            : "steady";

      zones[zone.id] = {
        count: currentCount,
        percentage:
          totalCurrentMembers > 0
            ? Number(((currentCount / totalCurrentMembers) * 100).toFixed(2))
            : 0,
        trend,
      };
    });

    const payload: OccupancyResponsePayload = {
      zones,
      generatedAt: new Date().toISOString(),
    };

    occupancyCacheByEvent.set(eventId, {
      payload,
      expiresAt: now + OCCUPANCY_CACHE_TTL_MS,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to calculate zone occupancy",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
