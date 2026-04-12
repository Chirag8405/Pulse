"use client";

import { useCallback, useEffect, useState } from "react";
import { limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { eventsCollection } from "@/lib/firebase/collections";
import { fetchEventsFeed as fetchEventsFeedFromApi } from "@/lib/firebase/realtimeApi";
import { getErrorMessage } from "@/lib/shared/errorUtils";
import type { Event } from "@/types/firebase";

interface UseActiveEventResult {
  data: Event | null;
  loading: boolean;
  error: string | null;
}

/** @see getErrorMessage from @/lib/shared/errorUtils */
const getActiveEventErrorMessage = (error: unknown) =>
  getErrorMessage(error, "Could not load active event.");

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

function selectActiveEvent(events: Event[]): Event | null {
  const activeEvents = events
    .filter((event) => event.status === "live" || event.status === "halftime")
    .sort((left, right) => right.startTime.toMillis() - left.startTime.toMillis());

  return activeEvents[0] ?? null;
}

export function useActiveEvent(): UseActiveEventResult {
  const [data, setData] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSnapshot = useCallback((snapshot: { docs: Array<{ data: () => Event }> }) => {
    const eventDocSnapshot = snapshot.docs[0];
    setData(eventDocSnapshot ? eventDocSnapshot.data() : null);
    setLoading(false);
  }, []);

  const handleSnapshotError = useCallback((snapshotError: unknown) => {
    setError(getActiveEventErrorMessage(snapshotError));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!shouldUseRealtimeListeners) {
      let active = true;
      let inFlight = false;

      const tick = async () => {
        if (!active || inFlight) {
          return;
        }

        inFlight = true;

        try {
          const events = await fetchEventsFeedFromApi(120);

          if (!active) {
            return;
          }

          setData(selectActiveEvent(events));
          setError(null);
          setLoading(false);
        } catch (error) {
          if (!active) {
            return;
          }

          setError(getActiveEventErrorMessage(error));
          setLoading(false);
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

    const activeEventQuery = query(
      eventsCollection,
      where("status", "in", ["live", "halftime"]),
      orderBy("startTime", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      activeEventQuery,
      handleSnapshot,
      handleSnapshotError
    );

    return () => {
      unsubscribe();
    };
  }, [handleSnapshot, handleSnapshotError]);

  return { data, loading, error };
}
