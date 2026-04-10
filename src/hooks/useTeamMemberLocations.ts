"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { memberLocationsCollection } from "@/lib/firebase/collections";
import type { MemberLocation } from "@/types/firebase";

interface TeamMemberLocationData {
  byZone: Record<string, number>;
  locations: MemberLocation[];
  totalActiveMembers: number;
}

interface UseTeamMemberLocationsResult {
  data: TeamMemberLocationData;
  loading: boolean;
  error: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Could not load team member locations.";
}

const INITIAL_DATA: TeamMemberLocationData = {
  byZone: {},
  locations: [],
  totalActiveMembers: 0,
};

export function useTeamMemberLocations(
  teamId: string | null | undefined
): UseTeamMemberLocationsResult {
  const [data, setData] = useState<TeamMemberLocationData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) {
      setData(INITIAL_DATA);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memberLocationsCollection(teamId),
      (snapshot) => {
        const locationDocs = snapshot.docs.map((docSnapshot) => docSnapshot.data());
        const activeLocations = locationDocs.filter((location) => location.isActive);

        const byZone = activeLocations.reduce<Record<string, number>>((acc, location) => {
          const currentCount = acc[location.zoneId] ?? 0;
          acc[location.zoneId] = currentCount + 1;
          return acc;
        }, {});

        setData({
          byZone,
          locations: activeLocations,
          totalActiveMembers: activeLocations.length,
        });
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
  }, [teamId]);

  return { data, loading, error };
}
