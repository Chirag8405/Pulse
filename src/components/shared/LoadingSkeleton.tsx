"use client";

import { Skeleton } from "@/components/ui/skeleton";

type LoadingSkeletonVariant = "dashboard";

interface LoadingSkeletonProps {
  variant?: LoadingSkeletonVariant;
}

export function LoadingSkeleton({
  variant = "dashboard",
}: LoadingSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <main className="min-h-screen bg-background p-6">
        <section className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-10 w-56 rounded-none border-2 border-border" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 rounded-none border-2 border-border" />
            <Skeleton className="h-28 rounded-none border-2 border-border" />
            <Skeleton className="h-28 rounded-none border-2 border-border" />
          </div>
          <Skeleton className="h-64 rounded-none border-2 border-border" />
        </section>
      </main>
    );
  }

  return null;
}
