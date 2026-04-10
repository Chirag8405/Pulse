"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { ZONES, type ZoneId } from "@/constants";
import { ZoneCard } from "@/components/shared/ZoneCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Zone } from "@/types";

interface ZoneMapProps {
  memberCountsByZone: Record<string, number>;
  targetZoneIds: string[];
  currentZoneId: string | null;
  totalTeamMembers: number;
  onSetCurrentZone?: (zoneId: ZoneId) => void;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isDesktop;
}

function ZoneDetailContent({
  zone,
  memberCount,
  occupancyPercent,
  isCurrentZone,
  onSetCurrentZone,
}: {
  zone: Zone;
  memberCount: number;
  occupancyPercent: number;
  isCurrentZone: boolean;
  onSetCurrentZone?: (zoneId: ZoneId) => void;
}) {
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${zone.lat},${zone.lng}`;

  return (
    <div className="space-y-3">
      <DialogHeader>
        <DialogTitle className="text-xl font-black tracking-tight">{zone.name}</DialogTitle>
        <DialogDescription className="font-mono text-xs">Gate: {zone.gate}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2 border-y-2 border-border py-3 text-sm">
        <p>
          Current occupancy: <span className="font-bold">{occupancyPercent}%</span>
        </p>
        <p>
          Teammates in zone: <span className="font-bold">{memberCount}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={mapLink}
          target="_blank"
          rel="noreferrer"
          className="nb-btn inline-flex items-center gap-1 border-2 border-border bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
        >
          <MapPin className="size-4" />
          Open Map Link
        </a>

        {onSetCurrentZone ? (
          <Button
            type="button"
            variant="outline"
            disabled={isCurrentZone}
            onClick={() => onSetCurrentZone(zone.id as ZoneId)}
            className="nb-btn rounded-none border-2 border-border bg-card"
          >
            {isCurrentZone ? "Current Zone" : "Set as My Zone"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ZoneMap({
  memberCountsByZone,
  targetZoneIds,
  currentZoneId,
  totalTeamMembers,
  onSetCurrentZone,
}: ZoneMapProps) {
  const isDesktop = useIsDesktop();
  const [selectedZoneId, setSelectedZoneId] = useState<ZoneId | null>(null);

  const selectedZone = useMemo(
    () => ZONES.find((zone) => zone.id === selectedZoneId) ?? null,
    [selectedZoneId]
  );

  const open = selectedZoneId !== null;

  const detailContent = selectedZone ? (
    <ZoneDetailContent
      zone={selectedZone}
      memberCount={memberCountsByZone[selectedZone.id] ?? 0}
      occupancyPercent={Math.round(
        ((memberCountsByZone[selectedZone.id] ?? 0) /
          Math.max(1, totalTeamMembers)) *
          100
      )}
      isCurrentZone={currentZoneId === selectedZone.id}
      onSetCurrentZone={onSetCurrentZone}
    />
  ) : null;

  return (
    <section className="space-y-3">
      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Zone Map
      </h3>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ZONES.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            memberCount={memberCountsByZone[zone.id] ?? 0}
            totalTeamMembers={Math.max(1, totalTeamMembers)}
            isTarget={targetZoneIds.includes(zone.id)}
            isCurrentUserHere={currentZoneId === zone.id}
            onClick={() => setSelectedZoneId(zone.id)}
          />
        ))}
      </div>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && setSelectedZoneId(null)}>
          <DialogContent className="rounded-none border-2 border-border bg-card p-5">
            {detailContent}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && setSelectedZoneId(null)}>
          <SheetContent
            side="bottom"
            className="max-h-[80vh] rounded-none border-t-2 border-border bg-card p-5"
          >
            {detailContent}
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}
