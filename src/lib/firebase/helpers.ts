import type { User as FirebaseUser } from "firebase/auth";
import {
  Timestamp,
  arrayUnion,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
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

export async function getUserById(uid: string): Promise<User | null> {
  const snapshot = await getDoc(userDoc(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const snapshot = await getDoc(teamDoc(teamId));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function getOrCreateUser(firebaseUser: FirebaseUser): Promise<User> {
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

  await setDoc(userDoc(firebaseUser.uid), newUser);

  return newUser;
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
  await runTransaction(db, async (transaction) => {
    const userReference = userDoc(userId);
    const teamReference = teamDoc(teamId);

    const userSnapshot = await transaction.get(userReference);
    const teamSnapshot = await transaction.get(teamReference);

    if (!userSnapshot.exists()) {
      throw new Error("User document not found");
    }

    if (!teamSnapshot.exists()) {
      throw new Error("Team document not found");
    }

    const team = teamSnapshot.data();

    if (!team.memberIds.includes(userId)) {
      transaction.update(teamReference, {
        memberIds: arrayUnion(userId),
      });
    }

    transaction.update(userReference, {
      teamId,
    });
  });
}
