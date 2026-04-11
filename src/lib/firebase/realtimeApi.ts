"use client";

import { Timestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase/config";
import type {
  Challenge,
  ChallengeTeamProgress,
  Event,
  Team,
} from "@/types/firebase";

type RealtimeResource =
  | "events"
  | "challenges"
  | "teamsByEvent"
  | "zoneOccupancy"
  | "challengeTeamProgress";

interface RealtimeApiEnvelope<T> {
  data: T;
}

interface RealtimeApiErrorPayload {
  error?: string;
  details?: string;
}

interface SerializedEvent {
  id: string;
  title?: string | null;
  venueName: string;
  venueCity: string;
  homeTeam: string;
  awayTeam: string;
  startTimeMillis: number;
  status: Event["status"];
  currentChallengeId: string | null;
  matchDay: string;
  attendeeCount?: number;
  totalAttendees?: number;
}

interface SerializedChallenge {
  id: string;
  eventId: string;
  title: string;
  description: string;
  targetSpreadPercentage: number;
  targetZoneCount: number;
  durationMinutes: number;
  startTimeMillis: number;
  endTimeMillis: number;
  status: Challenge["status"];
  reward: {
    type: string;
    description: string;
    unlockedAtMillis: number | null;
  };
  participatingTeamIds: string[];
}

interface SerializedTeam {
  id: string;
  name: string;
  colorHex: string;
  emoji: string;
  venueId: string;
  eventId: string;
  memberIds: string[];
  currentSpreadScore: number;
  lastCalculatedAtMillis: number;
  totalChallengesWon: number;
  sectionIds: string[];
}

interface ZoneOccupancyPayload {
  byZone: Record<string, number>;
  totalActiveMembers: number;
  updatedAtMillis: number;
}

interface SerializedTeamProgress {
  teamId: string;
  challengeId: string;
  spreadScore: number;
  activeZones: string[];
  completedAtMillis: number | null;
  isCompleted: boolean;
  memberCount: number;
}

function toSafeMillis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return 0;
}

function toTimestamp(value: unknown): Timestamp {
  return Timestamp.fromMillis(toSafeMillis(value));
}

async function getAuthBearerToken(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Realtime API can only be called from the browser.");
  }

  const currentUser = auth?.currentUser;

  if (!currentUser) {
    throw new Error("Authentication is required.");
  }

  return currentUser.getIdToken();
}

async function fetchRealtimeResource<T>(
  resource: RealtimeResource,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const token = await getAuthBearerToken();
  const endpoint = new URL("/api/realtime", window.location.origin);

  endpoint.searchParams.set("resource", resource);

  Object.entries(params).forEach(([key, value]) => {
    if (value == null) {
      return;
    }

    endpoint.searchParams.set(key, String(value));
  });

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | RealtimeApiEnvelope<T>
    | RealtimeApiErrorPayload
    | null;

  if (!response.ok) {
    const message = payload && "error" in payload ? payload.error : null;
    const details = payload && "details" in payload ? payload.details : null;

    if (message && details) {
      throw new Error(`${message}: ${details}`);
    }

    throw new Error(message ?? details ?? `Failed to load ${resource}.`);
  }

  if (!payload || !("data" in payload)) {
    throw new Error(`Invalid response while loading ${resource}.`);
  }

  return payload.data;
}

function deserializeEvent(event: SerializedEvent): Event {
  return {
    id: event.id,
    title: event.title ?? undefined,
    venueName: event.venueName,
    venueCity: event.venueCity,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    startTime: toTimestamp(event.startTimeMillis),
    status: event.status,
    currentChallengeId: event.currentChallengeId,
    matchDay: event.matchDay,
    attendeeCount: event.attendeeCount,
    totalAttendees: event.totalAttendees,
  } as Event;
}

function deserializeChallenge(challenge: SerializedChallenge): Challenge {
  return {
    id: challenge.id,
    eventId: challenge.eventId,
    title: challenge.title,
    description: challenge.description,
    targetSpreadPercentage: challenge.targetSpreadPercentage,
    targetZoneCount: challenge.targetZoneCount,
    durationMinutes: challenge.durationMinutes,
    startTime: toTimestamp(challenge.startTimeMillis),
    endTime: toTimestamp(challenge.endTimeMillis),
    status: challenge.status,
    reward: {
      type: challenge.reward.type,
      description: challenge.reward.description,
      unlockedAt:
        challenge.reward.unlockedAtMillis == null
          ? null
          : toTimestamp(challenge.reward.unlockedAtMillis),
    },
    participatingTeamIds: Array.isArray(challenge.participatingTeamIds)
      ? challenge.participatingTeamIds
      : [],
  };
}

function deserializeTeam(team: SerializedTeam): Team {
  return {
    id: team.id,
    name: team.name,
    colorHex: team.colorHex,
    emoji: team.emoji,
    venueId: team.venueId,
    eventId: team.eventId,
    memberIds: Array.isArray(team.memberIds) ? team.memberIds : [],
    currentSpreadScore: team.currentSpreadScore,
    lastCalculatedAt: toTimestamp(team.lastCalculatedAtMillis),
    totalChallengesWon: team.totalChallengesWon,
    sectionIds: Array.isArray(team.sectionIds) ? team.sectionIds : [],
  };
}

function deserializeTeamProgress(
  progress: SerializedTeamProgress
): ChallengeTeamProgress {
  return {
    teamId: progress.teamId,
    challengeId: progress.challengeId,
    spreadScore: progress.spreadScore,
    activeZones: Array.isArray(progress.activeZones) ? progress.activeZones : [],
    completedAt:
      progress.completedAtMillis == null
        ? null
        : toTimestamp(progress.completedAtMillis),
    isCompleted: progress.isCompleted,
    memberCount: progress.memberCount,
  };
}

export async function fetchEventsFeed(limit: number): Promise<Event[]> {
  const payload = await fetchRealtimeResource<SerializedEvent[]>("events", {
    limit,
  });

  return payload.map(deserializeEvent);
}

export async function fetchChallengesFeed(limit: number): Promise<Challenge[]> {
  const payload = await fetchRealtimeResource<SerializedChallenge[]>("challenges", {
    limit,
  });

  return payload.map(deserializeChallenge);
}

export async function fetchTeamsByEvent(eventId: string): Promise<Team[]> {
  const payload = await fetchRealtimeResource<SerializedTeam[]>("teamsByEvent", {
    eventId,
  });

  return payload.map(deserializeTeam);
}

export async function fetchZoneOccupancy(): Promise<ZoneOccupancyPayload> {
  return fetchRealtimeResource<ZoneOccupancyPayload>("zoneOccupancy");
}

export async function fetchChallengeTeamProgress(
  challengeId: string
): Promise<ChallengeTeamProgress[]> {
  const payload = await fetchRealtimeResource<SerializedTeamProgress[]>(
    "challengeTeamProgress",
    {
      challengeId,
    }
  );

  return payload.map(deserializeTeamProgress);
}
