"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { ZONES } from "@/constants";
import { TEAM_MAPPINGS } from "@/constants/teams";
import { useChallengesFeed, useZoneOccupancy } from "@/hooks/useAdminRealtime";
import { fetchChallengeTeamProgress } from "@/lib/firebase/realtimeApi";
import type { Challenge } from "@/types/firebase";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((module) => module.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((module) => module.LineChart),
  { ssr: false }
);
const Line = dynamic(() => import("recharts").then((module) => module.Line), {
  ssr: false,
});
const BarChart = dynamic(
  () => import("recharts").then((module) => module.BarChart),
  { ssr: false }
);
const Bar = dynamic(() => import("recharts").then((module) => module.Bar), {
  ssr: false,
});
const PieChart = dynamic(
  () => import("recharts").then((module) => module.PieChart),
  { ssr: false }
);
const Pie = dynamic(() => import("recharts").then((module) => module.Pie), {
  ssr: false,
});
const Cell = dynamic(() => import("recharts").then((module) => module.Cell), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((module) => module.CartesianGrid),
  { ssr: false }
);
const XAxis = dynamic(() => import("recharts").then((module) => module.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((module) => module.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(
  () => import("recharts").then((module) => module.Tooltip),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((module) => module.Legend),
  { ssr: false }
);

const CHART_PALETTE = [
  "rgb(var(--primary))",
  "rgb(var(--secondary))",
  "rgb(var(--accent))",
  "rgb(var(--success))",
  "rgb(var(--warning))",
];

const CHART_TOOLTIP_STYLE = {
  border: "2px solid rgb(var(--border))",
  borderRadius: 0,
  background: "rgb(var(--card))",
  color: "rgb(var(--foreground))",
} as const;

const RESPONSIVE_CONTAINER_PROPS = {
  width: "100%",
  height: "100%",
  minWidth: 0,
  minHeight: 220,
} as const;

function getTeamLabel(teamId: string): string {
  return TEAM_MAPPINGS.find((team) => team.id === teamId)?.name ?? teamId;
}

function normalizeChallengeOrder(challenges: Challenge[]): Challenge[] {
  return [...challenges]
    .sort((left, right) => right.startTime.toMillis() - left.startTime.toMillis())
    .slice(0, 10)
    .reverse();
}

function AdminAnalyticsContent() {
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

  const recentChallenges = useMemo(
    () => normalizeChallengeOrder(challenges),
    [challenges]
  );

  const {
    data: spreadSeries = [],
    isLoading: spreadSeriesLoading,
    error: spreadSeriesError,
  } = useQuery({
    queryKey: [
      "analytics-spread-series",
      recentChallenges.map((challenge) => challenge.id).join(","),
    ],
    enabled: recentChallenges.length > 0,
    queryFn: async () => {
      const rows: Array<Record<string, number | string>> = [];

      for (let index = 0; index < recentChallenges.length; index += 1) {
        const challenge = recentChallenges[index];

        if (!challenge) {
          continue;
        }

        const challengeProgressRows = await fetchChallengeTeamProgress(challenge.id);

        const row: Record<string, number | string> = {
          challenge: `C${index + 1}`,
        };

        challengeProgressRows.forEach((progress) => {
          row[progress.teamId] = Math.round(progress.spreadScore);
        });

        rows.push(row);
      }

      return rows;
    },
  });

  const teamSeriesIds = useMemo(() => {
    const teamIds = new Set<string>();

    spreadSeries.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "challenge") {
          teamIds.add(key);
        }
      });
    });

    return Array.from(teamIds);
  }, [spreadSeries]);

  const occupancyBarData = useMemo(() => {
    return ZONES.map((zone) => ({
      zone: zone.name,
      occupancy: occupancy.byZone[zone.id] ?? 0,
    }));
  }, [occupancy.byZone]);

  const challengeStatusData = useMemo(() => {
    const active = challenges.filter((challenge) => challenge.status === "active").length;
    const completed = challenges.filter((challenge) => challenge.status === "completed").length;
    const pending = challenges.filter((challenge) => challenge.status === "pending").length;

    return [
      { name: "Completed", value: completed, color: "rgb(var(--success))" },
      { name: "Active", value: active, color: "rgb(var(--primary))" },
      { name: "Pending", value: pending, color: "rgb(var(--warning))" },
    ].filter((entry) => entry.value > 0);
  }, [challenges]);

  const combinedError =
    challengesError ??
    occupancyError ??
    (spreadSeriesError instanceof Error ? spreadSeriesError.message : null);

  if (challengesLoading || occupancyLoading || spreadSeriesLoading) {
    return <LoadingSkeleton variant="admin" />;
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Operations Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spread and occupancy trends for venue operations.
        </p>
      </header>

      <section className="nb-card min-w-0 bg-card p-4">
        <h2 className="text-lg font-black tracking-tight">Spread Score Over Time</h2>
        <p className="text-xs text-muted-foreground">
          Last 10 challenges with one line per team.
        </p>

        {spreadSeries.length === 0 || teamSeriesIds.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No spread score history yet"
            description="Complete challenges to populate this chart."
            headingLevel={3}
          />
        ) : (
          <div className="mt-3 h-72 min-w-0" tabIndex={0} aria-label="Spread score over time chart">
            <ResponsiveContainer {...RESPONSIVE_CONTAINER_PROPS}>
              <LineChart data={spreadSeries} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="2 2" />
                <XAxis dataKey="challenge" stroke="rgb(var(--foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="rgb(var(--foreground))" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                {teamSeriesIds.map((teamId, index) => (
                  <Line
                    key={teamId}
                    type="monotone"
                    dataKey={teamId}
                    name={getTeamLabel(teamId)}
                    stroke={CHART_PALETTE[index % CHART_PALETTE.length]}
                    strokeWidth={3}
                    dot={{ r: 3, stroke: "rgb(var(--border))", strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="nb-card min-w-0 bg-card p-4">
        <h2 className="text-lg font-black tracking-tight">Zone Occupancy Distribution</h2>
        <p className="text-xs text-muted-foreground">
          Live occupancy count by zone.
        </p>

        {occupancyBarData.every((entry) => entry.occupancy === 0) ? (
          <EmptyState
            icon={BarChart3}
            title="No occupancy data yet"
            description="Active member locations will appear here."
            headingLevel={3}
          />
        ) : (
          <div className="mt-3 h-80 min-w-0" tabIndex={0} aria-label="Zone occupancy distribution chart">
            <ResponsiveContainer {...RESPONSIVE_CONTAINER_PROPS}>
              <BarChart data={occupancyBarData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="2 2" />
                <XAxis dataKey="zone" stroke="rgb(var(--foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgb(var(--foreground))" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                <Bar
                  dataKey="occupancy"
                  name="Occupancy"
                  fill="rgb(var(--primary))"
                  radius={0}
                  stroke="rgb(var(--border))"
                  strokeWidth={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="nb-card min-w-0 bg-card p-4">
        <h2 className="text-lg font-black tracking-tight">Challenge Completion Rate</h2>
        <p className="text-xs text-muted-foreground">
          Completed vs active vs pending challenge counts.
        </p>

        {challengeStatusData.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No challenge status data yet"
            description="Create challenges to populate this chart."
            headingLevel={3}
          />
        ) : (
          <div className="mt-3 h-80 min-w-0" tabIndex={0} aria-label="Challenge completion rate chart">
            <ResponsiveContainer {...RESPONSIVE_CONTAINER_PROPS}>
              <PieChart>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                <Pie
                  data={challengeStatusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={118}
                  stroke="rgb(var(--border))"
                  strokeWidth={2}
                >
                  {challengeStatusData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      stroke="rgb(var(--border))"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {combinedError ? (
        <section className="nb-card border-destructive bg-card p-3">
          <p className="font-mono text-xs text-destructive">{combinedError}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.reload()}
            className="nb-btn mt-3 rounded-none border-2 border-border bg-card font-bold"
          >
            Retry
          </Button>
        </section>
      ) : null}
    </section>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminAnalyticsContent />
    </AuthGuard>
  );
}
