import { ZONES, type ZoneId } from "@/constants";

export interface TeamMapping {
  id: string;
  zoneId: ZoneId;
  name: string;
  emoji: string;
  colorHex: string;
  sectionPattern: RegExp;
}

export const TEAM_MAPPINGS: TeamMapping[] = [
  {
    id: "team-north-wolves",
    zoneId: "zone-north",
    name: "North Stand Wolves",
    emoji: "🐺",
    colorHex: "#2563EB",
    sectionPattern: /^[A-B]$/,
  },
  {
    id: "team-south-lions",
    zoneId: "zone-south",
    name: "South Stand Lions",
    emoji: "🦁",
    colorHex: "#DC2626",
    sectionPattern: /^[C-D]$/,
  },
  {
    id: "team-east-falcons",
    zoneId: "zone-east",
    name: "East Stand Falcons",
    emoji: "🦅",
    colorHex: "#F59E0B",
    sectionPattern: /^[E-F]$/,
  },
  {
    id: "team-west-sharks",
    zoneId: "zone-west",
    name: "West Stand Sharks",
    emoji: "🦈",
    colorHex: "#0EA5E9",
    sectionPattern: /^[G-H]$/,
  },
  {
    id: "team-concourse-n-hawks",
    zoneId: "zone-concourse-n",
    name: "North Concourse Hawks",
    emoji: "🦉",
    colorHex: "#10B981",
    sectionPattern: /^[J-K]$/,
  },
  {
    id: "team-concourse-s-tigers",
    zoneId: "zone-concourse-s",
    name: "South Concourse Tigers",
    emoji: "🐯",
    colorHex: "#FB7185",
    sectionPattern: /^[L-M]$/,
  },
  {
    id: "team-entry-main-rhinos",
    zoneId: "zone-entry-main",
    name: "Main Entry Rhinos",
    emoji: "🦏",
    colorHex: "#7C3AED",
    sectionPattern: /^[N-P]$/,
  },
  {
    id: "team-entry-sec-panthers",
    zoneId: "zone-entry-sec",
    name: "Secondary Entry Panthers",
    emoji: "🐆",
    colorHex: "#059669",
    sectionPattern: /^[Q-Z]{1,2}$/,
  },
];

const ZONE_IDS = new Set(ZONES.map((zone) => zone.id));

export function getTeamForSeatSection(
  seatSection: string
): TeamMapping | null {
  const normalized = seatSection.toUpperCase();

  const matchingTeam = TEAM_MAPPINGS.find((team) =>
    team.sectionPattern.test(normalized)
  );

  if (matchingTeam) {
    return matchingTeam;
  }

  if (normalized.length === 0) {
    return null;
  }

  const orderedTeams = TEAM_MAPPINGS.filter((team) => ZONE_IDS.has(team.zoneId));
  const seed = normalized.charCodeAt(0);
  const fallbackTeam = orderedTeams[seed % orderedTeams.length];

  return fallbackTeam ?? null;
}
