"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreateUser } from "@/lib/firebase/helpers";
import { getErrorMessage } from "@/lib/shared/errorUtils";
import { useAuthStore } from "@/stores/authStore";

const getAccessDeniedErrorMessage = (error: unknown) =>
  getErrorMessage(error, "Could not refresh access status.");

export function AccessDenied() {
  const { user, isAdmin } = useAuth();
  const setFirestoreUser = useAuthStore((state) => state.setFirestoreUser);
  const currentUid = user?.uid ?? "unknown";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-pulse";
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const autoRefreshAttemptedRef = useRef(false);

  const recheckAccess = useCallback(async () => {
    if (!user) {
      return;
    }

    setRefreshing(true);
    setRefreshError(null);

    try {
      const syncedUser = await getOrCreateUser(user);
      setFirestoreUser(syncedUser);
    } catch (error) {
      setRefreshError(getAccessDeniedErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }, [setFirestoreUser, user]);

  useEffect(() => {
    if (!user?.uid || autoRefreshAttemptedRef.current) {
      return;
    }

    autoRefreshAttemptedRef.current = true;
    void recheckAccess();
  }, [recheckAccess, user?.uid]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="nb-card w-full max-w-md bg-card p-8 text-center">
        <ShieldOff className="mx-auto mb-4 size-14 text-muted-foreground" />
        <h1 className="text-3xl font-black tracking-tight">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is for venue staff only. Audience accounts should use the attendee dashboard.
        </p>
        <p className="mt-2 border-2 border-border bg-muted px-3 py-2 text-left font-mono text-[11px] text-foreground">
          Signed-in UID: {currentUid}
          <br />
          Firebase project: {projectId}
          <br />
          App computed isAdmin: {String(isAdmin)}
          <br />
          Required: users/{currentUid}.isAdmin = true
        </p>
        <button
          type="button"
          onClick={() => {
            void recheckAccess();
          }}
          disabled={refreshing || !user?.uid}
          className="nb-btn mt-3 inline-flex w-full items-center justify-center border-2 border-border bg-muted px-4 py-2 font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          {refreshing ? "Re-checking Staff Access..." : "Re-check Staff Access"}
        </button>
        {refreshError ? (
          <p className="mt-2 text-xs text-red-600">{refreshError}</p>
        ) : null}
        <div className="mt-6 space-y-2">
          <Link
            href="/dashboard"
            className="nb-btn inline-flex w-full items-center justify-center border-2 border-border bg-primary px-4 py-2 font-bold text-primary-foreground"
          >
            Go to Attendee Dashboard
          </Link>
          <Link
            href="/login?redirect=%2Fdashboard"
            className="nb-btn inline-flex w-full items-center justify-center border-2 border-border bg-muted px-4 py-2 font-bold text-foreground"
          >
            Sign In as Audience
          </Link>
        </div>
      </section>
    </div>
  );
}
