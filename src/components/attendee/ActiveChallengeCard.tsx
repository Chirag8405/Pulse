"use client";

import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { SpreadMeter } from "@/components/shared/SpreadMeter";
import type { Challenge, ChallengeTeamProgress } from "@/types/firebase";

interface ActiveChallengeCardProps {
  challenge: Challenge;
  teamProgress: ChallengeTeamProgress | null;
  statusLine: string;
}

export function ActiveChallengeCard({
  challenge,
  teamProgress,
  statusLine,
}: ActiveChallengeCardProps) {
  const progressValue = Math.max(0, Math.min(100, teamProgress?.spreadScore ?? 0));

  return (
    <section className="nb-card border-amber-400 bg-card p-5">
      <h2 className="text-2xl font-black tracking-tight">{challenge.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{challenge.description}</p>

      <div className="my-5 flex justify-center">
        <CountdownTimer endTime={challenge.endTime.toDate()} onExpire={() => undefined} />
      </div>

      <SpreadMeter value={progressValue} target={challenge.targetSpreadPercentage} />

      <p className="mt-4 text-sm font-bold" aria-live="polite">
        {statusLine}
      </p>
    </section>
  );
}
