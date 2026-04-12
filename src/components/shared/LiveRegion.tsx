"use client";

import { type ReactNode } from "react";

interface LiveRegionProps {
  children: ReactNode;
  /** "polite" for non-urgent updates, "assertive" for critical alerts */
  politeness?: "polite" | "assertive";
  /** Additional CSS classes */
  className?: string;
  /** Whether to visually hide the region (still announced by screen readers) */
  visuallyHidden?: boolean;
}

/**
 * Accessible live region that announces dynamic content changes
 * to screen readers. Use for real-time data updates like
 * leaderboard changes, countdown ticks, and zone occupancy.
 */
export function LiveRegion({
  children,
  politeness = "polite",
  className = "",
  visuallyHidden = false,
}: LiveRegionProps) {
  return (
    <div
      aria-live={politeness}
      aria-atomic="true"
      role={politeness === "assertive" ? "alert" : "status"}
      className={visuallyHidden ? "sr-only" : className}
    >
      {children}
    </div>
  );
}
