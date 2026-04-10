"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Trophy } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { EmptyState } from "@/components/shared/EmptyState";
import { TeamBadge } from "@/components/shared/TeamBadge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEAM_MAPPINGS } from "@/constants/teams";
import { useActiveChallenge } from "@/hooks/useActiveChallenge";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { cn } from "@/lib/utils";
import type { ChallengeTeamProgress } from "@/types/firebase";

interface LeaderboardRowData {
  id: string;
  teamId: string;
  teamName: string;
  teamEmoji: string;
  teamColorHex: string;
  spreadScore: number;
  challengesWon: number;
  sparkline: number[];
}

const TABLE_COLUMNS_CLASS =
  "grid grid-cols-[72px_minmax(220px,1fr)_190px_140px] items-center gap-2";

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

function createSparkline(score: number, seed: number): number[] {
  return Array.from({ length: 5 }, (_, index) => {
    const delta = ((seed + index * 7) % 9) - 4;
    return Math.max(30, Math.min(98, Math.round(score + delta)));
  });
}

function mapTeamPresentation(teamId: string, fallbackSeed: number) {
  const mappedTeam = TEAM_MAPPINGS.find((team) => team.id === teamId);

  if (mappedTeam) {
    return {
      name: mappedTeam.name,
      emoji: mappedTeam.emoji,
      colorHex: mappedTeam.colorHex,
    };
  }

  const fallbackTeam = TEAM_MAPPINGS[fallbackSeed % Math.max(1, TEAM_MAPPINGS.length)];

  return {
    name: fallbackTeam?.name ?? `Team ${fallbackSeed + 1}`,
    emoji: fallbackTeam?.emoji ?? "🏟",
    colorHex: fallbackTeam?.colorHex ?? "#2563EB",
  };
}

function mapEventRows(sourceRows: ChallengeTeamProgress[]): LeaderboardRowData[] {
  return [...sourceRows]
    .sort((left, right) => right.spreadScore - left.spreadScore)
    .map((row, index) => {
      const teamDisplay = mapTeamPresentation(row.teamId, index);

      return {
        id: `event-${row.teamId}-${index}`,
        teamId: row.teamId,
        teamName: teamDisplay.name,
        teamEmoji: teamDisplay.emoji,
        teamColorHex: teamDisplay.colorHex,
        spreadScore: Math.round(row.spreadScore),
        challengesWon: row.isCompleted ? 1 : 0,
        sparkline: createSparkline(row.spreadScore, index),
      };
    });
}

function buildAllTimeRows(): LeaderboardRowData[] {
  const fallbackTeam = TEAM_MAPPINGS[0];
  const rows: LeaderboardRowData[] = [];

  for (let index = 0; index < 80; index += 1) {
    const mappedTeam = TEAM_MAPPINGS[index % Math.max(1, TEAM_MAPPINGS.length)] ?? fallbackTeam;

    rows.push({
      id: `all-time-${index}`,
      teamId: `${mappedTeam?.id ?? "team"}-${index}`,
      teamName: `${mappedTeam?.name ?? "Team"} ${Math.floor(index / 8) + 1}`,
      teamEmoji: mappedTeam?.emoji ?? "🏟",
      teamColorHex: mappedTeam?.colorHex ?? "#2563EB",
      spreadScore: Math.max(35, 97 - Math.floor(index * 0.75)),
      challengesWon: Math.max(1, 24 - Math.floor(index / 4)),
      sparkline: createSparkline(92 - Math.floor(index * 0.5), index + 4),
    });
  }

  return rows.sort((left, right) => right.spreadScore - left.spreadScore);
}

function MiniSparkline({ values }: { values: number[] }) {
  return (
    <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
      {values.map((value, index) => {
        const normalized = Math.max(2, Math.round((value / 100) * 14));
        const x = index * 6;
        const y = 16 - normalized;

        return (
          <rect key={index} x={x} y={y} width="4" height={normalized} fill="currentColor" />
        );
      })}
    </svg>
  );
}

function DesktopLeaderboardRow({
  row,
  rank,
  isYourTeam,
}: {
  row: LeaderboardRowData;
  rank: number;
  isYourTeam: boolean;
}) {
  return (
    <div
      className={cn(
        `${TABLE_COLUMNS_CLASS} border-b border-border px-3 py-2 border-l-2 border-l-transparent hover:border-l-primary`,
        rank % 2 === 0
          ? "bg-white text-black dark:bg-zinc-950 dark:text-foreground"
          : "bg-zinc-50 text-black dark:bg-zinc-900 dark:text-foreground",
        isYourTeam && "border-2 border-black shadow-[var(--nb-shadow-sm)]"
      )}
    >
      <span className="font-mono text-sm font-bold">{getRankLabel(rank)}</span>
      <TeamBadge
        teamName={row.teamName}
        emoji={row.teamEmoji}
        colorHex={row.teamColorHex}
        size="sm"
      />
      <span className="inline-flex items-center gap-2 font-mono text-sm font-bold">
        {row.spreadScore}%
        <MiniSparkline values={row.sparkline} />
      </span>
      <Badge
        className="rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground"
      >
        {row.challengesWon}
      </Badge>
    </div>
  );
}

