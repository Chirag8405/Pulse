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
import { isAdminLikeValue } from "@/lib/shared/authUtils";
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
    try {
      // Fall back to cached lookup if server is temporarily unavailable.
      const snapshot = await getDoc(userReference);

      if (process.env.NODE_ENV === "development") {
        console.log("[getUserById] uid:", uid, "isAdmin:", snapshot.data()?.isAdmin);
      }

      return snapshot.exists() ? normalizeUserAdminFlag(snapshot.data()) : null;
    } catch {
      return null;
    }
  }
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const snapshot = await getDoc(teamDoc(teamId));
  return snapshot.exists() ? snapshot.data() : null;
}

interface BootstrapUserResponse {
  isAdmin?: boolean;
  teamId?: string | null;
}

async function bootstrapUserOnServer(
  firebaseUser: FirebaseUser
): Promise<BootstrapUserResponse | null> {
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

  return (await response.json().catch(() => null)) as BootstrapUserResponse | null;
}

/**
 * Builds a fallback User object from Firebase Auth + bootstrap data
 * without requiring a Firestore read.
 */
function buildFallbackUser(
  firebaseUser: FirebaseUser,
  isAdmin: boolean,
  teamId: string | null
): User {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    teamId,
    venueId: VENUE_NAME,
    joinedAt: Timestamp.now(),
    totalPoints: 0,
    totalChallengesCompleted: 0,
    isAdmin,
  };
}

/**
 * Applies bootstrap-derived admin/teamId overrides on top of a User.
 */
function applyBootstrapOverrides(
  user: User,
  bootstrappedIsAdmin: boolean | null,
  bootstrappedTeamId: string | null
): User {
  if (bootstrappedIsAdmin !== true && bootstrappedTeamId == null) {
    return user;
  }

  return {
    ...user,
    isAdmin: bootstrappedIsAdmin === true ? true : user.isAdmin,
    teamId:
      user.teamId ??
      (typeof bootstrappedTeamId === "string" ? bootstrappedTeamId : null),
  };
}

export async function getOrCreateUser(firebaseUser: FirebaseUser): Promise<User> {
  const existingSync = userSyncInFlight.get(firebaseUser.uid);

  if (existingSync) {
    return existingSync;
  }

  const syncPromise = (async () => {
    let bootstrappedIsAdmin: boolean | null = null;
    let bootstrappedTeamId: string | null = null;
    let hasBootstrapResult = false;

    // Phase 1: Try server bootstrap + fresh read
    try {
      const result = await bootstrapUserOnServer(firebaseUser);
      hasBootstrapResult = result !== null;
      bootstrappedIsAdmin = result?.isAdmin === true;
      bootstrappedTeamId =
        typeof result?.teamId === "string" ? result.teamId : null;

      const syncedUser = await getUserById(firebaseUser.uid);
      if (syncedUser) {
        return applyBootstrapOverrides(syncedUser, bootstrappedIsAdmin, bootstrappedTeamId);
      }
    } catch {
      // Fallback for local/offline development where API route may be unavailable.
    }

    // Phase 2: Direct Firestore read
    const existing = await getUserById(firebaseUser.uid).catch(() => null);
    if (existing) {
      return applyBootstrapOverrides(existing, bootstrappedIsAdmin, bootstrappedTeamId);
    }

    // Phase 3: Server bootstrap succeeded but Firestore reads failed — use derived data
    if (hasBootstrapResult) {
      return buildFallbackUser(firebaseUser, bootstrappedIsAdmin === true, bootstrappedTeamId);
    }

    // Phase 4: Create new user document
    const newUser = buildFallbackUser(
      firebaseUser,
      bootstrappedIsAdmin === true,
      bootstrappedTeamId
    );

    try {
      await setDoc(userDoc(firebaseUser.uid), newUser, { merge: true });
    } catch (writeError) {
      const hydratedUser = await getUserById(firebaseUser.uid).catch(() => null);
      if (hydratedUser) {
        return applyBootstrapOverrides(hydratedUser, bootstrappedIsAdmin, bootstrappedTeamId);
      }

      if (process.env.NODE_ENV === "development") {
        console.warn("[getOrCreateUser] fallback user hydration after setDoc failure", {
          uid: firebaseUser.uid,
          message: writeError instanceof Error ? writeError.message : String(writeError),
        });
      }

      return newUser;
    }

    return applyBootstrapOverrides(
      (await getUserById(firebaseUser.uid)) ?? newUser,
      bootstrappedIsAdmin,
      bootstrappedTeamId
    );
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
