import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    arrayUnion: vi.fn((value: string) => ({ __arrayUnion: value })),
    userDoc: vi.fn((uid: string) => `user:${uid}`),
    teamDoc: vi.fn((teamId: string) => `team:${teamId}`),
    memberLocationDoc: vi.fn(
      (teamId: string, userId: string) => `member-location:${teamId}:${userId}`
    ),
  };
});

vi.mock("firebase/firestore", () => ({
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => 0 })),
  },
  arrayUnion: mocks.arrayUnion,
  getDoc: mocks.getDoc,
  getDocs: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: mocks.runTransaction,
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
}));

import {
  getUserById,
  joinTeam,
  updateUserLocation,
} from "@/lib/firebase/helpers";

describe("firebase helpers", () => {
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

  it("joinTeam uses a Firestore transaction", async () => {
    const transaction = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ exists: () => true, data: () => ({}) })
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ memberIds: [] }) }),
      update: vi.fn(),
    };

    mocks.runTransaction.mockImplementation(async (_db, callback) => callback(transaction));

    await joinTeam("user-9", "team-9");

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledWith("team:team-9", {
      memberIds: { __arrayUnion: "user-9" },
    });
    expect(transaction.update).toHaveBeenCalledWith("user:user-9", {
      teamId: "team-9",
    });
  });
});
