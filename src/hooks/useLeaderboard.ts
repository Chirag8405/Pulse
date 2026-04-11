"use client";

import { useCallback, useEffect, useState } from "react";
import { limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { teamProgressCollection } from "@/lib/firebase/collections";
import { fetchChallengeTeamProgress as fetchChallengeTeamProgressFromApi } from "@/lib/firebase/realtimeApi";
import type { ChallengeTeamProgress } from "@/types/firebase";

interface UseLeaderboardResult {
  data: ChallengeTeamProgress[];
  loading: boolean;
  error: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Could not load leaderboard.";
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

function sortLeaderboardRows(
  rows: ChallengeTeamProgress[],
  leaderboardLimit: number
): ChallengeTeamProgress[] {
  const safeLimit = Math.max(1, Math.floor(leaderboardLimit));

  return [...rows]
    .sort((left, right) => {
      if (left.spreadScore !== right.spreadScore) {
        return right.spreadScore - left.spreadScore;
      }

      const leftCompletedAt = left.completedAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      const rightCompletedAt = right.completedAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;

      return leftCompletedAt - rightCompletedAt;
    })
    .slice(0, safeLimit);
}

export function useLeaderboard(
  challengeId: string | null | undefined,
  leaderboardLimit = 10
): UseLeaderboardResult {
  const [snapshot, setSnapshot] = useState<{
    key: string | null;
    data: ChallengeTeamProgress[];
    error: string | null;
    resolved: boolean;
  }>({
    key: null,
    data: [],
    error: null,
    resolved: false,
  });

  const key = challengeId
    ? `${challengeId}:${Math.max(1, Math.floor(leaderboardLimit))}`
    : null;

  const handleLeaderboardUpdate = useCallback(
    (leaderboardRows: ChallengeTeamProgress[]) => {
      if (!key) {
        return;
      }

      setSnapshot({
        key,
        data: sortLeaderboardRows(leaderboardRows, leaderboardLimit),
        error: null,
        resolved: true,
      });
    },
    [key, leaderboardLimit]
  );

  useEffect(() => {
    if (!challengeId || !key) {
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
          const rows = await fetchChallengeTeamProgressFromApi(challengeId);

          if (!active) {
            return;
          }

          handleLeaderboardUpdate(rows);
        } catch (error) {
          if (!active) {
            return;
          }

          setSnapshot({
            key,
            data: [],
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

    const safeLimit = Math.max(1, Math.floor(leaderboardLimit));
    const leaderboardQuery = query(
      teamProgressCollection(challengeId),
      orderBy("spreadScore", "desc"),
      orderBy("completedAt", "asc"),
      limit(safeLimit)
    );

    const unsubscribe = onSnapshot(
      leaderboardQuery,
      (incomingSnapshot) => {
        handleLeaderboardUpdate(
          incomingSnapshot.docs.map((docSnapshot) => docSnapshot.data())
        );
      },
      (snapshotError) => {
        setSnapshot({
          key,
          data: [],
          error: getErrorMessage(snapshotError),
          resolved: true,
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [challengeId, handleLeaderboardUpdate, key, leaderboardLimit]);

  if (!challengeId) {
    return { data: [], loading: false, error: null };
  }

  const isResolvedForCurrentChallenge =
    snapshot.key === key && snapshot.resolved;

  return {
    data: isResolvedForCurrentChallenge ? snapshot.data : [],
    loading: !isResolvedForCurrentChallenge,
    error: isResolvedForCurrentChallenge ? snapshot.error : null,
  };
}
