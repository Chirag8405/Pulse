"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, Map, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SeatInputSchema } from "@/lib/schemas";
import { joinTeam } from "@/lib/firebase/helpers";
import { TEAM_MAPPINGS, getTeamForSeatSection } from "@/constants/teams";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStore } from "@/stores/onboardingStore";

function getSectionFromSeatInput(value: string): string {
  return value.trim().toUpperCase().split("-")[0] ?? "";
}

function estimateSectionCount(section: string, teamId: string): number {
  const sectionSeed = section.charCodeAt(0) || 65;
  const teamSeed = teamId.length * 7;
  return 120 + ((sectionSeed + teamSeed) % 80);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Could not complete team assignment.";
}

export default function JoinPage() {
  const router = useRouter();
  const { user } = useAuth();

  const step = useOnboardingStore((state) => state.step);
  const direction = useOnboardingStore((state) => state.direction);
  const seatInput = useOnboardingStore((state) => state.seatInput);
  const selectedTeamId = useOnboardingStore((state) => state.selectedTeamId);
  const setSeatInput = useOnboardingStore((state) => state.setSeatInput);
  const setSelectedTeamId = useOnboardingStore((state) => state.setSelectedTeamId);
  const goToNextStep = useOnboardingStore((state) => state.goToNextStep);
  const goToPreviousStep = useOnboardingStore((state) => state.goToPreviousStep);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  const [seatError, setSeatError] = useState<string | null>(null);
  const [isSeatValid, setIsSeatValid] = useState(false);

  const seatSection = useMemo(() => getSectionFromSeatInput(seatInput), [seatInput]);

  const selectedTeam = useMemo(
    () => TEAM_MAPPINGS.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId]
  );

  const sectionMemberCount = useMemo(() => {
    if (!selectedTeam || !seatSection) {
      return 0;
    }

    return estimateSectionCount(seatSection, selectedTeam.id);
  }, [seatSection, selectedTeam]);

  useEffect(() => {
    const normalized = seatInput.trim().toUpperCase();

    const timeoutId = window.setTimeout(() => {
      if (normalized.length === 0) {
        setSeatError(null);
        setIsSeatValid(false);
        return;
      }

      const validation = SeatInputSchema.safeParse(normalized);

      if (validation.success) {
        setSeatError(null);
        setIsSeatValid(true);
        return;
      }

      setSeatError(validation.error.issues[0]?.message ?? "Invalid seat format");
      setIsSeatValid(false);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [seatInput]);

  const handleSeatContinue = useCallback(() => {
    const normalized = seatInput.trim().toUpperCase();
    const validation = SeatInputSchema.safeParse(normalized);

    if (!validation.success) {
      setSeatError(validation.error.issues[0]?.message ?? "Invalid seat format");
      setIsSeatValid(false);
      return;
    }

    const section = getSectionFromSeatInput(normalized);
    const mappedTeam = getTeamForSeatSection(section);

    if (!mappedTeam) {
      toast.error("Could not map your section to a team. Try another seat.");
      return;
    }

    setSeatInput(normalized);
    setSelectedTeamId(mappedTeam.id);
    goToNextStep();
  }, [goToNextStep, seatInput, setSeatInput, setSelectedTeamId]);

  const handleJoinThisTeam = useCallback(() => {
    if (!selectedTeam) {
      toast.error("Team details are missing. Please go back and try again.");
      return;
    }

    goToNextStep();
  }, [goToNextStep, selectedTeam]);

  const handleBrowseAsGuest = useCallback(() => {
    resetOnboarding();
    router.push("/dashboard");
  }, [resetOnboarding, router]);

  const handleEnterArena = useCallback(() => {
    if (!user?.uid) {
      toast.error("User session not found. Please sign in again.");
      return;
    }

    if (!selectedTeam?.id) {
      toast.error("No team selected. Please complete the reveal step again.");
      return;
    }

    const userId = user.uid;
    const teamId = selectedTeam.id;

    router.push("/dashboard");
    resetOnboarding();

    void joinTeam(userId, teamId).catch((error) => {
      toast.error(getErrorMessage(error));
    });
  }, [resetOnboarding, router, selectedTeam, user]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Escape" || event.key === "Backspace") && step > 1) {
        const targetElement = event.target as HTMLElement | null;
        const isTextInput =
          targetElement?.tagName === "INPUT" || targetElement?.tagName === "TEXTAREA";

        if (event.key === "Escape" || !isTextInput) {
          event.preventDefault();
          goToPreviousStep();
          return;
        }
      }

      if (event.key !== "Enter") {
        return;
      }

      if (step === 1 && isSeatValid) {
        event.preventDefault();
        handleSeatContinue();
        return;
      }

      if (step === 2 && selectedTeam) {
        event.preventDefault();
        handleJoinThisTeam();
        return;
      }

      if (step === 3 && selectedTeam && user?.uid) {
        event.preventDefault();
        handleEnterArena();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    goToPreviousStep,
    handleEnterArena,
    handleJoinThisTeam,
    handleSeatContinue,
    isSeatValid,
    selectedTeam,
    step,
    user?.uid,
  ]);

  return (
    <AuthGuard>
      <section className="mx-auto flex min-h-[calc(100vh-11rem)] w-full max-w-3xl items-center justify-center px-4 py-8">
        <div className="nb-card w-full max-w-md bg-card p-6">
          <div className="mb-5 flex items-center justify-center gap-2" aria-hidden="true">
            {[1, 2, 3].map((dot) => {
              const active = dot === step;
              return (
                <span
                  key={dot}
                  className={cn(
                    "h-3 w-3 border-2 border-border",
                    active ? "bg-primary" : "bg-transparent"
                  )}
                />
              );
            })}
          </div>

          <p className="mb-4 text-center font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Step {step} of 3
          </p>

          {step > 1 ? (
            <button
              type="button"
              onClick={goToPreviousStep}
              className="mb-4 border-2 border-border px-3 py-1 text-xs font-bold"
            >
              Back
            </button>
          ) : null}

          <div
            key={`${step}-${direction}`}
            className={cn(
              direction === "forward"
                ? "nb-onboarding-slide-left"
                : "nb-onboarding-slide-right"
            )}
          >
            {step === 1 ? (
              <div>
                <h1 className="text-center text-3xl font-black tracking-tight">
                  Enter your seat number
                </h1>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Found on your ticket. Format: Section-Row-Seat
                </p>

                <div className="relative mt-6">
                  <input
                    value={seatInput}
                    onChange={(event) =>
                      setSeatInput(
                        event.target.value.toUpperCase().replace(/\s+/g, "")
                      )
                    }
                    placeholder="A-12-34"
                    aria-label="Seat number"
                    className={cn(
                      "h-14 w-full border-2 px-4 pr-10 font-mono text-lg outline-none",
                      isSeatValid
                        ? "border-emerald-600"
                        : seatError
                          ? "border-red-600"
                          : "border-border"
                    )}
                  />

                  {isSeatValid ? (
                    <CheckCircle2
                      className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>

                {seatError ? (
                  <p className="mt-2 font-mono text-sm text-red-600">{seatError}</p>
                ) : null}

                <Button
                  type="button"
                  onClick={handleSeatContinue}
                  disabled={!isSeatValid}
                  className="nb-btn mt-6 h-11 w-full border-2 border-border bg-primary text-base font-bold text-primary-foreground"
                >
                  Continue
                </Button>
              </div>
            ) : null}

            {step === 2 && selectedTeam ? (
              <div className="nb-reveal-up text-center">
                <p className="text-[64px] leading-none" aria-hidden="true">
                  {selectedTeam.emoji}
                </p>
                <h2 className="mt-4 text-4xl font-black tracking-tight">
                  {selectedTeam.name}
                </h2>

                <div
                  className="mx-auto mt-5 h-20 w-20 border-2 border-border"
                  style={{
                    backgroundColor: selectedTeam.colorHex,
                    boxShadow: `4px 4px 0px 0px ${selectedTeam.colorHex}`,
                  }}
                  aria-hidden="true"
                />

                <p className="mt-5 font-mono text-sm text-muted-foreground">
                  You are joining {sectionMemberCount} fans in your section
                </p>

                <Button
                  type="button"
                  onClick={handleJoinThisTeam}
                  className="nb-btn mt-6 h-11 w-full border-2 border-border bg-primary text-base font-bold text-primary-foreground"
                >
                  Join This Team
                </Button>

                <button
                  type="button"
                  onClick={handleBrowseAsGuest}
                  className="mt-3 font-semibold underline"
                >
                  Browse as Guest
                </button>
              </div>
            ) : null}

            {step === 3 && selectedTeam ? (
              <div>
                <h2 className="text-center text-2xl font-black tracking-tight">
                  You are in. Here is how it works.
                </h2>

                <ol className="mt-6 space-y-3">
                  <li className="flex items-start gap-3 border-2 border-border px-3 py-3">
                    <span className="font-mono text-xl font-black text-muted-foreground">1</span>
                    <Bell className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                    <p className="text-sm font-bold">Challenge is announced</p>
                  </li>
                  <li className="flex items-start gap-3 border-2 border-border px-3 py-3">
                    <span className="font-mono text-xl font-black text-muted-foreground">2</span>
                    <Map className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                    <p className="text-sm font-bold">Your team spreads across zones</p>
                  </li>
                  <li className="flex items-start gap-3 border-2 border-border px-3 py-3">
                    <span className="font-mono text-xl font-black text-muted-foreground">3</span>
                    <Trophy className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                    <p className="text-sm font-bold">Team wins. Reward unlocked.</p>
                  </li>
                </ol>

                <Button
                  type="button"
                  onClick={handleEnterArena}
                  className="nb-btn mt-6 h-11 w-full border-2 border-border bg-primary text-base font-bold text-primary-foreground"
                >
                  Enter the Arena
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AuthGuard>
  );
}
