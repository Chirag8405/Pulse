"use client";

import { useEffect, useState } from "react";
import { subscribeToLeaderboard } from "@/lib/firebase/helpers";
import type { ChallengeTeamProgress } from "@/types/firebase";

interface UseLeaderboardResult {
  data: ChallengeTeamProgress[];
  loading: boolean;
  error: string | null;
}

export function useLeaderboard(
  challengeId: string | null | undefined,
  leaderboardLimit = 10
): UseLeaderboardResult {
  const [snapshot, setSnapshot] = useState<{
    key: string | null;
    data: ChallengeTeamProgress[];
    error: string | null;
  }>({
    key: null,
    data: [],
    error: null,
  });

  const key = challengeId
    ? `${challengeId}:${Math.max(1, Math.floor(leaderboardLimit))}`
    : null;

  useEffect(() => {
    if (!challengeId || !key) {
      return;
    }

    const unsubscribe = subscribeToLeaderboard(
      challengeId,
      Math.max(1, Math.floor(leaderboardLimit)),
      (leaderboardRows) => {
        setSnapshot({
          key,
          data: leaderboardRows,
          error: null,
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [challengeId, key, leaderboardLimit]);

  if (!challengeId) {
    return { data: [], loading: false, error: null };
  }

  const isResolvedForCurrentChallenge = snapshot.key === key;

  return {
    data: isResolvedForCurrentChallenge ? snapshot.data : [],
    loading: !isResolvedForCurrentChallenge,
    error: isResolvedForCurrentChallenge ? snapshot.error : null,
  };
}
