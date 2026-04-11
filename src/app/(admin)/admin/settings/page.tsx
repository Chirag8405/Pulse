"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/firebase/auth";

interface HealthPayload {
  status?: string;
  service?: string;
  timestamp?: string;
  version?: string;
}

interface BootstrapPayload {
  isAdmin?: boolean;
  teamId?: string | null;
  error?: string;
}

function valueOrFallback(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "Not set";
}

function AdminSettingsContent() {
  const router = useRouter();
  const { user, firestoreUser, isAdmin } = useAuth();
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthPayload, setHealthPayload] = useState<HealthPayload | null>(null);
  const [isSyncingAccess, setIsSyncingAccess] = useState(false);
  const [bootstrapPayload, setBootstrapPayload] = useState<BootstrapPayload | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const runtimeMode =
    process.env.NEXT_PUBLIC_ENABLE_FIRESTORE_REALTIME_LISTENERS === "true"
      ? "Realtime listeners"
      : "API polling fallback";

  const pollInterval = process.env.NEXT_PUBLIC_FIRESTORE_POLL_INTERVAL_MS ?? "5000";

  const handleHealthCheck = async () => {
    setIsCheckingHealth(true);

    try {
      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as HealthPayload | null;

      if (!response.ok) {
        throw new Error("Health check failed");
      }

      setHealthPayload(payload);
      toast.success("Health check passed.");
    } catch (error) {
      setHealthPayload(null);
      toast.error(error instanceof Error ? error.message : "Health check failed");
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleAccessSync = async () => {
    if (!user) {
      toast.error("You must be signed in to sync admin access.");
      return;
    }

    setIsSyncingAccess(true);

    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/auth/bootstrap-user", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as BootstrapPayload | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Admin access sync failed.");
      }

      setBootstrapPayload(payload);
      toast.success("Admin access sync complete.");
    } catch (error) {
      setBootstrapPayload({
        error: error instanceof Error ? error.message : "Admin access sync failed.",
      });
      toast.error(error instanceof Error ? error.message : "Admin access sync failed.");
    } finally {
      setIsSyncingAccess(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOut();
      toast.success("Signed out.");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Operations Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Runtime mode, admin access sync, and service checks.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="nb-card bg-card p-4">
          <h2 className="text-xl font-black tracking-tight">Admin Session</h2>
          <div className="mt-3 space-y-2 font-mono text-xs">
            <p>
              <span className="font-bold">Email:</span> {valueOrFallback(user?.email)}
            </p>
            <p>
              <span className="font-bold">UID:</span> {valueOrFallback(user?.uid)}
            </p>
            <p>
              <span className="font-bold">Role:</span> {isAdmin ? "admin" : "attendee"}
            </p>
            <p>
              <span className="font-bold">Team:</span> {valueOrFallback(firestoreUser?.teamId ?? null)}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void handleAccessSync();
              }}
              disabled={isSyncingAccess}
              className="nb-btn rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
            >
              <ShieldCheck className="size-4" />
              {isSyncingAccess ? "Syncing..." : "Sync Admin Access"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void handleSignOut();
              }}
              disabled={isSigningOut}
              className="nb-btn rounded-none border-2 border-border bg-card font-bold"
            >
              <LogOut className="size-4" />
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>

          {bootstrapPayload ? (
            <div className="mt-3 border-2 border-border bg-muted p-2 font-mono text-xs">
              {bootstrapPayload.error ? (
                <p className="text-destructive">{bootstrapPayload.error}</p>
              ) : (
                <>
                  <p>isAdmin: {String(bootstrapPayload.isAdmin === true)}</p>
                  <p>teamId: {valueOrFallback(bootstrapPayload.teamId ?? null)}</p>
                </>
              )}
            </div>
          ) : null}
        </section>

        <section className="nb-card bg-card p-4">
          <h2 className="text-xl font-black tracking-tight">Runtime</h2>
          <div className="mt-3 space-y-2 font-mono text-xs">
            <p>
              <span className="font-bold">Data mode:</span> {runtimeMode}
            </p>
            <p>
              <span className="font-bold">Poll interval:</span> {pollInterval} ms
            </p>
            <p>
              <span className="font-bold">Long polling:</span>{" "}
              {process.env.NEXT_PUBLIC_FIREBASE_FORCE_LONG_POLLING === "true"
                ? "enabled"
                : "disabled"}
            </p>
            <p>
              <span className="font-bold">Persistence:</span>{" "}
              {process.env.NEXT_PUBLIC_ENABLE_FIRESTORE_PERSISTENCE === "true"
                ? "enabled"
                : "disabled"}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void handleHealthCheck();
              }}
              disabled={isCheckingHealth}
              className="nb-btn rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
            >
              <Activity className="size-4" />
              {isCheckingHealth ? "Checking..." : "Run Health Check"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
              className="nb-btn rounded-none border-2 border-border bg-card font-bold"
            >
              <RefreshCw className="size-4" />
              Reload Admin
            </Button>
          </div>

          {healthPayload ? (
            <div className="mt-3 border-2 border-border bg-muted p-2 font-mono text-xs">
              <p>status: {valueOrFallback(healthPayload.status)}</p>
              <p>service: {valueOrFallback(healthPayload.service)}</p>
              <p>version: {valueOrFallback(healthPayload.version)}</p>
              <p>timestamp: {valueOrFallback(healthPayload.timestamp)}</p>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default function AdminSettingsPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminSettingsContent />
    </AuthGuard>
  );
}
