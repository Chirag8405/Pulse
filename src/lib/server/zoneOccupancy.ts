import "server-only";
import { ZONES } from "@/constants";
import { adminDb } from "@/lib/firebase/admin";

export interface EventMemberLocation {
  userId: string;
  teamId: string;
  zoneId: string;
  timestampMillis: number;
}

export interface EventZoneOccupancySummary {
  byZone: Record<string, number>;
  totalActiveMembers: number;
  updatedAtMillis: number;
}

const OCCUPANCY_METRICS_COLLECTION = "metrics";
const OCCUPANCY_METRICS_DOC = "zone_occupancy";
const ZONE_ID_SET = new Set<string>(ZONES.map((zone) => zone.id));

function isKnownZone(zoneId: unknown): zoneId is string {
  return typeof zoneId === "string" && ZONE_ID_SET.has(zoneId);
}

export function buildEmptyZoneCounts(): Record<string, number> {
  return ZONES.reduce<Record<string, number>>((acc, zone) => {
    acc[zone.id] = 0;
    return acc;
  }, {});
}

export function normalizeZoneCounts(value: unknown): Record<string, number> {
  const base = buildEmptyZoneCounts();

  if (!value || typeof value !== "object") {
    return base;
  }

  const mapValue = value as Record<string, unknown>;

  for (const zone of ZONES) {
    const raw = mapValue[zone.id];

    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      continue;
    }

    base[zone.id] = Math.max(0, Math.floor(raw));
  }

  return base;
}

