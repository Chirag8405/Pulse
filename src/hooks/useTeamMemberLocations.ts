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
  const [snapshot, setSnapshot] = useState<{
    teamId: string | null;
    data: TeamMemberLocationData;
    error: string | null;
  }>({
    teamId: null,
    data: INITIAL_DATA,
    error: null,
  });

  useEffect(() => {
    if (!teamId) {
      return;
    }

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

        setSnapshot({
          teamId,
          data: {
            byZone,
            locations: activeLocations,
            totalActiveMembers: activeLocations.length,
          },
          error: null,
        });
      },
      (snapshotError) => {
        setSnapshot({
          teamId,
          data: INITIAL_DATA,
          error: getErrorMessage(snapshotError),
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [teamId]);

  if (!teamId) {
    return { data: INITIAL_DATA, loading: false, error: null };
  }

  const isResolvedForCurrentTeam = snapshot.teamId === teamId;

  return {
    data: isResolvedForCurrentTeam ? snapshot.data : INITIAL_DATA,
    loading: !isResolvedForCurrentTeam,
    error: isResolvedForCurrentTeam ? snapshot.error : null,
  };
}
