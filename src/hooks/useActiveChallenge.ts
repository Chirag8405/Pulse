"use client";

import { useEffect, useState } from "react";
import { limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { challengesCollection } from "@/lib/firebase/collections";
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

export function useActiveChallenge(
  eventId: string | null | undefined
): UseActiveChallengeResult {
  const [snapshot, setSnapshot] = useState<{
    eventId: string | null;
    data: Challenge | null;
    error: string | null;
  }>({
    eventId: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!eventId) {
      return;
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
      (snapshot) => {
        const challengeDocSnapshot = snapshot.docs[0];
        setSnapshot({
          eventId,
          data: challengeDocSnapshot ? challengeDocSnapshot.data() : null,
          error: null,
        });
      },
      (snapshotError) => {
        setSnapshot({
          eventId,
          data: null,
          error: getErrorMessage(snapshotError),
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [eventId]);

  if (!eventId) {
    return { data: null, loading: false, error: null };
  }

  const isResolvedForCurrentEvent = snapshot.eventId === eventId;

  return {
    data: isResolvedForCurrentEvent ? snapshot.data : null,
    loading: !isResolvedForCurrentEvent,
    error: isResolvedForCurrentEvent ? snapshot.error : null,
  };
}
