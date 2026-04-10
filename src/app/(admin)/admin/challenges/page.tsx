"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Timestamp, addDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { AlertTriangle, Bot, RefreshCcw, Sparkles } from "lucide-react";
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
import { logVenueAnalyticsEvent } from "@/lib/firebase/analytics";
import {
  auditLogCollection,
  challengeDoc,
  challengesCollection,
} from "@/lib/firebase/collections";
import { recommendChallengeParams } from "@/lib/recommender/challengeRecommender";
import { AdminChallengeSchema } from "@/lib/schemas";
import type { Challenge, ChallengeTeamProgress } from "@/types/firebase";

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

function buildFormErrors(validationMessage: string, fieldPath: string): ChallengeFormErrors {
  if (
    fieldPath !== "title" &&
    fieldPath !== "description" &&
    fieldPath !== "targetSpreadPercentage" &&
    fieldPath !== "targetZoneCount" &&
    fieldPath !== "durationMinutes" &&
    fieldPath !== "rewardType" &&
    fieldPath !== "rewardDescription"
  ) {
    return {};
  }

  return {
    [fieldPath]: validationMessage,
  };
}

function AdminChallengesContent() {
  const { firestoreUser } = useAuth();

  const { data: activeEvent } = useActiveEvent();
  const { data: activeChallenge, loading: activeChallengeLoading } = useActiveChallenge(
    activeEvent?.id ?? null
  );

  const { data: teams } = useTeamsByEvent(activeEvent?.id ?? null);
  const { data: challengesFeed } = useChallengesFeed(200);
  const { data: occupancy } = useZoneOccupancy();
  const {
    data: leaderboardRows,
    loading: leaderboardLoading,
  } = useLeaderboard(activeChallenge?.id, 200);

  const [formValues, setFormValues] = useState<ChallengeFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<ChallengeFormErrors>({});
  const [recalcNonce, setRecalcNonce] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEndingChallenge, setIsEndingChallenge] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const historicalSpreadScores = useMemo(() => {
    return challengesFeed
      .filter(
        (challenge) =>
          challenge.status === "completed" &&
          (!activeEvent || challenge.eventId === activeEvent.id)
      )
      .slice(0, 10)
      .map((challenge) => challenge.targetSpreadPercentage);
  }, [activeEvent, challengesFeed]);

  const eventMinutesElapsed = useMemo(() => {
    if (!activeEvent) {
      return 0;
    }

    const referenceMillis =
      occupancy.updatedAtMillis > 0
        ? occupancy.updatedAtMillis
        : activeEvent.startTime.toMillis();

    return Math.max(
      0,
      Math.floor((referenceMillis - activeEvent.startTime.toMillis()) / 60_000)
    );
  }, [activeEvent, occupancy.updatedAtMillis]);

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
      participatingTeamIds: teams.map((team) => team.id),
    };
  }, [activeEvent?.id, formValues, teams]);

  const aggregateProgress = useMemo<ChallengeTeamProgress | null>(() => {
    if (!activeChallenge) {
      return null;
    }

    const averageSpread =
      leaderboardRows.length > 0
        ? leaderboardRows.reduce((sum, row) => sum + row.spreadScore, 0) /
          leaderboardRows.length
        : 0;

    const memberCount = leaderboardRows.reduce(
      (sum, row) => sum + row.memberCount,
      0
    );

    return {
      teamId: "aggregate",
      challengeId: activeChallenge.id,
      spreadScore: Math.round(averageSpread),
      activeZones: [],
      completedAt: null,
      isCompleted: false,
      memberCount,
    };
  }, [activeChallenge, leaderboardRows]);

  const suggestionZoneCards = recommendation.suggestedTargetZones.map((zoneId) => {
    const zone = ZONES.find((candidate) => candidate.id === zoneId);

    return {
      id: zoneId,
      name: zone?.name ?? zoneId,
      gate: zone?.gate ?? "Unknown Gate",
    };
  });

  const handleUseRecommendedSettings = () => {
    const recommendedZoneCount = Math.min(
      6,
      Math.max(2, recommendation.suggestedTargetZones.length)
    );
    const recommendedSpread = Math.min(
      90,
      Math.max(50, recommendation.suggestedSpreadPercentage)
    );
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
        const fieldPath = String(issue.path[0] ?? "");
        return {
          ...acc,
          ...buildFormErrors(issue.message, fieldPath),
        };
      }, {});

      setFormErrors(nextErrors);
      return;
    }

    if (!activeEvent) {
      toast.error("No active event. Start an event before creating a challenge.");
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const startTime = Timestamp.now();
      const endTime = Timestamp.fromMillis(
        startTime.toMillis() + parsed.data.durationMinutes * 60_000
      );

      const challengeReference = doc(challengesCollection);

      const challengePayload: Challenge = {
        id: challengeReference.id,
        eventId: activeEvent.id,
        title: parsed.data.title,
        description: parsed.data.description,
        targetSpreadPercentage: parsed.data.targetSpreadPercentage,
        targetZoneCount: parsed.data.targetZoneCount,
        durationMinutes: parsed.data.durationMinutes,
        startTime,
        endTime,
        status: "active",
        reward: {
          type: parsed.data.rewardType,
          description: parsed.data.rewardDescription,
          unlockedAt: null,
        },
        participatingTeamIds: teams.map((team) => team.id),
      };

      await setDoc(challengeReference, challengePayload);

      await addDoc(auditLogCollection, {
        action: "challenge_created",
        adminUid: firestoreUser?.uid ?? "unknown",
        timestamp: serverTimestamp(),
        challengeId: challengeReference.id,
      });

      logVenueAnalyticsEvent("challenge_created", {
        challengeId: challengeReference.id,
        eventId: activeEvent.id,
      });

      toast.success("Challenge created successfully.");
      setFormValues(INITIAL_FORM_VALUES);
      setFormErrors({});
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Challenge creation failed.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndChallengeEarly = async () => {
    if (!activeChallenge) {
      return;
    }

    setIsEndingChallenge(true);

    try {
      await updateDoc(challengeDoc(activeChallenge.id), {
        status: "completed",
        endTime: Timestamp.now(),
      });

      logVenueAnalyticsEvent("challenge_completed", {
        challengeId: activeChallenge.id,
        eventId: activeChallenge.eventId,
      });

      toast.success("Challenge ended early.");
      setConfirmEndOpen(false);
    } catch (endError) {
      const message = endError instanceof Error ? endError.message : "Failed to end challenge.";
      toast.error(message);
    } finally {
      setIsEndingChallenge(false);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Challenge Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure challenges, launch recommendations, and monitor completion live.
        </p>
      </header>

      <section className="nb-card border-l-4 border-l-amber-500 bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="size-5" />
          <h2 className="text-xl font-black tracking-tight">Smart Challenge Recommender</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Based on current crowd data and event context, here is what we recommend:
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="nb-card bg-card p-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Suggested target zones
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
                Suggested spread %
              </p>
              <p className="mt-2 font-mono text-4xl font-black">
                {recommendation.suggestedSpreadPercentage}%
              </p>
            </article>
            <article className="nb-card bg-card p-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Suggested duration
              </p>
              <p className="mt-2 font-mono text-4xl font-black">
                {recommendation.suggestedDuration}m
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
            onClick={() => setRecalcNonce((value) => value + 1)}
            className="nb-btn rounded-none border-2 border-border bg-card font-bold"
          >
            <RefreshCcw className="size-4" />
            Recalculate
          </Button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <form className="nb-card bg-card p-5" onSubmit={handleCreateChallenge}>
          <h2 className="text-xl font-black tracking-tight">CREATE NEW CHALLENGE</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="challenge-title">
                Title
              </label>
              <Input
                id="challenge-title"
                value={formValues.title}
                maxLength={80}
                onChange={(changeEvent) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    title: changeEvent.target.value,
                  }))
                }
                className="rounded-none border-2 border-border"
              />
              <div className="mt-1 flex items-center justify-between font-mono text-xs">
                <span className="text-destructive">{formErrors.title}</span>
                <span className="text-muted-foreground">{formValues.title.length}/80</span>
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
                onChange={(changeEvent) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    description: changeEvent.target.value,
                  }))
                }
                className="min-h-24 rounded-none border-2 border-border"
              />
              <div className="mt-1 flex items-center justify-between font-mono text-xs">
                <span className="text-destructive">{formErrors.description}</span>
                <span className="text-muted-foreground">{formValues.description.length}/200</span>
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-bold">Target Spread %</p>
              <div className="flex items-center gap-3">
                <Slider
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
                <p className="mb-1 text-sm font-bold">Target Zone Count</p>
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
                <p className="mb-1 text-sm font-bold">Duration</p>
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
                <p className="mb-1 text-sm font-bold">Reward Type</p>
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
                  onChange={(changeEvent) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      rewardDescription: changeEvent.target.value,
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

      <section className="space-y-3">
        <h2 className="text-xl font-black tracking-tight">Active Challenge</h2>

        {!activeChallenge || activeChallengeLoading ? (
          <EmptyState
            icon={AlertTriangle}
            title="No active challenge"
            description="Launch a challenge from the form above to start live tracking."
          />
        ) : (
          <>
            <ActiveChallengeCard
              challenge={activeChallenge}
              teamProgress={aggregateProgress}
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

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Spread Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Members</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboardRows.map((row) => (
                    <TableRow key={`${row.teamId}-${row.challengeId}`}>
                      <TableCell className="font-bold">{getTeamName(row.teamId)}</TableCell>
                      <TableCell className="font-mono">{Math.round(row.spreadScore)}%</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            row.isCompleted
                              ? "rounded-none border-2 border-border bg-emerald-500 px-2 py-1 text-xs font-bold text-white"
                              : "rounded-none border-2 border-border bg-amber-400 px-2 py-1 text-xs font-bold text-foreground"
                          }
                        >
                          {row.isCompleted ? "Completed" : "In Progress"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{row.memberCount}</TableCell>
                    </TableRow>
                  ))}
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

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent className="rounded-none border-2 border-border bg-card p-5" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">End challenge now?</DialogTitle>
            <DialogDescription>
              This action marks the challenge as completed for all participants.
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
              {isEndingChallenge ? "Ending..." : "Confirm End"}
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
