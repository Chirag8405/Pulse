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
  const [data, setData] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

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
        setData(challengeDocSnapshot ? challengeDocSnapshot.data() : null);
        setLoading(false);
      },
      (snapshotError) => {
        setError(getErrorMessage(snapshotError));
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [eventId]);

  return { data, loading, error };
}
