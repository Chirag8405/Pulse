"use client";

import { useEffect, useState } from "react";
import { limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { eventsCollection } from "@/lib/firebase/collections";
import type { Event } from "@/types/firebase";

interface UseActiveEventResult {
  data: Event | null;
  loading: boolean;
  error: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Could not load active event.";
}

export function useActiveEvent(): UseActiveEventResult {
  const [data, setData] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const activeEventQuery = query(
      eventsCollection,
      where("status", "in", ["live", "halftime"]),
      orderBy("startTime", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      activeEventQuery,
      (snapshot) => {
        const eventDocSnapshot = snapshot.docs[0];
        setData(eventDocSnapshot ? eventDocSnapshot.data() : null);
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
  }, []);

  return { data, loading, error };
}
