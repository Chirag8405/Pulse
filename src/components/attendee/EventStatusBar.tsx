import type { Event } from "@/types/firebase";

interface EventStatusBarProps {
  event: Event;
}

export function EventStatusBar({ event }: EventStatusBarProps) {
  return (
    <section className="nb-card flex w-full items-center justify-between gap-3 border-l-[4px] border-l-amber-400 bg-card px-4 py-3">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {event.venueName} • {event.matchDay}
        </p>
        <h2 className="text-lg font-black tracking-tight">
          {event.homeTeam} vs {event.awayTeam}
        </h2>
      </div>

      <span className="inline-flex items-center border-2 border-border bg-red-600 px-2 py-1 font-mono text-xs font-bold uppercase tracking-wide text-white">
        LIVE
        <span className="sr-only">Event is currently live</span>
      </span>
    </section>
  );
}
