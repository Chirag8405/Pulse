"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInAnonymously,
  signInWithGoogle,
} from "@/lib/firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { APP_NAME, APP_TAGLINE } from "@/constants";
import { getErrorMessage } from "@/lib/shared/errorUtils";

type PendingMethod = "google" | "guest" | null;

interface FirebaseAuthErrorLike {
  code?: string;
  message?: string;
}

function GoogleGIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6395-.0573-1.2536-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7968 2.715v2.2582h2.9086c1.7027-1.5677 2.6846-3.8773 2.6846-6.6141z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1818l-2.9086-2.2582c-.8059.54-1.8368.8591-3.0478.8591-2.3441 0-4.3282-1.5827-5.0368-3.7091H.9568v2.3318C2.4377 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.9632 10.7091A5.4121 5.4121 0 0 1 3.6818 9c0-.5932.1018-1.1686.2814-1.7091V4.9591H.9568A8.996 8.996 0 0 0 0 9c0 1.4523.3482 2.8277.9568 4.0409l3.0064-2.3318z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5809c1.3214 0 2.5077.4541 3.44 1.3459l2.5818-2.5818C13.4632.8918 11.43 0 9 0 5.4818 0 2.4377 2.0168.9568 4.9591l3.0064 2.3318C4.6718 5.1636 6.6559 3.5809 9 3.5809z"
      />
    </svg>
  );
}

function getAuthPageErrorMessage(error: unknown): string {
  const authError = error as FirebaseAuthErrorLike;

  if (authError.code === "auth/popup-blocked") {
    return "Popup was blocked. Please allow popups for this site.";
  }

  return getErrorMessage(error, "Authentication failed. Please try again.");
}

function LoginFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
      style={{
        backgroundImage:
          "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <section className="w-full max-w-sm border-2 border-black bg-card p-6 shadow-[4px_4px_0px_0px_rgb(0_0_0)]">
        <h1 className="font-mono text-4xl font-black tracking-tight text-primary">
          {APP_NAME}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Loading login...</p>
      </section>
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestoreUser, isAuthenticated, isAdmin, loading } = useAuth();
  const [pendingMethod, setPendingMethod] = useState<PendingMethod>(null);
  const lastRedirectDestinationRef = useRef<string | null>(null);
  const hasShownNonAdminToastRef = useRef(false);

  const requestedRedirect = useMemo(() => {
    return searchParams.get("redirect") || "";
  }, [searchParams]);

  const isAdminTarget = useMemo(() => {
    return requestedRedirect === "/admin" || requestedRedirect.startsWith("/admin/");
  }, [requestedRedirect]);

  const postLoginDestination = useMemo(() => {
    if (isAdmin) {
      return "/admin";
    }

    return firestoreUser?.teamId ? "/dashboard" : "/join";
  }, [firestoreUser?.teamId, isAdmin]);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      return;
    }

    if (isAdminTarget && !isAdmin && !hasShownNonAdminToastRef.current) {
      hasShownNonAdminToastRef.current = true;
      toast("Signed in as attendee", {
        description:
          "Your account does not have venue staff access. Redirecting to attendee flow.",
      });
    }

    if (lastRedirectDestinationRef.current === postLoginDestination) {
      return;
    }

    lastRedirectDestinationRef.current = postLoginDestination;

    router.replace(postLoginDestination);
  }, [isAdmin, isAdminTarget, isAuthenticated, loading, postLoginDestination, router]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    lastRedirectDestinationRef.current = null;
    hasShownNonAdminToastRef.current = false;
  }, [isAuthenticated]);

  const handleGoogleSignIn = useCallback(async () => {
    setPendingMethod("google");

    try {
      await signInWithGoogle({
        clearExistingSession: true,
        forceAccountSelection: true,
      });
    } catch (error) {
      toast.error(getAuthPageErrorMessage(error));
    } finally {
      setPendingMethod(null);
    }
  }, []);

  const handleGuestSignIn = useCallback(async () => {
    setPendingMethod("guest");

    try {
      await signInAnonymously();
    } catch (error) {
      toast.error(getAuthPageErrorMessage(error));
    } finally {
      setPendingMethod(null);
    }
  }, []);

  const isPending = pendingMethod !== null;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
      style={{
        backgroundImage:
          "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <section className="w-full max-w-sm border-2 border-black bg-card p-6 shadow-[4px_4px_0px_0px_rgb(0_0_0)]">
        <h1 className="font-mono text-4xl font-black tracking-tight text-primary">
          {APP_NAME}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">{APP_TAGLINE}</p>
        <p className="mt-3 border-2 border-border bg-muted px-3 py-2 text-xs text-foreground">
          {isAdminTarget
            ? "Requested area: Venue Staff. Non-admin accounts are automatically sent to the attendee dashboard."
            : "Requested area: Attendee."}
        </p>

        <div className="my-5 border-t-2 border-black" />

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isPending}
            aria-label="Sign in with Google account"
            className="nb-btn inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pendingMethod === "google" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <GoogleGIcon />
                Sign in with Google (Attendee or Staff)
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={isPending}
            aria-label="Continue as guest attendee"
            className="nb-btn inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-muted px-4 py-2 text-sm font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pendingMethod === "guest" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Joining as audience...
              </>
            ) : (
              "Continue as Audience (Guest)"
            )}
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Staff access requires your user to have <span className="font-mono">isAdmin=true</span>.
        </p>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          By continuing, you agree to venue safety communications during live
          events.
        </p>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
