"use client";

import { memo, type KeyboardEventHandler, type Ref } from "react";
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
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  buttonRef?: Ref<HTMLButtonElement>;
}

function ZoneCardBase({
  zone,
  memberCount,
  totalTeamMembers,
  isTarget,
  isCurrentUserHere,
  onClick,
  onKeyDown,
  buttonRef,
}: ZoneCardProps) {
  const spreadValue =
    totalTeamMembers > 0 ? Math.round((memberCount / totalTeamMembers) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      ref={buttonRef}
      className={cn(
        "nb-card nb-card-interactive w-full cursor-pointer bg-card text-left",
        isCurrentUserHere && "border-dashed border-primary"
      )}
    >
      <div
        className={cn(
          "relative border-b-2 border-border px-4 py-3",
          isTarget && "bg-amber-400 text-black"
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
              <MapPin className="size-3" aria-hidden="true" />
              You
            </span>
          ) : null}
        </div>

        {isTarget ? (
          <span className="sr-only">, this is a target zone for the current challenge</span>
        ) : null}
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

export const ZoneCard = memo(ZoneCardBase, (prevProps, nextProps) => {
  return (
    prevProps.zone.id === nextProps.zone.id &&
    prevProps.memberCount === nextProps.memberCount &&
    prevProps.isTarget === nextProps.isTarget
  );
});
