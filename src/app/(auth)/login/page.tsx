"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInAnonymously,
  signInWithGoogle,
} from "@/lib/firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { APP_NAME, APP_TAGLINE } from "@/constants";

type PendingMethod = "google" | "guest" | null;

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const [pendingMethod, setPendingMethod] = useState<PendingMethod>(null);

  const redirectPath = useMemo(() => {
    return searchParams.get("redirect") || "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push(redirectPath);
    }
  }, [isAuthenticated, loading, redirectPath, router]);

  const handleGoogleSignIn = useCallback(async () => {
    setPendingMethod("google");

    try {
      await signInWithGoogle();
      router.push(redirectPath);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPendingMethod(null);
    }
  }, [redirectPath, router]);

  const handleGuestSignIn = useCallback(async () => {
    setPendingMethod("guest");

    try {
      await signInAnonymously();
      router.push(redirectPath);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPendingMethod(null);
    }
  }, [redirectPath, router]);

  const isPending = pendingMethod !== null;

  return (
    <main
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
                Sign in with Google
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
                Joining as guest...
              </>
            ) : (
              "Continue as Guest"
            )}
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          By continuing, you agree to venue safety communications during live
          events.
        </p>
      </section>
    </main>
  );
}
