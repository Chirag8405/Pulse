"use client";

import { useMemo } from "react";
import { getDocs, orderBy, query } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { EmptyState } from "@/components/shared/EmptyState";
import { TeamBadge } from "@/components/shared/TeamBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEAM_MAPPINGS } from "@/constants/teams";
import { useActiveChallenge } from "@/hooks/useActiveChallenge";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { useChallengesFeed } from "@/hooks/useAdminRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { teamsCollection } from "@/lib/firebase/collections";
import { cn } from "@/lib/utils";
import type { ChallengeTeamProgress, Team } from "@/types/firebase";

interface LeaderboardRowData {
  id: string;
  teamId: string;
  teamName: string;
  teamEmoji: string;
  teamColorHex: string;
  spreadScore: number;
  challengesWon: number;
}

function getRankLabel(rank: number): string {
  if (rank === 1) {
    return "🥇";
  }
  if (rank === 2) {
    return "🥈";
  }
  if (rank === 3) {
    return "🥉";
  }
  return String(rank);
}

function getTeamPresentation(teamId: string, fallbackIndex: number) {
  const mappedTeam = TEAM_MAPPINGS.find((team) => team.id === teamId);

  if (mappedTeam) {
    return {
      name: mappedTeam.name,
      emoji: mappedTeam.emoji,
      colorHex: mappedTeam.colorHex,
    };
  }

  const fallbackTeam = TEAM_MAPPINGS[fallbackIndex % Math.max(1, TEAM_MAPPINGS.length)];

  return {
    name: fallbackTeam?.name ?? `Team ${fallbackIndex + 1}`,
    emoji: fallbackTeam?.emoji ?? "🏟",
    colorHex: fallbackTeam?.colorHex ?? "#2563EB",
  };
}

function mapEventRows(sourceRows: ChallengeTeamProgress[]): LeaderboardRowData[] {
  return [...sourceRows]
    .sort((left, right) => right.spreadScore - left.spreadScore)
    .map((row, index) => {
      const teamDisplay = getTeamPresentation(row.teamId, index);

      return {
        id: `event-${row.teamId}-${index}`,
        teamId: row.teamId,
        teamName: teamDisplay.name,
        teamEmoji: teamDisplay.emoji,
        teamColorHex: teamDisplay.colorHex,
        spreadScore: Math.round(row.spreadScore),
        challengesWon: row.isCompleted ? 1 : 0,
      };
    });
}

function mapAllTimeRows(sourceTeams: Team[]): LeaderboardRowData[] {
  return [...sourceTeams]
    .sort((left, right) => right.totalChallengesWon - left.totalChallengesWon)
    .map((team, index) => {
      const mappedTeam = TEAM_MAPPINGS.find((candidate) => candidate.id === team.id);

      return {
        id: `all-${team.id}`,
        teamId: team.id,
        teamName: team.name ?? mappedTeam?.name ?? `Team ${index + 1}`,
        teamEmoji: team.emoji ?? mappedTeam?.emoji ?? "🏟",
        teamColorHex: team.colorHex ?? mappedTeam?.colorHex ?? "#2563EB",
        spreadScore: Math.round(team.currentSpreadScore),
        challengesWon: team.totalChallengesWon,
      };
    });
}

function LeaderboardSkeletonRows() {
  return (
    <div className="nb-card overflow-hidden bg-card" aria-busy="true" role="status">
      <table className="w-full" aria-label="Team leaderboard table loading">
        <thead className="bg-black text-xs font-bold uppercase tracking-wider text-white">
          <tr>
            <th scope="col" className="px-3 py-3 text-left">Rank</th>
            <th scope="col" className="px-3 py-3 text-left">Team</th>
            <th scope="col" className="px-3 py-3 text-left">Spread Score</th>
            <th scope="col" className="px-3 py-3 text-left">Challenges Won</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, index) => (
            <tr key={index} className="border-b border-border">
              <td className="px-3 py-2"><div className="h-4 w-8 animate-pulse bg-muted" /></td>
              <td className="px-3 py-2"><div className="h-6 w-48 animate-pulse bg-muted" /></td>
              <td className="px-3 py-2"><div className="h-4 w-28 animate-pulse bg-muted" /></td>
              <td className="px-3 py-2"><div className="h-5 w-12 animate-pulse bg-muted" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardPanel({
  rows,
  loading,
  error,
  yourTeamId,
  emptyMessage,
}: {
  rows: LeaderboardRowData[];
  loading: boolean;
  error: string | null;
  yourTeamId: string | null;
  emptyMessage: string;
}) {
  if (loading) {
    return <LeaderboardSkeletonRows />;
  }

  if (error) {
    return (
      <section className="nb-card border-destructive bg-card p-4">
        <p className="font-mono text-xs text-destructive">{error}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
          className="nb-btn mt-3 rounded-none border-2 border-border bg-card font-bold"
        >
          Retry
        </Button>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title={emptyMessage}
        description="Check back once challenge data starts streaming."
        headingLevel={2}
      />
    );
  }

  return (
    <>
      <section className="nb-card hidden overflow-hidden bg-card md:block">
        <table className="w-full" aria-label="Team leaderboard table">
          <thead className="bg-black text-xs font-bold uppercase tracking-wider text-white">
            <tr>
              <th scope="col" className="px-3 py-3 text-left">Rank</th>
              <th scope="col" className="px-3 py-3 text-left">Team</th>
              <th scope="col" className="px-3 py-3 text-left">Spread Score</th>
              <th scope="col" className="px-3 py-3 text-left">Challenges Won</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isYourTeam = yourTeamId === row.teamId;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border align-middle",
                    index % 2 === 0
                      ? "bg-white text-black dark:bg-zinc-950 dark:text-foreground"
                      : "bg-zinc-50 text-black dark:bg-zinc-900 dark:text-foreground",
                    isYourTeam && "border-l-4 border-l-blue-600"
                  )}
                >
                  <th scope="row" className="px-3 py-2 text-left font-mono text-sm font-bold">
                    <span aria-hidden="true">{getRankLabel(index + 1)}</span>
                  </th>
                  <td className="px-3 py-2">
                    <TeamBadge
                      teamName={row.teamName}
                      emoji={row.teamEmoji}
                      colorHex={row.teamColorHex}
                      size="sm"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-sm font-bold">{row.spreadScore}%</td>
                  <td className="px-3 py-2">
                    <Badge className="rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground">
                      {row.challengesWon}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => {
          const isYourTeam = yourTeamId === row.teamId;

          return (
            <article
              key={row.id}
              className={cn(
                "nb-card space-y-3 p-4",
                isYourTeam && "border-2 border-blue-600"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold">{getRankLabel(index + 1)}</span>
                <Badge className="rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground">
                  {row.challengesWon} won
                </Badge>
              </div>

              <TeamBadge
                teamName={row.teamName}
                emoji={row.teamEmoji}
                colorHex={row.teamColorHex}
                size="sm"
              />

              <p className="font-mono text-sm font-bold">Spread {row.spreadScore}%</p>
            </article>
          );
        })}
      </div>
    </>
  );
}

