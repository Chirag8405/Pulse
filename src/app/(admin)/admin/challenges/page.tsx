"use client";

import { Fragment, type FormEvent, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { Bot, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ActiveChallengeCard } from "@/components/attendee/ActiveChallengeCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  CHALLENGE_DURATION_OPTIONS,
  REWARD_TYPES,
  type RewardType,
  ZONES,
} from "@/constants";
import { TEAM_MAPPINGS } from "@/constants/teams";
import { useActiveChallenge } from "@/hooks/useActiveChallenge";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import {
  useChallengesFeed,
  useTeamsByEvent,
  useZoneOccupancy,
} from "@/hooks/useAdminRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import {
  completeAdminChallenge,
  createAdminChallenge,
  setAdminChallengeLive,
} from "@/lib/firebase/adminApi";
import { logVenueAnalyticsEvent } from "@/lib/firebase/analytics";
import { recommendChallengeParams } from "@/lib/recommender/challengeRecommender";
import { AdminChallengeSchema } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/shared/errorUtils";
import type { Challenge } from "@/types/firebase";

interface ChallengeFormValues {
  title: string;
  description: string;
  targetSpreadPercentage: number;
  targetZoneCount: number;
  durationMinutes: number;
  rewardType: RewardType;
  rewardDescription: string;
}

type ChallengeFormErrors = Partial<Record<keyof ChallengeFormValues, string>>;

const PREVIEW_TIMESTAMP = Timestamp.fromMillis(0);

const INITIAL_FORM_VALUES: ChallengeFormValues = {
  title: "",
  description: "",
  targetSpreadPercentage: 70,
  targetZoneCount: 3,
  durationMinutes: 10,
  rewardType: REWARD_TYPES[0],
  rewardDescription: "",
};

function getTeamName(teamId: string): string {
  return TEAM_MAPPINGS.find((team) => team.id === teamId)?.name ?? teamId;
}

function mapIssueToField(fieldPath: string): keyof ChallengeFormValues | null {
  if (
    fieldPath === "title" ||
    fieldPath === "description" ||
    fieldPath === "targetSpreadPercentage" ||
    fieldPath === "targetZoneCount" ||
    fieldPath === "durationMinutes" ||
    fieldPath === "rewardType" ||
    fieldPath === "rewardDescription"
  ) {
    return fieldPath;
  }

  return null;
}

