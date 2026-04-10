"use client";

import { useState } from "react";
import {
  Activity,
  Award,
  BarChart3,
  Compass,
  Inbox,
  Users,
} from "lucide-react";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { SpreadMeter } from "@/components/shared/SpreadMeter";
import { StatCard } from "@/components/shared/StatCard";
import { TeamBadge } from "@/components/shared/TeamBadge";
import { ZoneCard } from "@/components/shared/ZoneCard";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ZONES } from "@/constants";
import {
  getBestMoveForAttendee,
  recommendChallengeParams,
} from "@/lib/recommender/challengeRecommender";

const SHOWCASE_TIMER_END = new Date("2035-01-01T00:01:35.000Z");

export default function ShowcasePage() {
  const [expired, setExpired] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>(ZONES[0].id);

  const recommendation = recommendChallengeParams({
    currentOccupancy: {
      "zone-north": 5300,
      "zone-south": 4200,
      "zone-east": 2100,
      "zone-west": 1700,
      "zone-concourse-n": 1400,
      "zone-concourse-s": 1600,
      "zone-entry-main": 2400,
      "zone-entry-sec": 1900,
    },
    eventMinutesElapsed: 52,
    historicalSpreadScores: [64, 72, 68, 59, 74],
    teamCount: 4,
  });

  const bestMove = getBestMoveForAttendee({
    currentZoneId: selectedZone,
    teamMemberLocations: {
      "zone-east": 10,
      "zone-west": 4,
      "zone-concourse-n": 3,
    },
    targetZoneIds: recommendation.suggestedTargetZones,
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="nb-card flex items-center justify-between bg-card p-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Design Showcase</h1>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Neobrutalism shared components preview
            </p>
          </div>
          <ThemeToggle />
        </header>

        <section className="border-t-2 border-border pt-6">
          <h2 className="mb-4 text-xl font-black">Stat Cards</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              ariaLabel="Spread score statistic"
              label="Spread Score"
              value="73%"
              delta={6}
              icon={BarChart3}
              description="Compared to previous challenge"
            />
            <StatCard
              ariaLabel="Active attendees statistic"
              label="Active Members"
              value={1542}
              delta={-2}
              icon={Users}
            />
            <StatCard
              ariaLabel="Rewards unlocked statistic"
              label="Rewards Unlocked"
              value={12}
              icon={Award}
            />
          </div>
        </section>

        <section className="border-t-2 border-border pt-6">
          <h2 className="mb-4 text-xl font-black">Spread Meter + Timer</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="nb-card bg-card p-4">
              <SpreadMeter value={63} target={75} />
            </div>
            <div className="nb-card space-y-2 bg-card p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Challenge Countdown
              </p>
              <CountdownTimer endTime={SHOWCASE_TIMER_END} onExpire={() => setExpired(true)} />
              <p className="text-sm text-muted-foreground">
                {expired ? "Challenge window expired" : "Move now to maximize spread"}
              </p>
            </div>
          </div>
        </section>

        <section className="border-t-2 border-border pt-6">
          <h2 className="mb-4 text-xl font-black">Zone Cards + Team Badge</h2>
          <div className="mb-4">
            <TeamBadge teamName="Mumbai Blazers" emoji="🔥" colorHex="#2563EB" size="md" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ZoneCard
              zone={{ ...ZONES[2] }}
              memberCount={10}
              totalTeamMembers={80}
              isTarget
              isCurrentUserHere={selectedZone === ZONES[2].id}
              onClick={() => setSelectedZone(ZONES[2].id)}
            />
            <ZoneCard
              zone={{ ...ZONES[4] }}
              memberCount={3}
              totalTeamMembers={80}
              isTarget
              isCurrentUserHere={selectedZone === ZONES[4].id}
              onClick={() => setSelectedZone(ZONES[4].id)}
            />
          </div>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Best move: {bestMove.reason}
          </p>
        </section>

        <section className="border-t-2 border-border pt-6">
          <h2 className="mb-4 text-xl font-black">Empty State + Skeletons</h2>
          <EmptyState
            icon={Inbox}
            title="No Active Challenge"
            description="The next challenge starts in a few minutes."
            action={{
              label: "View Recommender",
              onClick: () => setSelectedZone(ZONES[0].id),
            }}
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <LoadingSkeleton variant="challenge" />
            <LoadingSkeleton variant="leaderboard" />
            <LoadingSkeleton variant="admin" />
            <LoadingSkeleton variant="dashboard" />
          </div>
        </section>

        <section className="border-t-2 border-border pt-6">
          <h2 className="mb-4 text-xl font-black">Recommender Output</h2>
          <div className="nb-card bg-card p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Smart Assistant Decision
            </p>
            <p className="mt-2 text-sm">{recommendation.reasoning}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 border-2 border-border bg-accent px-2 py-1 font-mono text-xs font-bold">
                <Compass className="size-3" /> Target Zones: {recommendation.suggestedTargetZones.join(", ")}
              </span>
              <span className="inline-flex items-center gap-1 border-2 border-border bg-secondary px-2 py-1 font-mono text-xs font-bold text-secondary-foreground">
                <Activity className="size-3" /> Spread: {recommendation.suggestedSpreadPercentage}%
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
