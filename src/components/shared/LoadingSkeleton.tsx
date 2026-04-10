"use client";

import { Skeleton } from "@/components/ui/skeleton";

type LoadingSkeletonVariant =
  | "dashboard"
  | "challenge"
  | "leaderboard"
  | "admin";

interface LoadingSkeletonProps {
  variant?: LoadingSkeletonVariant;
}

export function LoadingSkeleton({
  variant = "dashboard",
}: LoadingSkeletonProps) {
  const skeletonTone = "rounded-none border-2 border-border";

  if (variant === "challenge") {
    return (
      <section className="w-full border-2 border-border bg-card p-4">
        <div className="space-y-3">
          <Skeleton className={`h-8 w-40 ${skeletonTone}`} />
          <Skeleton className={`h-16 w-full ${skeletonTone}`} />
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className={`h-4 w-full ${skeletonTone}`} />
            ))}
          </div>
          <Skeleton className={`h-11 w-48 ${skeletonTone}`} />
        </div>
      </section>
    );
  }

  if (variant === "leaderboard") {
    return (
      <section className="w-full border-2 border-border bg-card p-4">
        <div className="space-y-3">
          <Skeleton className={`h-8 w-52 ${skeletonTone}`} />
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-2">
              <Skeleton className={`h-10 ${skeletonTone}`} />
              <Skeleton className={`h-10 w-20 ${skeletonTone}`} />
              <Skeleton className={`h-10 w-16 ${skeletonTone}`} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (variant === "admin") {
    return (
      <section className="w-full border-2 border-border bg-card p-4">
        <div className="space-y-4">
          <Skeleton className={`h-9 w-64 ${skeletonTone}`} />
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className={`h-24 ${skeletonTone}`} />
            <Skeleton className={`h-24 ${skeletonTone}`} />
            <Skeleton className={`h-24 ${skeletonTone}`} />
          </div>
          <Skeleton className={`h-56 ${skeletonTone}`} />
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <section className="mx-auto max-w-5xl border-2 border-border bg-card p-4">
        <div className="space-y-4">
          <Skeleton className={`h-10 w-56 ${skeletonTone}`} />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className={`h-28 ${skeletonTone}`} />
            <Skeleton className={`h-28 ${skeletonTone}`} />
            <Skeleton className={`h-28 ${skeletonTone}`} />
          </div>
          <Skeleton className={`h-64 ${skeletonTone}`} />
        </div>
      </section>
    </main>
  );
}
