"use client";

import { useCallback, useEffect, useState } from "react";
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

  const handleTeamProgressUpdate = useCallback(
    (teamProgress: ChallengeTeamProgress | null) => {
      if (!key) {
        return;
      }

      setSnapshot({
        key,
        data: teamProgress,
        error: null,
      });
    },
    [key]
  );

  useEffect(() => {
    if (!challengeId || !teamId || !key) {
      return;
    }

    const unsubscribe = subscribeToTeamProgress(
      challengeId,
      teamId,
      handleTeamProgressUpdate
    );

    return () => {
      unsubscribe();
    };
  }, [challengeId, handleTeamProgressUpdate, key, teamId]);

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
