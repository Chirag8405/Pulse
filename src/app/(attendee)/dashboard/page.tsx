"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation, ShieldAlert } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { EventStatusBar } from "@/components/attendee/EventStatusBar";
import { SpreadHistoryChart } from "@/components/attendee/SpreadHistoryChart";
import { ActiveChallengeCard } from "@/components/attendee/ActiveChallengeCard";
import { BestMoveCard } from "@/components/attendee/BestMoveCard";
import { ZoneMap } from "@/components/attendee/ZoneMap";
import { LeaderboardMini } from "@/components/attendee/LeaderboardMini";
import { RewardNotification } from "@/components/attendee/RewardNotification";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ZoneCard } from "@/components/shared/ZoneCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TEAM_MAPPINGS } from "@/constants/teams";
import { ZONES } from "@/constants";
import { getBestMoveForAttendee, recommendChallengeParams } from "@/lib/recommender/challengeRecommender";
import { getTeamById } from "@/lib/firebase/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { useActiveChallenge } from "@/hooks/useActiveChallenge";
import { useTeamProgress } from "@/hooks/useTeamProgress";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useTeamMemberLocations } from "@/hooks/useTeamMemberLocations";
import { useLocationTracking } from "@/hooks/useLocationTracking";

function TeamInfoCard({
  teamName,
  totalPoints,
  spreadHistory,
}: {
  teamName: string;
  totalPoints: number;
  spreadHistory: number[];
}) {
  return (
    <section className="nb-card mx-auto mt-5 max-w-3xl bg-card p-5">
      <h2 className="text-xl font-black tracking-tight">{teamName}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Spread Score History
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {spreadHistory.map((score, index) => (
              <span
                key={`${score}-${index}`}
                className="inline-flex border-2 border-border bg-muted px-2 py-1 font-mono text-xs font-bold"
              >
                C{index + 1}: {score}%
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Total Points
          </p>
          <p className="mt-2 text-4xl font-black">{totalPoints}</p>
        </div>
      </div>
    </section>
  );
}

function DashboardContent() {
  const { firestoreUser, loading: authLoading } = useAuth();

  const teamId = firestoreUser?.teamId ?? null;
  const { data: teamDoc } = useQuery({
    queryKey: ["team-dashboard", teamId],
    queryFn: () => getTeamById(teamId as string),
    enabled: Boolean(teamId),
    staleTime: 60_000,
  });

  const { data: activeEvent, loading: activeEventLoading, error: activeEventError } =
    useActiveEvent();
  const {
    data: activeChallenge,
    loading: activeChallengeLoading,
    error: activeChallengeError,
  } = useActiveChallenge(activeEvent?.id ?? null);
  const { data: teamProgress, error: teamProgressError } = useTeamProgress(
    activeChallenge?.id,
    teamId
  );
  const { data: leaderboardRows, error: leaderboardError } = useLeaderboard(
    activeChallenge?.id
  );
  const { data: teamMemberLocations, error: teamMemberLocationsError } =
    useTeamMemberLocations(teamId);

  const locationTracking = useLocationTracking({
    userId: firestoreUser?.uid,
    teamId,
  });

  const [rewardOpen, setRewardOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const fallbackTeamName = useMemo(() => {
    const mappedTeam = TEAM_MAPPINGS.find((team) => team.id === teamId);
    return mappedTeam?.name ?? TEAM_MAPPINGS[0]?.name ?? "Unassigned Team";
  }, [teamId]);

  const spreadHistory = useMemo(() => {
    const baseScore = Math.round(teamDoc?.currentSpreadScore ?? 64);
    return [
      Math.max(10, baseScore - 14),
      Math.max(10, baseScore - 9),
      Math.max(10, baseScore - 4),
      Math.max(10, baseScore - 2),
      Math.max(10, baseScore),
    ];
  }, [teamDoc?.currentSpreadScore]);

  const occupancyByZone = useMemo(() => {
    return ZONES.reduce<Record<string, number>>((acc, zone) => {
      acc[zone.id] = teamMemberLocations.byZone[zone.id] ?? 0;
      return acc;
    }, {});
  }, [teamMemberLocations.byZone]);

  const eventMinutesElapsed = useMemo(() => {
    if (!activeEvent) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor((clockNow - activeEvent.startTime.toMillis()) / 60_000)
    );
  }, [activeEvent, clockNow]);

  const recommendation = useMemo(() => {
    if (!activeChallenge) {
      return null;
    }

    return recommendChallengeParams({
      currentOccupancy: occupancyByZone,
      eventMinutesElapsed,
      historicalSpreadScores: spreadHistory,
      teamCount: Math.max(1, leaderboardRows.length),
    });
  }, [
    activeChallenge,
    eventMinutesElapsed,
    leaderboardRows.length,
    occupancyByZone,
    spreadHistory,
  ]);

  const targetZoneIds = useMemo(() => {
    if (!activeChallenge) {
      return [];
    }

    if (recommendation) {
      return recommendation.suggestedTargetZones.slice(
        0,
        activeChallenge.targetZoneCount
      );
    }

    return ZONES.slice(0, activeChallenge.targetZoneCount).map((zone) => zone.id);
  }, [activeChallenge, recommendation]);

  const currentZoneId =
    locationTracking.data.currentZoneId ?? targetZoneIds[0] ?? ZONES[0].id;

  const bestMove = useMemo(() => {
    if (targetZoneIds.length === 0) {
      return {
        suggestedZoneId: currentZoneId,
        reason: "You are in a great spot! Stay here.",
      };
    }

    return getBestMoveForAttendee({
      currentZoneId,
      teamMemberLocations: occupancyByZone,
      targetZoneIds,
    });
  }, [currentZoneId, occupancyByZone, targetZoneIds]);

  const bestMoveZone =
    ZONES.find((zone) => zone.id === bestMove.suggestedZoneId) ?? ZONES[0];

  const totalTeamMembers = Math.max(
    teamDoc?.memberIds.length ?? 0,
    teamProgress?.memberCount ?? 0,
    teamMemberLocations.totalActiveMembers,
    1
  );

  const zonesCovered =
    teamProgress?.activeZones.length ??
    Object.values(occupancyByZone).filter((count) => count > 0).length;

  const statusLine = `${teamMemberLocations.totalActiveMembers} of ${totalTeamMembers} teammates spread across ${zonesCovered} zones`;

  useEffect(() => {
    if (!activeChallenge || !teamId) {
      return;
    }

    const completed = teamProgress?.isCompleted ?? false;
    const isParticipating = activeChallenge.participatingTeamIds.includes(teamId);

    if (!completed || !isParticipating) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const storageKey = `pulse.reward.seen.${activeChallenge.id}`;

    if (window.localStorage.getItem(storageKey)) {
      return;
    }

    window.localStorage.setItem(storageKey, "1");

    const timeoutId = window.setTimeout(() => {
      setRewardOpen(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeChallenge, teamId, teamProgress?.isCompleted]);

  const combinedError =
    activeEventError ??
    activeChallengeError ??
    teamProgressError ??
    leaderboardError ??
    teamMemberLocationsError ??
    locationTracking.error;

  if (authLoading || activeEventLoading || activeChallengeLoading) {
    return <LoadingSkeleton variant="dashboard" />;
  }

  if (!activeEvent) {
    return (
      <div className="space-y-5">
        <EmptyState
          icon={MapPin}
          title="No live event"
          description="We will activate your command center as soon as kickoff begins."
        />

        <TeamInfoCard
          teamName={teamDoc?.name ?? fallbackTeamName}
          totalPoints={firestoreUser?.totalPoints ?? 0}
          spreadHistory={spreadHistory}
        />
      </div>
    );
  }

  if (!activeChallenge) {
    return (
      <div className="space-y-5">
        <EventStatusBar event={activeEvent} />
        <SpreadHistoryChart scores={spreadHistory} />
        <EmptyState
          icon={Navigation}
          title="No active challenge"
          description="Stay ready. Your next spread challenge will appear here in real-time."
        />

        {combinedError ? (
          <p className="font-mono text-xs text-destructive">{combinedError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <EventStatusBar event={activeEvent} />

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <ActiveChallengeCard
            challenge={activeChallenge}
            teamProgress={teamProgress}
            statusLine={statusLine}
          />

          <BestMoveCard
            reason={bestMove.reason}
            isStayHere={bestMove.reason.includes("Stay here")}
            suggestedZoneName={bestMoveZone.name}
            suggestedZoneGate={bestMoveZone.gate}
          />

          {locationTracking.data.mode === "manual" ? (
            <section className="nb-card bg-card p-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Manual Zone Picker
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {ZONES.map((zone) => (
                  <ZoneCard
                    key={`manual-${zone.id}`}
                    zone={zone}
                    memberCount={occupancyByZone[zone.id] ?? 0}
                    totalTeamMembers={totalTeamMembers}
                    isTarget={targetZoneIds.includes(zone.id)}
                    isCurrentUserHere={locationTracking.data.currentZoneId === zone.id}
                    onClick={() => void locationTracking.selectManualZone(zone.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <ZoneMap
          memberCountsByZone={occupancyByZone}
          targetZoneIds={targetZoneIds}
          currentZoneId={currentZoneId}
          totalTeamMembers={totalTeamMembers}
          onSetCurrentZone={(zoneId) => {
            void locationTracking.selectManualZone(zoneId);
          }}
        />
      </div>

      <LeaderboardMini rows={leaderboardRows} yourTeamId={teamId} />

      {combinedError ? (
        <section className="nb-card border-destructive bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-destructive">
            <ShieldAlert className="size-4" />
            {combinedError}
          </p>
        </section>
      ) : null}

      <Dialog
        open={locationTracking.data.permissionDialogOpen}
        onOpenChange={() => undefined}
      >
        <DialogContent className="rounded-none border-2 border-border bg-card p-5" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Help your team win
            </DialogTitle>
            <DialogDescription>
              Share your location to help your team track its spread score.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-2">
            <Button
              type="button"
              onClick={locationTracking.requestGps}
              className="nb-btn w-full rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
            >
              Use GPS
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={locationTracking.requestManual}
              className="nb-btn w-full rounded-none border-2 border-border bg-card font-bold"
            >
              Pick my zone
            </Button>
            <button
              type="button"
              onClick={locationTracking.skipLocation}
              className="w-full text-center text-xs font-semibold underline"
            >
              Skip for now
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={locationTracking.data.manualPickerOpen}
        onOpenChange={locationTracking.setManualPickerOpen}
      >
        <DialogContent className="max-w-4xl rounded-none border-2 border-border bg-card p-5" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Pick your current zone
            </DialogTitle>
            <DialogDescription>
              Tap your current area so your team gets accurate spread scoring.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {ZONES.map((zone) => (
              <ZoneCard
                key={`picker-${zone.id}`}
                zone={zone}
                memberCount={occupancyByZone[zone.id] ?? 0}
                totalTeamMembers={totalTeamMembers}
                isTarget={targetZoneIds.includes(zone.id)}
                isCurrentUserHere={locationTracking.data.currentZoneId === zone.id}
                onClick={() => void locationTracking.selectManualZone(zone.id)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <RewardNotification
        challenge={activeChallenge}
        open={rewardOpen}
        onDismiss={() => setRewardOpen(false)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
