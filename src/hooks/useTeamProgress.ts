"use client";

import { useEffect, useState } from "react";
import { subscribeToTeamProgress } from "@/lib/firebase/helpers";
import type { ChallengeTeamProgress } from "@/types/firebase";

interface UseTeamProgressResult {
  data: ChallengeTeamProgress | null;
  loading: boolean;
  error: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Could not load team progress.";
}

export function useTeamProgress(
  challengeId: string | null | undefined,
  teamId: string | null | undefined
): UseTeamProgressResult {
  const [data, setData] = useState<ChallengeTeamProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId || !teamId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = subscribeToTeamProgress(
        challengeId,
        teamId,
        (teamProgress) => {
          setData(teamProgress);
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
  }, [challengeId, teamId]);

  return { data, loading, error };
}
