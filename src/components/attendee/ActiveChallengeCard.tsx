"use client";

import { useState } from "react";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { SpreadMeter } from "@/components/shared/SpreadMeter";
import type { Challenge, ChallengeTeamProgress } from "@/types/firebase";

interface ActiveChallengeCardProps {
  challenge: Challenge;
  teamProgress: ChallengeTeamProgress | null;
  teamProgressLoading?: boolean;
  hasTeam?: boolean;
  statusLine: string;
  previewMode?: boolean;
}

export function ActiveChallengeCard({
  challenge,
  teamProgress,
  teamProgressLoading = false,
  hasTeam = true,
  statusLine,
  previewMode = false,
}: ActiveChallengeCardProps) {
  const [expiredChallengeId, setExpiredChallengeId] = useState<string | null>(null);
  const hasExpired = expiredChallengeId === challenge.id;

  const progressValue = Math.max(0, Math.min(100, teamProgress?.spreadScore ?? 0));

  return (
    <section className="nb-card border-amber-400 bg-card p-5">
      <h2 className="text-2xl font-black tracking-tight">{challenge.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{challenge.description}</p>

      <div className="my-5 flex justify-center">
        {previewMode ? (
          <p className="border-2 border-border bg-muted px-3 py-2 font-mono text-2xl font-black">
            {challenge.durationMinutes}:00
          </p>
        ) : (
          <CountdownTimer
            endTime={challenge.endTime.toDate()}
            onExpire={() => setExpiredChallengeId(challenge.id)}
          />
        )}
      </div>

      {hasExpired && !previewMode ? (
        <p className="mb-4 border-2 border-border bg-muted px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Challenge ended
        </p>
      ) : null}

      {!previewMode && !hasTeam ? (
        <p className="border-2 border-border bg-muted px-3 py-2 text-sm font-bold">
          Join a team to see your spread score
        </p>
      ) : null}

      {!previewMode && hasTeam && teamProgressLoading ? (
        <LoadingSkeleton variant="challenge" />
      ) : null}

      {(previewMode || (hasTeam && !teamProgressLoading)) ? (
        <SpreadMeter value={progressValue} target={challenge.targetSpreadPercentage} />
      ) : null}

      <p className="mt-4 text-sm font-bold" aria-live="polite">
        {statusLine}
      </p>
    </section>
  );
}
