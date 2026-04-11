"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Shield,
  Star,
  Target,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { updateDoc } from "firebase/firestore";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { TeamBadge } from "@/components/shared/TeamBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Switch } from "@/components/ui/switch";
import { TEAM_MAPPINGS } from "@/constants/teams";
import { useAuth } from "@/hooks/useAuth";
import { getTeamById } from "@/lib/firebase/helpers";
import { deleteAccount, signOut } from "@/lib/firebase/auth";
import { UserProfileUpdateSchema } from "@/lib/schemas";
import { userDoc } from "@/lib/firebase/collections";
import { useAuthStore } from "@/stores/authStore";

type SaveState = "idle" | "saving" | "saved" | "error";

const LOCATION_PREF_KEY = "pulse_location_permission";

function formatMemberSinceLabel(epochMillis: number | null): string {
  if (!epochMillis) {
    return "Unknown";
  }

  return new Date(epochMillis).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(displayName: string | null, email: string | null): string {
  const source = (displayName ?? email ?? "PULSE").trim();

  const words = source.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0]?.[0] ?? "P"}${words[1]?.[0] ?? "U"}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Action failed. Please try again.";
}

function ProfileContent() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const { user, firestoreUser } = useAuth();
  const setFirestoreUser = useAuthStore((state) => state.setFirestoreUser);

  const teamId = firestoreUser?.teamId ?? null;
  const { data: teamDoc } = useQuery({
    queryKey: ["team-profile", teamId],
    queryFn: () => getTeamById(teamId as string),
    enabled: Boolean(teamId),
    staleTime: 60_000,
  });

  const sourceDisplayName = firestoreUser?.displayName ?? user?.displayName ?? "";

  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [nameValidationError, setNameValidationError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [shareLocation, setShareLocation] = useState(true);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [confirmDeleteAccountOpen, setConfirmDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const displayNameInput = displayNameDraft ?? sourceDisplayName;

  const teamDisplay = useMemo(() => {
    const mappedTeam = TEAM_MAPPINGS.find((team) => team.id === teamId);

    return {
      name: teamDoc?.name ?? mappedTeam?.name ?? "Unassigned Team",
      emoji: mappedTeam?.emoji ?? "🏟",
      colorHex: mappedTeam?.colorHex ?? "#2563EB",
    };
  }, [teamDoc?.name, teamId]);

  const memberSince = useMemo(() => {
    const joinedAt = firestoreUser?.joinedAt;
    return joinedAt ? formatMemberSinceLabel(joinedAt.toMillis()) : "Unknown";
  }, [firestoreUser?.joinedAt]);

  const rewards = useMemo(() => {
    const completed = firestoreUser?.totalChallengesCompleted ?? 0;

    if (completed < 1) {
      return [];
    }

    const baseDate = new Date();

    return [
      {
        name: "Food Credit",
        date: new Date(baseDate.getTime() - 5 * 86_400_000).toLocaleDateString(),
        status: "Available" as const,
      },
      {
        name: "Exclusive Zone Access",
        date: new Date(baseDate.getTime() - 14 * 86_400_000).toLocaleDateString(),
        status: "Claimed" as const,
      },
    ];
  }, [firestoreUser?.totalChallengesCompleted]);

  const profileStats = useMemo(() => {
    const challengesCompleted = firestoreUser?.totalChallengesCompleted ?? 0;

    return {
      totalPoints: firestoreUser?.totalPoints ?? 0,
      challengesCompleted,
      bestSpreadScore: Math.round(teamDoc?.currentSpreadScore ?? 0),
      eventsAttended: Math.max(0, Math.round(challengesCompleted / 3)),
    };
  }, [firestoreUser?.totalChallengesCompleted, firestoreUser?.totalPoints, teamDoc?.currentSpreadScore]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setShareLocation(window.localStorage.getItem(LOCATION_PREF_KEY) !== "false");
  }, []);

  useEffect(() => {
    if (!firestoreUser?.uid || displayNameDraft === null) {
      return;
    }

    const nextName = displayNameDraft.trim();
    const currentName = sourceDisplayName.trim();

    if (nextName === currentName) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const validation = UserProfileUpdateSchema.safeParse({ displayName: nextName });

      if (!validation.success) {
        setNameValidationError(
          validation.error.issues[0]?.message ?? "Invalid display name"
        );
        setSaveState("error");
        return;
      }

      setNameValidationError(null);
      setSaveState("saving");

      void updateDoc(userDoc(firestoreUser.uid), {
        displayName: validation.data.displayName,
      })
        .then(() => {
          setFirestoreUser({
            ...firestoreUser,
            displayName: validation.data.displayName,
          });
          setDisplayNameDraft(null);
          setSaveState("saved");
        })
        .catch(() => {
          setSaveState("error");
          setNameValidationError("Could not save display name");
        });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [displayNameDraft, firestoreUser, setFirestoreUser, sourceDisplayName]);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSaveState("idle");
    }, 2_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [saveState]);

  const handleLocationToggle = (nextValue: boolean) => {
    setShareLocation(nextValue);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCATION_PREF_KEY, String(nextValue));
    }
  };

  const handleConfirmSignOut = async () => {
    try {
      await signOut();
      setConfirmSignOutOpen(false);
      router.push("/login");
    } catch (signOutError) {
      toast.error(getErrorMessage(signOutError));
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setDeletingAccount(true);

    try {
      await deleteAccount();
      setConfirmDeleteAccountOpen(false);
      toast.success("Account deleted.");
      router.replace("/login");
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError));
    } finally {
      setDeletingAccount(false);
    }
  };

  const initials = getInitials(firestoreUser?.displayName ?? null, firestoreUser?.email ?? null);
  const activeTheme = theme ?? "system";

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your identity, rewards, and preferences.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <section className="nb-card bg-card p-5 text-center">
            <Avatar className="mx-auto size-16 border-2 border-border">
              <AvatarImage src={firestoreUser?.photoURL ?? undefined} />
              <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
            </Avatar>

            <h2 className="mt-3 text-xl font-bold">
              {firestoreUser?.displayName ?? "Anonymous Fan"}
            </h2>

            <div className="mt-3 flex justify-center">
              <TeamBadge
                teamName={teamDisplay.name}
                emoji={teamDisplay.emoji}
                colorHex={teamDisplay.colorHex}
                size="sm"
              />
            </div>

            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Member since {memberSince}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Points" value={profileStats.totalPoints} icon={Star} />
            <StatCard
              label="Challenges Completed"
              value={profileStats.challengesCompleted}
              icon={CheckCircle2}
            />
            <StatCard
              label="Best Spread Score"
              value={`${profileStats.bestSpreadScore}%`}
              icon={Target}
            />
            <StatCard
              label="Events Attended"
              value={profileStats.eventsAttended}
              icon={CalendarDays}
            />
          </div>

          <section className="nb-card bg-card p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
              YOUR REWARDS
            </p>

            {rewards.length === 0 ? (
              <EmptyState
                icon={Star}
                title="No rewards yet"
                description="No rewards yet. Win a challenge!"
              />
            ) : (
              <div className="mt-3 space-y-2">
                {rewards.map((reward) => (
                  <div
                    key={`${reward.name}-${reward.date}`}
                    className="flex items-center justify-between gap-2 border-2 border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-bold">{reward.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{reward.date}</p>
                    </div>
                    <Badge
                      className={
                        reward.status === "Available"
                          ? "rounded-none border-2 border-border bg-amber-400 px-2 py-1 text-xs font-bold text-black"
                          : "rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground"
                      }
                    >
                      {reward.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="nb-card bg-card p-5">
          <h3 className="text-lg font-black tracking-tight">Settings</h3>

          <div className="mt-4 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="displayName">
                Display Name
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="displayName"
                  value={displayNameInput}
                  aria-describedby="display-name-status"
                  aria-invalid={Boolean(nameValidationError)}
                  onChange={(event) => {
                    setDisplayNameDraft(event.target.value);
                    setNameValidationError(null);
                    setSaveState("idle");
                  }}
                  className="h-10 rounded-none border-2 border-border text-base"
                />
                {saveState === "saving" ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              <p
                id="display-name-status"
                className="mt-1 h-5 text-xs font-mono"
                aria-live={nameValidationError ? "assertive" : "polite"}
              >
                {nameValidationError ? (
                  <span className="text-destructive">{nameValidationError}</span>
                ) : saveState === "saved" ? (
                  <span className="text-emerald-600">Saved</span>
                ) : null}
              </p>
            </div>

            <div className="flex items-center justify-between border-2 border-border px-3 py-3">
              <div>
                <p className="text-sm font-bold">Share my location during challenges</p>
              </div>
              <Switch checked={shareLocation} onCheckedChange={handleLocationToggle} />
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Theme</p>
              <div className="inline-flex border-2 border-border">
                {[
                  { id: "light", label: "Light" },
                  { id: "system", label: "System" },
                  { id: "dark", label: "Dark" },
                ].map((option) => {
                  const active = activeTheme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTheme(option.id)}
                      className={
                        active
                          ? "border-r-2 border-border bg-foreground px-4 py-2 text-sm font-bold text-background last:border-r-0"
                          : "border-r-2 border-border bg-card px-4 py-2 text-sm font-bold last:border-r-0"
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmSignOutOpen(true)}
              className="nb-btn w-full rounded-none border-2 border-red-600 bg-white font-bold text-red-600"
            >
              Sign Out
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDeleteAccountOpen(true)}
              className="nb-btn w-full rounded-none border-2 border-destructive font-bold"
            >
              Delete Account
            </Button>
          </div>
        </section>
      </div>

      <Dialog open={confirmSignOutOpen} onOpenChange={setConfirmSignOutOpen}>
        <DialogContent className="rounded-none border-2 border-border bg-card p-5" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">Sign out?</DialogTitle>
            <DialogDescription>
              You will be returned to the login screen.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none border-2 border-border bg-card font-bold"
              onClick={() => setConfirmSignOutOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="nb-btn w-full rounded-none border-2 border-red-600 bg-white font-bold text-red-600"
              onClick={() => {
                void handleConfirmSignOut();
              }}
            >
              Sign Out
            </Button>
          </div>

          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="size-3" />
            Your data remains stored securely in your account.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteAccountOpen} onOpenChange={setConfirmDeleteAccountOpen}>
        <DialogContent className="rounded-none border-2 border-border bg-card p-5" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">Delete account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account profile and signs you out immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none border-2 border-border bg-card font-bold"
              onClick={() => setConfirmDeleteAccountOpen(false)}
              disabled={deletingAccount}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="nb-btn w-full rounded-none border-2 border-destructive font-bold"
              disabled={deletingAccount}
              onClick={() => {
                void handleConfirmDeleteAccount();
              }}
            >
              {deletingAccount ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Account"
              )}
            </Button>
          </div>

          <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
            <TriangleAlert className="size-3" />
            This action cannot be undone.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
