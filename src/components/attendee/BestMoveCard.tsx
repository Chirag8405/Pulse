import { CheckCircle2, MapPin } from "lucide-react";
import { ZONES } from "@/constants";
import { getBestMoveForAttendee } from "@/lib/recommender/challengeRecommender";
import { cn } from "@/lib/utils";

interface BestMoveCardProps {
  currentZoneId: string | null;
  memberLocations: Record<string, number>;
  targetZoneIds: string[];
}

export function BestMoveCard({
  currentZoneId,
  memberLocations,
  targetZoneIds,
}: BestMoveCardProps) {
  if (!currentZoneId) {
    return (
      <section className="nb-card border-2 border-border bg-card p-5">
        <p className="font-mono text-sm font-bold uppercase tracking-wider">Your Best Move</p>
        <p className="mt-3 text-sm font-bold">Select your zone to get a suggestion</p>
      </section>
    );
  }

  const bestMove = getBestMoveForAttendee({
    currentZoneId,
    teamMemberLocations: memberLocations,
    targetZoneIds,
  });

  const isStayHere = bestMove.suggestedZoneId === currentZoneId;
  const suggestedZone = ZONES.find((zone) => zone.id === bestMove.suggestedZoneId) ?? null;

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
          <MapPin className="mt-0.5 size-5 text-amber-700" aria-hidden="true" />
        )}

        <div className="space-y-1">
          <p className="text-sm font-bold">
            {isStayHere
              ? "You're in a great spot! Stay here."
              : `Move to ${suggestedZone?.name ?? bestMove.suggestedZoneId} via ${suggestedZone?.gate ?? "nearest gate"}`}
          </p>
          {!isStayHere ? (
            <p className="font-mono text-xs text-muted-foreground">
              {bestMove.reason}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
