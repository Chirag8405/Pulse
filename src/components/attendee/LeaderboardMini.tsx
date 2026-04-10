import { TEAM_MAPPINGS } from "@/constants/teams";
import { TeamBadge } from "@/components/shared/TeamBadge";
import { cn } from "@/lib/utils";
import type { ChallengeTeamProgress } from "@/types/firebase";

interface LeaderboardMiniProps {
  rows: ChallengeTeamProgress[];
  yourTeamId: string | null;
}

function getTeamDisplay(teamId: string, index: number) {
  const mapped = TEAM_MAPPINGS.find((team) => team.id === teamId);

  if (mapped) {
    return mapped;
  }

  return {
    id: teamId,
    name: `Team ${index + 1}`,
    emoji: "🏟",
    colorHex: "#2563EB",
    zoneId: "zone-north",
    sectionPattern: /^A$/,
  };
}

export function LeaderboardMini({ rows, yourTeamId }: LeaderboardMiniProps) {
  const topRows = rows.slice(0, 5);

  return (
    <section className="nb-card mt-5 bg-card p-4">
      <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
        LEADERBOARD
      </h3>

      <div className="mt-3 space-y-2">
        {topRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leaderboard data yet.</p>
        ) : null}

        {topRows.map((row, index) => {
          const teamDisplay = getTeamDisplay(row.teamId, index);
          const isYourTeam = yourTeamId === row.teamId;

          return (
            <div
              key={row.teamId}
              className={cn(
                "grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 border-2 border-border px-2 py-2",
                isYourTeam &&
                  "bg-foreground text-background dark:bg-background dark:text-foreground"
              )}
            >
              <span className="font-mono text-xs font-bold">#{index + 1}</span>
              <TeamBadge
                teamName={teamDisplay.name}
                emoji={teamDisplay.emoji}
                colorHex={teamDisplay.colorHex}
                size="sm"
              />
              <span className="font-mono text-xs font-bold">{Math.round(row.spreadScore)}%</span>
              <span className="text-xs font-bold">
                {row.isCompleted ? "Completed" : "In Progress"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
