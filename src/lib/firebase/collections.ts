import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type WithFieldValue,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type {
  Challenge,
  ChallengeTeamProgress,
  Event,
  MemberLocation,
  Team,
  User,
} from "@/types/firebase";

const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
  toFirestore(modelObject: WithFieldValue<T>): DocumentData {
    return modelObject as DocumentData;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options: SnapshotOptions
  ): T {
    return snapshot.data(options) as T;
  },
});

export const userConverter = createConverter<User>();
export const teamConverter = createConverter<Team>();
export const eventConverter = createConverter<Event>();
export const challengeConverter = createConverter<Challenge>();
export const memberLocationConverter = createConverter<MemberLocation>();
export const challengeTeamProgressConverter =
  createConverter<ChallengeTeamProgress>();

export const usersCollection = collection(db, "users").withConverter(userConverter);
export const teamsCollection = collection(db, "teams").withConverter(teamConverter);
export const eventsCollection = collection(db, "events").withConverter(eventConverter);
export const challengesCollection = collection(db, "challenges").withConverter(
  challengeConverter
);
export const auditLogCollection = collection(db, "audit_log");

export const userDoc = (uid: string) => doc(usersCollection, uid);
export const teamDoc = (teamId: string) => doc(teamsCollection, teamId);
export const eventDoc = (eventId: string) => doc(eventsCollection, eventId);
export const challengeDoc = (challengeId: string) =>
  doc(challengesCollection, challengeId);

export const memberLocationsCollection = (
  teamId: string
): CollectionReference<MemberLocation> =>
  collection(teamDoc(teamId), "memberLocations").withConverter(
    memberLocationConverter
  );

export const memberLocationDoc = (teamId: string, userId: string) =>
  doc(memberLocationsCollection(teamId), userId);

export const teamProgressCollection = (
  challengeId: string
): CollectionReference<ChallengeTeamProgress> =>
  collection(challengeDoc(challengeId), "teamProgress").withConverter(
    challengeTeamProgressConverter
  );

export const teamProgressDoc = (challengeId: string, teamId: string) =>
  doc(teamProgressCollection(challengeId), teamId);