function AdminChallengesContent() {
  const { user, firestoreUser } = useAuth();

  const { data: activeEvent, loading: activeEventLoading } = useActiveEvent();
  const { data: activeChallenge, loading: activeChallengeLoading } = useActiveChallenge(
    activeEvent?.id ?? null
  );
  const { data: teams } = useTeamsByEvent(activeEvent?.id ?? null);
  const { data: challengesFeed, loading: challengesLoading, error: challengesError } =
    useChallengesFeed(200);
  const { data: occupancy, error: occupancyError } = useZoneOccupancy();
  const {
    data: leaderboardRows,
    loading: leaderboardLoading,
    error: leaderboardError,
  } = useLeaderboard(activeChallenge?.id, 200);

  const [formValues, setFormValues] = useState<ChallengeFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<ChallengeFormErrors>({});
  const [recalcNonce, setRecalcNonce] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingLiveId, setIsSettingLiveId] = useState<string | null>(null);
  const [isEndingChallenge, setIsEndingChallenge] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const eventChallenges = useMemo(() => {
    if (!activeEvent) {
      return [];
    }

    return challengesFeed.filter((challenge) => challenge.eventId === activeEvent.id);
  }, [activeEvent, challengesFeed]);

  const pendingChallenges = useMemo(() => {
    return eventChallenges
      .filter((challenge) => challenge.status === "pending")
      .sort((left, right) => right.startTime.toMillis() - left.startTime.toMillis());
  }, [eventChallenges]);

  const historicalSpreadScores = useMemo(() => {
    return eventChallenges
      .filter((challenge) => challenge.status === "completed")
      .sort((left, right) => right.startTime.toMillis() - left.startTime.toMillis())
      .slice(0, 5)
      .map((challenge) => challenge.targetSpreadPercentage);
  }, [eventChallenges]);

  const eventMinutesElapsed = useMemo(() => {
    if (!activeEvent) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor((Date.now() - activeEvent.startTime.toDate().getTime()) / 60_000)
    );
  }, [activeEvent]);

  const recommendation = useMemo(() => {
    void recalcNonce;

    return recommendChallengeParams({
      currentOccupancy: occupancy.byZone,
      eventMinutesElapsed,
      historicalSpreadScores,
      teamCount: Math.max(1, teams.length),
    });
  }, [eventMinutesElapsed, historicalSpreadScores, occupancy.byZone, recalcNonce, teams.length]);

  const previewChallenge = useMemo<Challenge>(() => {
    return {
      id: "preview",
      eventId: activeEvent?.id ?? "preview-event",
      title: formValues.title || "New Challenge Title",
      description: formValues.description || "Challenge description will appear here.",
      targetSpreadPercentage: formValues.targetSpreadPercentage,
      targetZoneCount: formValues.targetZoneCount,
      durationMinutes: formValues.durationMinutes,
      startTime: PREVIEW_TIMESTAMP,
      endTime: PREVIEW_TIMESTAMP,
      status: "pending",
      reward: {
        type: formValues.rewardType,
        description: formValues.rewardDescription || "Reward details will appear here",
        unlockedAt: null,
      },
      participatingTeamIds: [],
    };
  }, [activeEvent?.id, formValues]);

  const suggestionZoneCards = recommendation.suggestedTargetZones.map((zoneId) => {
    const zone = ZONES.find((candidate) => candidate.id === zoneId);

    return {
      id: zoneId,
      name: zone?.name ?? zoneId,
      gate: zone?.gate ?? "Unknown Gate",
    };
  });

  const handleRecalculate = () => {
    setIsRecalculating(true);

    window.setTimeout(() => {
      setRecalcNonce((value) => value + 1);
      setIsRecalculating(false);
    }, 200);
  };

  const handleUseRecommendedSettings = () => {
    const recommendedZoneCount = Math.min(6, Math.max(2, recommendation.suggestedTargetZones.length));
    const recommendedSpread = Math.min(90, Math.max(50, recommendation.suggestedSpreadPercentage));
    const recommendedDuration = CHALLENGE_DURATION_OPTIONS.includes(
      recommendation.suggestedDuration as (typeof CHALLENGE_DURATION_OPTIONS)[number]
    )
      ? recommendation.suggestedDuration
      : 10;

    setFormValues((currentValues) => ({
      ...currentValues,
      targetSpreadPercentage: recommendedSpread,
      targetZoneCount: recommendedZoneCount,
      durationMinutes: recommendedDuration,
    }));
  };

  const handleCreateChallenge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = AdminChallengeSchema.safeParse(formValues);

    if (!parsed.success) {
      const nextErrors = parsed.error.issues.reduce<ChallengeFormErrors>((acc, issue) => {
        const fieldName = mapIssueToField(String(issue.path[0] ?? ""));

        if (!fieldName || acc[fieldName]) {
          return acc;
        }

        return {
          ...acc,
          [fieldName]: issue.message,
        };
      }, {});

      setFormErrors(nextErrors);
      return;
    }

    if (!activeEvent) {
      toast.error("No active event. Start an event before creating a challenge.");
      return;
    }

    if (!user) {
      toast.error("Authentication expired. Please sign in again.");
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const createdChallenge = await createAdminChallenge(user, {
        eventId: activeEvent.id,
        title: parsed.data.title,
        description: parsed.data.description,
        targetSpreadPercentage: parsed.data.targetSpreadPercentage,
        targetZoneCount: parsed.data.targetZoneCount,
        durationMinutes: parsed.data.durationMinutes,
        rewardType: parsed.data.rewardType,
        rewardDescription: parsed.data.rewardDescription,
      });

      logVenueAnalyticsEvent("challenge_created", {
        challengeId: createdChallenge.id,
      });

      toast.success("Challenge created. Set it live when ready.");
      setFormValues(INITIAL_FORM_VALUES);
    } catch (createError) {
      toast.error(getErrorMessage(createError, "Challenge creation failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetLive = async (challenge: Challenge) => {
    if (activeChallenge && activeChallenge.id !== challenge.id) {
      toast.error("End the current active challenge first");
      return;
    }

    if (!activeEvent) {
      toast.error("No active event found.");
      return;
    }

    if (!user) {
      toast.error("Authentication expired. Please sign in again.");
      return;
    }

    setIsSettingLiveId(challenge.id);

    try {
      await setAdminChallengeLive(user, {
        challengeId: challenge.id,
        eventId: activeEvent.id,
        durationMinutes: challenge.durationMinutes,
      });

      toast.success("Challenge is now live.");
    } catch (setLiveError) {
      toast.error(getErrorMessage(setLiveError, "Could not set challenge live."));
    } finally {
      setIsSettingLiveId(null);
    }
  };

  const handleEndChallengeEarly = async () => {
    if (!activeChallenge) {
      return;
    }

    if (!user) {
      toast.error("Authentication expired. Please sign in again.");
      return;
    }

    setIsEndingChallenge(true);

    try {
      await completeAdminChallenge(user, {
        challengeId: activeChallenge.id,
      });

      logVenueAnalyticsEvent("challenge_completed", {
        challengeId: activeChallenge.id,
        endedEarly: true,
        adminUid: firestoreUser?.uid ?? "unknown",
      });

      toast.success("Challenge ended early.");
      setConfirmEndOpen(false);
    } catch (endError) {
      toast.error(getErrorMessage(endError, "Failed to end challenge."));
    } finally {
      setIsEndingChallenge(false);
    }
  };

  const combinedError = challengesError ?? occupancyError ?? leaderboardError;

  if (activeEventLoading || challengesLoading) {
    return <EmptyState icon={Bot} title="Loading challenge operations" description="Fetching event and challenge state..." />;
  }

  if (!activeEvent) {
    return (
      <EmptyState
        icon={Bot}
        title="No active event"
        description="Start an event before creating or activating challenges."
      />
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Challenge Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure, stage, and activate challenges in realtime.
        </p>
      </header>

      <section className="nb-card border-l-4 border-l-amber-500 bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="size-5" />
          <h2 className="text-xl font-black tracking-tight">🤖 Smart Challenge Recommender</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Based on current crowd distribution and event timing.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="nb-card bg-card p-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Suggested zones to target
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {suggestionZoneCards.map((zone) => (
                <article key={zone.id} className="border-2 border-border bg-muted px-2 py-2">
                  <p className="text-sm font-bold">{zone.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{zone.gate}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="nb-card bg-card p-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Recommended spread target
              </p>
              <p className="mt-2 font-mono text-4xl font-black">
                {recommendation.suggestedSpreadPercentage}%
              </p>
            </article>
            <article className="nb-card bg-card p-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Recommended duration
              </p>
              <p className="mt-2 font-mono text-4xl font-black">
                {recommendation.suggestedDuration} min
              </p>
            </article>
          </div>
        </div>

        <blockquote className="mt-3 border-2 border-border bg-muted px-3 py-2 text-sm italic text-muted-foreground">
          {recommendation.reasoning}
        </blockquote>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleUseRecommendedSettings}
            className="nb-btn rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
          >
            <Sparkles className="size-4" />
            Use These Settings
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRecalculate}
            className="nb-btn rounded-none border-2 border-border bg-card font-bold"
          >
            <RefreshCcw className="size-4" />
            Recalculate
          </Button>
          {isRecalculating ? (
            <span className="inline-flex items-center font-mono text-xs text-muted-foreground">
              Recalculating...
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <form className="nb-card bg-card p-5" onSubmit={handleCreateChallenge}>
          <h2 className="text-xl font-black tracking-tight">Create Challenge</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="challenge-title">
                Title
              </label>
              <Input
                id="challenge-title"
                value={formValues.title}
                maxLength={80}
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    title: event.target.value,
                  }))
                }
                className="rounded-none border-2 border-border"
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="font-mono text-destructive">{formErrors.title}</span>
                <span className="font-mono text-muted-foreground">{formValues.title.length}/80</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="challenge-description">
                Description
              </label>
              <Textarea
                id="challenge-description"
                value={formValues.description}
                maxLength={200}
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    description: event.target.value,
                  }))
                }
                className="min-h-24 rounded-none border-2 border-border"
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="font-mono text-destructive">{formErrors.description}</span>
                <span className="font-mono text-muted-foreground">{formValues.description.length}/200</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="challenge-target-spread">
                Target Spread %
              </label>
              <div className="flex items-center gap-3">
                <Slider
                  id="challenge-target-spread"
                  min={50}
                  max={90}
                  step={1}
                  value={[formValues.targetSpreadPercentage]}
                  onValueChange={(values) => {
                    const nextValue = Array.isArray(values) ? values[0] : values;

                    if (typeof nextValue !== "number") {
                      return;
                    }

                    setFormValues((currentValues) => ({
                      ...currentValues,
                      targetSpreadPercentage: nextValue,
                    }));
                  }}
                />
                <span className="font-mono text-lg font-black">{formValues.targetSpreadPercentage}%</span>
              </div>
              <p className="mt-1 font-mono text-xs text-destructive">{formErrors.targetSpreadPercentage}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-bold">Target Zone Count</label>
                <Select
                  value={String(formValues.targetZoneCount)}
                  onValueChange={(value) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      targetZoneCount: Number(value),
                    }))
                  }
                >
                  <SelectTrigger className="w-full rounded-none border-2 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-border">
                    {[2, 3, 4, 5, 6].map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 font-mono text-xs text-destructive">{formErrors.targetZoneCount}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">Duration</label>
                <Select
                  value={String(formValues.durationMinutes)}
                  onValueChange={(value) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      durationMinutes: Number(value),
                    }))
                  }
                >
                  <SelectTrigger className="w-full rounded-none border-2 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-border">
                    {CHALLENGE_DURATION_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 font-mono text-xs text-destructive">{formErrors.durationMinutes}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-bold">Reward Type</label>
                <Select
                  value={formValues.rewardType}
                  onValueChange={(value) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      rewardType: value as RewardType,
                    }))
                  }
                >
                  <SelectTrigger className="w-full rounded-none border-2 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-border">
                    {REWARD_TYPES.map((rewardType) => (
                      <SelectItem key={rewardType} value={rewardType}>
                        {rewardType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 font-mono text-xs text-destructive">{formErrors.rewardType}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold" htmlFor="reward-description">
                  Reward Description
                </label>
                <Input
                  id="reward-description"
                  value={formValues.rewardDescription}
                  maxLength={150}
                  onChange={(event) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      rewardDescription: event.target.value,
                    }))
                  }
                  className="rounded-none border-2 border-border"
                />
                <p className="mt-1 font-mono text-xs text-destructive">{formErrors.rewardDescription}</p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="nb-btn w-full rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
            >
              {isSubmitting ? "Creating..." : "Create Challenge"}
            </Button>
          </div>
        </form>

        <section className="nb-card bg-card p-5">
          <h3 className="text-lg font-black tracking-tight">Live Preview</h3>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            This is how attendees will see the challenge card.
          </p>
          <ActiveChallengeCard
            challenge={previewChallenge}
            teamProgress={null}
            statusLine={`Target ${formValues.targetZoneCount} zones • Reward: ${formValues.rewardType}`}
            previewMode
          />
        </section>
      </section>

      <section className="nb-card bg-card p-4">
        <h2 className="text-xl font-black tracking-tight">Pending Challenges</h2>

        {pendingChallenges.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No pending challenges.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pendingChallenges.map((challenge) => (
              <article key={challenge.id} className="border-2 border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{challenge.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {challenge.targetSpreadPercentage}% target • {challenge.durationMinutes} min
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleSetLive(challenge);
                    }}
                    disabled={Boolean(isSettingLiveId)}
                    className="nb-btn rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
                  >
                    {isSettingLiveId === challenge.id ? "Setting..." : "Set Live"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black tracking-tight">Active Challenge</h2>

        {!activeChallenge || activeChallengeLoading ? (
          <EmptyState
            icon={Bot}
            title="No active challenge"
            description="Set a pending challenge live to start realtime team tracking."
          />
        ) : (
          <>
            <ActiveChallengeCard
              challenge={activeChallenge}
              teamProgress={null}
              statusLine={`${activeChallenge.participatingTeamIds.length} teams participating`}
            />

            <section className="nb-card bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Team Progress
                </h3>
                <Badge className="rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground">
                  {leaderboardRows.length} teams
                </Badge>
              </div>

              <Table aria-label="Challenge team progress table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Spread Score</TableHead>
                    <TableHead>Zones Active</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboardRows
                    .toSorted((left, right) => right.spreadScore - left.spreadScore)
                    .map((row) => {
                      const rowKey = `${row.teamId}-${row.challengeId}`;

                      return (
                        <Fragment key={rowKey}>
                          <TableRow>
                            <TableCell className="font-bold">{getTeamName(row.teamId)}</TableCell>
                            <TableCell className="font-mono">{Math.round(row.spreadScore)}%</TableCell>
                            <TableCell className="font-mono">{row.activeZones.length}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  row.isCompleted
                                    ? "rounded-none border-2 border-border bg-emerald-500 px-2 py-1 text-xs font-bold text-white"
                                    : "rounded-none border-2 border-border bg-amber-400 px-2 py-1 text-xs font-bold text-black"
                                }
                              >
                                {row.isCompleted ? "Completed" : "In Progress"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      );
                    })}
                </TableBody>
              </Table>

              {leaderboardLoading ? (
                <p className="mt-2 font-mono text-xs text-muted-foreground">Loading progress...</p>
              ) : null}
            </section>

            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmEndOpen(true)}
              className="nb-btn rounded-none border-2 border-red-600 bg-white font-bold text-red-600"
            >
              End Challenge Early
            </Button>
          </>
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

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent className="rounded-none border-2 border-border bg-card p-5" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">
              End challenge for all teams? This cannot be undone.
            </DialogTitle>
            <DialogDescription>
              The challenge will immediately stop for every attendee.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none border-2 border-border bg-card font-bold"
              onClick={() => setConfirmEndOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="nb-btn w-full rounded-none border-2 border-red-600 bg-white font-bold text-red-600"
              onClick={() => {
                void handleEndChallengeEarly();
              }}
              disabled={isEndingChallenge}
            >
              {isEndingChallenge ? "Ending..." : "End Challenge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function AdminChallengesPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminChallengesContent />
    </AuthGuard>
  );
}
