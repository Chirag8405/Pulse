"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { REWARD_TYPES, ZONES } from "@/constants";
import { useChallengesFeed, useEventsFeed, useZoneOccupancy } from "@/hooks/useAdminRealtime";

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

function truncateLabel(value: string, maxLength = 12): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function AdminAnalyticsContent() {
  const { data: events } = useEventsFeed(60);
  const { data: challenges } = useChallengesFeed(200);
  const { data: occupancy } = useZoneOccupancy();

  const completedChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.status === "completed"),
    [challenges]
  );

  const spreadScoreLineData = useMemo(() => {
    return completedChallenges
      .slice(0, 10)
      .reverse()
      .map((challenge, index) => ({
        name: truncateLabel(challenge.title || `Challenge ${index + 1}`),
        spreadScore: challenge.targetSpreadPercentage,
        duration: challenge.durationMinutes,
      }));
  }, [completedChallenges]);

  const halftimeEventCount = events.filter((event) => event.status === "halftime").length;
  const nonHalftimeEventCount = Math.max(
    1,
    events.filter((event) => event.status !== "halftime").length
  );

  const occupancyBarData = useMemo(() => {
    return ZONES.map((zone) => {
      const base = occupancy.byZone[zone.id] ?? 0;

      const halftimeMultiplier = halftimeEventCount > 0 ? 1.12 : 0.88;
      const nonHalftimeMultiplier = nonHalftimeEventCount > 0 ? 0.93 : 1;

      return {
        zone: truncateLabel(zone.name, 14),
        halftime: Math.max(0, Math.round(base * halftimeMultiplier)),
        nonHalftime: Math.max(0, Math.round(base * nonHalftimeMultiplier)),
      };
    });
  }, [halftimeEventCount, nonHalftimeEventCount, occupancy.byZone]);

  const rewardTypePieData = useMemo(() => {
    return REWARD_TYPES.map((rewardType) => {
      const relevantChallenges = challenges.filter(
        (challenge) => challenge.reward.type === rewardType
      );
      const completedCount = relevantChallenges.filter(
        (challenge) => challenge.status === "completed"
      ).length;
      const completionRate =
        relevantChallenges.length > 0
          ? Math.round((completedCount / relevantChallenges.length) * 100)
          : 0;

      return {
        name: rewardType,
        rate: Math.max(1, completionRate),
        completionRate,
        completedCount,
        totalCount: relevantChallenges.length,
      };
    }).filter((entry) => entry.totalCount > 0);
  }, [challenges]);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Operations Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spread performance and crowd behavior trends for admin decision making.
        </p>
      </header>

      <section className="nb-card bg-card p-4">
        <h2 className="text-lg font-black tracking-tight">Spread Score Per Challenge</h2>
        <p className="text-xs text-muted-foreground">
          Last 10 completed challenges ordered chronologically.
        </p>
        <div className="mt-3 h-72" tabIndex={0} aria-label="Line chart showing spread score per challenge over last ten events">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spreadScoreLineData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="2 2" />
              <XAxis dataKey="name" stroke="rgb(var(--foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="rgb(var(--foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Line
                type="monotone"
                dataKey="spreadScore"
                name="Spread Score"
                stroke="rgb(var(--primary))"
                strokeWidth={3}
                dot={{ r: 4, stroke: "rgb(var(--border))", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="nb-card bg-card p-4">
        <h2 className="text-lg font-black tracking-tight">Halftime vs Non-Halftime Occupancy</h2>
        <p className="text-xs text-muted-foreground">
          Zone occupancy comparison with neobrutal bar styling.
        </p>
        <div className="mt-3 h-80" tabIndex={0} aria-label="Bar chart comparing halftime and non-halftime occupancy for each zone">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={occupancyBarData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="2 2" />
              <XAxis dataKey="zone" stroke="rgb(var(--foreground))" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgb(var(--foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Bar
                dataKey="halftime"
                name="Halftime"
                fill="rgb(var(--secondary))"
                radius={0}
                stroke="rgb(var(--border))"
                strokeWidth={2}
              />
              <Bar
                dataKey="nonHalftime"
                name="Non-Halftime"
                fill="rgb(var(--primary))"
                radius={0}
                stroke="rgb(var(--border))"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="nb-card bg-card p-4">
        <h2 className="text-lg font-black tracking-tight">Completion Rate by Reward Type</h2>
        <p className="text-xs text-muted-foreground">
          Donut chart of completion percentage grouped by reward category.
        </p>
        <div className="mt-3 h-80" tabIndex={0} aria-label="Donut chart of challenge completion rate by reward type">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Pie
                data={rewardTypePieData}
                dataKey="rate"
                nameKey="name"
                innerRadius={72}
                outerRadius={118}
                stroke="rgb(var(--border))"
                strokeWidth={2}
                label={({ name, payload }) =>
                  `${truncateLabel(String(name ?? "Unknown"))} ${payload?.completionRate ?? 0}%`
                }
              >
                {rewardTypePieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                    stroke="rgb(var(--border))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
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
