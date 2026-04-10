"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  endTime: Date;
  onExpire: () => void;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function CountdownTimer({ endTime, onExpire }: CountdownTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, endTime.getTime() - Date.now())
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener("change", updatePreference);
    };
  }, []);

  useEffect(() => {
    expiredRef.current = false;

    const updateRemaining = () => {
      const nextMs = Math.max(0, endTime.getTime() - Date.now());
      setRemainingMs(nextMs);

      if (nextMs === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };

    updateRemaining();

    const timer = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [endTime, onExpire]);

  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  const announcement =
    remainingSeconds === 120
      ? "2 minutes remaining"
      : remainingSeconds === 60
        ? "1 minute remaining"
        : remainingSeconds === 30
          ? "30 seconds remaining"
          : remainingSeconds === 0
            ? "Challenge timer ended"
            : "";

  return (
    <>
      <p
        className={cn(
          "font-mono text-4xl font-black tabular-nums",
          remainingSeconds < 30
            ? cn("text-red-600", !prefersReducedMotion && "nb-shake-critical")
            : remainingSeconds < 120
              ? "text-amber-600"
              : "text-foreground"
        )}
        aria-live="off"
      >
        {formatClock(remainingSeconds)}
      </p>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  );
}
