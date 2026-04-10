"use client";

import dynamic from "next/dynamic";
import { Activity, CalendarCheck2, MapPinned, Users2 } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ZoneOccupancyPanel } from "@/components/admin/ZoneOccupancyPanel";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { StatCard } from "@/components/shared/StatCard";
import { ZONES } from "@/constants";
import { useActiveChallenge } from "@/hooks/useActiveChallenge";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import {
  useChallengesFeed,
  useEventsFeed,
  useZoneOccupancy,
} from "@/hooks/useAdminRealtime";
import type { Event } from "@/types/firebase";

const VenueHeatmap = dynamic(() => import("@/components/admin/VenueHeatmap"), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="admin" />,
});

function isToday(epochMillis: number): boolean {
  const targetDate = new Date(epochMillis);
  const now = new Date();

  return (
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate()
  );
}

function getEventAttendeeCount(event: Event): number {
  const withCount = event as Event & {
    attendeeCount?: number;
    totalAttendees?: number;
  };

  return withCount.attendeeCount ?? withCount.totalAttendees ?? 0;
}

function AdminOverviewContent() {
  const { data: events, loading: eventsLoading, error: eventsError } = useEventsFeed(60);
  const {
    data: challenges,
    loading: challengesLoading,
    error: challengesError,
  } = useChallengesFeed(200);
  const {
    data: occupancy,
    loading: occupancyLoading,
    error: occupancyError,
  } = useZoneOccupancy();

  const { data: activeEvent, error: activeEventError } = useActiveEvent();
  const {
    data: activeChallenge,
    error: activeChallengeError,
  } = useActiveChallenge(activeEvent?.id ?? null);

  const totalAttendeesFromEvents = events.reduce(
    (sum, event) => sum + getEventAttendeeCount(event),
    0
  );

  const totalAttendees =
    totalAttendeesFromEvents > 0
      ? totalAttendeesFromEvents
      : occupancy.totalActiveMembers;

  const activeInChallenge = activeChallenge?.participatingTeamIds.length ?? 0;

  const mostOccupiedZone = ZONES.map((zone) => ({
    zone,
    count: occupancy.byZone[zone.id] ?? 0,
  })).sort((left, right) => right.count - left.count)[0];

  const completedChallengesToday = challenges.filter(
    (challenge) => challenge.status === "completed" && isToday(challenge.endTime.toMillis())
  ).length;

  const combinedError =
    eventsError ??
    challengesError ??
    occupancyError ??
    activeEventError ??
    activeChallengeError;

  if (eventsLoading || challengesLoading || occupancyLoading) {
    return <LoadingSkeleton variant="admin" />;
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Venue Operations Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live venue state and challenge readiness at a glance.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Attendees"
          value={totalAttendees}
          icon={Users2}
          description="Realtime aggregation from event feed"
        />
        <StatCard
          label="Active in Challenge"
          value={activeInChallenge}
          icon={Activity}
          description="Participating teams in current challenge"
        />
        <StatCard
          label="Current Active Zone"
          value={mostOccupiedZone?.zone.name ?? "No occupancy"}
          icon={MapPinned}
          description="Most occupied zone right now"
        />
        <StatCard
          label="Challenges Today"
          value={completedChallengesToday}
          icon={CalendarCheck2}
          description="Completed challenge count today"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <VenueHeatmap countsByZone={occupancy.byZone} />
        <ZoneOccupancyPanel countsByZone={occupancy.byZone} />
      </div>

      {combinedError ? (
        <p className="nb-card border-destructive bg-card p-3 font-mono text-xs text-destructive">
          {combinedError}
        </p>
      ) : null}
    </section>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminOverviewContent />
    </AuthGuard>
  );
}
