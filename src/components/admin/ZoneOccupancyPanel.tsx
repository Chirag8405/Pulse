"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { ZONES } from "@/constants";
import { cn } from "@/lib/utils";

type TrendDirection = "up" | "down" | "flat";

interface ZoneOccupancyPanelProps {
  countsByZone: Record<string, number>;
}

interface OccupancyWindow {
  previous: Record<string, number>;
  current: Record<string, number>;
}

function normalizeCounts(sourceCounts: Record<string, number>): Record<string, number> {
  return ZONES.reduce<Record<string, number>>((acc, zone) => {
    acc[zone.id] = sourceCounts[zone.id] ?? 0;
    return acc;
  }, {});
}

function getTrendDirection(currentValue: number, previousValue: number): TrendDirection {
  if (currentValue > previousValue) {
    return "up";
  }

  if (currentValue < previousValue) {
    return "down";
  }

  return "flat";
}

function getTrendIcon(direction: TrendDirection) {
  if (direction === "up") {
    return ArrowUpRight;
  }

  if (direction === "down") {
    return ArrowDownRight;
  }

  return ArrowRight;
}

function getUtilizationTone(utilization: number): string {
  if (utilization > 0.75) {
    return "bg-red-600";
  }

  if (utilization >= 0.5) {
    return "bg-amber-500";
  }

  return "bg-emerald-500";
}

function getRecommendation(zoneName: string, gate: string, utilization: number): string {
  if (utilization > 0.75) {
    return `${zoneName} is above 75% utilization. Route new entries through alternate gates and slow inflow via ${gate}.`;
  }

  if (utilization >= 0.5) {
    return `${zoneName} is approaching saturation. Keep ${gate} open and redirect overflow to adjacent concourse lanes.`;
  }

  return `${zoneName} has capacity headroom. Encourage redistribution through ${gate} to improve spread.`;
}

export function ZoneOccupancyPanel({ countsByZone }: ZoneOccupancyPanelProps) {
  const normalizedCounts = useMemo(() => normalizeCounts(countsByZone), [countsByZone]);

  const [windowSample, setWindowSample] = useState<OccupancyWindow>(() => ({
    previous: normalizedCounts,
    current: normalizedCounts,
  }));
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);

  const latestCountsRef = useRef(normalizedCounts);

  useEffect(() => {
    latestCountsRef.current = normalizedCounts;
  }, [normalizedCounts]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setWindowSample((previousWindow) => ({
        previous: previousWindow.current,
        current: latestCountsRef.current,
      }));
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const sortedRows = useMemo(() => {
    return ZONES.map((zone) => {
      const currentCount = windowSample.current[zone.id] ?? 0;
      const previousCount = windowSample.previous[zone.id] ?? 0;
      const utilization = zone.capacity > 0 ? currentCount / zone.capacity : 0;
      const trend = getTrendDirection(currentCount, previousCount);

      return {
        zone,
        currentCount,
        utilization,
        trend,
      };
    }).sort((left, right) => right.currentCount - left.currentCount);
  }, [windowSample]);

  return (
    <section className="nb-card bg-card p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          ZONE OCCUPANCY
        </h3>
        <span className="font-mono text-[11px] text-muted-foreground">30s refresh</span>
      </header>

      <div className="space-y-2">
        {sortedRows.map((row) => {
          const trendIcon = getTrendIcon(row.trend);
          const isExpanded = expandedZoneId === row.zone.id;
          const trendLabel =
            row.trend === "up"
              ? "Occupancy increasing"
              : row.trend === "down"
                ? "Occupancy decreasing"
                : "Occupancy steady";

          const TrendIcon = trendIcon;

          return (
            <div key={row.zone.id} className="border-2 border-border">
              <button
                type="button"
                onClick={() =>
                  setExpandedZoneId((currentZoneId) =>
                    currentZoneId === row.zone.id ? null : row.zone.id
                  )
                }
                className="w-full bg-card px-3 py-2 text-left hover:bg-muted/40"
              >
                <div className="mb-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{row.zone.name}</p>
                  <div className="inline-flex items-center gap-1 border-2 border-border px-2 py-0.5 font-mono text-xs font-bold">
                    <TrendIcon
                      className={cn(
                        "size-3",
                        row.trend === "up"
                          ? "text-emerald-600"
                          : row.trend === "down"
                            ? "text-red-600"
                            : "text-muted-foreground"
                      )}
                    />
                    <span>{trendLabel}</span>
                  </div>
                </div>

                <div className="mb-1 h-3 w-full border-2 border-border bg-muted">
                  <div
                    className={cn("h-full", getUtilizationTone(row.utilization))}
                    style={{ width: `${Math.max(4, Math.min(100, Math.round(row.utilization * 100)))}%` }}
                  />
                </div>

                <p className="font-mono text-xs text-muted-foreground">
                  {row.currentCount}/{row.zone.capacity}
                </p>
              </button>

              {isExpanded ? (
                <div className="border-t-2 border-border bg-amber-50 px-3 py-2 text-xs text-foreground dark:bg-zinc-950">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Gate Recommendation
                  </p>
                  <p className="mt-1 leading-relaxed">
                    {getRecommendation(row.zone.name, row.zone.gate, row.utilization)}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