function LeaderboardContent() {
  const { firestoreUser } = useAuth();
  const { data: activeEvent, loading: activeEventLoading, error: activeEventError } =
    useActiveEvent();
  const {
    data: activeChallenge,
    loading: activeChallengeLoading,
    error: activeChallengeError,
  } = useActiveChallenge(activeEvent?.id);
  const {
    data: challengesFeed,
    loading: challengesFeedLoading,
    error: challengesFeedError,
  } = useChallengesFeed(50);

  const fallbackChallenge = useMemo(() => {
    if (!activeEvent) {
      return null;
    }

    return challengesFeed
      .filter((challenge) => challenge.eventId === activeEvent.id)
      .sort((left, right) => right.startTime.toMillis() - left.startTime.toMillis())[0] ?? null;
  }, [activeEvent, challengesFeed]);

  const eventChallenge = activeChallenge ?? fallbackChallenge;

  const {
    data: eventLeaderboardRows,
    loading: eventLeaderboardLoading,
    error: eventLeaderboardError,
  } = useLeaderboard(eventChallenge?.id);

  const {
    data: allTimeTeams = [],
    isLoading: allTimeLoading,
    error: allTimeError,
  } = useQuery({
    queryKey: ["all-time-teams"],
    queryFn: async () => {
      const snapshot = await getDocs(
        query(teamsCollection, orderBy("totalChallengesWon", "desc"))
      );
      return snapshot.docs.map((docSnapshot) => docSnapshot.data());
    },
  });

  const thisEventRows = useMemo(() => mapEventRows(eventLeaderboardRows), [eventLeaderboardRows]);
  const allTimeRows = useMemo(() => mapAllTimeRows(allTimeTeams), [allTimeTeams]);

  const yourTeamId = firestoreUser?.teamId ?? null;

  return (
    <section className="space-y-4" role="region" aria-label="Team leaderboard">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track spread performance and challenge wins across teams.
        </p>
      </header>

      <Tabs defaultValue="event" className="space-y-3">
        <TabsList className="rounded-none border-2 border-border bg-card p-1">
          <TabsTrigger value="event" className="rounded-none border-2 border-transparent data-active:border-border data-active:bg-black data-active:text-white dark:data-active:bg-white dark:data-active:text-black">
            This Event
          </TabsTrigger>
          <TabsTrigger value="all-time" className="rounded-none border-2 border-transparent data-active:border-border data-active:bg-black data-active:text-white dark:data-active:bg-white dark:data-active:text-black">
            All Time
          </TabsTrigger>
        </TabsList>

        <TabsContent value="event" className="outline-none">
          <LeaderboardPanel
            rows={thisEventRows}
            loading={
              activeEventLoading ||
              activeChallengeLoading ||
              challengesFeedLoading ||
              (Boolean(eventChallenge?.id) && eventLeaderboardLoading)
            }
            error={
              activeEventError ??
              activeChallengeError ??
              challengesFeedError ??
              eventLeaderboardError
            }
            yourTeamId={yourTeamId}
            emptyMessage="No challenge data yet for this event"
          />
        </TabsContent>

        <TabsContent value="all-time" className="outline-none">
          <LeaderboardPanel
            rows={allTimeRows}
            loading={allTimeLoading}
            error={allTimeError instanceof Error ? allTimeError.message : null}
            yourTeamId={yourTeamId}
            emptyMessage="No all-time team data yet"
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

export default function LeaderboardPage() {
  return (
    <AuthGuard>
      <LeaderboardContent />
    </AuthGuard>
  );
}
