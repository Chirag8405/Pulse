"use client";

import { useCallback, useEffect } from "react";
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
  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined" && challenge) {
      window.localStorage.setItem(`pulse_seen_reward_${challenge.id}`, "1");
    }

    onDismiss();
  }, [challenge, onDismiss]);

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
      handleDismiss();
    }, 8_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [handleDismiss, open]);

  if (!open || !challenge) {
    return null;
  }

  const rewardEmoji = REWARD_EMOJI_MAP[challenge.reward.type] ?? "🎉";

  return (
    <div
      className="fixed inset-0 z-50 bg-blue-600/95 p-4 backdrop-blur-sm"
      aria-live="assertive"
      aria-atomic="true"
    >
      <section className="nb-card mx-auto mt-32 w-full max-w-sm bg-card p-6 text-center">
        <p className="text-6xl" aria-hidden="true">
          {rewardEmoji}
        </p>
        <h3 className="mt-3 text-2xl font-black tracking-tight">{challenge.reward.description}</h3>
        <p className="mt-4 font-mono text-xs font-bold uppercase tracking-wider text-primary">
          Claim at the Guest Services counter near Gate 1
        </p>

        <Button
          type="button"
          onClick={handleDismiss}
          className="nb-btn mt-6 w-full rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
        >
          Got it!
        </Button>
      </section>
    </div>
  );
}
