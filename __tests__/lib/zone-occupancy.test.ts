import { describe, expect, it } from "vitest";
import {
  buildEmptyZoneCounts,
  computeWindowedZoneCounts,
  normalizeZoneCounts,
  summarizeEventLocations,
  type EventMemberLocation,
} from "@/lib/server/zoneOccupancy";

describe("zoneOccupancy helper", () => {
  it("buildEmptyZoneCounts initializes all known zones", () => {
    const counts = buildEmptyZoneCounts();

    expect(Object.keys(counts).length).toBeGreaterThan(0);
    expect(Object.values(counts).every((value) => value === 0)).toBe(true);
  });

  it("normalizeZoneCounts clamps invalid values and unknown keys", () => {
    const normalized = normalizeZoneCounts({
      "zone-east": 5.9,
      "zone-west": -3,
      unknown: 999,
    });

    expect(normalized["zone-east"]).toBe(5);
    expect(normalized["zone-west"]).toBe(0);
    expect((normalized as Record<string, number>).unknown).toBeUndefined();
  });

  it("summarizeEventLocations aggregates zone counts", () => {
    const locations: EventMemberLocation[] = [
      {
        userId: "u1",
        teamId: "t1",
        zoneId: "zone-east",
        timestampMillis: 100,
      },
      {
        userId: "u2",
        teamId: "t1",
        zoneId: "zone-east",
        timestampMillis: 200,
      },
      {
        userId: "u3",
        teamId: "t2",
        zoneId: "zone-west",
        timestampMillis: 300,
      },
    ];

    const summary = summarizeEventLocations(locations);

    expect(summary.byZone["zone-east"]).toBe(2);
    expect(summary.byZone["zone-west"]).toBe(1);
    expect(summary.totalActiveMembers).toBe(3);
    expect(summary.updatedAtMillis).toBe(300);
  });

  it("computeWindowedZoneCounts splits current and previous windows", () => {
    const now = Date.now();
    const locations: EventMemberLocation[] = [
      {
        userId: "u1",
        teamId: "t1",
        zoneId: "zone-east",
        timestampMillis: now - 2 * 60 * 1000,
      },
      {
        userId: "u2",
        teamId: "t1",
        zoneId: "zone-east",
        timestampMillis: now - 7 * 60 * 1000,
      },
      {
        userId: "u3",
        teamId: "t2",
        zoneId: "zone-west",
        timestampMillis: now - 3 * 60 * 1000,
      },
    ];

    const windowed = computeWindowedZoneCounts(locations, now);

    expect(windowed.currentCounts["zone-east"]).toBe(1);
    expect(windowed.currentCounts["zone-west"]).toBe(1);
    expect(windowed.previousCounts["zone-east"]).toBe(1);
    expect(windowed.totalCurrentMembers).toBe(2);
  });
});