function toTimestampMillis(value: unknown): number {
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

function toSafeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseLocationData(
  data: Record<string, unknown>,
  fallbackTeamId: string
): EventMemberLocation | null {
  const userId = toSafeString(data.userId);
  const zoneId = toSafeString(data.zoneId);

  if (!userId || !isKnownZone(zoneId)) {
    return null;
  }

  const teamId = toSafeString(data.teamId) || fallbackTeamId;

  return {
    userId,
    teamId,
    zoneId,
    timestampMillis: toTimestampMillis(data.timestamp),
  };
}

export function summarizeEventLocations(
  locations: EventMemberLocation[]
): EventZoneOccupancySummary {
  const byZone = buildEmptyZoneCounts();

  locations.forEach((location) => {
    if (!isKnownZone(location.zoneId)) {
      return;
    }

    byZone[location.zoneId] = (byZone[location.zoneId] ?? 0) + 1;
  });

  const updatedAtMillis = locations.reduce(
    (max, location) => Math.max(max, location.timestampMillis),
    0
  );

  return {
    byZone,
    totalActiveMembers: locations.length,
    updatedAtMillis,
  };
}

export function computeWindowedZoneCounts(
  locations: EventMemberLocation[],
  now = Date.now()
): {
  currentCounts: Record<string, number>;
  previousCounts: Record<string, number>;
  totalCurrentMembers: number;
} {
  const currentWindowStart = now - 5 * 60 * 1000;
  const previousWindowStart = now - 10 * 60 * 1000;
  const currentCounts = buildEmptyZoneCounts();
  const previousCounts = buildEmptyZoneCounts();

  locations.forEach((location) => {
    if (!isKnownZone(location.zoneId)) {
      return;
    }

    if (location.timestampMillis >= currentWindowStart) {
      currentCounts[location.zoneId] = (currentCounts[location.zoneId] ?? 0) + 1;
      return;
    }

    if (location.timestampMillis >= previousWindowStart) {
      previousCounts[location.zoneId] = (previousCounts[location.zoneId] ?? 0) + 1;
    }
  });

  const totalCurrentMembers = Object.values(currentCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    currentCounts,
    previousCounts,
    totalCurrentMembers,
  };
}

export function getEventOccupancyDocRef(eventId: string) {
  return adminDb
    .collection("events")
    .doc(eventId)
    .collection(OCCUPANCY_METRICS_COLLECTION)
    .doc(OCCUPANCY_METRICS_DOC);
}

export async function writeEventZoneOccupancySummary(
  eventId: string,
  summary: EventZoneOccupancySummary,
  source: "location_update_api" | "scan_fallback"
): Promise<void> {
  await getEventOccupancyDocRef(eventId).set(
    {
      byZone: normalizeZoneCounts(summary.byZone),
      totalActiveMembers: Math.max(0, Math.floor(summary.totalActiveMembers)),
      updatedAt: new Date(),
      source,
    },
    { merge: true }
  );
}

export async function readEventZoneOccupancySummary(
  eventId: string
): Promise<EventZoneOccupancySummary | null> {
  const snapshot = await getEventOccupancyDocRef(eventId).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as {
    byZone?: unknown;
    totalActiveMembers?: unknown;
    updatedAt?: unknown;
  };

  const byZone = normalizeZoneCounts(data.byZone);

  return {
    byZone,
    totalActiveMembers:
      typeof data.totalActiveMembers === "number" && Number.isFinite(data.totalActiveMembers)
        ? Math.max(0, Math.floor(data.totalActiveMembers))
        : Object.values(byZone).reduce((sum, count) => sum + count, 0),
    updatedAtMillis: toTimestampMillis(data.updatedAt),
  };
}

export async function resolveActiveEventId(): Promise<string | null> {
  try {
    const activeSnapshot = await adminDb
      .collection("events")
      .where("status", "in", ["live", "halftime"])
      .orderBy("startTime", "desc")
      .limit(1)
      .get();

    const activeDoc = activeSnapshot.docs[0];
    return activeDoc?.id ?? null;
  } catch {
    const fallbackSnapshot = await adminDb
      .collection("events")
      .orderBy("startTime", "desc")
      .limit(25)
      .get();

    const activeDoc = fallbackSnapshot.docs.find((docSnapshot) => {
      const status = toSafeString((docSnapshot.data() as { status?: unknown }).status);
      return status === "live" || status === "halftime";
    });

    return activeDoc?.id ?? null;
  }
}

async function readEventMemberLocationsFromMirror(
  eventId: string
): Promise<EventMemberLocation[]> {
  const snapshot = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("memberLocations")
    .where("isActive", "==", true)
    .get();

  return snapshot.docs
    .map((docSnapshot) =>
      parseLocationData(
        docSnapshot.data() as Record<string, unknown>,
        toSafeString((docSnapshot.data() as { teamId?: unknown }).teamId)
      )
    )
    .filter((value): value is EventMemberLocation => value !== null);
}

async function readEventMemberLocationsFromTeams(
  eventId: string
): Promise<EventMemberLocation[]> {
  const teamsSnapshot = await adminDb
    .collection("teams")
    .where("eventId", "==", eventId)
    .get();

  const locationSnapshots = await Promise.all(
    teamsSnapshot.docs.map((teamDocSnapshot) =>
      teamDocSnapshot.ref
        .collection("memberLocations")
        .where("isActive", "==", true)
        .get()
    )
  );

  const locations: EventMemberLocation[] = [];

  locationSnapshots.forEach((snapshot, index) => {
    const fallbackTeamId = teamsSnapshot.docs[index]?.id ?? "";

    snapshot.docs.forEach((locationDocSnapshot) => {
      const parsed = parseLocationData(
        locationDocSnapshot.data() as Record<string, unknown>,
        fallbackTeamId
      );

      if (parsed) {
        locations.push(parsed);
      }
    });
  });

  return locations;
}

export async function readEventMemberLocations(
  eventId: string
): Promise<EventMemberLocation[]> {
  const mirrorLocations = await readEventMemberLocationsFromMirror(eventId);

  if (mirrorLocations.length > 0) {
    return mirrorLocations;
  }

  return readEventMemberLocationsFromTeams(eventId);
}

export async function refreshEventZoneOccupancySummary(
  eventId: string
): Promise<EventZoneOccupancySummary> {
  const locations = await readEventMemberLocations(eventId);
  const summary = summarizeEventLocations(locations);

  await writeEventZoneOccupancySummary(eventId, summary, "scan_fallback");

  return summary;
}
