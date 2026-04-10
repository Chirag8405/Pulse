"use client";

import { MapPin } from "lucide-react";
import { SpreadMeter } from "@/components/shared/SpreadMeter";
import { cn } from "@/lib/utils";
import type { Zone } from "@/types";

interface ZoneCardProps {
  zone: Zone;
  memberCount: number;
  totalTeamMembers: number;
  isTarget: boolean;
  isCurrentUserHere: boolean;
  onClick: () => void;
}

export function ZoneCard({
  zone,
  memberCount,
  totalTeamMembers,
  isTarget,
  isCurrentUserHere,
  onClick,
}: ZoneCardProps) {
  const spreadValue =
    totalTeamMembers > 0 ? Math.round((memberCount / totalTeamMembers) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer border-2 border-border bg-card text-left shadow-[var(--nb-shadow)] transition-transform duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--nb-shadow-lg)]",
        isCurrentUserHere && "border-dashed border-primary"
      )}
    >
      <div
        className={cn(
          "relative border-b-2 border-border px-4 py-3",
          isTarget && "bg-amber-400"
        )}
      >
        {isTarget ? (
          <span
            className="pointer-events-none absolute inset-0 border-2 border-amber-600 nb-target-ring"
            aria-hidden="true"
          />
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold leading-tight">{zone.name}</h3>
            <p className="font-mono text-xs text-muted-foreground">{zone.gate}</p>
          </div>

          {isCurrentUserHere ? (
            <span className="inline-flex items-center gap-1 border-2 border-primary bg-accent px-2 py-1 font-mono text-[11px] font-bold text-primary">
              <MapPin className="size-3" />
              You
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        <SpreadMeter value={spreadValue} target={75} compact label={`${spreadValue}% occupancy`} />

        <div className="inline-flex border-2 border-border bg-muted px-2 py-1 font-mono text-xs font-bold">
          {memberCount} teammates here
        </div>
      </div>
    </button>
  );
}
