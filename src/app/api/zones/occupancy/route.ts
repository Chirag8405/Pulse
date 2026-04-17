import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ZONES } from "@/constants";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { readIsAdmin, verifyBearerToken } from "@/lib/server/requestAuth";
import {
  computeWindowedZoneCounts,
  readEventMemberLocations,
} from "@/lib/server/zoneOccupancy";

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
    const locations = await readEventMemberLocations(eventId);
    const { currentCounts, previousCounts, totalCurrentMembers } =
      computeWindowedZoneCounts(locations);

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
    return internalApiErrorResponse(
      "Failed to calculate zone occupancy",
      error,
      "Zone occupancy API failed"
    );
  }
}
