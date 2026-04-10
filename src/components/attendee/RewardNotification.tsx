"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import type { Challenge } from "@/types/firebase";

interface RewardNotificationProps {
  challenge: Challenge | null;
  open: boolean;
  onDismiss: () => void;
}

const REWARD_EMOJI_MAP: Record<string, string> = {
  "Early Entry": "🚪",
  "Exclusive Zone Access": "🎟",
  "Food Credit": "🍔",
  "Meet & Greet Lottery": "🤝",
  "Stadium Tour": "🏟",
};

export function RewardNotification({
  challenge,
  open,
  onDismiss,
}: RewardNotificationProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }

    const timeoutId = window.setTimeout(() => {
      onDismiss();
    }, 8_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onDismiss, open]);

  if (!open || !challenge) {
    return null;
  }

  const rewardEmoji = REWARD_EMOJI_MAP[challenge.reward.type] ?? "🎉";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-blue-600/95 p-4 backdrop-blur-sm"
      aria-live="assertive"
      aria-atomic="true"
    >
      <section className="nb-card w-full max-w-md bg-card p-6 text-center">
        <p className="text-6xl" aria-hidden="true">
          {rewardEmoji}
        </p>
        <h3 className="mt-3 text-2xl font-black tracking-tight">{challenge.reward.type}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{challenge.reward.description}</p>
        <p className="mt-4 font-mono text-xs font-bold uppercase tracking-wider text-primary">
          Claim at Guest Services
        </p>

        <Button
          type="button"
          onClick={onDismiss}
          className="nb-btn mt-6 w-full rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
        >
          Dismiss
        </Button>
      </section>
    </div>
  );
}
