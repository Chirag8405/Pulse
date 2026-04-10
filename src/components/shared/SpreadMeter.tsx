import { cn } from "@/lib/utils";

interface SpreadMeterProps {
  value: number;
  target: number;
  label?: string;
  compact?: boolean;
}

function getFillTone(stepPercent: number): string {
  if (stepPercent <= 40) {
    return "bg-zinc-300";
  }

  if (stepPercent <= 70) {
    return "bg-amber-400";
  }

  return "bg-emerald-500";
}

export function SpreadMeter({
  value,
  target,
  label,
  compact = false,
}: SpreadMeterProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const clampedTarget = Math.max(0, Math.min(100, target));
  const targetStep = Math.max(0, Math.min(9, Math.ceil(clampedTarget / 10) - 1));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clampedValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-live="polite"
      aria-atomic="true"
      className="w-full"
    >
      <div className="relative mb-2">
        <div
          className="absolute -top-4 text-xs font-black"
          style={{ left: `calc(${(targetStep + 0.5) * 10}% - 5px)` }}
          aria-hidden="true"
        >
          ▼
        </div>

        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, index) => {
            const stepPercent = (index + 1) * 10;
            const filled = clampedValue >= stepPercent;

            return (
              <div
                key={index}
                className={cn(
                  "border-2 border-border",
                  compact ? "h-2" : "h-5",
                  filled ? getFillTone(stepPercent) : "bg-white"
                )}
                aria-hidden="true"
              />
            );
          })}
        </div>
      </div>

      <p className="font-mono text-sm font-bold">
        {label ?? `${Math.round(clampedValue)}% of ${Math.round(clampedTarget)}% target`}
      </p>

      <span className="sr-only">
        {Math.round(clampedValue)}% of {Math.round(clampedTarget)}% target achieved
      </span>
    </div>
  );
}
