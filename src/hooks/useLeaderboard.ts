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
  challengeId: string | null | undefined
): UseLeaderboardResult {
  const [snapshot, setSnapshot] = useState<{
    challengeId: string | null;
    data: ChallengeTeamProgress[];
    error: string | null;
  }>({
    challengeId: null,
    data: [],
    error: null,
  });

  useEffect(() => {
    if (!challengeId) {
      return;
    }

    const unsubscribe = subscribeToLeaderboard(
      challengeId,
      10,
      (leaderboardRows) => {
        setSnapshot({
          challengeId,
          data: leaderboardRows,
          error: null,
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [challengeId]);

  if (!challengeId) {
    return { data: [], loading: false, error: null };
  }

  const isResolvedForCurrentChallenge = snapshot.challengeId === challengeId;

  return {
    data: isResolvedForCurrentChallenge ? snapshot.data : [],
    loading: !isResolvedForCurrentChallenge,
    error: isResolvedForCurrentChallenge ? snapshot.error : null,
  };
}
