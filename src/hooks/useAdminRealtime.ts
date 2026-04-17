"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import {
  fetchChallengesFeed as fetchChallengesFeedFromApi,
  fetchEventsFeed as fetchEventsFeedFromApi,
  fetchTeamsByEvent as fetchTeamsByEventFromApi,
  fetchZoneOccupancy as fetchZoneOccupancyFromApi,
} from "@/lib/firebase/realtimeApi";
import { getErrorMessage } from "@/lib/shared/errorUtils";
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

const getRealtimeErrorMessage = (error: unknown) =>
  getErrorMessage(error, "Failed to load realtime data.");

function buildEmptyZoneCounts(): Record<string, number> {
  return ZONES.reduce<Record<string, number>>((acc, zone) => {
    acc[zone.id] = 0;
    return acc;
  }, {});
}

const EMPTY_ZONE_COUNTS = buildEmptyZoneCounts();

const shouldUseRealtimeListeners =
  typeof window !== "undefined" &&
  (process.env.NEXT_PUBLIC_ENABLE_FIRESTORE_REALTIME_LISTENERS === "true" ||
    process.env.NODE_ENV === "production");

const configuredPollIntervalMs = Number.parseInt(
  process.env.NEXT_PUBLIC_FIRESTORE_POLL_INTERVAL_MS ?? "5000",
  10
);

const firestorePollIntervalMs =
  Number.isFinite(configuredPollIntervalMs) && configuredPollIntervalMs >= 1_000
    ? configuredPollIntervalMs
    : 5_000;

function safeUnsubscribe(unsubscribe: () => void, source: string): void {
  try {
    unsubscribe();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[useAdminRealtime] unsubscribe failed (${source})`, error);
    }
  }
}

function startPolling(
  source: string,
  run: () => Promise<void>
): () => void {
  let active = true;
  let inFlight = false;

  const tick = async () => {
    if (!active || inFlight) {
      return;
    }

    inFlight = true;

    try {
      await run();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[useAdminRealtime] polling tick failed (${source})`, error);
      }
    } finally {
      inFlight = false;
    }
  };

  void tick();

  const intervalId = window.setInterval(() => {
    void tick();
  }, firestorePollIntervalMs);

  return () => {
    active = false;
    window.clearInterval(intervalId);
  };
}

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

  const handleSnapshot = useCallback(
    (snapshot: { docs: Array<{ data: () => Event }> }) => {
      setState({
        data: snapshot.docs.map((docSnapshot) => docSnapshot.data()),
        error: null,
        resolved: true,
      });
    },
    []
  );

  const handleSnapshotError = useCallback((snapshotError: unknown) => {
    setState({
      data: [],
      error: getRealtimeErrorMessage(snapshotError),
      resolved: true,
    });
  }, []);

  useEffect(() => {
    if (!shouldUseRealtimeListeners) {
      return startPolling("useEventsFeed", async () => {
        try {
          const events = await fetchEventsFeedFromApi(
            Math.max(1, Math.floor(feedLimit))
          );

          setState({
            data: events,
            error: null,
            resolved: true,
          });
        } catch (error) {
          setState({
            data: [],
            error: getRealtimeErrorMessage(error),
            resolved: true,
          });
        }
      });
    }

    const eventsQuery = query(
      eventsCollection,
      orderBy("startTime", "desc"),
      limit(Math.max(1, Math.floor(feedLimit)))
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      handleSnapshot,
      handleSnapshotError
    );

    return () => {
      safeUnsubscribe(unsubscribe, "useEventsFeed");
    };
  }, [feedLimit, handleSnapshot, handleSnapshotError]);

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

  const handleSnapshot = useCallback(
    (snapshot: { docs: Array<{ data: () => Challenge }> }) => {
      setState({
        data: snapshot.docs.map((docSnapshot) => docSnapshot.data()),
        error: null,
        resolved: true,
      });
    },
    []
  );

  const handleSnapshotError = useCallback((snapshotError: unknown) => {
    setState({
      data: [],
      error: getRealtimeErrorMessage(snapshotError),
      resolved: true,
    });
  }, []);

  useEffect(() => {
    if (!shouldUseRealtimeListeners) {
      return startPolling("useChallengesFeed", async () => {
        try {
          const challenges = await fetchChallengesFeedFromApi(
            Math.max(1, Math.floor(feedLimit))
          );

          setState({
            data: challenges,
            error: null,
            resolved: true,
          });
        } catch (error) {
          setState({
            data: [],
            error: getRealtimeErrorMessage(error),
            resolved: true,
          });
        }
      });
    }

    const challengesQuery = query(
      challengesCollection,
      orderBy("startTime", "desc"),
      limit(Math.max(1, Math.floor(feedLimit)))
    );

    const unsubscribe = onSnapshot(
      challengesQuery,
      handleSnapshot,
      handleSnapshotError
    );

    return () => {
      safeUnsubscribe(unsubscribe, "useChallengesFeed");
    };
  }, [feedLimit, handleSnapshot, handleSnapshotError]);

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

  const handleSnapshot = useCallback(
    (snapshot: { docs: Array<{ data: () => Team }> }) => {
      if (!eventId) {
        return;
      }

      setState({
        key: eventId,
        data: snapshot.docs.map((docSnapshot) => docSnapshot.data()),
        error: null,
        resolved: true,
      });
    },
    [eventId]
  );

  const handleSnapshotError = useCallback(
    (snapshotError: unknown) => {
      if (!eventId) {
        return;
      }

      setState({
        key: eventId,
        data: [],
        error: getRealtimeErrorMessage(snapshotError),
        resolved: true,
      });
    },
    [eventId]
  );

  useEffect(() => {
    if (!eventId) {
      return;
    }

    if (!shouldUseRealtimeListeners) {
      return startPolling("useTeamsByEvent", async () => {
        try {
          const teams = await fetchTeamsByEventFromApi(eventId);

          setState({
            key: eventId,
            data: teams,
            error: null,
            resolved: true,
          });
        } catch (error) {
          setState({
            key: eventId,
            data: [],
            error: getRealtimeErrorMessage(error),
            resolved: true,
          });
        }
      });
    }

    const teamsByEventQuery = query(teamsCollection, where("eventId", "==", eventId));

    const unsubscribe = onSnapshot(
      teamsByEventQuery,
      handleSnapshot,
      handleSnapshotError
    );

    return () => {
      safeUnsubscribe(unsubscribe, "useTeamsByEvent");
    };
  }, [eventId, handleSnapshot, handleSnapshotError]);

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
    return startPolling("useZoneOccupancy", async () => {
      try {
        const occupancy = await fetchZoneOccupancyFromApi();

        setState({
          data: {
            byZone: occupancy.byZone,
            totalActiveMembers: occupancy.totalActiveMembers,
            updatedAtMillis: occupancy.updatedAtMillis,
          },
          error: null,
          resolved: true,
        });
      } catch (error) {
        setState((currentState) => ({
          data: currentState.data,
          error: getRealtimeErrorMessage(error),
          resolved: true,
        }));
      }
    });
  }, []);

  const stableData = useMemo(() => state.data, [state.data]);

  return {
    data: stableData,
    loading: !state.resolved,
    error: state.error,
  };
}
