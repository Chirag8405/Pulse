import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  icon: LucideIcon;
  description?: string;
  ariaLabel?: string;
}

function StatCardBase({
  label,
  value,
  delta,
  icon: Icon,
  description,
  ariaLabel,
}: StatCardProps) {
  const deltaTone =
    delta === undefined
      ? ""
      : delta >= 0
        ? "bg-emerald-500 text-white"
        : "bg-red-600 text-white";

  return (
    <section
      role="region"
      aria-label={ariaLabel ?? `${label} statistic`}
      className="nb-card bg-card p-4"
    >
      <div className="mb-4 flex items-start gap-2">
        {delta !== undefined ? (
          <span
            className={cn(
              "inline-flex border-2 border-border px-2 py-0.5 font-mono text-xs font-bold",
              deltaTone
            )}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        ) : (
          <span className="inline-flex h-6 items-center border-2 border-transparent px-2 py-0.5 font-mono text-xs" />
        )}

        <div className="ml-auto flex h-9 w-9 items-center justify-center border-2 border-border bg-amber-400">
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>

      <div className="text-3xl font-black leading-none">{value}</div>

      <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </section>
  );
}

export const StatCard = memo(StatCardBase);