function MobileLeaderboardCard({
  row,
  rank,
  isYourTeam,
}: {
  row: LeaderboardRowData;
  rank: number;
  isYourTeam: boolean;
}) {
  return (
    <article
      className={cn(
        "nb-card space-y-3 p-4",
        isYourTeam && "border-2 border-black shadow-[var(--nb-shadow-sm)]"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold">{getRankLabel(rank)}</span>
        <Badge
          className="rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground"
        >
          {row.challengesWon} won
        </Badge>
      </div>

      <TeamBadge
        teamName={row.teamName}
        emoji={row.teamEmoji}
        colorHex={row.teamColorHex}
        size="sm"
      />

      <p className="inline-flex items-center gap-2 font-mono text-sm font-bold">
        Spread {row.spreadScore}%
        <MiniSparkline values={row.sparkline} />
      </p>
    </article>
  );
}

function LeaderboardSkeletonRows() {
  return (
    <section className="nb-card overflow-hidden bg-card">
      <div className={`${TABLE_COLUMNS_CLASS} bg-black px-3 py-3 text-xs font-bold uppercase tracking-wider text-white`}>
        <span>Rank</span>
        <span>Team</span>
        <span>Spread Score</span>
        <span>Challenges Won</span>
      </div>
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className={`${TABLE_COLUMNS_CLASS} border-b border-border px-3 py-2`}
        >
          <div className="h-4 w-8 animate-pulse bg-muted" />
          <div className="h-6 w-48 animate-pulse bg-muted" />
          <div className="h-4 w-28 animate-pulse bg-muted" />
          <div className="h-5 w-12 animate-pulse bg-muted" />
        </div>
      ))}
    </section>
  );
}

function LeaderboardTable({
  rows,
  yourTeamId,
}: {
  rows: LeaderboardRowData[];
  yourTeamId: string | null;
}) {
  const shouldVirtualize = rows.length > 50;
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  return (
    <section className="nb-card overflow-hidden bg-card">
      <div className={`${TABLE_COLUMNS_CLASS} bg-black px-3 py-3 text-xs font-bold uppercase tracking-wider text-white`}>
        <span>Rank</span>
        <span>Team</span>
        <span>Spread Score</span>
        <span>Challenges Won</span>
      </div>

      {shouldVirtualize ? (
        <div ref={scrollParentRef} className="max-h-[580px] overflow-auto">
          <div
            className="relative"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];

              if (!row) {
                return null;
              }

              return (
                <div
                  key={row.id}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <DesktopLeaderboardRow
                    row={row}
                    rank={virtualRow.index + 1}
                    isYourTeam={yourTeamId === row.teamId}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {rows.map((row, index) => (
            <DesktopLeaderboardRow
              key={row.id}
              row={row}
              rank={index + 1}
              isYourTeam={yourTeamId === row.teamId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LeaderboardPanel({
  rows,
  loading,
  yourTeamId,
}: {
  rows: LeaderboardRowData[];
  loading: boolean;
  yourTeamId: string | null;
}) {
  if (loading) {
    return <LeaderboardSkeletonRows />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No leaderboard data"
        description="Leaderboard standings will appear once challenge data starts streaming."
      />
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <LeaderboardTable rows={rows} yourTeamId={yourTeamId} />
      </div>

      <div className="space-y-3 md:hidden">
        {rows.slice(0, 20).map((row, index) => (
          <MobileLeaderboardCard
            key={row.id}
            row={row}
            rank={index + 1}
            isYourTeam={yourTeamId === row.teamId}
          />
        ))}
      </div>
    </>
  );
}

function LeaderboardContent() {
  const { firestoreUser } = useAuth();
  const { data: activeEvent } = useActiveEvent();
  const { data: activeChallenge, loading: challengeLoading } = useActiveChallenge(
    activeEvent?.id
  );
  const { data: eventLeaderboardRows, loading: eventLoading } = useLeaderboard(
    activeChallenge?.id
  );

  const thisEventRows = useMemo(
    () => mapEventRows(eventLeaderboardRows),
    [eventLeaderboardRows]
  );

  const allTimeRows = useMemo(() => buildAllTimeRows(), []);

  const yourTeamId = firestoreUser?.teamId ?? null;

  return (
    <section className="space-y-4">
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
            loading={eventLoading || challengeLoading}
            yourTeamId={yourTeamId}
          />
        </TabsContent>

        <TabsContent value="all-time" className="outline-none">
          <LeaderboardPanel rows={allTimeRows} loading={false} yourTeamId={yourTeamId} />
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
