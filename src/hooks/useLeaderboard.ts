"use client";

import { useEffect, useState } from "react";
import { subscribeToLeaderboard } from "@/lib/firebase/helpers";
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

export function useLeaderboard(
  challengeId: string | null | undefined
): UseLeaderboardResult {
  const [data, setData] = useState<ChallengeTeamProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = subscribeToLeaderboard(
        challengeId,
        10,
        (leaderboardRows) => {
          setData(leaderboardRows);
          setLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (subscriptionError) {
      setError(getErrorMessage(subscriptionError));
      setLoading(false);
      return;
    }
  }, [challengeId]);

  return { data, loading, error };
}
