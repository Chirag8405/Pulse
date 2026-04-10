"use client";

import { AuthGuard } from "@/components/layout/AuthGuard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Zap } from "lucide-react";

export default function ChallengesPage() {
  return (
    <AuthGuard>
      <section className="nb-card mx-auto max-w-4xl bg-card p-6">
        <h1 className="text-3xl font-black tracking-tight">Challenges</h1>

        <EmptyState
          icon={Zap}
          title="No active challenge"
          description="Your next coordination challenge will appear here once venue ops launches it."
        />
      </section>
    </AuthGuard>
  );
}
