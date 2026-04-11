"use client";

import { useCallback, useEffect, useState } from "react";
import { limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { challengesCollection } from "@/lib/firebase/collections";
import { fetchChallengesFeed as fetchChallengesFeedFromApi } from "@/lib/firebase/realtimeApi";
import type { Challenge } from "@/types/firebase";

interface UseActiveChallengeResult {
  data: Challenge | null;
  loading: boolean;
  error: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Could not load active challenge.";
}

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

function selectActiveChallenge(
  challenges: Challenge[],
  eventId: string
): Challenge | null {
  const activeChallenges = challenges
    .filter(
      (challenge) =>
        challenge.eventId === eventId && challenge.status === "active"
    )
    .sort((left, right) => right.startTime.toMillis() - left.startTime.toMillis());

  return activeChallenges[0] ?? null;
}

export function useActiveChallenge(
  eventId: string | null | undefined
): UseActiveChallengeResult {
  const [snapshot, setSnapshot] = useState<{
    eventId: string | null;
    data: Challenge | null;
    error: string | null;
    resolved: boolean;
  }>({
    eventId: null,
    data: null,
    error: null,
    resolved: false,
  });

  const handleSnapshot = useCallback(
    (incomingSnapshot: { docs: Array<{ data: () => Challenge }> }) => {
      if (!eventId) {
        return;
      }

      const challengeDocSnapshot = incomingSnapshot.docs[0];
      setSnapshot({
        eventId,
        data: challengeDocSnapshot ? challengeDocSnapshot.data() : null,
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

      setSnapshot({
        eventId,
        data: null,
        error: getErrorMessage(snapshotError),
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
      let active = true;
      let inFlight = false;

      const tick = async () => {
        if (!active || inFlight) {
          return;
        }

        inFlight = true;

        try {
          const challenges = await fetchChallengesFeedFromApi(300);

          if (!active) {
            return;
          }

          setSnapshot({
            eventId,
            data: selectActiveChallenge(challenges, eventId),
            error: null,
            resolved: true,
          });
        } catch (error) {
          if (!active) {
            return;
          }

          setSnapshot({
            eventId,
            data: null,
            error: getErrorMessage(error),
            resolved: true,
          });
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

    const activeChallengeQuery = query(
      challengesCollection,
      where("eventId", "==", eventId),
      where("status", "==", "active"),
      orderBy("startTime", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      activeChallengeQuery,
      handleSnapshot,
      handleSnapshotError
    );

    return () => {
      unsubscribe();
    };
  }, [eventId, handleSnapshot, handleSnapshotError]);

  if (!eventId) {
    return { data: null, loading: false, error: null };
  }

  const isResolvedForCurrentEvent =
    snapshot.eventId === eventId && snapshot.resolved;

  return {
    data: isResolvedForCurrentEvent ? snapshot.data : null,
    loading: !isResolvedForCurrentEvent,
    error: isResolvedForCurrentEvent ? snapshot.error : null,
  };
}
