"use client";

import { useMemo } from "react";
import { Activity, ShieldAlert, Users2 } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { StatCard } from "@/components/shared/StatCard";
import { TeamBadge } from "@/components/shared/TeamBadge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TEAM_MAPPINGS } from "@/constants/teams";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { useTeamsByEvent, useZoneOccupancy } from "@/hooks/useAdminRealtime";

function getTeamDisplay(teamId: string): {
  name: string;
  emoji: string;
  colorHex: string;
  zoneId: string;
} {
  const mapped = TEAM_MAPPINGS.find((team) => team.id === teamId);

  if (!mapped) {
    return {
      name: teamId,
      emoji: "🏟️",
      colorHex: "#374151",
      zoneId: "",
    };
  }

  return {
    name: mapped.name,
    emoji: mapped.emoji,
    colorHex: mapped.colorHex,
    zoneId: mapped.zoneId,
  };
}

function getBalanceStatus(memberCount: number, averageCount: number): string {
  if (memberCount === 0) {
    return "No members";
  }

  if (memberCount < Math.max(1, Math.floor(averageCount * 0.75))) {
    return "Understaffed";
  }

  if (memberCount > Math.ceil(averageCount * 1.25)) {
    return "Overstaffed";
  }

  return "Balanced";
}

function balanceBadgeClass(status: string): string {
  if (status === "Overstaffed") {
    return "rounded-none border-2 border-border bg-amber-400 px-2 py-1 text-xs font-bold text-black";
  }

  if (status === "Understaffed" || status === "No members") {
    return "rounded-none border-2 border-border bg-red-600 px-2 py-1 text-xs font-bold text-white";
  }

  return "rounded-none border-2 border-border bg-emerald-500 px-2 py-1 text-xs font-bold text-white";
}

function AdminTeamsContent() {
  const {
    data: activeEvent,
    loading: activeEventLoading,
    error: activeEventError,
  } = useActiveEvent();
  const {
    data: teams,
    loading: teamsLoading,
    error: teamsError,
  } = useTeamsByEvent(activeEvent?.id ?? null);
  const { data: occupancy, error: occupancyError } = useZoneOccupancy();

  const sortedTeams = useMemo(() => {
    return [...teams].sort((left, right) => right.memberIds.length - left.memberIds.length);
  }, [teams]);

  const totalMembers = useMemo(
    () => sortedTeams.reduce((sum, team) => sum + team.memberIds.length, 0),
    [sortedTeams]
  );

  const averageMembers = sortedTeams.length > 0 ? totalMembers / sortedTeams.length : 0;
  const spreadDelta =
    sortedTeams.length > 1
      ? Math.max(...sortedTeams.map((team) => team.memberIds.length)) -
        Math.min(...sortedTeams.map((team) => team.memberIds.length))
      : 0;

  const combinedError = activeEventError ?? teamsError ?? occupancyError;

  if (activeEventLoading || teamsLoading) {
    return <LoadingSkeleton variant="admin" />;
  }

  if (!activeEvent) {
    return (
      <EmptyState
        icon={Users2}
        title="No active event"
        description="Start an event to view team operations and balancing metrics."
      />
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Team Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Team load balancing and readiness for {activeEvent.homeTeam} vs {activeEvent.awayTeam}.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Teams"
          value={sortedTeams.length}
          icon={Users2}
          description="Teams mapped to current event"
        />
        <StatCard
          label="Total Members"
          value={totalMembers}
          icon={Activity}
          description="Combined team member count"
        />
        <StatCard
          label="Avg Members / Team"
          value={Number.isFinite(averageMembers) ? averageMembers.toFixed(1) : "0.0"}
          icon={Users2}
          description="Even distribution target"
        />
        <StatCard
          label="Team Spread Delta"
          value={spreadDelta}
          icon={ShieldAlert}
          description="Difference between largest and smallest teams"
        />
      </div>

      <section className="nb-card bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">Live Team Breakdown</h2>
          <Badge className="rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground">
            {activeEvent.matchDay}
          </Badge>
        </div>

        <Table aria-label="Teams by member distribution and readiness">
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Spread Score</TableHead>
              <TableHead>Home Zone Occupancy</TableHead>
              <TableHead>Challenge Wins</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTeams.map((team) => {
              const display = getTeamDisplay(team.id);
              const memberCount = team.memberIds.length;
              const balanceStatus = getBalanceStatus(memberCount, averageMembers);
              const zoneOccupancy = display.zoneId
                ? occupancy.byZone[display.zoneId] ?? 0
                : 0;

              return (
                <TableRow key={team.id}>
                  <TableCell>
                    <TeamBadge
                      teamName={display.name}
                      emoji={display.emoji}
                      colorHex={display.colorHex}
                      size="sm"
                    />
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{team.id}</p>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-bold">{memberCount}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {Math.round(team.currentSpreadScore)}%
                  </TableCell>
                  <TableCell className="font-mono text-sm">{zoneOccupancy}</TableCell>
                  <TableCell className="font-mono text-sm">{team.totalChallengesWon}</TableCell>
                  <TableCell>
                    <Badge className={balanceBadgeClass(balanceStatus)}>{balanceStatus}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {sortedTeams.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No teams are attached to the current event yet.
          </p>
        ) : null}
      </section>

      {combinedError ? (
        <p className="nb-card border-destructive bg-card p-3 font-mono text-xs text-destructive">
          {combinedError}
        </p>
      ) : null}
    </section>
  );
}

export default function AdminTeamsPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminTeamsContent />
    </AuthGuard>
  );
}
