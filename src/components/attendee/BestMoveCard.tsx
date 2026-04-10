import { CheckCircle2, Route } from "lucide-react";
import { cn } from "@/lib/utils";

interface BestMoveCardProps {
  reason: string;
  isStayHere: boolean;
  suggestedZoneName: string;
  suggestedZoneGate: string;
}

export function BestMoveCard({
  reason,
  isStayHere,
  suggestedZoneName,
  suggestedZoneGate,
}: BestMoveCardProps) {
  return (
    <section
      className={cn(
        "nb-card p-5",
        isStayHere
          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
          : "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
      )}
    >
      <p className="font-mono text-sm font-bold uppercase tracking-wider">Your Best Move</p>

      <div className="mt-3 flex items-start gap-3">
        {isStayHere ? (
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" aria-hidden="true" />
        ) : (
          <Route className="mt-0.5 size-5 text-amber-700" aria-hidden="true" />
        )}

        <div className="space-y-1">
          <p className="text-sm font-bold">{reason}</p>
          {!isStayHere ? (
            <p className="font-mono text-xs text-muted-foreground">
              Move target: {suggestedZoneName} ({suggestedZoneGate})
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
