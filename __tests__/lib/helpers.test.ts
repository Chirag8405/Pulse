import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    userDoc: vi.fn((uid: string) => `user:${uid}`),
    teamDoc: vi.fn((teamId: string) => `team:${teamId}`),
    memberLocationDoc: vi.fn(
      (teamId: string, userId: string) => `member-location:${teamId}:${userId}`
    ),
    auth: {
      currentUser: null as null | {
        getIdToken: (forceRefresh?: boolean) => Promise<string>;
      },
    },
  };
});

vi.mock("firebase/firestore", () => ({
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => 0 })),
  },
  getDoc: mocks.getDoc,
  getDocs: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
  where: vi.fn(),
}));

vi.mock("@/lib/firebase/collections", () => ({
  challengesCollection: "challengesCollection",
  eventsCollection: "eventsCollection",
  memberLocationDoc: mocks.memberLocationDoc,
  teamDoc: mocks.teamDoc,
  teamProgressCollection: vi.fn(),
  teamProgressDoc: vi.fn(),
  userDoc: mocks.userDoc,
}));

vi.mock("@/lib/firebase/config", () => ({
  db: { id: "mock-db" },
  auth: mocks.auth,
}));

import {
  getUserById,
  updateUserLocation,
} from "@/lib/firebase/helpers";

describe("firebase helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.currentUser = null;
  });

  it("getUserById returns null for non-existent document", async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => null,
    });

    const result = await getUserById("user-1");

    expect(result).toBeNull();
    expect(mocks.userDoc).toHaveBeenCalledWith("user-1");
  });

  it("getUserById returns typed User for existing document", async () => {
    const user = {
      uid: "user-2",
      email: "demo@pulse.app",
      displayName: "Demo User",
      photoURL: null,
      teamId: null,
      venueId: "Wankhede Stadium",
      joinedAt: { toMillis: () => 1 },
      totalPoints: 10,
      totalChallengesCompleted: 1,
      isAdmin: false,
    };

    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => user,
    });

    const result = await getUserById("user-2");

    expect(result).toEqual(user);
  });

  it("updateUserLocation calls setDoc with correct data", async () => {
    await updateUserLocation("uid", "team-id", "zone-east");

    expect(mocks.memberLocationDoc).toHaveBeenCalledWith("team-id", "uid");
    expect(mocks.serverTimestamp).toHaveBeenCalled();
    expect(mocks.setDoc).toHaveBeenCalledWith(
      "member-location:team-id:uid",
      {
        userId: "uid",
        teamId: "team-id",
        zoneId: "zone-east",
        timestamp: "SERVER_TIMESTAMP",
        isActive: true,
      },
      { merge: true }
    );
  });

  it("updateUserLocation throws if zoneId invalid", async () => {
    await expect(
      updateUserLocation("uid", "team-id", "invalid-zone")
    ).rejects.toThrow();
  });

  it("updateUserLocation uses API route for authenticated user", async () => {
    const getIdToken = vi.fn().mockResolvedValue("token-123");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });

    mocks.auth.currentUser = { getIdToken };
    vi.stubGlobal("fetch", fetchMock);

    await updateUserLocation("uid", "team-id", "zone-east");

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/location/update",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      })
    );
    expect(mocks.setDoc).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

});
