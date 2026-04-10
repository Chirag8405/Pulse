"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collectionGroup,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { ZONES } from "@/constants";
import {
  challengesCollection,
  eventsCollection,
  teamsCollection,
} from "@/lib/firebase/collections";
import { db } from "@/lib/firebase/config";
import type { Challenge, Event, Team } from "@/types/firebase";

interface FeedResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface ResolvedState<T> {
  data: T;
  error: string | null;
  resolved: boolean;
}

interface KeyedResolvedState<T> {
  key: string | null;
  data: T;
  error: string | null;
  resolved: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load realtime data.";
}

function buildEmptyZoneCounts(): Record<string, number> {
  return ZONES.reduce<Record<string, number>>((acc, zone) => {
    acc[zone.id] = 0;
    return acc;
  }, {});
}

const EMPTY_ZONE_COUNTS = buildEmptyZoneCounts();

export interface ZoneOccupancyData {
  byZone: Record<string, number>;
  totalActiveMembers: number;
  updatedAtMillis: number;
}

export function useEventsFeed(feedLimit = 30): FeedResult<Event[]> {
  const [state, setState] = useState<ResolvedState<Event[]>>({
    data: [],
    error: null,
    resolved: false,
  });

  useEffect(() => {
    const eventsQuery = query(
      eventsCollection,
      orderBy("startTime", "desc"),
      limit(Math.max(1, Math.floor(feedLimit)))
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        setState({
          data: snapshot.docs.map((docSnapshot) => docSnapshot.data()),
          error: null,
          resolved: true,
        });
      },
      (snapshotError) => {
        setState({
          data: [],
          error: getErrorMessage(snapshotError),
          resolved: true,
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [feedLimit]);

  return {
    data: state.data,
    loading: !state.resolved,
    error: state.error,
  };
}

export function useChallengesFeed(feedLimit = 100): FeedResult<Challenge[]> {
  const [state, setState] = useState<ResolvedState<Challenge[]>>({
    data: [],
    error: null,
    resolved: false,
  });

  useEffect(() => {
    const challengesQuery = query(
      challengesCollection,
      orderBy("startTime", "desc"),
      limit(Math.max(1, Math.floor(feedLimit)))
    );

    const unsubscribe = onSnapshot(
      challengesQuery,
      (snapshot) => {
        setState({
          data: snapshot.docs.map((docSnapshot) => docSnapshot.data()),
          error: null,
          resolved: true,
        });
      },
      (snapshotError) => {
        setState({
          data: [],
          error: getErrorMessage(snapshotError),
          resolved: true,
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [feedLimit]);

  return {
    data: state.data,
    loading: !state.resolved,
    error: state.error,
  };
}

export function useTeamsByEvent(
  eventId: string | null | undefined
): FeedResult<Team[]> {
  const [state, setState] = useState<KeyedResolvedState<Team[]>>({
    key: null,
    data: [],
    error: null,
    resolved: false,
  });

  useEffect(() => {
    if (!eventId) {
      return;
    }

    const teamsByEventQuery = query(teamsCollection, where("eventId", "==", eventId));

    const unsubscribe = onSnapshot(
      teamsByEventQuery,
      (snapshot) => {
        setState({
          key: eventId,
          data: snapshot.docs.map((docSnapshot) => docSnapshot.data()),
          error: null,
          resolved: true,
        });
      },
      (snapshotError) => {
        setState({
          key: eventId,
          data: [],
          error: getErrorMessage(snapshotError),
          resolved: true,
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [eventId]);

  if (!eventId) {
    return { data: [], loading: false, error: null };
  }

  const isResolved = state.key === eventId && state.resolved;

  return {
    data: isResolved ? state.data : [],
    loading: !isResolved,
    error: isResolved ? state.error : null,
  };
}

export function useZoneOccupancy(): FeedResult<ZoneOccupancyData> {
  const [state, setState] = useState<ResolvedState<ZoneOccupancyData>>({
    data: {
      byZone: EMPTY_ZONE_COUNTS,
      totalActiveMembers: 0,
      updatedAtMillis: 0,
    },
    error: null,
    resolved: false,
  });

  useEffect(() => {
    const occupancyQuery = query(
      collectionGroup(db, "memberLocations"),
      where("isActive", "==", true)
    );

    const unsubscribe = onSnapshot(
      occupancyQuery,
      (snapshot) => {
        const nextZoneCounts = buildEmptyZoneCounts();

        snapshot.docs.forEach((docSnapshot) => {
          const location = docSnapshot.data() as { zoneId?: string };
          const zoneId = location.zoneId;

          if (!zoneId || !Object.hasOwn(nextZoneCounts, zoneId)) {
            return;
          }

          nextZoneCounts[zoneId] = (nextZoneCounts[zoneId] ?? 0) + 1;
        });

        const totalActiveMembers = Object.values(nextZoneCounts).reduce(
          (sum, count) => sum + count,
          0
        );

        setState({
          data: {
            byZone: nextZoneCounts,
            totalActiveMembers,
            updatedAtMillis: Date.now(),
          },
          error: null,
          resolved: true,
        });
      },
      (snapshotError) => {
        setState((currentState) => ({
          data: currentState.data,
          error: getErrorMessage(snapshotError),
          resolved: true,
        }));
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const stableData = useMemo(() => state.data, [state.data]);

  return {
    data: stableData,
    loading: !state.resolved,
    error: state.error,
  };
}
