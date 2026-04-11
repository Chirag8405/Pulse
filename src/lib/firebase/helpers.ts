import type { User as FirebaseUser } from "firebase/auth";
import {
  Timestamp,
  arrayUnion,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { VENUE_NAME } from "@/constants";
import {
  challengesCollection,
  eventsCollection,
  memberLocationDoc,
  teamDoc,
  teamProgressCollection,
  teamProgressDoc,
  userDoc,
} from "@/lib/firebase/collections";
import { db } from "@/lib/firebase/config";
import { LocationUpdateSchema } from "@/lib/schemas";
import type {
  Challenge,
  ChallengeTeamProgress,
  Event,
  Team,
  User,
} from "@/types/firebase";

const userSyncInFlight = new Map<string, Promise<User>>();

interface LegacyUserAdminFields {
  role?: unknown;
  admin?: unknown;
  is_admin?: unknown;
  "is admin"?: unknown;
  isAdmin?: unknown;
}

function isAdminLikeValue(value: unknown): boolean {
  if (value === true) {
    return true;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    return (
      normalizedValue === "true" ||
      normalizedValue === "1" ||
      normalizedValue === "yes" ||
      normalizedValue === "admin" ||
      normalizedValue === "staff"
    );
  }

  return false;
}

function normalizeUserAdminFlag(user: User): User {
  const legacyFields = user as User & LegacyUserAdminFields;

  const normalizedAdmin =
    isAdminLikeValue(legacyFields.isAdmin) ||
    isAdminLikeValue(legacyFields.role) ||
    isAdminLikeValue(legacyFields.admin) ||
    isAdminLikeValue(legacyFields.is_admin) ||
    isAdminLikeValue(legacyFields["is admin"]);

  return {
    ...user,
    isAdmin: normalizedAdmin,
  };
}

export async function getUserById(uid: string): Promise<User | null> {
  const userReference = userDoc(uid);

  try {
    const snapshot = await getDocFromServer(userReference);

    if (process.env.NODE_ENV === "development") {
      console.log("[getUserById] uid:", uid, "isAdmin:", snapshot.data()?.isAdmin);
    }

    return snapshot.exists() ? normalizeUserAdminFlag(snapshot.data()) : null;
  } catch {
    // Fall back to cached lookup if server is temporarily unavailable.
    const snapshot = await getDoc(userReference);

    if (process.env.NODE_ENV === "development") {
      console.log("[getUserById] uid:", uid, "isAdmin:", snapshot.data()?.isAdmin);
    }

    return snapshot.exists() ? normalizeUserAdminFlag(snapshot.data()) : null;
  }
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const snapshot = await getDoc(teamDoc(teamId));
  return snapshot.exists() ? snapshot.data() : null;
}

async function bootstrapUserOnServer(firebaseUser: FirebaseUser): Promise<void> {
  const token = await firebaseUser.getIdToken(true);
  const response = await fetch("/api/auth/bootstrap-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Failed to bootstrap user");
  }
}

export async function getOrCreateUser(firebaseUser: FirebaseUser): Promise<User> {
  const existingSync = userSyncInFlight.get(firebaseUser.uid);

  if (existingSync) {
    return existingSync;
  }

  const syncPromise = (async () => {
    try {
      await bootstrapUserOnServer(firebaseUser);
      const syncedUser = await getUserById(firebaseUser.uid);

      if (syncedUser) {
        return syncedUser;
      }
    } catch {
      // Fallback for local/offline development where API route may be unavailable.
    }

    const existing = await getUserById(firebaseUser.uid);

    if (existing) {
      return existing;
    }

    const newUser: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      teamId: null,
      venueId: VENUE_NAME,
      joinedAt: Timestamp.now(),
      totalPoints: 0,
      totalChallengesCompleted: 0,
      isAdmin: false,
    };

    try {
      await setDoc(userDoc(firebaseUser.uid), newUser, { merge: true });
    } catch (writeError) {
      // If the user doc already exists with stricter fields (for example isAdmin),
      // prefer reading canonical server state over failing auth hydration.
      const hydratedUser = await getUserById(firebaseUser.uid);
      if (hydratedUser) {
        return hydratedUser;
      }

      throw writeError;
    }

    const hydratedUser = await getUserById(firebaseUser.uid);
    if (hydratedUser) {
      return hydratedUser;
    }

    return newUser;
  })();

  userSyncInFlight.set(firebaseUser.uid, syncPromise);

  try {
    return await syncPromise;
  } finally {
    userSyncInFlight.delete(firebaseUser.uid);
  }
}

export async function getActiveEvent(): Promise<Event | null> {
  const activeEventQuery = query(
    eventsCollection,
    where("status", "in", ["live", "halftime"]),
    orderBy("startTime", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(activeEventQuery);
  const activeEventDoc = snapshot.docs[0];

  return activeEventDoc ? activeEventDoc.data() : null;
}

export async function getActiveChallenge(
  eventId: string
): Promise<Challenge | null> {
  const activeChallengeQuery = query(
    challengesCollection,
    where("eventId", "==", eventId),
    where("status", "==", "active"),
    orderBy("startTime", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(activeChallengeQuery);
  const activeChallengeDoc = snapshot.docs[0];

  return activeChallengeDoc ? activeChallengeDoc.data() : null;
}

export function subscribeToTeamProgress(
  challengeId: string,
  teamId: string,
  cb: (teamProgress: ChallengeTeamProgress | null) => void
): () => void {
  return onSnapshot(teamProgressDoc(challengeId, teamId), (snapshot) => {
    cb(snapshot.exists() ? snapshot.data() : null);
  });
}

export function subscribeToActiveChallenge(
  eventId: string,
  cb: (challenge: Challenge | null) => void
): () => void {
  const activeChallengeQuery = query(
    challengesCollection,
    where("eventId", "==", eventId),
    where("status", "==", "active"),
    orderBy("startTime", "desc"),
    limit(1)
  );

  return onSnapshot(activeChallengeQuery, (snapshot) => {
    const challengeDocSnapshot = snapshot.docs[0];
    cb(challengeDocSnapshot ? challengeDocSnapshot.data() : null);
  });
}

export function subscribeToLeaderboard(
  challengeId: string,
  leaderboardLimit: number,
  cb: (teams: ChallengeTeamProgress[]) => void
): () => void {
  const safeLimit = Math.max(1, Math.floor(leaderboardLimit));
  const leaderboardQuery = query(
    teamProgressCollection(challengeId),
    orderBy("spreadScore", "desc"),
    orderBy("completedAt", "asc"),
    limit(safeLimit)
  );

  return onSnapshot(leaderboardQuery, (snapshot) => {
    cb(snapshot.docs.map((docSnapshot) => docSnapshot.data()));
  });
}

export async function updateUserLocation(
  userId: string,
  teamId: string,
  zoneId: string
): Promise<void> {
  const parsedLocation = LocationUpdateSchema.parse({
    zoneId,
    timestamp: Date.now(),
  });

  await setDoc(
    memberLocationDoc(teamId, userId),
    {
      userId,
      teamId,
      zoneId: parsedLocation.zoneId,
      timestamp: serverTimestamp(),
      isActive: true,
    },
    { merge: true }
  );
}

export async function joinTeam(userId: string, teamId: string): Promise<void> {
  const batch = writeBatch(db);

  batch.update(teamDoc(teamId), {
    memberIds: arrayUnion(userId),
  });

  batch.update(userDoc(userId), {
    teamId,
  });

  await batch.commit();
}
