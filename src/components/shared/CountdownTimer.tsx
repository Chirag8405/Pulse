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
  const expiredRef = useRef(false);

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

  return (
    <p
      className={cn(
        "font-mono text-4xl font-black tabular-nums",
        remainingSeconds < 30
          ? "text-red-600 nb-shake-critical"
          : remainingSeconds < 120
            ? "text-amber-600"
            : "text-foreground"
      )}
      aria-live="polite"
    >
      {formatClock(remainingSeconds)}
    </p>
  );
}
