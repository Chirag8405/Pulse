import { beforeEach, describe, expect, it, vi } from "vitest";

const occupancyGetMock = vi.hoisted(() => vi.fn());
const occupancySetMock = vi.hoisted(() => vi.fn());
const activeEventsGetMock = vi.hoisted(() => vi.fn());
const fallbackEventsGetMock = vi.hoisted(() => vi.fn());
const mirrorLocationsGetMock = vi.hoisted(() => vi.fn());
const teamsGetMock = vi.hoisted(() => vi.fn());

const collectionMock = vi.hoisted(() =>
  vi.fn((collectionName: string) => {
    if (collectionName === "events") {
      return {
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: activeEventsGetMock,
            })),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: fallbackEventsGetMock,
          })),
        })),
        doc: vi.fn(() => ({
          collection: vi.fn((subCollectionName: string) => {
            if (subCollectionName === "metrics") {
              return {
                doc: vi.fn(() => ({
                  get: occupancyGetMock,
                  set: occupancySetMock,
                })),
              };
            }

            if (subCollectionName === "memberLocations") {
              return {
                where: vi.fn(() => ({
                  get: mirrorLocationsGetMock,
                })),
              };
            }

            return {
              doc: vi.fn(() => ({
                get: occupancyGetMock,
                set: occupancySetMock,
              })),
            };
          }),
        })),
      };
    }

    if (collectionName === "teams") {
      return {
        where: vi.fn(() => ({
          get: teamsGetMock,
        })),
      };
    }

    return {
      doc: vi.fn(() => ({
        get: occupancyGetMock,
      })),
    };
  })
);

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: collectionMock,
  },
}));

import {
  readEventMemberLocations,
  readEventZoneOccupancySummary,
  refreshEventZoneOccupancySummary,
  resolveActiveEventId,
} from "@/lib/server/zoneOccupancy";

describe("zoneOccupancy I/O helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    activeEventsGetMock.mockResolvedValue({ docs: [{ id: "event-live" }] });
    fallbackEventsGetMock.mockResolvedValue({ docs: [] });
    mirrorLocationsGetMock.mockResolvedValue({ docs: [] });
    teamsGetMock.mockResolvedValue({ docs: [] });
    occupancyGetMock.mockResolvedValue({ exists: false });
    occupancySetMock.mockResolvedValue(undefined);
  });

  it("readEventZoneOccupancySummary falls back total count from byZone", async () => {
    occupancyGetMock.mockResolvedValue({
      exists: true,
      data: () => ({
        byZone: {
          "zone-east": 2,
          "zone-west": 1,
          unknown: 50,
        },
        totalActiveMembers: "not-a-number",
        updatedAt: new Date(1234),
      }),
    });

    const summary = await readEventZoneOccupancySummary("event-1");

    expect(summary).not.toBeNull();
    expect(summary?.totalActiveMembers).toBe(3);
    expect(summary?.byZone["zone-east"]).toBe(2);
    expect(summary?.updatedAtMillis).toBe(1234);
  });

  it("resolveActiveEventId uses fallback query when index query fails", async () => {
    activeEventsGetMock.mockRejectedValue(new Error("failed-precondition"));
    fallbackEventsGetMock.mockResolvedValue({
      docs: [
        {
          id: "event-upcoming",
          data: () => ({ status: "upcoming" }),
        },
        {
          id: "event-halftime",
          data: () => ({ status: "halftime" }),
        },
      ],
    });

    const eventId = await resolveActiveEventId();

    expect(eventId).toBe("event-halftime");
  });

  it("readEventMemberLocations uses mirror when mirror has active members", async () => {
    mirrorLocationsGetMock.mockResolvedValue({
      docs: [
        {
          data: () => ({
            userId: "user-1",
            teamId: "team-1",
            zoneId: "zone-east",
            timestamp: new Date(5000),
          }),
        },
        {
          data: () => ({
            userId: "",
            teamId: "team-1",
            zoneId: "zone-west",
            timestamp: new Date(5000),
          }),
        },
      ],
    });

    const locations = await readEventMemberLocations("event-1");

    expect(locations).toHaveLength(1);
    expect(locations[0]?.teamId).toBe("team-1");
    expect(teamsGetMock).not.toHaveBeenCalled();
  });

  it("readEventMemberLocations falls back to team member locations", async () => {
    mirrorLocationsGetMock.mockResolvedValue({ docs: [] });

    const teamOneGet = vi.fn().mockResolvedValue({
      docs: [
        {
          data: () => ({
            userId: "user-1",
            zoneId: "zone-east",
            timestamp: { toMillis: () => 2000 },
          }),
        },
      ],
    });
    const teamTwoGet = vi.fn().mockResolvedValue({
      docs: [
        {
          data: () => ({
            userId: "user-2",
            zoneId: "zone-west",
            timestamp: 3000,
          }),
        },
      ],
    });

    teamsGetMock.mockResolvedValue({
      docs: [
        {
          id: "team-one",
          ref: {
            collection: vi.fn(() => ({
              where: vi.fn(() => ({
                get: teamOneGet,
              })),
            })),
          },
        },
        {
          id: "team-two",
          ref: {
            collection: vi.fn(() => ({
              where: vi.fn(() => ({
                get: teamTwoGet,
              })),
            })),
          },
        },
      ],
    });

    const locations = await readEventMemberLocations("event-1");

    expect(locations).toHaveLength(2);
    expect(locations[0]?.teamId).toBe("team-one");
    expect(locations[1]?.teamId).toBe("team-two");
  });

  it("refreshEventZoneOccupancySummary writes scan_fallback summary", async () => {
    mirrorLocationsGetMock.mockResolvedValue({
      docs: [
        {
          data: () => ({
            userId: "user-1",
            teamId: "team-1",
            zoneId: "zone-east",
            timestamp: new Date(7000),
          }),
        },
      ],
    });

    const summary = await refreshEventZoneOccupancySummary("event-1");

    expect(summary.totalActiveMembers).toBe(1);
    expect(summary.byZone["zone-east"]).toBe(1);
    expect(occupancySetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "scan_fallback",
        totalActiveMembers: 1,
      }),
      { merge: true }
    );
  });
});
