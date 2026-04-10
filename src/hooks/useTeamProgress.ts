"use client";

import { useEffect, useState } from "react";
import { subscribeToTeamProgress } from "@/lib/firebase/helpers";
import type { ChallengeTeamProgress } from "@/types/firebase";

interface UseTeamProgressResult {
  data: ChallengeTeamProgress | null;
  loading: boolean;
  error: string | null;
}

export function useTeamProgress(
  challengeId: string | null | undefined,
  teamId: string | null | undefined
): UseTeamProgressResult {
  const [snapshot, setSnapshot] = useState<{
    key: string | null;
    data: ChallengeTeamProgress | null;
    error: string | null;
  }>({
    key: null,
    data: null,
    error: null,
  });

  const key = challengeId && teamId ? `${challengeId}:${teamId}` : null;

  useEffect(() => {
    if (!challengeId || !teamId || !key) {
      return;
    }

    const unsubscribe = subscribeToTeamProgress(
      challengeId,
      teamId,
      (teamProgress) => {
        setSnapshot({
          key,
          data: teamProgress,
          error: null,
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [challengeId, key, teamId]);

  if (!key) {
    return { data: null, loading: false, error: null };
  }

  const isResolvedForCurrentRequest = snapshot.key === key;

  return {
    data: isResolvedForCurrentRequest ? snapshot.data : null,
    loading: !isResolvedForCurrentRequest,
    error: isResolvedForCurrentRequest ? snapshot.error : null,
  };
}
