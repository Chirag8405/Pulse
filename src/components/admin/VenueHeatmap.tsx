"use client";

import { useMemo } from "react";
import { ZONES } from "@/constants";
import { cn } from "@/lib/utils";

interface VenueHeatmapProps {
  countsByZone: Record<string, number>;
}

function getTileTone(utilization: number): string {
  if (utilization > 0.75) {
    return "bg-red-600 text-white";
  }

  if (utilization >= 0.5) {
    return "bg-amber-400 text-foreground";
  }

  if (utilization >= 0.25) {
    return "bg-emerald-400 text-foreground";
  }

  return "bg-muted text-foreground";
}

export default function VenueHeatmap({ countsByZone }: VenueHeatmapProps) {
  const tiles = useMemo(() => {
    return ZONES.map((zone) => {
      const occupancy = countsByZone[zone.id] ?? 0;
      const utilization = zone.capacity > 0 ? occupancy / zone.capacity : 0;

      return {
        zone,
        occupancy,
        utilization,
      };
    });
  }, [countsByZone]);

  return (
    <section className="nb-card bg-card p-4">
      <header className="mb-4">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Venue Heatmap
        </p>
        <p className="text-xs text-muted-foreground">
          Live concentration by zone and concourse.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <article key={tile.zone.id} className="border-2 border-border">
            <div className={cn("px-3 py-3", getTileTone(tile.utilization))}>
              <p className="truncate text-sm font-bold">{tile.zone.name}</p>
              <p className="mt-1 font-mono text-xs">{Math.round(tile.utilization * 100)}% utilization</p>
            </div>
            <div className="border-t-2 border-border px-3 py-2">
              <p className="font-mono text-xs text-muted-foreground">
                {tile.occupancy}/{tile.zone.capacity}
              </p>
              <p className="font-mono text-xs text-muted-foreground">{tile.zone.gate}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
